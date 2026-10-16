import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    // These need a database: `npm run test:integration`
    exclude: ["**/node_modules/**", "src/**/*.integration.test.ts"],
  },
});
