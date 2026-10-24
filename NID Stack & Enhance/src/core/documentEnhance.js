/**
 * documentEnhance.js — 1-Click Document & NID Image Enhancement Engine.
 *
 * Provides intelligent 1-click document enhancement (similar to Microsoft Lens
 * "Document" mode and CamScanner "Magic Color"):
 *  1. Automatic white balance & paper background whitening:
 *     Samples the brightest percentiles corresponding to paper/card background,
 *     estimates per-channel gain, and cleans grayish/yellowish shadows to paper white.
 *  2. Tone mapping & contrast optimization:
 *     Deepens text, signatures, and borders for high contrast and legibility,
 *     while preserving color fidelity on ID photos, seals, and flags.
 *  3. Unsharp Mask Sharpening:
 *     Applies a 3x3 high-pass sharpening convolution to make fine Bengali
 *     fonts, dates, and card digits crisp and razor sharp.
 *  4. Total guarantee: Pure math core with zero DOM dependencies; never throws.
 */

/**
 * Clamp value into 0..255 byte range.
 */
function clampByte(val) {
  if (val < 0) return 0;
  if (val > 255) return 255;
  return Math.round(val);
}

/**
 * Pure pixel transform: enhances an RGBA pixel buffer in-place or into a new buffer.
 *
 * @param {Uint8ClampedArray|Uint8Array|Array<number>} data - RGBA source pixels
 * @param {number} width - image width
 * @param {number} height - image height
 * @returns {Uint8ClampedArray} new enhanced RGBA buffer
 */
export function enhanceDocumentBuffer(data, width, height, strength = 1.0) {
  const s = Number.isFinite(strength) ? Math.max(0, Math.min(1, strength)) : 1.0;
  const w = Math.max(1, Math.floor(Number(width) || 0));
  const h = Math.max(1, Math.floor(Number(height) || 0));
  const total = w * h;
  const out = new Uint8ClampedArray(total * 4);

  if (!data || data.length < total * 4) {
    if (data && data.length) {
      out.set(data.subarray ? data.subarray(0, out.length) : data.slice(0, out.length));
    }
    return out;
  }

  // If strength is 0, return verbatim copy
  if (s <= 0) {
    out.set(data.subarray ? data.subarray(0, total * 4) : data.slice(0, total * 4));
    return out;
  }

  // 1. Calculate luminance histogram & find black/white percentiles
  const luma = new Float32Array(total);
  const hist = new Int32Array(256);
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const l = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
    luma[i] = l;
    hist[Math.min(255, Math.max(0, l))]++;
  }

  // Black point (1st percentile: darkest text/ink floor)
  let count = 0;
  let blackPoint = 0;
  const p1 = total * 0.01;
  for (let i = 0; i < 256; i++) {
    count += hist[i];
    if (count >= p1) {
      blackPoint = i;
      break;
    }
  }

  // White point (96th percentile: paper background ceiling)
  count = 0;
  let whitePoint = 255;
  const p96 = total * 0.96;
  for (let i = 0; i < 256; i++) {
    count += hist[i];
    if (count >= p96) {
      whitePoint = i;
      break;
    }
  }

  // Ensure minimum separation so flat images don't explode
  if (whitePoint - blackPoint < 35) {
    blackPoint = Math.max(0, blackPoint - 20);
    whitePoint = Math.min(255, whitePoint + 20);
  }

  // 2. Estimate paper background color from upper 15% brightest pixels
  let bgR = 0, bgG = 0, bgB = 0, bgCount = 0;
  const threshBg = whitePoint * 0.90;
  for (let i = 0; i < total; i++) {
    if (luma[i] >= threshBg) {
      const idx = i * 4;
      bgR += data[idx];
      bgG += data[idx + 1];
      bgB += data[idx + 2];
      bgCount++;
    }
  }

  if (bgCount > 0) {
    bgR /= bgCount;
    bgG /= bgCount;
    bgB /= bgCount;
  } else {
    bgR = whitePoint;
    bgG = whitePoint;
    bgB = whitePoint;
  }

  // White balance gains (target paper white ~252)
  const targetWhite = 252;
  const gainR = targetWhite / Math.max(110, bgR);
  const gainG = targetWhite / Math.max(110, bgG);
  const gainB = targetWhite / Math.max(110, bgB);

  // 3. Dynamic range tone mapping & progressive text deepening
  const range = Math.max(1, whitePoint - blackPoint);
  const temp = new Uint8ClampedArray(total * 4);

  // Progressive text darkening: as strength s increases, darkFloor drops down to 0.18
  // making letters, digits, and signatures deeply dark and crystal-clear.
  const darkFloor = 0.50 - 0.32 * s;
  const textThresh = 0.52;
  const bgThresh = 0.65;

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const r = data[idx] * gainR;
    const g = data[idx + 1] * gainG;
    const b = data[idx + 2] * gainB;
    const a = data[idx + 3];

    const currentLuma = 0.299 * r + 0.587 * g + 0.114 * b;
    let norm = (currentLuma - blackPoint) / range;
    norm = Math.max(0, Math.min(1, norm));

    let factor;
    if (norm > bgThresh) {
      // Paper background: whiten smoothly toward pure white
      const t = (norm - bgThresh) / (1.0 - bgThresh);
      factor = 1.0 + t * (0.22 + 0.26 * s);
    } else if (norm < textThresh) {
      // Text and signatures: progressively deepen to rich, clear dark black
      const t = norm / textThresh;
      factor = darkFloor + (1.0 - darkFloor) * Math.pow(t, 0.75);
    } else {
      // Midtones (photos, card graphics)
      factor = 1.0;
    }

    temp[idx] = clampByte(r * factor);
    temp[idx + 1] = clampByte(g * factor);
    temp[idx + 2] = clampByte(b * factor);
    temp[idx + 3] = a;
  }

  // 4. Adaptive unsharp mask sharpening (amount scales with strength from 0.22 to 0.50)
  const amount = 0.22 + 0.28 * s;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const ym1 = Math.max(0, y - 1) * w;
    const yp1 = Math.min(h - 1, y + 1) * w;

    for (let x = 0; x < w; x++) {
      const xm1 = Math.max(0, x - 1);
      const xp1 = Math.min(w - 1, x + 1);

      const idx = (row + x) * 4;
      const idxT = (ym1 + x) * 4;
      const idxB = (yp1 + x) * 4;
      const idxL = (row + xm1) * 4;
      const idxR = (row + xp1) * 4;

      for (let c = 0; c < 3; c++) {
        const center = temp[idx + c];
        const neighbors = (temp[idxT + c] + temp[idxB + c] + temp[idxL + c] + temp[idxR + c]) * 0.25;
        const diff = center - neighbors;
        out[idx + c] = clampByte(center + diff * amount);
      }
      out[idx + 3] = temp[idx + 3]; // Preserve alpha channel
    }
  }

  // If strength < 1.0, blend smoothly with input data
  if (s < 0.999) {
    for (let i = 0; i < total; i++) {
      const idx = i * 4;
      out[idx] = clampByte(data[idx] * (1 - s) + out[idx] * s);
      out[idx + 1] = clampByte(data[idx + 1] * (1 - s) + out[idx + 1] * s);
      out[idx + 2] = clampByte(data[idx + 2] * (1 - s) + out[idx + 2] * s);
    }
  }

  return out;
}

/**
 * High-level helper: Enhances an HTMLImageElement or Canvas in-browser.
 *
 * @param {HTMLImageElement|HTMLCanvasElement} sourceImage
 * @param {Document} [doc]
 * @param {number} [strength=1.0]
 * @returns {{image: HTMLImageElement, dataUrl: string, width: number, height: number}|null}
 */
export function enhanceImageSource(sourceImage, doc, strength = 1.0) {
  try {
    if (!sourceImage) return null;
    const currentDoc = doc || (typeof document !== 'undefined' ? document : null);
    if (!currentDoc || typeof currentDoc.createElement !== 'function') return null;

    const width = sourceImage.naturalWidth || sourceImage.width || 0;
    const height = sourceImage.naturalHeight || sourceImage.height || 0;
    if (width <= 0 || height <= 0) return null;

    const canvas = currentDoc.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(sourceImage, 0, 0, width, height);
    const imgData = ctx.getImageData(0, 0, width, height);
    const enhancedData = enhanceDocumentBuffer(imgData.data, width, height, strength);

    const outImgData = ctx.createImageData(width, height);
    outImgData.data.set(enhancedData);
    ctx.putImageData(outImgData, 0, 0);

    const dataUrl = canvas.toDataURL('image/png');
    const outImg = new Image();
    outImg.src = dataUrl;

    return {
      image: outImg,
      dataUrl,
      width,
      height,
    };
  } catch (_err) {
    return null;
  }
}

export default enhanceDocumentBuffer;
