const MODEL_RUNNER_ENVIRONMENT_ALLOWLIST = [
  "ANTHROPIC_API_KEY",
  "AWS_ACCESS_KEY_ID",
  "AWS_DEFAULT_REGION",
  "AWS_PROFILE",
  "AWS_REGION",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_ENDPOINT",
  "COHERE_API_KEY",
  "DEEPSEEK_API_KEY",
  "FIREWORKS_API_KEY",
  "GOOGLE_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GROQ_API_KEY",
  "HOME",
  "HTTPS_PROXY",
  "HTTP_PROXY",
  "LANG",
  "LC_ALL",
  "MISTRAL_API_KEY",
  "NODE_EXTRA_CA_CERTS",
  "NO_PROXY",
  "OPENAI_API_KEY",
  "OPENROUTER_API_KEY",
  "PATH",
  "PERPLEXITY_API_KEY",
  "SHELL",
  "SSL_CERT_FILE",
  "TERM",
  "TMPDIR",
  "TOGETHER_AI_API_KEY",
  "USER",
  "XAI_API_KEY",
] as const;

const SUBSCRIPTION_HOST_ENVIRONMENT_ALLOWLIST = [
  "HOME",
  "HTTPS_PROXY",
  "HTTP_PROXY",
  "LANG",
  "LC_ALL",
  "NODE_EXTRA_CA_CERTS",
  "NO_PROXY",
  "PATH",
  "SHELL",
  "SSL_CERT_FILE",
  "TERM",
  "TMPDIR",
  "USER",
] as const;

export function modelRunnerEnvironment(
  source: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  return Object.fromEntries(
    MODEL_RUNNER_ENVIRONMENT_ALLOWLIST.flatMap((name) =>
      source[name] === undefined ? [] : [[name, source[name]]],
    ),
  );
}

export function subscriptionHostEnvironment(
  source: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  return Object.fromEntries(
    SUBSCRIPTION_HOST_ENVIRONMENT_ALLOWLIST.flatMap((name) =>
      source[name] === undefined ? [] : [[name, source[name]]],
    ),
  );
}
