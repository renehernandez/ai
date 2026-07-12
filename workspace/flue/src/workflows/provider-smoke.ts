import { defineAgent, defineWorkflow } from "@flue/runtime";
import * as v from "valibot";
import { registerOpenAICodexSubscription } from "../openai-codex-provider.ts";

const inputSchema = v.object({ nonce: v.string() });
const outputSchema = v.object({ nonce: v.string() });
const model = process.env.AX_FLUE_MODEL;
if (!model) throw new Error("AX_FLUE_MODEL is required");
const reasoning = process.env.AX_FLUE_REASONING ?? "low";
if (
  !v.is(v.picklist(["minimal", "low", "medium", "high", "xhigh"]), reasoning)
) {
  throw new Error("AX_FLUE_REASONING is invalid");
}
registerOpenAICodexSubscription(model);

const agent = defineAgent(() => ({
  model,
  thinkingLevel: reasoning,
  instructions:
    "Return the requested structured result exactly. Do not use tools.",
}));

export default defineWorkflow({
  agent,
  input: inputSchema,
  output: outputSchema,
  async run({ harness, input }) {
    const session = await harness.session();
    const response = await session.prompt(
      `Return this nonce unchanged: ${input.nonce}`,
      { result: outputSchema, thinkingLevel: reasoning },
    );
    return response.data;
  },
});
