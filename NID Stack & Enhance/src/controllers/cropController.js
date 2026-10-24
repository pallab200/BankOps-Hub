/**
 * cropController.js — DOM glue for the Crop_Editor modal.
 *
 * Handles opening/closing the crop modal, guarding crop-on-empty, initializing
 * the Crop_Region to full image bounds, storing the region in original pixel
 * coordinates, and displaying crop width/height.
 *
 * Input modalities (fixes D7):
 * - Pointer Events (pointerdown/move/up) handle both mouse and touch uniformly.
 * - Keyboard: arrow keys move the active corner by 1px, Shift+arrow by 10px.
 * - Escape closes the dialog discarding changes.
 *
 * Focus management:
 * - On open, focus moves into the dialog and is trapped (Req 11.5).
 * - On close, focus returns to the opener control (Req 11.7) or nearest
 *   persistent parent container if the opener is gone (Req 11.8).
 *
 * All event handlers are wrapped in try/catch to prevent uncaught errors
 * (Req 12.6).
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 11.2, 11.5, 11.6, 11.7, 11.8
 */

import {
  initialRegion,
  constrainCorner,
  constrainMove,
  displayToOriginal,
  originalToDisplay,
  sizeCropCanvas,
  initialQuadCorners,
  regionToQuadCorners,
  moveQuadCorner,
  moveQuad,
  quadBoundingBox,
} from '../core/cropGeometry.js';
import { detectCardCorners } from '../core/cardDetection.js';
import { enhanceImageSource } from '../core/documentEnhance.js';
import { showGuidance } from './messages.js';

/** CSS class used to hide elements. */
const HIDDEN_CLASS = 'hidden';

/** Corner handle hit-test radius in display pixels. */
const HANDLE_RADIUS = 12;

/** Arrow-key nudge distance in original pixels. */
const NUDGE_PX = 1;
/** Shift+arrow nudge distance in original pixels. */
const SHIFT_NUDGE_PX = 10;

/** Slot → crop button id mapping (matches markup ids). */
const CROP_BUTTONS = Object.freeze({
  front: 'crop1',
  back: 'crop2',
});

/** Slot → auto crop button id mapping. */
const AUTO_CROP_BUTTONS = Object.freeze({
  front: 'autoCrop1',
  back: 'autoCrop2',
});

/** Slot → cropInfo display element id. */
const CROP_INFO_IDS = Object.freeze({
  front: 'cropInfo1',
  back: 'cropInfo2',
});

/**
 * Create the crop controller.
 *
 * @param {Object} deps
 * @param {import('../core/appState.js').AppStateStore} deps.appState - State store.
 * @param {Document} [deps.document] - Document for element lookups.
 * @returns {{init: () => void, destroy: () => void}}
 */
export function createCropController(deps = {}) {
  const { appState, document: providedDoc } = deps;

  if (!appState || typeof appState.getState !== 'function') {
    throw new Error('createCropController requires an appState store');
  }

  const doc =
    providedDoc || (typeof document !== 'undefined' ? document : undefined);
  if (!doc || typeof doc.getElementById !== 'function') {
    throw new Error('createCropController requires a document');
  }

  // Track attached listeners for teardown.
  const teardown = [];

  // --- State for an open crop session ---
  /** @type {('front'|'back')|null} */
  let activeSlot = null;
  /** @type {{x:number,y:number,w:number,h:number}|null} */
  let currentRegion = null;
  /** @type {Array<{x:number,y:number}>|null} Free-corner quad points [TL,TR,BR,BL]. */
  let quadCorners = null;
  /** Display-to-original scale factor for the current session. */
  let scale = 1;
  /** Image element being cropped (for redraw). */
  let cropImage = null;
  /** Element that opened the modal (for focus return). */
  let openerElement = null;
  /** Active corner index for keyboard nudging (0-3), or -1 if none. */
  let activeCornerIdx = 0;
  /** Whether a pointer drag is in progress. */
  let dragging = false;
  /** Type of drag: 'corner' or 'move'. */
  let dragType = null;
  /** Corner index being dragged. */
  let dragCornerIdx = -1;
  /** Start pointer position for move drags (in original coords). */
  let dragStartOriginal = null;
  /** Quad corners at the start of a move drag. */
  let dragStartCorners = null;
  /** Unenhanced base image for the open crop modal session. */
  let modalBaseImage = null;

  // --- Helpers ---

  function byId(id) {
    return doc.getElementById(id);
  }

  function safeShowGuidance(text, options) {
    try {
      showGuidance(text, options);
    } catch (_e) {
      /* ignore if message controller is not initialized */
    }
  }

  function on(el, type, handler, options) {
    if (!el || typeof el.addEventListener !== 'function') return;
    el.addEventListener(type, handler, options);
    teardown.push(() => el.removeEventListener(type, handler, options));
  }

  function getModal() {
    return byId('cropModal');
  }

  function getCanvas() {
    return byId('cropCanvas');
  }

  function getModalContent() {
    const modal = getModal();
    return modal ? modal.querySelector('[role="dialog"]') : null;
  }

  // --- Focus trap (Req 11.5) ---

  function getFocusableElements() {
    const dialog = getModalContent();
    if (!dialog) return [];
    const selector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(dialog.querySelectorAll(selector)).filter(
      (el) => !el.disabled && el.offsetParent !== null
    );
  }

  function trapFocus(event) {
    try {
      const focusable = getFocusableElements();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.key === 'Tab') {
        if (event.shiftKey) {
          if (doc.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        } else {
          if (doc.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    } catch (_err) {
      /* never let focus trap throw */
    }
  }

  // --- Drawing ---

  function drawCropOverlay() {
    const canvas = getCanvas();
    if (!canvas || !cropImage || !quadCorners) return;

    let ctx = null;
    try {
      ctx = canvas.getContext('2d');
    } catch (_e) {
      ctx = null;
    }
    if (!ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;

    // Draw the image.
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(cropImage, 0, 0, cw, ch);

    // Dim the entire canvas.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, cw, ch);

    // Cut out the quadrilateral region using a clipping path.
    const displayCorners = quadCorners.map(c => ({
      x: c.x * scale,
      y: c.y * scale,
    }));

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(displayCorners[0].x, displayCorners[0].y);
    ctx.lineTo(displayCorners[1].x, displayCorners[1].y);
    ctx.lineTo(displayCorners[2].x, displayCorners[2].y);
    ctx.lineTo(displayCorners[3].x, displayCorners[3].y);
    ctx.closePath();
    ctx.clip();

    // Draw the image within the clipped quad region.
    ctx.drawImage(cropImage, 0, 0, cw, ch);
    ctx.restore();

    // Draw quadrilateral border with bright cyan accent.
    ctx.strokeStyle = '#00d2ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(displayCorners[0].x, displayCorners[0].y);
    ctx.lineTo(displayCorners[1].x, displayCorners[1].y);
    ctx.lineTo(displayCorners[2].x, displayCorners[2].y);
    ctx.lineTo(displayCorners[3].x, displayCorners[3].y);
    ctx.closePath();
    ctx.stroke();

    // Draw corner handles with outer touch ring and inner dot.
    displayCorners.forEach((corner, idx) => {
      // Outer touch target ring
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, HANDLE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = idx === activeCornerIdx ? 'rgba(0, 210, 255, 0.35)' : 'rgba(255, 255, 255, 0.2)';
      ctx.fill();

      // Inner handle
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, HANDLE_RADIUS / 2, 0, Math.PI * 2);
      ctx.fillStyle = idx === activeCornerIdx ? '#00bfff' : '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Draw Magnifier Loupe when dragging a corner handle (Lens-style Loupe)
    if (dragging && dragType === 'corner' && dragCornerIdx >= 0) {
      drawLoupe(ctx, cw, ch, displayCorners[dragCornerIdx], quadCorners[dragCornerIdx]);
    }
  }

  /**
   * Draw circular magnifying loupe showing a 2.4x zoomed view of the corner being dragged.
   * Mirrors the Microsoft Lens precision corner alignment experience.
   */
  function drawLoupe(ctx, cw, ch, displayCorner, origCorner) {
    if (!cropImage || !origCorner) return;

    const loupeRadius = 46;
    const zoom = 2.4;

    // Position loupe in the top corner opposite to the dragged corner
    const onRight = displayCorner.x < cw / 2;
    const loupeX = onRight ? cw - loupeRadius - 16 : loupeRadius + 16;
    const loupeY = loupeRadius + 16;

    ctx.save();

    // Background circle
    ctx.beginPath();
    ctx.arc(loupeX, loupeY, loupeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    // Clip circular aperture
    ctx.save();
    ctx.beginPath();
    ctx.arc(loupeX, loupeY, loupeRadius, 0, Math.PI * 2);
    ctx.clip();

    // Draw zoomed image centered at origCorner
    const srcW = (loupeRadius * 2) / (scale * zoom);
    const srcH = (loupeRadius * 2) / (scale * zoom);
    const srcX = origCorner.x - srcW / 2;
    const srcY = origCorner.y - srcH / 2;

    ctx.drawImage(
      cropImage,
      srcX, srcY, srcW, srcH,
      loupeX - loupeRadius, loupeY - loupeRadius, loupeRadius * 2, loupeRadius * 2
    );

    // Crosshair in center of loupe
    ctx.strokeStyle = '#00d2ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(loupeX - 10, loupeY);
    ctx.lineTo(loupeX + 10, loupeY);
    ctx.moveTo(loupeX, loupeY - 10);
    ctx.lineTo(loupeX, loupeY + 10);
    ctx.stroke();

    // Center target dot
    ctx.beginPath();
    ctx.arc(loupeX, loupeY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore(); // end clip

    // Circular white border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(loupeX, loupeY, loupeRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Cyan accent ring
    ctx.strokeStyle = '#00d2ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(loupeX, loupeY, loupeRadius + 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  // --- Hit testing ---

  function getCanvasPointer(event) {
    const canvas = getCanvas();
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function hitTestCorner(displayPoint) {
    if (!quadCorners) return -1;
    const displayCorners = quadCorners.map(c => ({
      x: c.x * scale,
      y: c.y * scale,
    }));

    for (let i = 0; i < displayCorners.length; i++) {
      const dx = displayPoint.x - displayCorners[i].x;
      const dy = displayPoint.y - displayCorners[i].y;
      if (Math.sqrt(dx * dx + dy * dy) <= HANDLE_RADIUS) {
        return i;
      }
    }
    return -1;
  }

  function isInsideRegion(displayPoint) {
    if (!quadCorners) return false;
    // Point-in-polygon test using ray casting for the quadrilateral.
    const displayCorners = quadCorners.map(c => ({
      x: c.x * scale,
      y: c.y * scale,
    }));
    const { x, y } = displayPoint;
    let inside = false;
    for (let i = 0, j = displayCorners.length - 1; i < displayCorners.length; j = i++) {
      const xi = displayCorners[i].x, yi = displayCorners[i].y;
      const xj = displayCorners[j].x, yj = displayCorners[j].y;
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  // --- Pointer event handlers (mouse + touch via Pointer Events, fixes D7) ---

  function handlePointerDown(event) {
    try {
      const canvas = getCanvas();
      if (!canvas || !quadCorners) return;

      const displayPoint = getCanvasPointer(event);
      const cornerIdx = hitTestCorner(displayPoint);

      if (cornerIdx >= 0) {
        // Start corner drag.
        dragging = true;
        dragType = 'corner';
        dragCornerIdx = cornerIdx;
        activeCornerIdx = cornerIdx;
        canvas.setPointerCapture(event.pointerId);
        event.preventDefault();
      } else if (isInsideRegion(displayPoint)) {
        // Start region move drag.
        dragging = true;
        dragType = 'move';
        dragStartOriginal = displayToOriginal(displayPoint, scale);
        dragStartCorners = quadCorners.map(c => ({ ...c }));
        canvas.setPointerCapture(event.pointerId);
        event.preventDefault();
      }
    } catch (_err) {
      /* Req 12.6: no uncaught errors */
    }
  }

  function handlePointerMove(event) {
    try {
      if (!dragging || !quadCorners) return;

      const displayPoint = getCanvasPointer(event);
      const imgBounds = getImageBounds();

      if (dragType === 'corner') {
        const originalPoint = displayToOriginal(displayPoint, scale);
        quadCorners = moveQuadCorner(
          quadCorners,
          dragCornerIdx,
          originalPoint,
          imgBounds
        );
      } else if (dragType === 'move') {
        const originalPoint = displayToOriginal(displayPoint, scale);
        const dx = Math.round(originalPoint.x - dragStartOriginal.x);
        const dy = Math.round(originalPoint.y - dragStartOriginal.y);
        quadCorners = moveQuad(dragStartCorners, { dx, dy }, imgBounds);
      }

      // Keep currentRegion in sync (bounding box of quad).
      currentRegion = quadBoundingBox(quadCorners);
      drawCropOverlay();
      event.preventDefault();
    } catch (_err) {
      /* Req 12.6: no uncaught errors */
    }
  }

  function handlePointerUp(event) {
    try {
      if (!dragging) return;
      dragging = false;
      dragType = null;
      dragCornerIdx = -1;
      dragStartOriginal = null;
      dragStartCorners = null;

      const canvas = getCanvas();
      if (canvas) {
        try {
          canvas.releasePointerCapture(event.pointerId);
        } catch (_e) {
          /* ignore if already released */
        }
      }
    } catch (_err) {
      /* Req 12.6 */
    }
  }

  // --- Keyboard handling (Req 11.2) ---

  function handleKeyDown(event) {
    try {
      const modal = getModal();
      if (!modal || modal.classList.contains(HIDDEN_CLASS)) return;

      // Escape closes discarding changes (Req 3.8, 11.6).
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelCrop();
        return;
      }

      // Focus trap (Req 11.5).
      trapFocus(event);

      // Arrow keys nudge the active corner (Req 11.2).
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        if (!quadCorners) return;
        event.preventDefault();

        const step = event.shiftKey ? SHIFT_NUDGE_PX : NUDGE_PX;
        const imgBounds = getImageBounds();

        // Get the current position of the active corner.
        const cornerPos = quadCorners[activeCornerIdx] || { x: 0, y: 0 };
        let targetX = cornerPos.x;
        let targetY = cornerPos.y;

        switch (event.key) {
          case 'ArrowLeft':
            targetX -= step;
            break;
          case 'ArrowRight':
            targetX += step;
            break;
          case 'ArrowUp':
            targetY -= step;
            break;
          case 'ArrowDown':
            targetY += step;
            break;
        }

        quadCorners = moveQuadCorner(
          quadCorners,
          activeCornerIdx,
          { x: targetX, y: targetY },
          imgBounds
        );
        currentRegion = quadBoundingBox(quadCorners);
        drawCropOverlay();
      }

      // Tab between corners with Tab key (cycle active corner).
      // This is separate from the focus trap which handles document focus.
    } catch (_err) {
      /* Req 12.6 */
    }
  }

  // --- Corner position helper ---

  function getCornerPosition(cornerIdx) {
    if (!currentRegion) return { x: 0, y: 0 };
    const r = currentRegion;
    switch (cornerIdx) {
      case 0:
        return { x: r.x, y: r.y }; // TL
      case 1:
        return { x: r.x + r.w, y: r.y }; // TR
      case 2:
        return { x: r.x + r.w, y: r.y + r.h }; // BR
      case 3:
        return { x: r.x, y: r.y + r.h }; // BL
      default:
        return { x: r.x, y: r.y };
    }
  }

  function getImageBounds() {
    const state = appState.getState();
    if (!activeSlot || !state.sources[activeSlot]) {
      return { width: 0, height: 0 };
    }
    const src = state.sources[activeSlot];
    return { width: src.naturalWidth, height: src.naturalHeight };
  }

  // --- Open / Close ---

  function openCropModal(slot, options = {}) {
    try {
      const state = appState.getState();
      const source = state.sources[slot];

      // Guard: no image loaded → show guidance, don't open (Req 3.2).
      if (!source || !source.image) {
        safeShowGuidance('No image is available to crop. Please upload an image first.');
        return;
      }

      activeSlot = slot;
      openerElement = byId(CROP_BUTTONS[slot]) || null;

      // Initialize region:
      // If forced autoDetect OR opening for the first time without prior crop,
      // automatically detect the 4 corners like Microsoft Lens!
      if (options.forceAutoDetect) {
        quadCorners = detectCardCorners(source.image, source.naturalWidth, source.naturalHeight, doc);
        currentRegion = quadBoundingBox(quadCorners);
        safeShowGuidance('4 corners auto-detected like Microsoft Lens. Drag handles to fine-tune.');
      } else if (source.crop && source.crop.corners) {
        // Restore previously stored quad corners.
        quadCorners = source.crop.corners.map(c => ({ ...c }));
        currentRegion = quadBoundingBox(quadCorners);
      } else if (source.crop) {
        // Legacy axis-aligned crop: convert to quad corners.
        currentRegion = { ...source.crop };
        quadCorners = regionToQuadCorners(currentRegion);
      } else {
        // Auto detect 4 corners by default like Microsoft Lens!
        quadCorners = detectCardCorners(source.image, source.naturalWidth, source.naturalHeight, doc);
        currentRegion = quadBoundingBox(quadCorners);
        safeShowGuidance('4 corners auto-selected like Microsoft Lens. Drag handles to fine-tune.');
      }

      // Size the crop canvas to fit within the viewport without scrolling (Req 10.6).
      const viewportW = (doc.defaultView && doc.defaultView.innerWidth) || 800;
      const viewportH = (doc.defaultView && doc.defaultView.innerHeight) || 600;
      // Reserve space for modal chrome (header, info note, enhance slider, action buttons, padding)
      const reservedChromeH = 180;
      const availW = Math.max(160, Math.min(viewportW * 0.88, 780));
      const availH = Math.max(120, Math.min(viewportH - reservedChromeH, viewportH * 0.52));

      const sizing = sizeCropCanvas(
        source.naturalWidth,
        source.naturalHeight,
        availW,
        availH
      );
      scale = sizing.scale || 1;

      const canvas = getCanvas();
      if (canvas) {
        canvas.width = Math.round(sizing.canvasW);
        canvas.height = Math.round(sizing.canvasH);
      }

      // Store image reference for redraw.
      cropImage = source.image;
      modalBaseImage = (source.image && source.image.__baseImage) || source.image;
      if (modalBaseImage) modalBaseImage.__baseImage = modalBaseImage;

      // Sync modal enhance slider with active card's enhance slider
      const currentSlotSlider = byId(slot === 'front' ? 'enhanceSlider1' : 'enhanceSlider2');
      const modalSlider = byId('enhanceSliderModal');
      const modalVal = byId('enhanceValModal');
      const initialSliderVal = currentSlotSlider ? currentSlotSlider.value : '0';
      if (modalSlider) modalSlider.value = initialSliderVal;
      if (modalVal) modalVal.textContent = `${initialSliderVal}%`;

      // Show the modal.
      const modal = getModal();
      if (modal) {
        modal.classList.remove(HIDDEN_CLASS);
        modal.setAttribute('aria-hidden', 'false');
      }

      // Reset active corner to TL.
      activeCornerIdx = 0;

      // Draw the initial overlay.
      drawCropOverlay();

      // Move focus into the dialog (Req 11.5).
      moveFocusIntoDialog();
    } catch (_err) {
      /* Req 12.6 */
    }
  }

  function moveFocusIntoDialog() {
    // Focus the first focusable element in the dialog.
    const focusable = getFocusableElements();
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      // Fallback: focus the dialog container itself.
      const dialog = getModalContent();
      if (dialog) {
        dialog.setAttribute('tabindex', '-1');
        dialog.focus();
      }
    }
  }

  function closeModal() {
    const modal = getModal();
    if (modal) {
      modal.classList.add(HIDDEN_CLASS);
      modal.setAttribute('aria-hidden', 'true');
    }

    // Clean up session state.
    dragging = false;
    dragType = null;
    cropImage = null;
    modalBaseImage = null;
    quadCorners = null;

    // Return focus to opener (Req 11.7) or nearest parent (Req 11.8).
    returnFocus();

    activeSlot = null;
    currentRegion = null;
  }

  function returnFocus() {
    try {
      // Try to return focus to the opener element.
      if (
        openerElement &&
        doc.body.contains(openerElement) &&
        typeof openerElement.focus === 'function'
      ) {
        openerElement.focus();
        return;
      }

      // Opener gone → find nearest persistent parent container (Req 11.8).
      if (openerElement) {
        let parent = openerElement.parentElement;
        while (parent && !doc.body.contains(parent)) {
          parent = parent.parentElement;
        }
        if (parent && typeof parent.focus === 'function') {
          parent.setAttribute('tabindex', '-1');
          parent.focus();
          return;
        }
      }

      // Absolute fallback: focus the body or the first focusable element.
      if (doc.body && typeof doc.body.focus === 'function') {
        doc.body.focus();
      }
    } catch (_err) {
      /* Req 12.6 */
    }
  }

  // --- Apply / Cancel ---

  function applyCrop() {
    try {
      if (!activeSlot || !quadCorners || !cropImage) {
        closeModal();
        return;
      }

      // Perform perspective crop: warp the quadrilateral into a rectangle.
      const croppedResult = perspectiveCrop(cropImage, quadCorners);

      if (croppedResult) {
        // Wait for the image to load before committing to state.
        const img = croppedResult.image;
        const dataUrl = croppedResult.dataUrl;
        const outW = croppedResult.width;
        const outH = croppedResult.height;
        const slot = activeSlot;

        const commitCrop = () => {
          img.__baseImage = img;
          // Replace the source image with the perspective-corrected crop.
          appState.setSource(slot, {
            image: img,
            naturalWidth: outW,
            naturalHeight: outH,
          });

          // Reset enhance slider for this slot to 0
          const slider = byId(slot === 'front' ? 'enhanceSlider1' : 'enhanceSlider2');
          const badge = byId(slot === 'front' ? 'enhanceVal1' : 'enhanceVal2');
          if (slider) slider.value = '0';
          if (badge) badge.textContent = '0%';

          // Update preview and thumbnail with the new cropped image.
          updateSlotVisuals(slot, dataUrl);

          // Display crop dimensions.
          displayCropInfo(slot);
        };

        if (img.complete && img.naturalWidth > 0) {
          commitCrop();
        } else {
          img.onload = commitCrop;
          img.onerror = () => {
            // Fallback: just store the bounding box crop.
            const bbox = quadBoundingBox(quadCorners);
            appState.setCrop(slot, {
              x: bbox.x,
              y: bbox.y,
              w: bbox.w,
              h: bbox.h,
              corners: quadCorners.map(c => ({ x: Math.round(c.x), y: Math.round(c.y) })),
            });
            displayCropInfo(slot);
          };
        }
      } else {
        // Fallback: store the bounding box crop if perspective crop failed.
        const bbox = quadBoundingBox(quadCorners);
        appState.setCrop(activeSlot, {
          x: bbox.x,
          y: bbox.y,
          w: bbox.w,
          h: bbox.h,
          corners: quadCorners.map(c => ({ x: Math.round(c.x), y: Math.round(c.y) })),
        });
        displayCropInfo(activeSlot);
      }

      closeModal();
    } catch (_err) {
      /* Req 12.6 */
    }
  }

  /**
   * Apply perspective transform: warp the quad region into a rectangle.
   * Uses bilinear interpolation via canvas 2D by subdividing the quad into
   * small cells.
   * Returns null if the quad covers the full image (no crop needed).
   */
  function perspectiveCrop(sourceImage, corners) {
    if (!sourceImage || !corners || corners.length < 4) return null;

    // Check if the quad is the full image (no crop needed).
    const imgBounds = getImageBounds();
    const isFullImage = (
      Math.abs(corners[0].x) < 2 && Math.abs(corners[0].y) < 2 &&
      Math.abs(corners[1].x - imgBounds.width) < 2 && Math.abs(corners[1].y) < 2 &&
      Math.abs(corners[2].x - imgBounds.width) < 2 && Math.abs(corners[2].y - imgBounds.height) < 2 &&
      Math.abs(corners[3].x) < 2 && Math.abs(corners[3].y - imgBounds.height) < 2
    );
    if (isFullImage) return null;

    // Compute output dimensions from the quad edges.
    const topWidth = Math.sqrt(
      Math.pow(corners[1].x - corners[0].x, 2) +
      Math.pow(corners[1].y - corners[0].y, 2)
    );
    const bottomWidth = Math.sqrt(
      Math.pow(corners[2].x - corners[3].x, 2) +
      Math.pow(corners[2].y - corners[3].y, 2)
    );
    const leftHeight = Math.sqrt(
      Math.pow(corners[3].x - corners[0].x, 2) +
      Math.pow(corners[3].y - corners[0].y, 2)
    );
    const rightHeight = Math.sqrt(
      Math.pow(corners[2].x - corners[1].x, 2) +
      Math.pow(corners[2].y - corners[1].y, 2)
    );

    const outW = Math.round(Math.max(topWidth, bottomWidth));
    const outH = Math.round(Math.max(leftHeight, rightHeight));

    if (outW <= 0 || outH <= 0) return null;

    // Create output canvas.
    const outCanvas = doc.createElement('canvas');
    outCanvas.width = outW;
    outCanvas.height = outH;
    let outCtx = null;
    try {
      outCtx = outCanvas.getContext('2d');
    } catch (_e) {
      outCtx = null;
    }
    if (!outCtx) return null;

    // Draw source image to a temp canvas for pixel access via drawImage sub-rects.
    // Use a grid-based approach: divide the quad and output into small cells
    // and draw each cell mapping from source quad to output rectangle.
    const gridSize = 20; // Number of subdivisions per axis.

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const u0 = col / gridSize;
        const u1 = (col + 1) / gridSize;
        const v0 = row / gridSize;
        const v1 = (row + 1) / gridSize;

        // Bilinear interpolation of the quad corners to get source positions.
        const srcTL = bilinearInterp(corners, u0, v0);
        const srcTR = bilinearInterp(corners, u1, v0);
        const srcBR = bilinearInterp(corners, u1, v1);
        const srcBL = bilinearInterp(corners, u0, v1);

        // Destination rectangle in the output canvas.
        const dstX = u0 * outW;
        const dstY = v0 * outH;
        const dstW = (u1 - u0) * outW;
        const dstH = (v1 - v0) * outH;

        // Use canvas transform to map the source quadrilateral cell.
        // Draw as two triangles for accurate mapping.
        drawQuadCell(outCtx, sourceImage, srcTL, srcTR, srcBR, srcBL, dstX, dstY, dstW, dstH);
      }
    }

    // Create an Image element from the result.
    const dataUrl = outCanvas.toDataURL('image/png');
    const img = new Image();
    img.src = dataUrl;

    return {
      image: img,
      width: outW,
      height: outH,
      dataUrl,
    };
  }

  /**
   * Bilinear interpolation within the quad defined by corners [TL, TR, BR, BL].
   * u goes left→right (0→1), v goes top→bottom (0→1).
   */
  function bilinearInterp(corners, u, v) {
    const topX = corners[0].x + (corners[1].x - corners[0].x) * u;
    const topY = corners[0].y + (corners[1].y - corners[0].y) * u;
    const botX = corners[3].x + (corners[2].x - corners[3].x) * u;
    const botY = corners[3].y + (corners[2].y - corners[3].y) * u;
    return {
      x: topX + (botX - topX) * v,
      y: topY + (botY - topY) * v,
    };
  }

  /**
   * Draw a small quadrilateral cell from the source image into a rectangular
   * destination using canvas affine transform (approximation using the cell's
   * top-left corner as source rect).
   */
  function drawQuadCell(ctx, img, srcTL, srcTR, srcBR, srcBL, dstX, dstY, dstW, dstH) {
    // Simple approximation: use the source cell's bounding box.
    const srcX = Math.min(srcTL.x, srcTR.x, srcBR.x, srcBL.x);
    const srcY = Math.min(srcTL.y, srcTR.y, srcBR.y, srcBL.y);
    const srcW = Math.max(srcTL.x, srcTR.x, srcBR.x, srcBL.x) - srcX;
    const srcH = Math.max(srcTL.y, srcTR.y, srcBR.y, srcBL.y) - srcY;

    if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) return;

    ctx.drawImage(img, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
  }

  /**
   * Update the preview and thumbnail visuals for a slot after cropping.
   */
  function updateSlotVisuals(slot, dataUrl) {
    const slotConfig = {
      front: { previewImg: 'preview1', previewContainer: 'preview1-container', thumb: 'thumb1', thumbPlaceholder: 'thumb1Placeholder' },
      back: { previewImg: 'preview2', previewContainer: 'preview2-container', thumb: 'thumb2', thumbPlaceholder: 'thumb2Placeholder' },
    };
    const cfg = slotConfig[slot];
    if (!cfg) return;

    const previewImg = byId(cfg.previewImg);
    if (previewImg) previewImg.src = dataUrl;
    const previewContainer = byId(cfg.previewContainer);
    if (previewContainer) previewContainer.classList.remove(HIDDEN_CLASS);

    const thumb = byId(cfg.thumb);
    if (thumb) {
      thumb.src = dataUrl;
      thumb.classList.remove(HIDDEN_CLASS);
    }
    const placeholder = byId(cfg.thumbPlaceholder);
    if (placeholder) placeholder.classList.add(HIDDEN_CLASS);
  }

  function cancelCrop() {
    try {
      // Discard changes: leave previously stored Crop_Region unchanged (Req 3.6, 3.8).
      closeModal();
    } catch (_err) {
      /* Req 12.6 */
    }
  }

  function autoDetectCurrentModal() {
    try {
      if (!activeSlot || !cropImage) return;
      const bounds = getImageBounds();
      quadCorners = detectCardCorners(cropImage, bounds.width, bounds.height, doc);
      currentRegion = quadBoundingBox(quadCorners);
      drawCropOverlay();
      safeShowGuidance('4 corners auto-detected like Microsoft Lens.');
    } catch (_err) {
      /* Req 12.6 */
    }
  }

  function resetToFullImage() {
    try {
      if (!activeSlot) return;
      const bounds = getImageBounds();
      quadCorners = initialQuadCorners(bounds.width, bounds.height);
      currentRegion = quadBoundingBox(quadCorners);
      drawCropOverlay();
      safeShowGuidance('Corners reset to full image.');
    } catch (_err) {
      /* Req 12.6 */
    }
  }

  function quickAutoCrop(slot) {
    try {
      const state = appState.getState();
      const source = state.sources[slot];

      if (!source || !source.image) {
        safeShowGuidance('No image is available to auto crop. Please upload an image first.');
        return;
      }

      const bounds = { width: source.naturalWidth, height: source.naturalHeight };
      const corners = detectCardCorners(source.image, bounds.width, bounds.height, doc);
      const croppedResult = perspectiveCrop(source.image, corners);

      if (croppedResult) {
        const img = croppedResult.image;
        const dataUrl = croppedResult.dataUrl;
        const outW = croppedResult.width;
        const outH = croppedResult.height;

        const commitCrop = () => {
          img.__baseImage = img;
          appState.setSource(slot, {
            image: img,
            naturalWidth: outW,
            naturalHeight: outH,
          });

          // Reset enhance slider for this slot to 0
          const slider = byId(slot === 'front' ? 'enhanceSlider1' : 'enhanceSlider2');
          const badge = byId(slot === 'front' ? 'enhanceVal1' : 'enhanceVal2');
          if (slider) slider.value = '0';
          if (badge) badge.textContent = '0%';

          updateSlotVisuals(slot, dataUrl);
          displayCropInfo(slot);
          safeShowGuidance(`Image ${slot === 'front' ? '1 (Front)' : '2 (Back)'}: Auto crop applied successfully!`);
        };

        if (img.complete && img.naturalWidth > 0) {
          commitCrop();
        } else {
          img.onload = commitCrop;
          img.onerror = () => {
            const bbox = quadBoundingBox(corners);
            appState.setCrop(slot, {
              x: bbox.x,
              y: bbox.y,
              w: bbox.w,
              h: bbox.h,
              corners: corners.map(c => ({ x: Math.round(c.x), y: Math.round(c.y) })),
            });
            displayCropInfo(slot);
            safeShowGuidance(`Image ${slot === 'front' ? '1 (Front)' : '2 (Back)'}: Corners detected.`);
          };
        }
      } else {
        const bbox = quadBoundingBox(corners);
        appState.setCrop(slot, {
          x: bbox.x,
          y: bbox.y,
          w: bbox.w,
          h: bbox.h,
          corners: corners.map(c => ({ x: Math.round(c.x), y: Math.round(c.y) })),
        });
        displayCropInfo(slot);
        safeShowGuidance(`Image ${slot === 'front' ? '1 (Front)' : '2 (Back)'}: Corners detected.`);
      }
    } catch (_err) {
      /* Req 12.6 */
    }
  }

  function quickEnhance(slot, strength = 1.0) {
    try {
      const state = appState.getState();
      const source = state.sources[slot];

      if (!source || !source.image) {
        safeShowGuidance(`No image is available to enhance. Please upload Image ${slot === 'front' ? '1 (Front)' : '2 (Back)'} first.`);
        return;
      }

      const s = Math.max(0, Math.min(1.0, typeof strength === 'number' ? strength : 1.0));
      const pct = Math.round(s * 100);

      const slider = byId(slot === 'front' ? 'enhanceSlider1' : 'enhanceSlider2');
      const badge = byId(slot === 'front' ? 'enhanceVal1' : 'enhanceVal2');
      if (slider && Number(slider.value) !== pct) slider.value = String(pct);
      if (badge) badge.textContent = `${pct}%`;

      const base = source.image.__baseImage || source.image;
      base.__baseImage = base;

      if (s <= 0) {
        appState.setSource(slot, {
          image: base,
          naturalWidth: base.naturalWidth,
          naturalHeight: base.naturalHeight,
        });
        updateSlotVisuals(slot, base.src);
        return;
      }

      const enhanced = enhanceImageSource(base, doc, s);
      if (!enhanced) {
        safeShowGuidance(`Could not enhance Image ${slot === 'front' ? '1 (Front)' : '2 (Back)'}.`);
        return;
      }

      enhanced.image.__baseImage = base;

      const commitEnhance = () => {
        appState.setSource(slot, {
          image: enhanced.image,
          naturalWidth: enhanced.width,
          naturalHeight: enhanced.height,
        });
        updateSlotVisuals(slot, enhanced.dataUrl);
        if (s >= 1.0) {
          safeShowGuidance(`Image ${slot === 'front' ? '1 (Front)' : '2 (Back)'}: Enhanced with 1-click!`);
        }
      };

      if (enhanced.image.complete && enhanced.image.naturalWidth > 0) {
        commitEnhance();
      } else {
        enhanced.image.onload = commitEnhance;
        enhanced.image.onerror = () => {
          safeShowGuidance(`Could not display enhanced image.`);
        };
      }
    } catch (_err) {
      /* Req 12.6 */
    }
  }

  function enhanceCurrentModal(strength = 1.0) {
    try {
      if (!activeSlot || !cropImage) return;
      const s = Math.max(0, Math.min(1.0, typeof strength === 'number' ? strength : 1.0));
      const pct = Math.round(s * 100);

      const modalSlider = byId('enhanceSliderModal');
      const modalVal = byId('enhanceValModal');
      if (modalSlider && Number(modalSlider.value) !== pct) modalSlider.value = String(pct);
      if (modalVal) modalVal.textContent = `${pct}%`;

      if (!modalBaseImage) {
        modalBaseImage = cropImage.__baseImage || cropImage;
        modalBaseImage.__baseImage = modalBaseImage;
      }

      if (s <= 0) {
        cropImage = modalBaseImage;
        drawCropOverlay();
        return;
      }

      const enhanced = enhanceImageSource(modalBaseImage, doc, s);
      if (!enhanced) return;

      enhanced.image.__baseImage = modalBaseImage;

      const commit = () => {
        cropImage = enhanced.image;
        drawCropOverlay();
        if (s >= 1.0) {
          safeShowGuidance('Image enhanced! Corners preserved.');
        }
      };

      if (enhanced.image.complete && enhanced.image.naturalWidth > 0) {
        commit();
      } else {
        enhanced.image.onload = commit;
      }
    } catch (_err) {
      /* Req 12.6 */
    }
  }

  function handleSliderInput(slot, value) {
    const num = Math.max(0, Math.min(100, Number(value) || 0));
    const badge = byId(slot === 'front' ? 'enhanceVal1' : 'enhanceVal2');
    if (badge) badge.textContent = `${num}%`;
    quickEnhance(slot, num / 100);
  }

  function handleModalSliderInput(value) {
    const num = Math.max(0, Math.min(100, Number(value) || 0));
    const badge = byId('enhanceValModal');
    if (badge) badge.textContent = `${num}%`;
    enhanceCurrentModal(num / 100);
  }

  function displayCropInfo(slot) {
    const infoEl = byId(CROP_INFO_IDS[slot]);
    if (!infoEl) return;

    const state = appState.getState();
    const source = state.sources[slot];
    if (!source) {
      infoEl.textContent = '';
      return;
    }

    // After perspective crop, crop is null but source dimensions reflect the crop.
    if (source.crop) {
      const crop = source.crop;
      infoEl.textContent = `Crop: ${crop.w} × ${crop.h} px`;
    } else if (source.naturalWidth && source.naturalHeight) {
      infoEl.textContent = `Cropped: ${source.naturalWidth} × ${source.naturalHeight} px`;
    } else {
      infoEl.textContent = '';
    }
  }

  // --- Initialization ---

  function init() {
    // Wire crop buttons.
    const crop1Btn = byId('crop1');
    const crop2Btn = byId('crop2');
    on(crop1Btn, 'click', () => openCropModal('front'));
    on(crop2Btn, 'click', () => openCropModal('back'));

    // Wire quick auto-crop buttons on upload cards.
    const autoCrop1Btn = byId('autoCrop1');
    const autoCrop2Btn = byId('autoCrop2');
    if (autoCrop1Btn) on(autoCrop1Btn, 'click', () => quickAutoCrop('front'));
    if (autoCrop2Btn) on(autoCrop2Btn, 'click', () => quickAutoCrop('back'));

    // Wire quick enhance buttons on upload cards.
    const enhance1Btn = byId('enhance1');
    const enhance2Btn = byId('enhance2');
    if (enhance1Btn) on(enhance1Btn, 'click', () => quickEnhance('front', 1.0));
    if (enhance2Btn) on(enhance2Btn, 'click', () => quickEnhance('back', 1.0));

    // Wire enhance sliders on upload cards.
    const slider1 = byId('enhanceSlider1');
    const slider2 = byId('enhanceSlider2');
    if (slider1) on(slider1, 'input', (e) => handleSliderInput('front', e.target.value));
    if (slider2) on(slider2, 'input', (e) => handleSliderInput('back', e.target.value));

    // Wire Auto Detect, Reset Full Image, Enhance button & slider inside modal.
    const autoDetectBtn = byId('autoDetectCrop');
    const resetCornersBtn = byId('resetCropCorners');
    const modalEnhanceBtn = byId('enhanceCropModal');
    const sliderModal = byId('enhanceSliderModal');
    if (autoDetectBtn) on(autoDetectBtn, 'click', autoDetectCurrentModal);
    if (resetCornersBtn) on(resetCornersBtn, 'click', resetToFullImage);
    if (modalEnhanceBtn) on(modalEnhanceBtn, 'click', () => enhanceCurrentModal(1.0));
    if (sliderModal) on(sliderModal, 'input', (e) => handleModalSliderInput(e.target.value));

    // Wire Apply/Cancel buttons.
    const applyBtn = byId('applyCrop');
    const cancelBtn = byId('cancelCrop');
    on(applyBtn, 'click', () => applyCrop());
    on(cancelBtn, 'click', () => cancelCrop());

    // Wire pointer events on the crop canvas (Req 3.3, 3.4, 3.7 — fixes D7).
    const canvas = getCanvas();
    on(canvas, 'pointerdown', handlePointerDown);
    on(canvas, 'pointermove', handlePointerMove);
    on(canvas, 'pointerup', handlePointerUp);
    // Prevent default touch behavior so pointer events work on touch (Req 3.7).
    on(canvas, 'touchstart', (e) => e.preventDefault(), { passive: false });

    // Wire keyboard (Req 11.2, 11.5, 11.6).
    on(doc, 'keydown', handleKeyDown);
  }

  function destroy() {
    while (teardown.length > 0) {
      const off = teardown.pop();
      try {
        off();
      } catch (_err) {
        /* ignore */
      }
    }
    activeSlot = null;
    currentRegion = null;
    cropImage = null;
    modalBaseImage = null;
    openerElement = null;
  }

  return {
    init,
    destroy,
    openCropModal,
    quickAutoCrop,
    quickEnhance,
    handleSliderInput,
    autoDetectCurrentModal,
    resetToFullImage,
    enhanceCurrentModal,
    handleModalSliderInput,
    applyCrop,
    cancelCrop,
  };
}

export default createCropController;
