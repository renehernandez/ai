import ts from "typescript";
import {
  assertionBindingIsSafe,
  isStaticExpectation,
} from "./charter-validator-assertion.ts";
import { forEachExecutedChild } from "./charter-validator-flow.ts";
import { hasTaintedMutation } from "./charter-validator-mutation.ts";
import {
  callName,
  type SourceBindingRequirement,
  sourceBindingExists,
  sourceBindingIsSafe,
} from "./charter-validator-source.ts";

type EvidenceRequirement = {
  binding?: SourceBindingRequirement;
  callee: RegExp;
  directSourceValue?: boolean;
  expectedText?: RegExp;
  text?: RegExp;
};

export type EvidenceBinding = {
  source: EvidenceRequirement;
  assertion: EvidenceRequirement;
};

export type ScenarioSyntax = {
  callback: ts.ArrowFunction | ts.FunctionExpression;
  source: ts.SourceFile;
};

export function hasBoundEvidence(
  scenario: ScenarioSyntax,
  binding: EvidenceBinding,
): boolean {
  if (!assertionBindingIsSafe(scenario.source)) {
    return false;
  }
  if (
    binding.source.binding &&
    (!sourceBindingExists(scenario.source, binding.source.binding) ||
      !sourceBindingIsSafe(scenario.source, binding.source.binding) ||
      callbackShadowsName(scenario.callback, binding.source.binding.name))
  ) {
    return false;
  }

  const executableCalls: ts.CallExpression[] = [];
  const declarations: ts.VariableDeclaration[] = [];
  const loops: ts.ForOfStatement[] = [];
  const visitExecutable = (node: ts.Node): void => {
    if (node !== scenario.callback.body && ts.isFunctionLike(node)) {
      return;
    }
    if (ts.isCallExpression(node)) {
      executableCalls.push(node);
    }
    if (ts.isVariableDeclaration(node)) {
      declarations.push(node);
    }
    if (ts.isForOfStatement(node)) {
      loops.push(node);
    }
    forEachExecutedChild(node, visitExecutable);
  };
  visitExecutable(scenario.callback.body);

  const assertions = executableCalls.filter((call) =>
    matchesCall(call, binding.assertion, scenario.source),
  );
  if (assertions.length === 0) {
    return false;
  }

  const bindingCounts = new Map<string, number>();
  for (const declaration of declarations) {
    countBindingNames(declaration.name, bindingCounts);
  }

  const tainted = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const declaration of declarations) {
      if (
        isConstDeclaration(declaration) &&
        declaration.initializer &&
        expressionDependsOnSource(
          declaration.initializer,
          binding.source,
          tainted,
          scenario.source,
          false,
        )
      ) {
        changed =
          addBindingNames(declaration.name, tainted, bindingCounts) || changed;
      }
    }
    for (const loop of loops) {
      if (
        ts.isVariableDeclarationList(loop.initializer) &&
        (loop.initializer.flags & ts.NodeFlags.Const) !== 0 &&
        expressionDependsOnSource(
          loop.expression,
          binding.source,
          tainted,
          scenario.source,
          false,
        )
      ) {
        for (const declaration of loop.initializer.declarations) {
          changed =
            addBindingNames(declaration.name, tainted, bindingCounts) ||
            changed;
        }
      }
    }
  }

  if (hasTaintedMutation(scenario.callback.body, tainted)) {
    return false;
  }

  return assertions.some((assertion) => {
    const testedValue = assertion.arguments[0];
    const assertionName = callName(assertion.expression);
    const expectedValue = assertion.arguments[1];
    if (
      binding.assertion.directSourceValue &&
      (!testedValue ||
        !isDirectSourceValue(
          testedValue,
          binding.source,
          tainted,
          scenario.source,
        ))
    ) {
      return false;
    }
    if (
      binding.assertion.expectedText &&
      (!expectedValue ||
        !binding.assertion.expectedText.test(
          expectedValue.getText(scenario.source),
        ))
    ) {
      return false;
    }
    if (
      /^assert\.(?:equal|deepEqual)$/.test(assertionName) &&
      (!expectedValue || !isStaticExpectation(expectedValue))
    ) {
      return false;
    }
    return (
      testedValue !== undefined &&
      expressionDependsOnSource(
        testedValue,
        binding.source,
        tainted,
        scenario.source,
        /^assert\.(?:throws|doesNotThrow)$/.test(assertionName),
      )
    );
  });
}

function isDirectSourceValue(
  node: ts.Expression,
  sourceRequirement: EvidenceRequirement,
  tainted: Set<string>,
  source: ts.SourceFile,
): boolean {
  const value = ts.isParenthesizedExpression(node) ? node.expression : node;
  return (
    (ts.isCallExpression(value) &&
      matchesCall(value, sourceRequirement, source)) ||
    (ts.isIdentifier(value) && tainted.has(value.text))
  );
}

function isConstDeclaration(declaration: ts.VariableDeclaration): boolean {
  return (
    ts.isVariableDeclarationList(declaration.parent) &&
    (declaration.parent.flags & ts.NodeFlags.Const) !== 0
  );
}

export function scenarioSyntax(
  content: string,
  namePrefix: string,
): ScenarioSyntax | undefined {
  const source = ts.createSourceFile(
    "scenario.ts",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  for (const statement of source.statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isCallExpression(statement.expression) ||
      callName(statement.expression.expression) !== "test"
    ) {
      continue;
    }
    const [name, callback] = statement.expression.arguments;
    if (
      !name ||
      !ts.isStringLiteralLike(name) ||
      !name.text.startsWith(namePrefix) ||
      !callback ||
      (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))
    ) {
      continue;
    }
    return { callback, source };
  }
  return undefined;
}

function expressionDependsOnSource(
  node: ts.Node,
  sourceRequirement: EvidenceRequirement,
  tainted: Set<string>,
  source: ts.SourceFile,
  descendIntoFunctions: boolean,
): boolean {
  const depends = (candidate: ts.Node): boolean => {
    if (
      ts.isCallExpression(candidate) &&
      matchesCall(candidate, sourceRequirement, source)
    ) {
      return true;
    }
    if (ts.isIdentifier(candidate)) {
      return tainted.has(candidate.text);
    }
    if (
      ts.isParenthesizedExpression(candidate) ||
      ts.isAsExpression(candidate) ||
      ts.isTypeAssertionExpression(candidate) ||
      ts.isNonNullExpression(candidate) ||
      ts.isAwaitExpression(candidate)
    ) {
      return depends(candidate.expression);
    }
    if (
      ts.isPrefixUnaryExpression(candidate) ||
      ts.isPostfixUnaryExpression(candidate)
    ) {
      return depends(candidate.operand);
    }
    if (ts.isPropertyAccessExpression(candidate)) {
      return depends(candidate.expression);
    }
    if (ts.isElementAccessExpression(candidate)) {
      return depends(candidate.expression);
    }
    if (ts.isArrayLiteralExpression(candidate)) {
      return candidate.elements.some(
        (element) =>
          !ts.isOmittedExpression(element) &&
          depends(ts.isSpreadElement(element) ? element.expression : element),
      );
    }
    if (ts.isCallExpression(candidate)) {
      return false;
    }
    if (ts.isBinaryExpression(candidate)) {
      return false;
    }
    if (ts.isConditionalExpression(candidate)) {
      return false;
    }
    if (
      descendIntoFunctions &&
      (ts.isArrowFunction(candidate) || ts.isFunctionExpression(candidate))
    ) {
      if (!ts.isBlock(candidate.body)) {
        return depends(candidate.body);
      }
      return (
        candidate.body.statements.length === 1 &&
        ((ts.isExpressionStatement(candidate.body.statements[0]) &&
          depends(candidate.body.statements[0].expression)) ||
          (ts.isReturnStatement(candidate.body.statements[0]) &&
            candidate.body.statements[0].expression !== undefined &&
            depends(candidate.body.statements[0].expression)))
      );
    }
    return false;
  };

  return depends(node);
}

function matchesCall(
  call: ts.CallExpression,
  requirement: EvidenceRequirement,
  source: ts.SourceFile,
): boolean {
  return (
    requirement.callee.test(callName(call.expression)) &&
    (!requirement.text || requirement.text.test(call.getText(source)))
  );
}

function callbackShadowsName(
  callback: ts.ArrowFunction | ts.FunctionExpression,
  name: string,
): boolean {
  let shadowed = callback.parameters.some((parameter) =>
    bindingContainsName(parameter.name, name),
  );
  const visit = (node: ts.Node): void => {
    if (shadowed) {
      return;
    }
    if (
      (ts.isVariableDeclaration(node) &&
        bindingContainsName(node.name, name)) ||
      ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
        node.name?.text === name)
    ) {
      shadowed = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(callback.body);
  return shadowed;
}

function bindingContainsName(binding: ts.BindingName, name: string): boolean {
  if (ts.isIdentifier(binding)) {
    return binding.text === name;
  }
  return binding.elements.some(
    (element) =>
      !ts.isOmittedExpression(element) &&
      bindingContainsName(element.name, name),
  );
}

function addBindingNames(
  name: ts.BindingName,
  bindings: Set<string>,
  counts: Map<string, number>,
): boolean {
  let changed = false;
  if (ts.isIdentifier(name)) {
    if (counts.get(name.text) === 1 && !bindings.has(name.text)) {
      bindings.add(name.text);
      return true;
    }
    return false;
  }
  for (const element of name.elements) {
    if (!ts.isOmittedExpression(element)) {
      changed = addBindingNames(element.name, bindings, counts) || changed;
    }
  }
  return changed;
}

function countBindingNames(
  name: ts.BindingName,
  counts: Map<string, number>,
): void {
  if (ts.isIdentifier(name)) {
    counts.set(name.text, (counts.get(name.text) ?? 0) + 1);
    return;
  }
  for (const element of name.elements) {
    if (!ts.isOmittedExpression(element)) {
      countBindingNames(element.name, counts);
    }
  }
}
