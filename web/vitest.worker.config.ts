import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "./worker/index.ts",
      wrangler: {
        configPath: "./wrangler.jsonc",
        environment: "preview",
      },
    }),
  ],
  test: {
    include: ["worker/**/*.integration.test.ts"],
  },
});
