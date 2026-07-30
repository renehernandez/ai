import ts from "typescript";

export function forEachExecutedChild(
  node: ts.Node,
  visit: (child: ts.Node) => void,
): void {
  if (ts.isBlock(node)) {
    for (const statement of node.statements) {
      visit(statement);
      if (statementAlwaysAbrupt(statement)) {
        break;
      }
    }
    return;
  }
  if (ts.isTryStatement(node)) {
    if (
      !node.catchClause &&
      (!node.finallyBlock || !containsAbruptCompletion(node.finallyBlock))
    ) {
      visit(node.tryBlock);
    }
    return;
  }
  if (ts.isSwitchStatement(node)) {
    visit(node.expression);
    return;
  }
  if (ts.isIfStatement(node)) {
    visit(node.expression);
    const condition = staticBoolean(node.expression);
    if (condition === true) {
      visit(node.thenStatement);
    }
    if (condition === false && node.elseStatement) {
      visit(node.elseStatement);
    }
    return;
  }
  if (ts.isConditionalExpression(node)) {
    visit(node.condition);
    const condition = staticBoolean(node.condition);
    if (condition === true) {
      visit(node.whenTrue);
    }
    if (condition === false) {
      visit(node.whenFalse);
    }
    return;
  }
  if (ts.isBinaryExpression(node)) {
    visit(node.left);
    const left = staticBoolean(node.left);
    const operator = node.operatorToken.kind;
    if (
      (operator !== ts.SyntaxKind.AmpersandAmpersandToken &&
        operator !== ts.SyntaxKind.BarBarToken) ||
      (operator === ts.SyntaxKind.AmpersandAmpersandToken && left === true) ||
      (operator === ts.SyntaxKind.BarBarToken && left === false)
    ) {
      visit(node.right);
    }
    return;
  }
  if (ts.isWhileStatement(node)) {
    visit(node.expression);
    if (staticBoolean(node.expression) === true) {
      visit(node.statement);
    }
    return;
  }
  if (ts.isDoStatement(node)) {
    visit(node.statement);
    return;
  }
  if (ts.isForStatement(node)) {
    if (node.initializer) {
      visit(node.initializer);
    }
    if (node.condition) {
      visit(node.condition);
    }
    if (!node.condition || staticBoolean(node.condition) === true) {
      visit(node.statement);
    }
    return;
  }
  if (ts.isForOfStatement(node)) {
    visit(node.initializer);
    visit(node.expression);
    if (
      (ts.isArrayLiteralExpression(node.expression) &&
        node.expression.elements.some(
          (element) =>
            !ts.isSpreadElement(element) && !ts.isOmittedExpression(element),
        )) ||
      (ts.isStringLiteralLike(node.expression) &&
        node.expression.text.length > 0)
    ) {
      visit(node.statement);
    }
    return;
  }
  if (ts.isForInStatement(node)) {
    visit(node.initializer);
    visit(node.expression);
    return;
  }
  ts.forEachChild(node, visit);
}

function statementAlwaysAbrupt(statement: ts.Statement): boolean {
  if (
    ts.isReturnStatement(statement) ||
    ts.isThrowStatement(statement) ||
    ts.isBreakStatement(statement) ||
    ts.isContinueStatement(statement)
  ) {
    return true;
  }
  if (ts.isTryStatement(statement)) {
    return true;
  }
  if (ts.isBlock(statement)) {
    return statement.statements.some(statementAlwaysAbrupt);
  }
  if (ts.isIfStatement(statement)) {
    const condition = staticBoolean(statement.expression);
    if (condition === true) {
      return statementAlwaysAbrupt(statement.thenStatement);
    }
    if (condition === false) {
      return statement.elseStatement
        ? statementAlwaysAbrupt(statement.elseStatement)
        : false;
    }
    return (
      statementAlwaysAbrupt(statement.thenStatement) &&
      !!statement.elseStatement &&
      statementAlwaysAbrupt(statement.elseStatement)
    );
  }
  return false;
}

function containsAbruptCompletion(node: ts.Node): boolean {
  let found = false;
  const visit = (candidate: ts.Node): void => {
    if (found || (candidate !== node && ts.isFunctionLike(candidate))) {
      return;
    }
    if (
      ts.isReturnStatement(candidate) ||
      ts.isThrowStatement(candidate) ||
      ts.isBreakStatement(candidate) ||
      ts.isContinueStatement(candidate)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(candidate, visit);
  };
  visit(node);
  return found;
}

function staticBoolean(expression: ts.Expression): boolean | undefined {
  if (expression.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (expression.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }
  if (
    ts.isPrefixUnaryExpression(expression) &&
    expression.operator === ts.SyntaxKind.ExclamationToken
  ) {
    const operand = staticBoolean(expression.operand);
    return operand === undefined ? undefined : !operand;
  }
  if (ts.isParenthesizedExpression(expression)) {
    return staticBoolean(expression.expression);
  }
  return undefined;
}
