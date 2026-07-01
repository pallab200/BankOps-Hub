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

  // --- Helpers ---

  function byId(id) {
    return doc.getElementById(id);
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

    const ctx = canvas.getContext('2d');
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

    // Draw quadrilateral border.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(displayCorners[0].x, displayCorners[0].y);
    ctx.lineTo(displayCorners[1].x, displayCorners[1].y);
    ctx.lineTo(displayCorners[2].x, displayCorners[2].y);
    ctx.lineTo(displayCorners[3].x, displayCorners[3].y);
    ctx.closePath();
    ctx.stroke();

    // Draw corner handles.
    displayCorners.forEach((corner, idx) => {
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, HANDLE_RADIUS / 2, 0, Math.PI * 2);
      ctx.fillStyle = idx === activeCornerIdx ? '#00bfff' : '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
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

  function openCropModal(slot) {
    try {
      const state = appState.getState();
      const source = state.sources[slot];

      // Guard: no image loaded → show guidance, don't open (Req 3.2).
      if (!source || !source.image) {
        showGuidance('No image is available to crop. Please upload an image first.');
        return;
      }

      activeSlot = slot;
      openerElement = byId(CROP_BUTTONS[slot]) || null;

      // Initialize region to full bounds or restore previously stored region (Req 3.1).
      if (source.crop && source.crop.corners) {
        // Restore previously stored quad corners.
        quadCorners = source.crop.corners.map(c => ({ ...c }));
        currentRegion = quadBoundingBox(quadCorners);
      } else if (source.crop) {
        // Legacy axis-aligned crop: convert to quad corners.
        currentRegion = { ...source.crop };
        quadCorners = regionToQuadCorners(currentRegion);
      } else {
        currentRegion = initialRegion(source.naturalWidth, source.naturalHeight);
        quadCorners = initialQuadCorners(source.naturalWidth, source.naturalHeight);
      }

      // Size the crop canvas to fit within the viewport (Req 10.6).
      const viewportW = (doc.defaultView && doc.defaultView.innerWidth) || 800;
      const viewportH = (doc.defaultView && doc.defaultView.innerHeight) || 600;
      // Leave some padding for modal chrome.
      const availW = Math.max(100, viewportW * 0.85);
      const availH = Math.max(100, viewportH * 0.7);

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
          // Replace the source image with the perspective-corrected crop.
          appState.setSource(slot, {
            image: img,
            naturalWidth: outW,
            naturalHeight: outH,
          });

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
    const outCtx = outCanvas.getContext('2d');
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
    openerElement = null;
  }

  return {
    init,
    destroy,
    openCropModal,
    applyCrop,
    cancelCrop,
  };
}

export default createCropController;
