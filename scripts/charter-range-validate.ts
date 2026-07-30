#!/usr/bin/env tsx
import { resolve } from "node:path";

import { validateCharterRange } from "./charter-validate.ts";

const [targetBase, sourceHead] = process.argv.slice(2);
if (!targetBase || !sourceHead) {
  process.stderr.write(
    "Usage: charter-range-validate.ts <target-base-sha> <source-head-sha>\n",
  );
  process.exit(1);
}
const errors = validateCharterRange(
  resolve(process.cwd()),
  targetBase,
  sourceHead,
);
if (errors.length > 0) {
  for (const error of errors) {
    process.stderr.write(`${error}\n`);
  }
  process.exit(1);
}
process.stdout.write(
  `Charter validation passed for ${targetBase}..${sourceHead}.\n`,
);
