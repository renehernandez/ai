import ts from "typescript";
import { callName } from "./charter-validator-source.ts";

const readOnlyMethods = new Set([
  "at",
  "concat",
  "endsWith",
  "entries",
  "every",
  "filter",
  "find",
  "findIndex",
  "flat",
  "flatMap",
  "forEach",
  "has",
  "includes",
  "indexOf",
  "join",
  "keys",
  "lastIndexOf",
  "map",
  "match",
  "matchAll",
  "reduce",
  "reduceRight",
  "slice",
  "some",
  "startsWith",
  "substring",
  "substr",
  "toLocaleString",
  "toString",
  "trim",
  "trimEnd",
  "trimStart",
  "values",
]);

export function hasBindingMutation(node: ts.Node, name: string): boolean {
  let mutated = false;
  const visit = (candidate: ts.Node): void => {
    if (mutated) {
      return;
    }
    if (
      ts.isIdentifier(candidate) &&
      candidate.text === name &&
      !isDirectAssertionRoot(candidate)
    ) {
      mutated = true;
      return;
    }
    if (
      ts.isBinaryExpression(candidate) &&
      candidate.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      candidate.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      expressionRootName(candidate.left) === name
    ) {
      mutated = true;
      return;
    }
    if (
      (ts.isPrefixUnaryExpression(candidate) ||
        ts.isPostfixUnaryExpression(candidate)) &&
      (candidate.operator === ts.SyntaxKind.PlusPlusToken ||
        candidate.operator === ts.SyntaxKind.MinusMinusToken) &&
      expressionRootName(candidate.operand) === name
    ) {
      mutated = true;
      return;
    }
    if (
      ts.isDeleteExpression(candidate) &&
      expressionRootName(candidate.expression) === name
    ) {
      mutated = true;
      return;
    }
    if (
      ts.isCallExpression(candidate) &&
      !callName(candidate.expression).startsWith("assert.") &&
      candidate.arguments.some((argument) =>
        expressionReferencesTainted(argument, new Set([name])),
      )
    ) {
      mutated = true;
      return;
    }
    ts.forEachChild(candidate, visit);
  };
  visit(node);
  return mutated;
}

function isDirectAssertionRoot(identifier: ts.Identifier): boolean {
  const property = identifier.parent;
  return (
    ts.isPropertyAccessExpression(property) &&
    property.expression === identifier &&
    ts.isCallExpression(property.parent) &&
    property.parent.expression === property
  );
}

export function hasTaintedMutation(
  node: ts.Node,
  tainted: Set<string>,
): boolean {
  let mutated = false;
  const visit = (candidate: ts.Node): void => {
    if (mutated) {
      return;
    }
    if (candidate !== node && ts.isFunctionLike(candidate)) {
      if (expressionReferencesTainted(candidate, tainted)) {
        mutated = true;
      }
      return;
    }
    if (
      ts.isBinaryExpression(candidate) &&
      candidate.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      candidate.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      ((expressionRootName(candidate.left) !== undefined &&
        tainted.has(expressionRootName(candidate.left) ?? "")) ||
        expressionReferencesTainted(candidate.right, tainted))
    ) {
      mutated = true;
      return;
    }
    if (
      ts.isVariableDeclaration(candidate) &&
      candidate.initializer &&
      expressionReferencesTainted(candidate.initializer, tainted) &&
      !bindingIsFullyTainted(candidate.name, tainted)
    ) {
      mutated = true;
      return;
    }
    if (
      (ts.isPrefixUnaryExpression(candidate) ||
        ts.isPostfixUnaryExpression(candidate)) &&
      (candidate.operator === ts.SyntaxKind.PlusPlusToken ||
        candidate.operator === ts.SyntaxKind.MinusMinusToken) &&
      tainted.has(expressionRootName(candidate.operand) ?? "")
    ) {
      mutated = true;
      return;
    }
    if (
      ts.isDeleteExpression(candidate) &&
      tainted.has(expressionRootName(candidate.expression) ?? "")
    ) {
      mutated = true;
      return;
    }
    if (
      ts.isCallExpression(candidate) &&
      ts.isPropertyAccessExpression(candidate.expression) &&
      tainted.has(expressionRootName(candidate.expression.expression) ?? "") &&
      !readOnlyMethods.has(candidate.expression.name.text)
    ) {
      mutated = true;
      return;
    }
    if (
      ts.isCallExpression(candidate) &&
      !callName(candidate.expression).startsWith("assert.") &&
      candidate.arguments.some((argument) =>
        expressionReferencesTainted(argument, tainted),
      )
    ) {
      mutated = true;
      return;
    }
    if (
      (ts.isArrayLiteralExpression(candidate) ||
        ts.isObjectLiteralExpression(candidate)) &&
      expressionReferencesTainted(candidate, tainted) &&
      !(
        ts.isArrayLiteralExpression(candidate) &&
        ts.isForOfStatement(candidate.parent) &&
        candidate.parent.expression === candidate
      )
    ) {
      mutated = true;
      return;
    }
    if (
      ts.isNewExpression(candidate) &&
      candidate.arguments?.some((argument) =>
        expressionReferencesTainted(argument, tainted),
      )
    ) {
      mutated = true;
      return;
    }
    ts.forEachChild(candidate, visit);
  };
  visit(node);
  return mutated;
}

function bindingIsFullyTainted(
  binding: ts.BindingName,
  tainted: Set<string>,
): boolean {
  if (ts.isIdentifier(binding)) {
    return tainted.has(binding.text);
  }
  return binding.elements.every(
    (element) =>
      ts.isOmittedExpression(element) ||
      bindingIsFullyTainted(element.name, tainted),
  );
}

function expressionReferencesTainted(
  node: ts.Node,
  tainted: Set<string>,
): boolean {
  let referenced = false;
  const visit = (candidate: ts.Node): void => {
    if (referenced) {
      return;
    }
    if (ts.isIdentifier(candidate) && tainted.has(candidate.text)) {
      referenced = true;
      return;
    }
    ts.forEachChild(candidate, visit);
  };
  visit(node);
  return referenced;
}

function expressionRootName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  if (
    ts.isPropertyAccessExpression(expression) ||
    ts.isElementAccessExpression(expression)
  ) {
    return expressionRootName(expression.expression);
  }
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    return expressionRootName(expression.expression);
  }
  return undefined;
}
