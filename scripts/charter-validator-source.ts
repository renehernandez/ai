import ts from "typescript";

export type SourceBindingRequirement = {
  allowedModules?: string[];
  forbidDynamicModuleAccess?: boolean;
  kind: "import" | "top-level-function";
  module?: string;
  name: string;
};

export function sourceBindingExists(
  source: ts.SourceFile,
  binding: SourceBindingRequirement,
): boolean {
  if (binding.kind === "top-level-function") {
    return source.statements.some(
      (statement) =>
        ts.isFunctionDeclaration(statement) &&
        statement.name?.text === binding.name,
    );
  }
  return (
    namedImportExists(source, binding.module ?? "", binding.name) &&
    (!binding.allowedModules ||
      importsAreRestricted(source, new Set(binding.allowedModules))) &&
    (!binding.forbidDynamicModuleAccess || !hasDynamicModuleAccess(source))
  );
}

export function sourceBindingIsSafe(
  source: ts.SourceFile,
  binding: SourceBindingRequirement,
): boolean {
  let safe = true;
  const visit = (node: ts.Node): void => {
    if (!safe) {
      return;
    }
    if (ts.isIdentifier(node) && node.text === binding.name) {
      const parent = node.parent;
      const isImportName =
        ts.isImportSpecifier(parent) &&
        parent.name === node &&
        (parent.propertyName?.text ?? parent.name.text) === binding.name;
      const isFunctionName =
        binding.kind === "top-level-function" &&
        ts.isFunctionDeclaration(parent) &&
        parent.name === node;
      const isDirectCall =
        ts.isCallExpression(parent) && parent.expression === node;
      if (!isImportName && !isFunctionName && !isDirectCall) {
        safe = false;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return safe;
}

function importsAreRestricted(
  source: ts.SourceFile,
  allowedModules: Set<string>,
): boolean {
  return source.statements.every(
    (statement) =>
      !ts.isImportDeclaration(statement) ||
      (statement.importClause !== undefined &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        allowedModules.has(statement.moduleSpecifier.text)),
  );
}

function hasDynamicModuleAccess(source: ts.SourceFile): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) {
      return;
    }
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        callName(node.expression) === "require" ||
        callName(node.expression) === "process.getBuiltinModule")
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function namedImportExists(
  source: ts.SourceFile,
  module: string,
  name: string,
): boolean {
  return source.statements.some((statement) => {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== module
    ) {
      return false;
    }
    return (
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings) &&
      statement.importClause.namedBindings.elements.some(
        (element) =>
          element.name.text === name &&
          (element.propertyName?.text ?? element.name.text) === name,
      )
    );
  });
}

export function callName(expression: ts.Expression): string {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  if (ts.isPropertyAccessExpression(expression)) {
    const owner = callName(expression.expression);
    return owner ? `${owner}.${expression.name.text}` : expression.name.text;
  }
  return "";
}
