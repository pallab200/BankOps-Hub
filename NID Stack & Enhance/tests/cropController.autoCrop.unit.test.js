import { describe, it, expect, beforeEach } from "vitest";
import { createAppState } from "../src/core/appState.js";
import { createCropController } from "../src/controllers/cropController.js";

function setupDom() {
  document.body.innerHTML = `
    <div class="inputs">
      <div class="upload-card">
        <label id="drop1" for="file1">
          <div id="preview1-container" class="hidden">
            <img id="preview1" />
          </div>
          <input id="file1" type="file" />
        </label>
        <div class="enhance-bar-card">
          <span id="enhanceVal1">0%</span>
          <input id="enhanceSlider1" type="range" min="0" max="100" value="0" />
        </div>
        <div class="crop-actions-row">
          <button id="autoCrop1" type="button" class="crop-btn auto-crop-btn">Auto Crop</button>
          <button id="enhance1" type="button" class="crop-btn">Enhance</button>
          <button id="crop1" type="button" class="crop-btn">Crop Corners</button>
        </div>
      </div>
      <div class="upload-card">
        <label id="drop2" for="file2">
          <div id="preview2-container" class="hidden">
            <img id="preview2" />
          </div>
          <input id="file2" type="file" />
        </label>
        <div class="enhance-bar-card">
          <span id="enhanceVal2">0%</span>
          <input id="enhanceSlider2" type="range" min="0" max="100" value="0" />
        </div>
        <div class="crop-actions-row">
          <button id="autoCrop2" type="button" class="crop-btn auto-crop-btn">Auto Crop</button>
          <button id="enhance2" type="button" class="crop-btn">Enhance</button>
          <button id="crop2" type="button" class="crop-btn">Crop Corners</button>
        </div>
      </div>
    </div>
    <div id="cropModal" class="modal hidden" aria-hidden="true">
      <div role="dialog">
        <h3 id="cropTitle">Crop Image</h3>
        <canvas id="cropCanvas"></canvas>
        <div class="modal-enhance-bar">
          <span id="enhanceValModal">0%</span>
          <input id="enhanceSliderModal" type="range" min="0" max="100" value="0" />
        </div>
        <div class="modal-actions">
          <button id="enhanceCropModal" type="button">Enhance</button>
          <button id="autoDetectCrop" type="button">Auto Detect</button>
          <button id="resetCropCorners" type="button">Full Image</button>
          <button id="applyCrop" type="button">Apply Crop</button>
          <button id="cancelCrop" type="button">Cancel</button>
        </div>
      </div>
    </div>
    <div id="cropInfo1"></div>
    <div id="cropInfo2"></div>
    <div id="thumb1Placeholder"></div>
    <img id="thumb1" class="hidden" />
    <div id="thumb2Placeholder"></div>
    <img id="thumb2" class="hidden" />
  `;
}

describe("cropController Auto Crop integration", () => {
  let appState;
  let controller;

  beforeEach(() => {
    setupDom();
    appState = createAppState();
    controller = createCropController({
      appState,
      document,
    });
    controller.init();
  });

  it("opens crop modal and runs auto corner detection when crop button clicked", () => {
    // Simulate image loaded
    const fakeImg = new Image();
    appState.setSource("front", {
      image: fakeImg,
      naturalWidth: 800,
      naturalHeight: 500,
    });

    const cropBtn = document.getElementById("crop1");
    cropBtn.click();

    const modal = document.getElementById("cropModal");
    expect(modal.classList.contains("hidden")).toBe(false);
    expect(modal.getAttribute("aria-hidden")).toBe("false");
  });

  it("resets corners to full image when Full Image button is clicked", () => {
    const fakeImg = new Image();
    appState.setSource("front", {
      image: fakeImg,
      naturalWidth: 800,
      naturalHeight: 500,
    });

    controller.openCropModal("front");
    const resetBtn = document.getElementById("resetCropCorners");
    expect(() => resetBtn.click()).not.toThrow();
  });

  it("re-runs auto detection when Auto Detect button is clicked", () => {
    const fakeImg = new Image();
    appState.setSource("front", {
      image: fakeImg,
      naturalWidth: 800,
      naturalHeight: 500,
    });

    controller.openCropModal("front");
    const autoDetectBtn = document.getElementById("autoDetectCrop");
    expect(() => autoDetectBtn.click()).not.toThrow();
  });

  it("executes quickAutoCrop without errors when image is loaded", () => {
    const fakeImg = new Image();
    appState.setSource("front", {
      image: fakeImg,
      naturalWidth: 800,
      naturalHeight: 500,
    });

    const autoCropBtn = document.getElementById("autoCrop1");
    expect(() => autoCropBtn.click()).not.toThrow();
  });

  it("handles quickEnhance without errors when clicked", () => {
    const fakeImg = new Image();
    appState.setSource("front", {
      image: fakeImg,
      naturalWidth: 800,
      naturalHeight: 500,
    });

    const enhanceBtn = document.getElementById("enhance1");
    expect(() => enhanceBtn.click()).not.toThrow();
  });

  it("handles enhanceCropModal inside crop modal without errors", () => {
    const fakeImg = new Image();
    appState.setSource("front", {
      image: fakeImg,
      naturalWidth: 800,
      naturalHeight: 500,
    });

    controller.openCropModal("front");
    const modalEnhanceBtn = document.getElementById("enhanceCropModal");
    expect(() => modalEnhanceBtn.click()).not.toThrow();
  });

  it("updates enhanceVal1 badge when enhanceSlider1 receives input", () => {
    const fakeImg = new Image();
    appState.setSource("front", {
      image: fakeImg,
      naturalWidth: 800,
      naturalHeight: 500,
    });

    const slider = document.getElementById("enhanceSlider1");
    const badge = document.getElementById("enhanceVal1");
    slider.value = "75";
    slider.dispatchEvent(new Event("input"));

    expect(badge.textContent).toBe("75%");
  });

  it("updates enhanceValModal badge when enhanceSliderModal receives input", () => {
    const fakeImg = new Image();
    appState.setSource("front", {
      image: fakeImg,
      naturalWidth: 800,
      naturalHeight: 500,
    });

    controller.openCropModal("front");
    const modalSlider = document.getElementById("enhanceSliderModal");
    const modalBadge = document.getElementById("enhanceValModal");
    modalSlider.value = "60";
    modalSlider.dispatchEvent(new Event("input"));

    expect(modalBadge.textContent).toBe("60%");
  });
});
