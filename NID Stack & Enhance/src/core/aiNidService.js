/**
 * aiNidService.js — OpenRouter AI detection & real document image enhancement service.
 *
 * CRITICAL DIRECTIVE:
 * Does NOT generate fake or computer-typed synthetic cards.
 * Operates purely on the USER'S REAL uploaded image(s):
 *   1. Vision AI detects the exact card boundaries and 4 corners for Front and Back.
 *   2. Extracts the real card images via perspective de-skewing.
 *   3. Removes phone camera shadows, cleans background to document white, sharpens real text.
 *   4. Stacks the authentic Front and Back card images onto a single page matching the reference layout.
 */

import {
  warpPerspectiveQuad,
  enhanceRealCardImage,
  stackEnhancedCards,
  expandQuadSafetyMargin,
  calculateCardHeight,
  separateAndExpandCards,
  normalizeQuad,
  makePoint,
  trimCardBackgroundPerimeter
} from './nidImageEnhancer.js';

export const DEFAULT_MODEL = 'google/gemini-2.5-flash';
export const FALLBACK_MODELS = [
  'google/gemini-2.5-flash',
  'qwen/qwen-2.5-vl-72b-instruct',
  'google/gemini-2.0-flash-001',
  'openrouter/free'
];

/**
 * Image-to-image EDITING models (OpenRouter /images endpoint).
 * These are the Google "Nano Banana" / Gemini flash image editing models — NOT the
 * vision-only models above. They are used internally for the real card edit; they are
 * deliberately NOT exposed through the vision model dropdown.
 * Ordered newest-first; the last slug is the known-referenceable safe fallback.
 */
export const DEFAULT_IMAGE_EDIT_MODEL = 'google/gemini-2.5-flash-image';
export const IMAGE_EDIT_FALLBACK_MODELS = [
  'google/gemini-3.1-flash-image',
  'google/gemini-3-pro-image',
  'google/gemini-2.5-flash-image'
];

/**
 * Imperative image-edit prompt tailored to Bangladeshi NID cards.
 * States the CHANGE first (crop/clean/de-skew/whiten/sharpen), then the PRESERVATION clause.
 * Phrased imperatively (never a question) so the image model does not refuse (HTTP 400 STOP)
 * and never regenerates / translates / fabricates real information.
 */
export const DEFAULT_CARD_EDIT_PROMPT = `Edit this photo of a Bangladeshi National Identity (NID) card into a clean, flat, document-quality scan.

Make these changes to the image:
1. Crop tightly and exactly to the 4 physical edges of the card itself. Remove everything outside the card: bedsheet, table, floor, fingers, hands, plastic sleeve, lanyard pouch, clear/colored plastic holder, and clip holes.
2. De-skew and flatten the perspective so the card is a straight, upright rectangle viewed head-on (correct any tilt, rotation, or keystone distortion).
3. Replace the background around the card with pure white.
4. Gently sharpen so the text, numbers, and photo are crisp and readable. Even out lighting and remove camera shadows and glare.

STRICT PRESERVATION — do NOT change the real information in any way:
- Do NOT alter, add, remove, re-type, translate, or regenerate ANY text, Bengali or English characters, name, father/mother name, date of birth, ID / NID number, or any digits.
- Do NOT change or redraw the person's photograph, the signature, the national emblem, the golden chip, the barcode, the flower graphic, or the machine-readable (MRZ) lines.
- Keep every pixel of the real card content exactly as it is. Only crop, straighten, clean the background, and sharpen. This is a real identity document; copy the real information precisely, never invent or substitute anything.`;

/**
 * Retrieve the saved OpenRouter API key.
 */
export function getStoredApiKey() {
  if (typeof localStorage !== 'undefined') {
    const key = localStorage.getItem('OPENROUTER_API_KEY');
    if (key && key.trim().length > 0) return key.trim();
  }
  if (typeof window !== 'undefined' && window.OPENROUTER_API_KEY) {
    return String(window.OPENROUTER_API_KEY).trim();
  }
  return '';
}

/**
 * Save OpenRouter API key into localStorage.
 */
export function setStoredApiKey(key) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('OPENROUTER_API_KEY', (key || '').trim());
  }
}

/**
 * Retrieve the saved AI model id.
 */
export function getStoredModel() {
  if (typeof localStorage !== 'undefined') {
    const migrated = localStorage.getItem('NID_MODEL_MIGRATED_V3');
    if (!migrated) {
      try {
        localStorage.setItem('NID_MODEL_MIGRATED_V3', 'true');
        localStorage.setItem('OPENROUTER_MODEL', DEFAULT_MODEL);
      } catch (_e) {}
      return DEFAULT_MODEL;
    }
    const m = localStorage.getItem('OPENROUTER_MODEL');
    if (m && m.trim().length > 0) return m.trim();
  }
  return DEFAULT_MODEL;
}

/**
 * Save AI model id into localStorage.
 */
export function setStoredModel(model) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('OPENROUTER_MODEL', (model || '').trim());
  }
}

/**
 * Convert a File or Blob into a base64 Data URL.
 */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file provided'));
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Load an image from a Data URL or URL into an HTMLImageElement.
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) return reject(new Error('No image source'));
    if (typeof Image === 'undefined') {
      return resolve({ width: 600, height: 400, naturalWidth: 600, naturalHeight: 400, src });
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let loaded = false;
    img.onload = () => {
      if (!loaded) {
        loaded = true;
        resolve(img);
      }
    };
    img.onerror = () => {
      if (!loaded) {
        loaded = true;
        reject(new Error('Failed to load image'));
      }
    };
    img.src = src;

    // In jsdom / test environments where mock Image doesn't emit onload
    if (typeof process !== 'undefined' && process.env && (process.env.VITEST || process.env.NODE_ENV === 'test')) {
      setTimeout(() => {
        if (!loaded) {
          loaded = true;
          try {
            Object.defineProperty(img, 'naturalWidth', { value: 800, configurable: true });
            Object.defineProperty(img, 'naturalHeight', { value: 600, configurable: true });
          } catch (_e) {}
          resolve(img);
        }
      }, 10);
    }
  });
}

/**
 * Downscale a Data URL so its longest edge is at most `maxEdge` pixels.
 * Prevents oversized sources from timing out on the image-edit endpoint.
 * No-ops (returns the input unchanged) when canvas/document is unavailable (jsdom)
 * or the source is already within the cap.
 *
 * @param {string} dataUrl
 * @param {number} [maxEdge=1600]
 * @returns {Promise<string>}
 */
export async function downscaleDataUrl(dataUrl, maxEdge = 1600) {
  if (!dataUrl || typeof dataUrl !== 'string') return dataUrl;
  if (typeof document === 'undefined') return dataUrl;

  let img;
  try {
    img = await loadImage(dataUrl);
  } catch (_e) {
    return dataUrl;
  }

  const w = img.naturalWidth || img.width || 0;
  const h = img.naturalHeight || img.height || 0;
  if (!w || !h) return dataUrl;

  const longest = Math.max(w, h);
  if (longest <= maxEdge) return dataUrl;

  const scale = maxEdge / longest;
  const targetW = Math.max(1, Math.round(w * scale));
  const targetH = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  try {
    ctx.drawImage(img, 0, 0, targetW, targetH);
    return canvas.toDataURL('image/jpeg', 0.92);
  } catch (_e) {
    return dataUrl;
  }
}

/**
 * Parse and normalize bounding box coordinates from AI models.
 * Handles Qwen pixel coordinates [xmin, ymin, xmax, ymax],
 * normalized 0-1, and 0-1000 scales.
 * Always returns normalized 0-1000 format [ymin, xmin, ymax, xmax].
 *
 * @param {number[]|object} rawBox
 * @param {number} naturalW
 * @param {number} naturalH
 * @returns {number[]} [ymin, xmin, ymax, xmax] (0-1000)
 */
export function parseDetectionBox(rawBox, naturalW = 1000, naturalH = 1000) {
  if (!rawBox) return [0, 0, 1000, 1000];
  const q = normalizeQuad(rawBox, naturalW, naturalH);
  return [
    Math.round(q.top_left.y),
    Math.round(q.top_left.x),
    Math.round(q.bottom_right.y),
    Math.round(q.bottom_right.x)
  ];
}

/**
 * Parse and normalize polygon corners from AI models.
 *
 * @param {object} rawCorners
 * @param {number} naturalW
 * @param {number} naturalH
 * @returns {object|null}
 */
export function parseDetectionCorners(rawCorners, naturalW = 1000, naturalH = 1000) {
  if (!rawCorners || typeof rawCorners !== 'object') return null;
  return normalizeQuad(rawCorners, naturalW, naturalH);
}

/**
 * Crop normalized region [ymin, xmin, ymax, xmax] (0-1000 scale).
 */
export async function cropImageRegion(sourceImg, box) {
  if (!box || box.length < 4) return null;
  const [ymin, xmin, ymax, xmax] = box;
  if (ymax <= ymin || xmax <= xmin) return null;

  const img = typeof sourceImg === 'string' ? await loadImage(sourceImg) : sourceImg;
  const naturalW = img.naturalWidth || img.width || 1;
  const naturalH = img.naturalHeight || img.height || 1;

  const pxX = Math.max(0, Math.round((xmin / 1000) * naturalW));
  const pxY = Math.max(0, Math.round((ymin / 1000) * naturalH));
  const pxW = Math.min(naturalW - pxX, Math.round(((xmax - xmin) / 1000) * naturalW));
  const pxH = Math.min(naturalH - pxY, Math.round(((ymax - ymin) / 1000) * naturalH));

  if (pxW <= 0 || pxH <= 0) return null;

  if (typeof document === 'undefined') {
    return `data:image/png;base64,mock_${pxW}x${pxH}`;
  }

  const canvas = document.createElement('canvas');
  canvas.width = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(img, pxX, pxY, pxW, pxH, 0, 0, pxW, pxH);
  return canvas.toDataURL('image/png');
}

/**
 * Prompt for detecting complete real card boundaries for both Smart NID and Paper NID.
 */
export const NID_DETECTION_PROMPT = `You are an expert document segmentation computer vision AI specialized in Bangladeshi National Identity (NID) cards (both Smart NID Chip Cards and laminated / Temporary Paper NID Cards).

Analyze this image carefully.
The image contains photograph(s), scan(s), or graphics of Bangladeshi NID card(s). The card may be placed on a bedsheet, table, floor, held in human hands, or enclosed inside a plastic lanyard sleeve/pouch/holder.

CRITICAL RULES — DETECT THE 4 CORNERS OF THE PHYSICAL CARD ONLY:
1. EXCLUDE ALL EXTERNAL BACKGROUND AND HOLDERS:
   - Completely ignore and exclude any lanyard pouch, plastic sleeve/holder, transparent edges, colored plastic frames (e.g. purple, blue, clear plastic), clip holes, bedsheets, table surfaces, fingers, or hands.
   - The 4 corners MUST snap PRECISELY to the 4 rounded corners of the authentic physical card itself (CR-80 plastic card or paper card perimeter).
   - "background full remove korte hobe. 4 ta corner er edge milate hobe." Do NOT include even 1 millimeter of the surrounding plastic sleeve, table, or bedsheet in the card boundary!

2. TWO SEPARATE CARDS (FRONT AND BACK):
   - Every Bangladeshi NID document has TWO separate parts: FRONT and BACK.
   - When both parts appear in the image (stacked vertically or placed side-by-side):
     YOU MUST ALWAYS DETECT AND RETURN BOTH AS TWO SEPARATE CARDS!
     NEVER combine them into one bounding box.
     NEVER mark "back.is_present": false if the back section is visible!

3. CARD SPECIFICS:
   - For Paper NID / Temporary NID ("সাময়িক জাতীয় পরিচয় পত্র"):
     * FRONT CARD: Starts at top emblem and "গণপ্রজাতন্ত্রী বাংলাদেশ সরকার", contains photo, name, father/mother name, DOB, and ends right below "ID NO: ...".
     * BACK CARD: Starts at "এই কার্ডটি গণপ্রজাতন্ত্রী বাংলাদেশ সরকারের সম্পত্তি...", contains address ("ঠিকানা: ..."), issue/expiry dates, signature, and barcode.
   - For Smart NID Chip Cards:
     * FRONT CARD: National emblem, "গণপ্রজাতন্ত্রী বাংলাদেশ সরকার", photo, golden chip, Bengali name, English name, DOB, NID No.
     * BACK CARD: Barcode at top, address ("ঠিকানা"), blood group, issue date, signature, flower graphic, and 3-line MRZ text at bottom.
   - Standard CR-80 card aspect ratio is 85.6mm x 53.98mm (~1.586 : 1, or height ~63% of width).

4. 100% PRESERVATION WITH ZERO TEXT/EMBLEM CLIPPING:
   - "কোনো অংশই কাটা যাবে না" — Every single millimeter of authentic card content must be preserved: emblem, photo, chip, signature, barcode, and MRZ lines.
   - For FRONT card: The bottom edge MUST extend below the holder's signature and the full NID number (e.g. "280 451 1984"). NEVER slice off or cut through the signature or NID number!
   - For BACK card: The top edge MUST include the full barcode. The left edge MUST include the full Bengali address ("ঠিকানা: ..."). The bottom edge MUST include all 3 full lines of machine-readable MRZ text (e.g. "KHATUN<<..."). NEVER slice off or cut through MRZ lines!
   - Always expand the boundary outward rather than cutting inward into any text or signature.

Coordinates must be returned in 0-1000 normalized scale (where 0,0 is top-left, 1000,1000 is bottom-right):
Return strictly valid JSON with explicit coordinates:
{
  "front": {
    "is_present": true,
    "corners": {
      "top_left": { "x": number, "y": number },
      "top_right": { "x": number, "y": number },
      "bottom_right": { "x": number, "y": number },
      "bottom_left": { "x": number, "y": number }
    },
    "bounds": { "xmin": number, "ymin": number, "xmax": number, "ymax": number },
    "box_2d": [xmin, ymin, xmax, ymax],
    "rotation_degrees": 0
  },
  "back": {
    "is_present": true,
    "corners": {
      "top_left": { "x": number, "y": number },
      "top_right": { "x": number, "y": number },
      "bottom_right": { "x": number, "y": number },
      "bottom_left": { "x": number, "y": number }
    },
    "bounds": { "xmin": number, "ymin": number, "xmax": number, "ymax": number },
    "box_2d": [xmin, ymin, xmax, ymax],
    "rotation_degrees": 0
  },
  "enhancement": {
    "brightness": 105,
    "contrast": 115,
    "sharpness": 25,
    "clean_background": true
  }
}`;

/**
 * Call OpenRouter Vision AI to detect card boundaries in the user's uploaded image(s).
 */
export async function detectCardBoundariesWithAI(params) {
  const {
    apiKey = getStoredApiKey(),
    model = getStoredModel(),
    images = [],
    onProgress = () => {}
  } = params;

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('OpenRouter API Key is required. Please set it in Settings.');
  }

  if (!images || images.length === 0) {
    throw new Error('Please upload at least one NID image.');
  }

  const candidateModels = [model, ...FALLBACK_MODELS.filter(m => m !== model)];
  let lastError = null;
  let parsed = null;

  for (let i = 0; i < candidateModels.length; i++) {
    const activeModel = candidateModels[i];
    onProgress(20 + i * 5, `Analyzing real NID card boundaries with ${activeModel.split('/').pop()}...`);

    const userContent = [{ type: 'text', text: NID_DETECTION_PROMPT }];
    images.forEach((imgDataUrl) => {
      userContent.push({
        type: 'image_url',
        image_url: { url: imgDataUrl }
      });
    });

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 60000) : null;

    let response;
    try {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
          'X-Title': 'NID Stack & Enhance'
        },
        body: JSON.stringify({
          model: activeModel,
          messages: [{ role: 'user', content: userContent }],
          temperature: 0
        }),
        signal: controller ? controller.signal : undefined
      });
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        lastError = new Error('AI request timed out. Please check your connection and try again.');
        continue;
      }
      lastError = err;
      continue;
    }
    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      let errBody;
      try {
        errBody = await response.json();
      } catch (_e) {}
      const msg = errBody?.error?.message || response.statusText || 'OpenRouter API error';
      lastError = new Error(`OpenRouter Error (${response.status}): ${msg}`);
      // Retry if 429 (rate limit) or 404 (model not found) or 503 (service unavailable)
      if ((response.status === 429 || response.status === 404 || response.status === 503 || response.status === 500) && i < candidateModels.length - 1) {
        onProgress(30 + i * 5, `${activeModel.split('/').pop()} busy (${response.status}), switching to fallback model...`);
        continue;
      }
      throw lastError;
    }

    onProgress(70, 'Processing card geometry & coordinates...');

    let data;
    try {
      data = await response.json();
    } catch (e) {
      lastError = new Error('Invalid JSON response from OpenRouter API.');
      continue;
    }

    const rawContent = data?.choices?.[0]?.message?.content;
    if (!rawContent) {
      lastError = new Error('No response returned by AI model.');
      continue;
    }

    let cleaned = rawContent.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/i, '').replace(/```\s*$/i, '');
    }

    try {
      parsed = JSON.parse(cleaned);
      break;
    } catch (_e) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
          break;
        } catch (err2) {
          lastError = new Error('Failed to parse AI detection JSON: ' + err2.message);
        }
      } else {
        lastError = new Error('Invalid JSON received from AI model.');
      }
    }
  }

  if (!parsed) {
    throw lastError || new Error('Failed to detect card boundaries with AI.');
  }

  return parsed;
}

/**
 * Main AI Image Enhancer pipeline:
 * Extracts, de-skews, fixes lighting/shadows, and stacks the user's authentic cards.
 *
 * @param {object} params
 * @param {string[]} params.images - 1 or 2 data URLs
 * @param {HTMLCanvasElement} [params.targetCanvas]
 * @param {number} [params.spacing=55]
 * @param {string} [params.bgColor='#ffffff']
 * @param {(pct: number, msg: string) => void} [params.onProgress]
 * @returns {Promise<object>}
 */
export async function enhanceRealNidImages(params) {
  const {
    apiKey = getStoredApiKey(),
    model = getStoredModel(),
    images = [],
    targetCanvas = null,
    spacing = 55,
    bgColor = '#ffffff',
    onProgress = () => {}
  } = params;

  // 1. Detect boundaries with AI
  const detection = await detectCardBoundariesWithAI({
    apiKey,
    model,
    images,
    onProgress
  });

  onProgress(80, 'De-skewing and cropping real card images...');

  // Identify source images:
  // If 2 images: Image 0 = Front, Image 1 = Back
  // If 1 image: Image 0 has both Front and Back
  const frontSourceDataUrl = images[0];
  const backSourceDataUrl = images.length > 1 ? images[1] : images[0];

  const frontImg = await loadImage(frontSourceDataUrl);
  const backImg = await loadImage(backSourceDataUrl);

  const frontInfo = detection.front || {};
  const backInfo = detection.back || {};
  const enhanceParams = detection.enhancement || {};

  const fW = frontImg.naturalWidth || frontImg.width || 1000;
  const fH = frontImg.naturalHeight || frontImg.height || 1000;
  const bW = backImg.naturalWidth || backImg.width || 1000;
  const bH = backImg.naturalHeight || backImg.height || 1000;

  // Normalize AI coordinates to 0-1000 scale
  if (frontInfo.is_present !== false) {
    if (frontInfo.box_2d) {
      frontInfo.box_2d = parseDetectionBox(frontInfo.box_2d, fW, fH);
    }
    if (frontInfo.corners) {
      frontInfo.corners = parseDetectionCorners(frontInfo.corners, fW, fH) || frontInfo.corners;
    }
  }

  if (backInfo.is_present !== false) {
    if (backInfo.box_2d) {
      backInfo.box_2d = parseDetectionBox(backInfo.box_2d, bW, bH);
    }
    if (backInfo.corners) {
      backInfo.corners = parseDetectionCorners(backInfo.corners, bW, bH) || backInfo.corners;
    }
  }

  // If 1 image was uploaded, ensure BOTH Front and Back are extracted!
  if (images.length === 1) {
    let hasFront = frontInfo && frontInfo.is_present !== false && (frontInfo.corners || frontInfo.bounds || frontInfo.box_2d);
    let hasBack = backInfo && backInfo.is_present !== false && (backInfo.corners || backInfo.bounds || backInfo.box_2d);

    // If only front was detected (or model lumped both cards into a single "front" box)
    if (hasFront && !hasBack) {
      const fQuad = normalizeQuad(frontInfo.corners || frontInfo.bounds || frontInfo.box_2d, fW, fH);
      const fMinY = Math.min(fQuad.top_left.y, fQuad.top_right.y);
      const fMaxY = Math.max(fQuad.bottom_left.y, fQuad.bottom_right.y);
      const fMinX = Math.min(fQuad.top_left.x, fQuad.bottom_left.x);
      const fMaxX = Math.max(fQuad.top_right.x, fQuad.bottom_right.x);
      const spanX = Math.max(10, fMaxX - fMinX);
      const spanY = Math.max(10, fMaxY - fMinY);
      const pxSpanX = (spanX / 1000) * fW;
      const pxSpanY = (spanY / 1000) * fH;
      const aspectHtoW = pxSpanY / (pxSpanX || 1);

      // If the detected bounding box has aspect ratio H/W > 0.82 (or covers > 70% vertical height),
      // it contains TWO stacked cards (since a single CR-80 card H/W is ~0.63)
      if (aspectHtoW > 0.82 || fMaxY - fMinY > 700) {
        const midY = Math.round((fMinY + fMaxY) / 2);
        frontInfo.is_present = true;
        frontInfo.corners = {
          top_left: makePoint(fMinX, fMinY),
          top_right: makePoint(fMaxX, fMinY),
          bottom_right: makePoint(fMaxX, midY),
          bottom_left: makePoint(fMinX, midY)
        };
        backInfo.is_present = true;
        backInfo.corners = {
          top_left: makePoint(fMinX, midY),
          top_right: makePoint(fMaxX, midY),
          bottom_right: makePoint(fMaxX, fMaxY),
          bottom_left: makePoint(fMinX, fMaxY)
        };
        hasBack = true;
      } else if (fMaxY <= 750) {
        // Vertical stacked: Back card is in the bottom portion
        backInfo.is_present = true;
        const topY = Math.min(950, fMaxY + 2);
        backInfo.corners = {
          top_left: makePoint(0, topY),
          top_right: makePoint(1000, topY),
          bottom_right: makePoint(1000, 1000),
          bottom_left: makePoint(0, 1000)
        };
        hasBack = true;
      } else if (fMaxX <= 750) {
        // Horizontal side-by-side: Back card is in the right portion
        backInfo.is_present = true;
        const leftX = Math.min(950, fMaxX + 2);
        backInfo.corners = {
          top_left: makePoint(leftX, 0),
          top_right: makePoint(1000, 0),
          bottom_right: makePoint(1000, 1000),
          bottom_left: makePoint(leftX, 1000)
        };
        hasBack = true;
      }
    } else if (!hasFront && hasBack) {
      // If only back was detected
      const bQuad = normalizeQuad(backInfo.corners || backInfo.bounds || backInfo.box_2d, bW, bH);
      const bMinY = Math.min(bQuad.top_left.y, bQuad.top_right.y);
      const bMaxY = Math.max(bQuad.bottom_left.y, bQuad.bottom_right.y);
      const bMinX = Math.min(bQuad.top_left.x, bQuad.bottom_left.x);
      const bMaxX = Math.max(bQuad.top_right.x, bQuad.bottom_right.x);
      const spanX = Math.max(10, bMaxX - bMinX);
      const spanY = Math.max(10, bMaxY - bMinY);
      const pxSpanX = (spanX / 1000) * bW;
      const pxSpanY = (spanY / 1000) * bH;
      const aspectHtoW = pxSpanY / (pxSpanX || 1);

      if (aspectHtoW > 0.82 || bMaxY - bMinY > 700) {
        const midY = Math.round((bMinY + bMaxY) / 2);
        frontInfo.is_present = true;
        frontInfo.corners = {
          top_left: makePoint(bMinX, bMinY),
          top_right: makePoint(bMaxX, bMinY),
          bottom_right: makePoint(bMaxX, midY),
          bottom_left: makePoint(bMinX, midY)
        };
        backInfo.is_present = true;
        backInfo.corners = {
          top_left: makePoint(bMinX, midY),
          top_right: makePoint(bMaxX, midY),
          bottom_right: makePoint(bMaxX, bMaxY),
          bottom_left: makePoint(bMinX, bMaxY)
        };
        hasFront = true;
      } else if (bMinY >= 250) {
        frontInfo.is_present = true;
        const botY = Math.max(50, bMinY - 2);
        frontInfo.corners = {
          top_left: makePoint(0, 0),
          top_right: makePoint(1000, 0),
          bottom_right: makePoint(1000, botY),
          bottom_left: makePoint(0, botY)
        };
        hasFront = true;
      } else if (bMinX >= 250) {
        frontInfo.is_present = true;
        const rightX = Math.max(50, bMinX - 2);
        frontInfo.corners = {
          top_left: makePoint(0, 0),
          top_right: makePoint(rightX, 0),
          bottom_right: makePoint(rightX, 1000),
          bottom_left: makePoint(0, 1000)
        };
        hasFront = true;
      }
    }

    // Ultimate fallback if either side is still missing when only 1 image provided:
    if (!hasFront || !hasBack) {
      const imgAspect = fH / (fW || 1);
      if (imgAspect >= 0.85) {
        // Portrait / vertical stacked
        if (!hasFront) {
          frontInfo.is_present = true;
          frontInfo.corners = {
            top_left: makePoint(0, 0),
            top_right: makePoint(1000, 0),
            bottom_right: makePoint(1000, 500),
            bottom_left: makePoint(0, 500)
          };
        }
        if (!hasBack) {
          backInfo.is_present = true;
          backInfo.corners = {
            top_left: makePoint(0, 500),
            top_right: makePoint(1000, 500),
            bottom_right: makePoint(1000, 1000),
            bottom_left: makePoint(0, 1000)
          };
        }
      } else {
        // Landscape / horizontal side-by-side
        if (!hasFront) {
          frontInfo.is_present = true;
          frontInfo.corners = {
            top_left: makePoint(0, 0),
            top_right: makePoint(500, 0),
            bottom_right: makePoint(500, 1000),
            bottom_left: makePoint(0, 1000)
          };
        }
        if (!hasBack) {
          backInfo.is_present = true;
          backInfo.corners = {
            top_left: makePoint(500, 0),
            top_right: makePoint(1000, 0),
            bottom_right: makePoint(1000, 1000),
            bottom_left: makePoint(500, 1000)
          };
        }
      }
    }
  }

  const cardW = 700;

  // Handle multi-card separation (Horizontal side-by-side or Vertical stacked)
  let frontCorners = null;
  let backCorners = null;

  if (images.length === 1 && frontInfo.is_present !== false && backInfo.is_present !== false) {
    const separated = separateAndExpandCards(frontInfo, backInfo, fW, fH);
    frontCorners = separated.frontCorners;
    backCorners = separated.backCorners;
  } else {
    if (frontInfo.is_present !== false) {
      const raw = frontInfo.corners || frontInfo.box_2d || [0, 0, 1000, 1000];
      frontCorners = expandQuadSafetyMargin(raw, { marginPct: 0.01, minPadUnits: 5 });
    }
    if (backInfo.is_present !== false) {
      const raw = backInfo.corners || backInfo.box_2d || [0, 0, 1000, 1000];
      backCorners = expandQuadSafetyMargin(raw, { marginPct: 0.01, minPadUnits: 5 });
    }
  }

  // Calculate dynamic proportional height (CR-80 standard ~0.6306)
  const frontH = calculateCardHeight(
    frontCorners,
    frontImg.naturalWidth || frontImg.width,
    frontImg.naturalHeight || frontImg.height,
    cardW
  );
  const backH = calculateCardHeight(
    backCorners,
    backImg.naturalWidth || backImg.width,
    backImg.naturalHeight || backImg.height,
    cardW
  );

  let frontCanvas = null;
  let backCanvas = null;

  // Extract and enhance Front card if present
  if (frontInfo.is_present !== false) {
    const rawFront = warpPerspectiveQuad(frontImg, frontCorners, cardW, frontH, { expandMargin: false });
    const trimmedFront = trimCardBackgroundPerimeter(rawFront);
    frontCanvas = enhanceRealCardImage(trimmedFront, {
      cleanBackground: enhanceParams.clean_background !== false,
      contrastBoost: (enhanceParams.contrast || 115) / 100,
      brightnessBoost: (enhanceParams.brightness || 105) / 100,
      sharpenAmount: enhanceParams.sharpness || 25,
      addBorder: false
    });
  }

  // Extract and enhance Back card if present
  if (backInfo.is_present !== false) {
    const rawBack = warpPerspectiveQuad(backImg, backCorners, cardW, backH, { expandMargin: false });
    const trimmedBack = trimCardBackgroundPerimeter(rawBack);
    backCanvas = enhanceRealCardImage(trimmedBack, {
      cleanBackground: enhanceParams.clean_background !== false,
      contrastBoost: (enhanceParams.contrast || 115) / 100,
      brightnessBoost: (enhanceParams.brightness || 105) / 100,
      sharpenAmount: enhanceParams.sharpness || 25,
      addBorder: false
    });
  }

  onProgress(92, 'Stacking real enhanced cards onto page canvas...');

  // Stack real cards onto target canvas
  const stackedCanvas = stackEnhancedCards(frontCanvas, backCanvas, {
    cardWidth: cardW,
    spacing: Math.max(25, spacing),
    bgColor,
    targetCanvas
  });

  onProgress(100, 'Real NID Enhancement complete!');

  return {
    detection,
    frontCanvas,
    backCanvas,
    stackedCanvas,
    frontDataUrl: frontCanvas && typeof frontCanvas.toDataURL === 'function' ? frontCanvas.toDataURL('image/png') : null,
    backDataUrl: backCanvas && typeof backCanvas.toDataURL === 'function' ? backCanvas.toDataURL('image/png') : null
  };
}

/**
 * Call an OpenRouter image-EDITING model (/api/v1/images) to crop, de-skew, whiten and
 * sharpen the user's REAL card image without altering any real information.
 *
 * Posts a single request and tries an ordered list of image-edit models, advancing to the
 * next slug on retryable failures (429/500/502/503) and on 400 refusals ("could not
 * generate an image" / "STOP"). Parses data[0].b64_json (+ optional media_type) into a
 * usable data URL. All fetch/AbortController usage is guarded for jsdom/vitest.
 *
 * @param {object} params
 * @param {string} params.apiKey
 * @param {string} [params.model] - preferred image-edit model slug
 * @param {string} params.imageDataUrl - source image (base64 data URL or https URL)
 * @param {string} [params.prompt]
 * @param {(pct:number, msg:string)=>void} [params.onProgress]
 * @returns {Promise<{ dataUrl: string, model: string, cost: (number|null) }>}
 */
export async function editCardImageWithAI(params) {
  const {
    apiKey = getStoredApiKey(),
    model = DEFAULT_IMAGE_EDIT_MODEL,
    imageDataUrl,
    prompt = DEFAULT_CARD_EDIT_PROMPT,
    onProgress = () => {}
  } = params || {};

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('OpenRouter API Key is required. Please set it in Settings.');
  }
  if (!imageDataUrl) {
    throw new Error('No source image provided for AI editing.');
  }
  if (typeof fetch === 'undefined') {
    throw new Error('Network fetch is not available in this environment.');
  }

  // Ordered, de-duplicated try-list: preferred model first, then fallbacks.
  const candidateModels = [];
  [model || DEFAULT_IMAGE_EDIT_MODEL, ...IMAGE_EDIT_FALLBACK_MODELS].forEach((m) => {
    if (m && !candidateModels.includes(m)) candidateModels.push(m);
  });

  let lastError = null;

  for (let i = 0; i < candidateModels.length; i++) {
    const activeModel = candidateModels[i];
    onProgress(40 + i * 5, `Editing real NID card with ${activeModel.split('/').pop()}...`);

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 60000) : null;

    let response;
    try {
      response = await fetch('https://openrouter.ai/api/v1/images', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
          'X-Title': 'NID Stack & Enhance'
        },
        body: JSON.stringify({
          model: activeModel,
          prompt,
          input_references: [
            {
              type: 'image_url',
              image_url: { url: imageDataUrl }
            }
          ]
        }),
        signal: controller ? controller.signal : undefined
      });
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      if (err && err.name === 'AbortError') {
        lastError = new Error('AI image edit timed out. Please check your connection and try again.');
        continue;
      }
      lastError = err instanceof Error ? err : new Error(String(err));
      continue;
    }
    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      let errBody;
      try {
        errBody = await response.json();
      } catch (_e) {}
      const msg = errBody?.error?.message || response.statusText || 'OpenRouter image API error';
      const status = response.status;

      // Distinguish "key lacks image-model access" from a model refusal.
      if (status === 401 || status === 403) {
        throw new Error(`Your OpenRouter key lacks access to image-editing models (${status}): ${msg}`);
      }

      lastError = new Error(`OpenRouter image Error (${status}): ${msg}`);

      // 400 refusals ("could not generate an image" / "STOP") are often model-specific — try next.
      const isRefusal = status === 400 && /could not generate|STOP|refus/i.test(msg);
      const isRetryable = status === 429 || status === 500 || status === 502 || status === 503 || isRefusal;
      if (isRetryable && i < candidateModels.length - 1) {
        onProgress(45 + i * 5, `${activeModel.split('/').pop()} unavailable (${status}), trying another image model...`);
        continue;
      }
      throw lastError;
    }

    let data;
    try {
      data = await response.json();
    } catch (_e) {
      lastError = new Error('Invalid JSON response from OpenRouter image API.');
      continue;
    }

    const first = data?.data?.[0];
    const b64 = first?.b64_json;
    if (!b64) {
      lastError = new Error('The image model did not return an edited image.');
      continue;
    }
    const mediaType = first?.media_type || 'image/png';
    const dataUrl = `data:${mediaType};base64,${b64}`;
    const cost = (data?.usage && typeof data.usage.cost === 'number') ? data.usage.cost : null;

    return { dataUrl, model: activeModel, cost };
  }

  throw lastError || new Error('Failed to edit the card image with AI.');
}

/**
 * Draw a loaded image onto a fresh canvas (guarded for jsdom).
 * Returns null when canvas is unavailable.
 */
function imageToCanvas(img) {
  if (typeof document === 'undefined') return null;
  const w = img.naturalWidth || img.width || 0;
  const h = img.naturalHeight || img.height || 0;
  if (!w || !h) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

/**
 * High-level pipeline using the REAL image-editing path.
 * Same signature and return shape as enhanceRealNidImages so the controller contract is
 * unchanged. Edits each uploaded slot with editCardImageWithAI, loads the edited data URLs
 * into canvases, then reuses the existing stackEnhancedCards layout.
 *
 * - Two-image path: front and back are edited independently and stacked.
 * - Single-image path: one whole-sheet edit (crop/de-skew/clean) still yields both cards on
 *   one sheet; to guarantee a proper front/back split we fall back to enhanceRealNidImages
 *   (the proven local split) for the separation step.
 * - Any unrecoverable editing failure falls back to enhanceRealNidImages so a usable result
 *   is always returned.
 *
 * @param {object} params - same shape as enhanceRealNidImages
 * @returns {Promise<object>}
 */
export async function enhanceNidImagesWithAIEdit(params) {
  const {
    apiKey = getStoredApiKey(),
    images = [],
    targetCanvas = null,
    spacing = 55,
    bgColor = '#ffffff',
    onProgress = () => {}
  } = params || {};

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('OpenRouter API Key is required. Please set it in Settings.');
  }
  if (!images || images.length === 0) {
    throw new Error('Please upload at least one NID image.');
  }

  const cardW = 680;

  try {
    // Single uploaded image that holds BOTH front and back: the local split is the proven
    // way to separate them, so delegate to the existing pipeline.
    if (images.length === 1) {
      return await enhanceRealNidImages(params);
    }

    onProgress(20, 'Preparing real card images for AI editing...');

    // Two-image primary path: edit front and back independently.
    const frontSource = await downscaleDataUrl(images[0], 1600);
    const backSource = await downscaleDataUrl(images[1], 1600);

    let editCost = 0;

    onProgress(35, 'Editing the front card with AI...');
    const frontEdit = await editCardImageWithAI({
      apiKey,
      model: DEFAULT_IMAGE_EDIT_MODEL,
      imageDataUrl: frontSource,
      prompt: DEFAULT_CARD_EDIT_PROMPT,
      onProgress
    });
    if (typeof frontEdit.cost === 'number') editCost += frontEdit.cost;

    onProgress(60, 'Editing the back card with AI...');
    const backEdit = await editCardImageWithAI({
      apiKey,
      model: DEFAULT_IMAGE_EDIT_MODEL,
      imageDataUrl: backSource,
      prompt: DEFAULT_CARD_EDIT_PROMPT,
      onProgress
    });
    if (typeof backEdit.cost === 'number') editCost += backEdit.cost;

    onProgress(80, 'Loading edited cards...');
    const frontImg = await loadImage(frontEdit.dataUrl);
    const backImg = await loadImage(backEdit.dataUrl);

    const frontCanvas = imageToCanvas(frontImg);
    const backCanvas = imageToCanvas(backImg);

    onProgress(92, 'Stacking edited cards onto page canvas...');
    const stackedCanvas = stackEnhancedCards(frontCanvas, backCanvas, {
      cardWidth: cardW,
      spacing: Math.max(25, spacing),
      bgColor,
      targetCanvas
    });

    onProgress(100, 'Real NID Enhancement complete!');

    return {
      frontCanvas,
      backCanvas,
      stackedCanvas,
      editCost,
      frontDataUrl: frontCanvas && typeof frontCanvas.toDataURL === 'function'
        ? frontCanvas.toDataURL('image/png')
        : frontEdit.dataUrl,
      backDataUrl: backCanvas && typeof backCanvas.toDataURL === 'function'
        ? backCanvas.toDataURL('image/png')
        : backEdit.dataUrl
    };
  } catch (err) {
    // Degrade gracefully to the proven coordinate/de-skew pipeline so the user always
    // gets a usable stacked result even if the image-edit model refuses or is unavailable.
    onProgress(30, 'AI image editing unavailable, falling back to local enhancement...');
    return await enhanceRealNidImages(params);
  }
}
