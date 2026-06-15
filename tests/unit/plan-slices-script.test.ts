import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

type TempPlan = {
  artifactRef: string;
  fingerprint: string;
};

function withTempPlan(callback: (plan: TempPlan) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "plan-slices-script-"));
  const artifactRef = join(directory, "plan.md");
  const content = "# Example Plan\n\n## Implementation Slices\n\n- Slice 1.\n";
  try {
    writeFileSync(artifactRef, content, "utf8");
    callback({
      artifactRef,
      fingerprint: createHash("sha256").update(content).digest("hex"),
    });
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function withTempReview(
  content: string,
  callback: (path: string) => void,
): void {
  const directory = mkdtempSync(join(tmpdir(), "plan-slices-review-"));
  const path = join(directory, "review.yaml");
  try {
    writeFileSync(path, content, "utf8");
    callback(path);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function runPlanSlices(
  command: string,
  args: string[] = [],
): { status: number | null; stderr: string; stdout: string } {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "tsx",
      "skills/plan-slices/scripts/plan-slices.ts",
      command,
      ...args,
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

function runValidateReview(content: string): {
  status: number | null;
  stderr: string;
  stdout: string;
} {
  let result: { status: number | null; stderr: string; stdout: string } | null =
    null;
  withTempReview(content, (path) => {
    result = runPlanSlices("validate-review", ["--file", path]);
  });
  assert.ok(result);
  return result;
}

function validReview(artifactRef: string, fingerprint: string): string {
  return `slice_plan_review:
  status: pass
  artifact_ref: ${artifactRef}
  artifact_fingerprint: ${fingerprint}
  mode: audit
  slices:
    - id: slice-01
      title: Example slice
      observable_outcome: pass
      bounded_scope: pass
      sequencing: pass
      verification: pass
      refactoring_reuse: pass
      delivery_fit: pass
  blocking_findings: []
  warnings: []
`;
}

test("fingerprint returns the current artifact sha256", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const result = runPlanSlices("fingerprint", [artifactRef]);

    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), fingerprint);
  });
});

test("validate-review accepts a current passing single-slice audit", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const result = runValidateReview(validReview(artifactRef, fingerprint));

    assert.equal(result.status, 0);
    assert.match(result.stdout, /slice_plan_review valid/);
  });
});

test("validate-review rejects stale artifact fingerprints", () => {
  withTempPlan(({ artifactRef }) => {
    const result = runValidateReview(validReview(artifactRef, "0".repeat(64)));

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /artifact_fingerprint must match current artifact_ref content/,
    );
  });
});

test("validate-review rejects unavailable artifact refs", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const result = runValidateReview(
      validReview(join(artifactRef, "missing.md"), fingerprint),
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /artifact_ref file is unavailable/);
  });
});

test("validate-review rejects slices missing required gates", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const result = runValidateReview(
      validReview(artifactRef, fingerprint).replace(
        "      delivery_fit: pass\n",
        "",
      ),
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /slices\[0\]\.delivery_fit is required/);
  });
});

test("validate-review rejects passing reviews with blocked gates", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const result = runValidateReview(
      validReview(artifactRef, fingerprint).replace(
        "      verification: pass",
        "      verification: blocked",
      ),
    );

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /pass reviews must not include blocked slice gates/,
    );
  });
});

test("validate-review accepts blocked reviews with concrete blocking evidence", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const result = runValidateReview(
      validReview(artifactRef, fingerprint)
        .replace("  status: pass", "  status: blocked")
        .replace("      delivery_fit: pass", "      delivery_fit: blocked")
        .replace(
          "  blocking_findings: []",
          "  blocking_findings:\n    - Slice is too broad",
        ),
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /slice_plan_review valid/);
  });
});

test("review-template includes the six mandatory slice gates", () => {
  const result = runPlanSlices("review-template");

  assert.equal(result.status, 0);
  assert.match(result.stdout, /first end-to-end sliver/);
  assert.match(result.stdout, /observable_outcome:/);
  assert.match(result.stdout, /bounded_scope:/);
  assert.match(result.stdout, /sequencing:/);
  assert.match(result.stdout, /verification:/);
  assert.match(result.stdout, /refactoring_reuse:/);
  assert.match(result.stdout, /delivery_fit:/);
});
