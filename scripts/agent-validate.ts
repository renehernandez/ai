import { resolve } from "node:path";
import { validateAgentSource } from "./ax/agent-runtime.ts";

const result = validateAgentSource(resolve("agents"));
console.log(
  `Validated ${result.agentNames.length} agents with prompt contract ${result.promptContractVersion}.`,
);
