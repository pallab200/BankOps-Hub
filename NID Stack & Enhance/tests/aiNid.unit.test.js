import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DEFAULT_MODEL,
  FALLBACK_MODELS,
  DEFAULT_IMAGE_EDIT_MODEL,
  IMAGE_EDIT_FALLBACK_MODELS,
  DEFAULT_CARD_EDIT_PROMPT,
  getStoredApiKey,
  setStoredApiKey,
  getStoredModel,
  setStoredModel,
  cropImageRegion,
  editCardImageWithAI,
  downscaleDataUrl,
  NID_DETECTION_PROMPT
} from '../src/core/aiNidService.js';
import {
  warpPerspectiveQuad,
  enhanceRealCardImage,
  stackEnhancedCards,
  expandQuadSafetyMargin,
  calculateCardHeight,
  separateAndExpandCards,
  normalizeQuad
} from '../src/core/nidImageEnhancer.js';
import { renderNidStackToCanvas } from '../src/core/nidRenderer.js';

let origCreateElement;

beforeEach(() => {
  localStorage.clear();

  const mockCtx = {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((txt) => ({ width: (txt || '').length * 8 })),
    save: vi.fn(),
    restore: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(400) })),
    createImageData: vi.fn((w, h) => ({ data: new Uint8ClampedArray(w * h * 4) })),
    putImageData: vi.fn()
  };

  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: () => mockCtx,
    toDataURL: (type) => `data:${type};base64,mockBase64Data`,
    classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn() }
  };

  origCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag) => {
    if (tag === 'canvas') {
      const c = Object.create(mockCanvas);
      c.width = 0;
      c.height = 0;
      c.classList = { add: vi.fn(), remove: vi.fn(), contains: vi.fn() };
      return c;
    }
    return origCreateElement(tag);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('aiNidService Unit Tests', () => {
  it('stores and retrieves OpenRouter API key', () => {
    expect(getStoredApiKey()).toBe('');
    setStoredApiKey('sk-or-test-key-12345');
    expect(getStoredApiKey()).toBe('sk-or-test-key-12345');
  });

  it('stores and retrieves AI model selection', () => {
    expect(getStoredModel()).toBe(DEFAULT_MODEL);
    setStoredModel('qwen/qwen-2.5-vl-72b-instruct');
    expect(getStoredModel()).toBe('qwen/qwen-2.5-vl-72b-instruct');
  });

  it('defines fallback models including Gemini and Qwen', () => {
    expect(FALLBACK_MODELS).toContain('google/gemini-2.5-flash');
    expect(FALLBACK_MODELS).toContain('google/gemini-2.0-flash-001');
    expect(FALLBACK_MODELS).toContain('qwen/qwen-2.5-vl-72b-instruct');
  });

  it('prompt includes card boundary detection and authentic preservation instructions', () => {
    expect(NID_DETECTION_PROMPT).toContain('Bangladeshi National Identity');
    expect(NID_DETECTION_PROMPT).toContain('100%');
    expect(NID_DETECTION_PROMPT).toContain('corners');
    expect(NID_DETECTION_PROMPT).toContain('box_2d');
    expect(NID_DETECTION_PROMPT).toContain('enhancement');
  });

  it('cropImageRegion handles invalid or null bounds gracefully', async () => {
    const resNull = await cropImageRegion('data:image/png;base64,abc', null);
    expect(resNull).toBeNull();

    const resInverted = await cropImageRegion('data:image/png;base64,abc', [500, 500, 200, 200]);
    expect(resInverted).toBeNull();
  });
});

describe('editCardImageWithAI (image-edit path) Unit Tests', () => {
  let origFetch;

  beforeEach(() => {
    origFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = origFetch;
  });

  it('exposes image-edit model constants and an imperative preservation prompt', () => {
    expect(DEFAULT_IMAGE_EDIT_MODEL).toBe('google/gemini-2.5-flash-image');
    expect(IMAGE_EDIT_FALLBACK_MODELS).toContain('google/gemini-3.1-flash-image');
    expect(IMAGE_EDIT_FALLBACK_MODELS).toContain('google/gemini-3-pro-image');
    // Imperative (not a question) and carries the preservation clause.
    expect(DEFAULT_CARD_EDIT_PROMPT).toContain('Edit this photo');
    expect(DEFAULT_CARD_EDIT_PROMPT).toContain('Crop');
    expect(DEFAULT_CARD_EDIT_PROMPT).toMatch(/do NOT/i);
    expect(DEFAULT_CARD_EDIT_PROMPT).toMatch(/MRZ/);
    expect(DEFAULT_CARD_EDIT_PROMPT).not.toContain('?');
  });

  it('posts to /api/v1/images with input_references and parses b64_json into a data URL', async () => {
    let capturedUrl = null;
    let capturedBody = null;
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      capturedUrl = url;
      capturedBody = JSON.parse(opts.body);
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: [{ b64_json: 'EDITEDBASE64', media_type: 'image/jpeg' }],
          usage: { cost: 0.0021 }
        })
      });
    });

    const res = await editCardImageWithAI({
      apiKey: 'test-key',
      imageDataUrl: 'data:image/png;base64,SRC',
      prompt: 'Edit this card.'
    });

    expect(capturedUrl).toBe('https://openrouter.ai/api/v1/images');
    expect(capturedBody.model).toBe(DEFAULT_IMAGE_EDIT_MODEL);
    expect(capturedBody.prompt).toBe('Edit this card.');
    expect(capturedBody.input_references[0].type).toBe('image_url');
    expect(capturedBody.input_references[0].image_url.url).toBe('data:image/png;base64,SRC');
    expect(res.dataUrl).toBe('data:image/jpeg;base64,EDITEDBASE64');
    expect(res.cost).toBe(0.0021);
  });

  it('defaults media_type to image/png when the response omits it', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: 'PNGDATA' }] })
    });
    const res = await editCardImageWithAI({
      apiKey: 'test-key',
      imageDataUrl: 'data:image/png;base64,SRC'
    });
    expect(res.dataUrl).toBe('data:image/png;base64,PNGDATA');
  });

  it('falls back to the next image model on a 400 refusal then succeeds', async () => {
    let call = 0;
    const modelsTried = [];
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      call += 1;
      modelsTried.push(JSON.parse(opts.body).model);
      if (call === 1) {
        return Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: async () => ({ error: { message: 'Gemini could not generate an image (STOP)' } })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [{ b64_json: 'OK', media_type: 'image/png' }] })
      });
    });

    const res = await editCardImageWithAI({
      apiKey: 'test-key',
      imageDataUrl: 'data:image/png;base64,SRC'
    });

    expect(call).toBe(2);
    expect(modelsTried[0]).toBe(DEFAULT_IMAGE_EDIT_MODEL);
    expect(modelsTried[1]).not.toBe(DEFAULT_IMAGE_EDIT_MODEL);
    expect(res.dataUrl).toBe('data:image/png;base64,OK');
  });

  it('throws a key-access error on 401/403 without retrying', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({ error: { message: 'no image access' } })
    });
    await expect(editCardImageWithAI({
      apiKey: 'test-key',
      imageDataUrl: 'data:image/png;base64,SRC'
    })).rejects.toThrow(/lacks access to image-editing/i);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws a descriptive error when all image models fail', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({ error: { message: 'busy' } })
    });
    await expect(editCardImageWithAI({
      apiKey: 'test-key',
      imageDataUrl: 'data:image/png;base64,SRC'
    })).rejects.toThrow(/OpenRouter image Error/i);
  });

  it('downscaleDataUrl no-ops under jsdom (returns the input unchanged)', async () => {
    const src = 'data:image/png;base64,SMALL';
    const out = await downscaleDataUrl(src, 1600);
    expect(out).toBe(src);
  });
});

describe('nidImageEnhancer Unit Tests', () => {
  it('warpPerspectiveQuad warps corners to flat canvas', () => {
    const mockImg = { naturalWidth: 1000, naturalHeight: 800 };
    const corners = {
      top_left: [100, 50],
      top_right: [120, 950],
      bottom_right: [700, 930],
      bottom_left: [680, 70]
    };

    const canvas = warpPerspectiveQuad(mockImg, corners, 600, 400);
    expect(canvas.width).toBe(600);
    expect(canvas.height).toBe(400);
  });

  it('enhanceRealCardImage applies background whitening and text deepening', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;

    const res = enhanceRealCardImage(canvas, {
      cleanBackground: true,
      contrastBoost: 1.2,
      brightnessBoost: 1.05,
      sharpenAmount: 20,
      addBorder: true
    });

    expect(res).toBe(canvas);
  });

  it('stackEnhancedCards stacks front and back cards with correct page dimensions', () => {
    const front = document.createElement('canvas');
    front.width = 600;
    front.height = 400;

    const back = document.createElement('canvas');
    back.width = 600;
    back.height = 360;

    const stacked = stackEnhancedCards(front, back, {
      cardWidth: 680,
      spacing: 60,
      bgColor: '#ffffff'
    });

    expect(stacked.width).toBe(680 + 220); // 900
    expect(stacked.height).toBeGreaterThan(800);
  });

  it('expandQuadSafetyMargin safely expands corners to prevent clipping', () => {
    const rawCorners = {
      top_left: [80, 50],
      top_right: [80, 950],
      bottom_right: [450, 950],
      bottom_left: [450, 50]
    };

    const expanded = expandQuadSafetyMargin(rawCorners, { marginPct: 0.05, minPadUnits: 30 });
    // Top corners move up (smaller y) to protect emblem and header
    expect(expanded.top_left[0]).toBeLessThan(80);
    expect(expanded.top_right[0]).toBeLessThan(80);
    // Bottom corners move down (larger y) to protect signatures/barcode
    expect(expanded.bottom_left[0]).toBeGreaterThan(450);
    expect(expanded.bottom_right[0]).toBeGreaterThan(450);
    // Left corners move left (smaller x)
    expect(expanded.top_left[1]).toBeLessThan(50);
    // Right corners move right (larger x)
    expect(expanded.top_right[1]).toBeGreaterThan(950);
  });

  it('calculateCardHeight computes proportional CR-80 card height', () => {
    const corners = {
      top_left: [0, 0],
      top_right: [0, 1000],
      bottom_right: [630, 1000],
      bottom_left: [630, 0]
    };
    const h = calculateCardHeight(corners, 1000, 1000, 700);
    expect(h).toBeGreaterThanOrEqual(420);
    expect(h).toBeLessThanOrEqual(460);
  });

  it('separateAndExpandCards correctly preserves side-by-side horizontal cards without slicing', () => {
    const frontInfo = {
      corners: {
        top_left: [200, 160],
        top_right: [200, 450],
        bottom_right: [520, 450],
        bottom_left: [520, 160]
      }
    };
    const backInfo = {
      corners: {
        top_left: [200, 455],
        top_right: [200, 760],
        bottom_right: [520, 760],
        bottom_left: [520, 455]
      }
    };

    const { frontCorners, backCorners } = separateAndExpandCards(frontInfo, backInfo);

    // Front card must retain full vertical height (no vertical slicing)
    expect(frontCorners.top_left[0]).toBeLessThanOrEqual(200);
    expect(frontCorners.bottom_left[0]).toBeGreaterThanOrEqual(520);

    // Back card must retain full vertical height (no vertical slicing)
    expect(backCorners.top_left[0]).toBeLessThanOrEqual(200);
    expect(backCorners.bottom_left[0]).toBeGreaterThanOrEqual(520);

    // Horizontal boundary: front card must be strictly to the left of back card
    const frontMaxX = Math.max(frontCorners.top_right[1], frontCorners.bottom_right[1]);
    const backMinX = Math.min(backCorners.top_left[1], backCorners.bottom_left[1]);
    expect(frontMaxX).toBeLessThan(backMinX);
  });

  it('normalizeQuad handles pixel coordinates and explicit {x, y} keys without swapping axes', () => {
    // Qwen pixel coordinates [120, 85] to [360, 230] on 800x450 image
    const pixelCorners = {
      top_left: [120, 85],
      top_right: [360, 85],
      bottom_right: [360, 230],
      bottom_left: [120, 230]
    };
    const norm = normalizeQuad(pixelCorners, 800, 450);
    // 120 / 800 * 1000 = 150 (X)
    // 85 / 450 * 1000 = 189 (Y)
    expect(norm.top_left.x).toBeCloseTo(150, 0);
    expect(norm.top_left.y).toBeCloseTo(189, 0);
    expect(norm.top_right.x).toBeCloseTo(450, 0);
    expect(norm.top_right.y).toBeCloseTo(189, 0);
    // Crucially: X coordinate is horizontal, Y is vertical (no 90-deg rotation)
    expect(norm.top_right.x).toBeGreaterThan(norm.top_left.x);
    expect(norm.bottom_left.y).toBeGreaterThan(norm.top_left.y);

    // Explicit { x, y } dictionary format from Gemini/Qwen
    const dictCorners = {
      top_left: { x: 100, y: 50 },
      top_right: { x: 900, y: 50 },
      bottom_right: { x: 900, y: 550 },
      bottom_left: { x: 100, y: 550 }
    };
    const normDict = normalizeQuad(dictCorners, 1000, 1000);
    expect(normDict.top_left.x).toBe(100);
    expect(normDict.top_left.y).toBe(50);
    expect(normDict.top_right.x).toBe(900);
  });
});

describe('nidRenderer Unit Tests', () => {
  it('renderNidStackToCanvas calculates correct dimensions for full page', async () => {
    const data = {
      front: {
        isPresent: true,
        nameBangla: 'তানজিল আহমেদ',
        nameEnglish: 'Tanzil Ahmed',
        dateOfBirth: '10 Dec 1995',
        nidNo: '4612505174'
      },
      back: {
        isPresent: true,
        address: 'ধুনট, বগুড়া',
        bloodGroup: 'AB-',
        placeOfIssue: 'বগুড়া'
      }
    };

    const canvas = await renderNidStackToCanvas(data, {
      cardWidth: 680,
      spacing: 50,
      fullPage: true
    });

    // Width = cardWidth + 2 * marginX (680 + 220 = 900)
    expect(canvas.width).toBe(900);
    expect(canvas.height).toBeGreaterThan(800);
  });

  it('renderNidStackToCanvas supports front-only rendering', async () => {
    const data = {
      front: {
        isPresent: true,
        nameBangla: 'তানজিল আহমেদ',
        nameEnglish: 'Tanzil Ahmed'
      },
      back: {
        isPresent: false
      }
    };

    const canvas = await renderNidStackToCanvas(data, {
      cardWidth: 600,
      fullPage: false
    });

    expect(canvas.width).toBe(600);
  });
});

describe('messages.showSuccess and aiNidController', () => {
  it('message controller supports showSuccess', async () => {
    const { createMessageController } = await import('../src/controllers/messages.js');
    const el = document.createElement('div');
    const msg = createMessageController(el);

    expect(typeof msg.showSuccess).toBe('function');
    msg.showSuccess('Operation successful');
    expect(el.textContent).toBe('Operation successful');
    expect(el.getAttribute('data-message-type')).toBe('success');
  });

  it('aiNidController opens and closes settings modal', async () => {
    const { createAiNidController } = await import('../src/controllers/aiNidController.js');

    // Create dummy DOM elements
    const settingsModal = document.createElement('div');
    settingsModal.id = 'aiSettingsModal';
    settingsModal.className = 'modal hidden';

    const settingsBtn = document.createElement('button');
    settingsBtn.id = 'aiSettingsBtn';

    const apiKeyInput = document.createElement('input');
    apiKeyInput.id = 'aiApiKeyInput';

    const modelSelect = document.createElement('select');
    modelSelect.id = 'aiModelSelect';

    document.body.appendChild(settingsModal);
    document.body.appendChild(settingsBtn);
    document.body.appendChild(apiKeyInput);
    document.body.appendChild(modelSelect);

    const mockMessages = {
      showSuccess: vi.fn(),
      showGuidance: vi.fn(),
      showError: vi.fn(),
      clearMessage: vi.fn()
    };

    const mockProgress = {
      begin: vi.fn(),
      set: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn()
    };

    const mockAppState = {
      getState: () => ({ sources: {}, settings: {} })
    };

    const ctrl = createAiNidController({
      appState: mockAppState,
      messages: mockMessages,
      progress: mockProgress,
      document
    });

    ctrl.init();

    // Opening settings
    ctrl.openSettings();
    expect(settingsModal.classList.contains('hidden')).toBe(false);

    // Closing settings
    ctrl.closeSettings();
    expect(settingsModal.classList.contains('hidden')).toBe(true);

    ctrl.destroy();
  });

  it('aiNidController handleAiEnhance edits a single front image via the AI edit path and leaves the back empty', async () => {
    const { createAiNidController } = await import('../src/controllers/aiNidController.js');

    const previewCvs = document.createElement('canvas');

    const mockDoc = {
      getElementById: (id) => {
        if (id === 'previewCanvas') return previewCvs;
        return null;
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };

    const mockAppState = {
      state: {
        sources: {
          front: {
            image: { src: 'data:image/png;base64,mock1' },
            naturalWidth: 800,
            naturalHeight: 1200
          },
          back: null
        },
        settings: { spacing: 40, backgroundColor: '#ffffff' }
      },
      getState() { return this.state; },
      setSource: vi.fn((slot, data) => {
        mockAppState.state.sources[slot] = data;
      }),
      setCombinedImage: vi.fn(),
      setExportCombinedVisible: vi.fn()
    };

    const mockMessages = {
      showSuccess: vi.fn(),
      showGuidance: vi.fn(),
      showError: vi.fn()
    };

    const mockProgress = {
      begin: vi.fn(),
      set: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn()
    };

    // Single front-only upload now goes through the image-edit path (/api/v1/images).
    // Return an image-edit shaped body for that endpoint; still answer any vision call
    // (should not be reached) with a valid detection body.
    const origFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/api/v1/images')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [{ b64_json: 'EDITED', media_type: 'image/png' }],
            usage: { cost: 0.001 }
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                front: {
                  is_present: true,
                  corners: {
                    top_left: { x: 0, y: 0 },
                    top_right: { x: 1000, y: 0 },
                    bottom_right: { x: 1000, y: 480 },
                    bottom_left: { x: 0, y: 480 }
                  }
                },
                back: {
                  is_present: true,
                  corners: {
                    top_left: { x: 0, y: 520 },
                    top_right: { x: 1000, y: 520 },
                    bottom_right: { x: 1000, y: 1000 },
                    bottom_left: { x: 0, y: 1000 }
                  }
                }
              })
            }
          }]
        })
      });
    });

    localStorage.setItem('OPENROUTER_API_KEY', 'test-key');

    const ctrl = createAiNidController({
      appState: mockAppState,
      messages: mockMessages,
      progress: mockProgress,
      document: mockDoc
    });

    await ctrl.handleAiEnhance();

    // Exactly ONE image-edit POST for a single source image.
    const imageEditCalls = global.fetch.mock.calls.filter(
      ([url]) => typeof url === 'string' && url.includes('/api/v1/images')
    );
    expect(imageEditCalls.length).toBe(1);

    // Front source is synced; back is never set to a card (only cleared with null).
    expect(mockAppState.setSource).toHaveBeenCalledWith('front', expect.objectContaining({
      image: expect.anything()
    }));
    const backWithCanvas = mockAppState.setSource.mock.calls.some(
      ([slot, data]) => slot === 'back' && data != null
    );
    expect(backWithCanvas).toBe(false);
    expect(mockAppState.state.sources.back).toBeNull();

    global.fetch = origFetch;
    ctrl.destroy();
  });
});

