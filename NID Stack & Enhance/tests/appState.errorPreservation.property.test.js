// Feature: nid-stack-enhance-redesign, Property 15: State preservation on reported error
//
// Property 15 (design.md): For any application state and any operation that
// reports an error to the user, the application state after the error — all
// previously produced images and all current settings — is identical to the
// state before the operation.
//
// **Validates: Requirements 12.5**

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  runOperation,
  createAppState,
  cloneState,
  FILTER_NAMES,
} from "../src/core/appState.js";

// ---------------------------------------------------------------------------
// Generators: build arbitrary-but-plausible AppState plain-data snapshots.
// ---------------------------------------------------------------------------

// A "buffer" is a host object reference in production (image/canvas). We model
// it here as either null or an opaque tagged object whose reference identity
// must be preserved across a no-op-on-error.
const bufferArb = fc.option(
  fc.record({ __buffer: fc.constant(true), id: fc.integer() }),
  { nil: null }
);

const cropArb = fc.option(
  fc.record({
    x: fc.integer({ min: 0, max: 5000 }),
    y: fc.integer({ min: 0, max: 5000 }),
    w: fc.integer({ min: 1, max: 5000 }),
    h: fc.integer({ min: 1, max: 5000 }),
  }),
  { nil: null }
);

const slotArb = fc.record({
  image: bufferArb,
  naturalWidth: fc.integer({ min: 0, max: 8000 }),
  naturalHeight: fc.integer({ min: 0, max: 8000 }),
  crop: cropArb,
});

const stateArb = fc.record({
  sources: fc.record({ front: slotArb, back: slotArb }),
  settings: fc.record({
    spacing: fc.integer({ min: -50, max: 200 }),
    backgroundColor: fc.constantFrom("#ffffff", "#000000", "#ff8800", "#123456"),
  }),
  adjustments: fc.record({
    brightness: fc.integer({ min: 0, max: 200 }),
    contrast: fc.integer({ min: 0, max: 200 }),
    saturation: fc.integer({ min: 0, max: 200 }),
    sharpness: fc.integer({ min: 0, max: 100 }),
  }),
  filter: fc.constantFrom(...FILTER_NAMES),
  combinedImage: bufferArb,
  adjustedBase: bufferArb,
  adjustedImage: bufferArb,
  ui: fc.record({
    exportCombinedVisible: fc.boolean(),
    exportAdjustedVisible: fc.boolean(),
    progressVisible: fc.boolean(),
    progressValue: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
  }),
});

// Error-reporting operations. Each receives the (clone of) current state and
// reports an error either by returning { ok: false } or by throwing. Some also
// attempt to mutate the draft first — those mutations must NOT leak into the
// preserved prior state.
const errorOperationArb = fc.oneof(
  // Plain explicit failure.
  fc.constant(() => ({ ok: false, message: "reported error" })),
  // Failure with extra payload.
  fc.constant(() => ({ ok: false, message: "validation failed", code: 42 })),
  // Mutate the draft, then report failure.
  fc.constant((draft) => {
    draft.settings.spacing = 9999;
    draft.filter = "grayscale";
    draft.sources.front.crop = { x: 1, y: 2, w: 3, h: 4 };
    draft.combinedImage = { __buffer: true, id: -1 };
    return { ok: false, message: "mutated then failed" };
  }),
  // Throw a plain Error.
  fc.constant(() => {
    throw new Error("boom");
  }),
  // Mutate the draft, then throw.
  fc.constant((draft) => {
    draft.adjustments.brightness = -1;
    draft.ui.progressVisible = true;
    throw new Error("mutated then threw");
  }),
  // Throw a non-Error value.
  fc.constant(() => {
    // eslint-disable-next-line no-throw-literal
    throw "string failure";
  })
);

describe("Property 15: state preservation on reported error", () => {
  it("standalone runOperation keeps the prior state identical when the operation reports an error", () => {
    fc.assert(
      fc.property(stateArb, errorOperationArb, (state, operation) => {
        const before = cloneState(state);
        const result = runOperation(state, operation);

        // The operation reported an error.
        expect(result.ok).toBe(false);
        expect(result.error).not.toBeNull();

        // Returned state is the unchanged prior state (same reference).
        expect(result.state).toBe(state);

        // The prior state's plain data is unchanged (no leaked mutations).
        expect(cloneState(result.state)).toEqual(before);
        expect(cloneState(state)).toEqual(before);
      }),
      { numRuns: 200 }
    );
  });

  it("store.runOperation leaves the store state unchanged when the operation reports an error", () => {
    fc.assert(
      fc.property(stateArb, errorOperationArb, (state, operation) => {
        const store = createAppState(state);
        const before = cloneState(store.getState());

        const result = store.runOperation(operation);

        expect(result.ok).toBe(false);
        // Store state still equals the pre-operation snapshot.
        expect(cloneState(store.getState())).toEqual(before);
      }),
      { numRuns: 200 }
    );
  });

  it("preserves host-object buffer references (images/canvases) across a reported error", () => {
    fc.assert(
      fc.property(stateArb, errorOperationArb, (state, operation) => {
        // Capture buffer references that should survive unchanged.
        const combinedRef = state.combinedImage;
        const adjustedBaseRef = state.adjustedBase;
        const adjustedImageRef = state.adjustedImage;
        const frontImageRef = state.sources.front.image;
        const backImageRef = state.sources.back.image;

        const result = runOperation(state, operation);

        expect(result.ok).toBe(false);
        expect(result.state.combinedImage).toBe(combinedRef);
        expect(result.state.adjustedBase).toBe(adjustedBaseRef);
        expect(result.state.adjustedImage).toBe(adjustedImageRef);
        expect(result.state.sources.front.image).toBe(frontImageRef);
        expect(result.state.sources.back.image).toBe(backImageRef);
      }),
      { numRuns: 200 }
    );
  });
});
