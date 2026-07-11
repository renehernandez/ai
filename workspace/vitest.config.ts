import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "workspace/wrangler.jsonc" },
      miniflare: {
        bindings: {
          AX_WORKSPACE_ENVIRONMENT: "test",
          AX_WORKSPACE_DEV_TOKEN: "test-token",
        },
      },
    }),
  ],
  test: {
    include: ["workspace/tests/**/*.test.ts"],
  },
});
