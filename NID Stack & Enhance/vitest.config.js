import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // jsdom provides DOM APIs so controller (DOM glue) tests can run in Node
    // without a real browser, while pure core modules import directly.
    environment: "jsdom",
    include: ["tests/**/*.{test,spec}.{js,mjs}", "src/**/*.{test,spec}.{js,mjs}"],
    globals: true
  }
});
