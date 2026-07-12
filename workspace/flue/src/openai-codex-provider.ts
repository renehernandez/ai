import { registerProvider } from "@flue/runtime";

const PROVIDER_PREFIX = "openai-codex/";

export function registerOpenAICodexSubscription(model: string): void {
  if (!model.startsWith(PROVIDER_PREFIX)) return;
  const accessToken = process.env.AX_OPENAI_CODEX_ACCESS_TOKEN;
  if (!accessToken)
    throw new Error("AX OpenAI Codex subscription authentication is required");
  registerProvider("openai-codex", { apiKey: accessToken });
}
