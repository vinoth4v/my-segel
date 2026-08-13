import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    // Same "@/" alias tsconfig gives the app. Without it a unit test can only
    // cover modules that happen to import nothing, which is the opposite of
    // what is worth testing.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
})
