import { describe, it, expect } from "vitest";

// Smoke test confirming the Vitest + jsdom test infrastructure is wired up.
// Subsequent tasks add property tests (fast-check) and unit tests here and
// alongside the source modules.
describe("test infrastructure", () => {
  it("runs Vitest", () => {
    expect(1 + 1).toBe(2);
  });

  it("provides a jsdom DOM environment", () => {
    const el = document.createElement("div");
    el.textContent = "NID Stack & Enhance";
    document.body.appendChild(el);
    expect(document.body.querySelector("div")?.textContent).toBe(
      "NID Stack & Enhance"
    );
  });
});
