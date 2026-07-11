import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  generateAgentRolePoliciesSource,
  generateAgentValidatorsSource,
} from "./ax/generate-agent-validators.ts";

const target = resolve(
  "skills/agent-workspace/scripts/generated-validators.cjs",
);
writeFileSync(target, generateAgentValidatorsSource(resolve("agents")));
console.log(`Rendered ${target}.`);
const policiesTarget = resolve(
  "skills/agent-workspace/scripts/generated-role-policies.json",
);
writeFileSync(
  policiesTarget,
  generateAgentRolePoliciesSource(resolve("agents")),
);
console.log(`Rendered ${policiesTarget}.`);
