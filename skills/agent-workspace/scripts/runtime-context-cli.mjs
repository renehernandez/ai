#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { serializeRuntimeContext } from "./runtime-context.ts";

try {
  const input = JSON.parse(readFileSync(0, "utf-8"));
  process.stdout.write(`${JSON.stringify(serializeRuntimeContext(input))}\n`);
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
