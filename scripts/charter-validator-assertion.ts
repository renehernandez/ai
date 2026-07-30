import ts from "typescript";
import { hasBindingMutation } from "./charter-validator-mutation.ts";
import { callName } from "./charter-validator-source.ts";

export function assertionBindingIsSafe(source: ts.SourceFile): boolean {
  if (
    source.statements.some(
      (statement) =>
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === "node:assert",
    ) ||
    hasAssertionModuleCall(source)
  ) {
    return false;
  }
  const imports = source.statements.filter(
    (statement): statement is ts.ImportDeclaration =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "node:assert/strict",
  );
  if (imports.length !== 1) {
    return false;
  }
  const clause = imports[0].importClause;
  const canonical =
    (clause?.name?.text === "assert" && !clause.namedBindings) ||
    (!clause?.name &&
      !!clause?.namedBindings &&
      ts.isNamespaceImport(clause.namedBindings) &&
      clause.namedBindings.name.text === "assert");
  return (
    canonical &&
    source.statements.every(
      (statement) =>
        ts.isImportDeclaration(statement) ||
        !moduleStatementMutatesAssertion(statement),
    )
  );
}

export function isStaticExpectation(node: ts.Expression): boolean {
  if (
    ts.isStringLiteralLike(node) ||
    ts.isNumericLiteral(node) ||
    ts.isRegularExpressionLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword
  ) {
    return true;
  }
  if (ts.isPrefixUnaryExpression(node)) {
    return isStaticExpectation(node.operand);
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.every(
      (element) =>
        !ts.isSpreadElement(element) &&
        (ts.isOmittedExpression(element) || isStaticExpectation(element)),
    );
  }
  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.every(
      (property) =>
        ts.isPropertyAssignment(property) &&
        isStaticExpectation(property.initializer),
    );
  }
  return false;
}

function moduleStatementMutatesAssertion(statement: ts.Statement): boolean {
  if (
    ts.isExpressionStatement(statement) &&
    ts.isCallExpression(statement.expression) &&
    callName(statement.expression.expression) === "test"
  ) {
    return statement.expression.arguments.some(
      (argument) =>
        (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) &&
        hasBindingMutation(argument.body, "assert"),
    );
  }
  return hasBindingMutation(statement, "assert");
}

function hasAssertionModuleCall(source: ts.SourceFile): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) {
      return;
    }
    if (
      ts.isCallExpression(node) &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      /^(?:node:assert|node:assert\/strict)$/.test(node.arguments[0].text)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}
