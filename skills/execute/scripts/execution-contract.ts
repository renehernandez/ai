export type WorktreeIdentity = {
  branch: string;
  worktree: string;
  head: string;
  writer: string;
  diffFingerprint: string;
};

export function assertWriterOwnership(
  expected: WorktreeIdentity,
  observed: WorktreeIdentity,
): void {
  for (const field of [
    "branch",
    "worktree",
    "head",
    "writer",
    "diffFingerprint",
  ] as const) {
    if (expected[field] !== observed[field]) {
      throw new Error(`worktree_ownership_stale:${field}`);
    }
  }
}

export function finalDeliveryOrder(unitIds: string[]): string[] {
  const seen = new Set<string>();

  for (const unitId of unitIds) {
    if (!unitId.trim() || seen.has(unitId)) {
      throw new Error(`invalid_delivery_unit:${unitId}`);
    }
    seen.add(unitId);
  }

  return [...unitIds];
}
