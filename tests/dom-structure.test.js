const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

/**
 * Unit Tests: DOM Structure and Behavior for Secured Overdraft Application Form
 * Validates: Requirements 1.1, 1.3, 1.4, 2.1, 3.1, 4.2, 4.3, 4.4, 5.1, 5.3, 5.4
 */

const htmlPath = path.resolve(__dirname, '..', 'BankOps Hub.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

function createDOM(localStorageData = {}) {
  const virtualConsole = new (require('jsdom').VirtualConsole)();
  // Suppress jsdom errors from missing external resources
  virtualConsole.on('error', () => {});
  virtualConsole.on('warn', () => {});
  virtualConsole.on('info', () => {});

  const dom = new JSDOM(htmlContent, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    url: 'http://localhost',
    virtualConsole,
    beforeParse(window) {
      // Mock localStorage
      const store = { ...localStorageData };
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: (key) => (key in store ? store[key] : null),
          setItem: (key, value) => { store[key] = String(value); },
          removeItem: (key) => { delete store[key]; },
          clear: () => { Object.keys(store).forEach(k => delete store[k]); },
          get length() { return Object.keys(store).length; },
          key: (i) => Object.keys(store)[i] || null,
          _store: store,
        },
        writable: true,
        configurable: true,
      });
      // Mock window.open to prevent errors
      window.open = jest.fn();
      // Mock fetch to prevent ReferenceError in inline scripts
      window.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
      // Mock pdfjsLib which is loaded externally
      window.pdfjsLib = { GlobalWorkerOptions: {} };
      // Mock requestAnimationFrame
      window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    },
  });
  return dom;
}

describe('DOM Structure: Secured Overdraft App Card', () => {
  let dom, document;

  beforeAll(() => {
    dom = createDOM();
    document = dom.window.document;
  });

  afterAll(() => {
    dom.window.close();
  });

  /**
   * Validates: Requirement 1.1
   */
  test('#app-secured-overdraft exists with correct child structure (icon, title, description, button)', () => {
    const card = document.getElementById('app-secured-overdraft');
    expect(card).not.toBeNull();

    // Icon element
    const icon = card.querySelector('i.app-icon');
    expect(icon).not.toBeNull();
    expect(icon.classList.contains('fa-file-signature')).toBe(true);

    // Title
    const title = card.querySelector('.app-title');
    expect(title).not.toBeNull();
    expect(title.textContent.trim()).toBe('Secured Overdraft Application Form');

    // Description
    const description = card.querySelector('.app-description');
    expect(description).not.toBeNull();
    expect(description.textContent.trim().length).toBeGreaterThan(0);
    expect(description.textContent.trim().length).toBeLessThanOrEqual(150);

    // Button
    const button = card.querySelector('button.open-btn');
    expect(button).not.toBeNull();
    expect(button.textContent).toContain('Open App');
  });

  /**
   * Validates: Requirement 1.3
   */
  test('app card follows the same HTML structure as existing app cards', () => {
    const card = document.getElementById('app-secured-overdraft');
    expect(card.classList.contains('app-card')).toBe(true);

    // Verify structure: icon with app-icon class, .app-title, .app-description, button.open-btn
    const children = Array.from(card.children);
    const hasIcon = children.some(el => el.tagName === 'I' && el.classList.contains('app-icon'));
    const hasTitle = children.some(el => el.classList.contains('app-title'));
    const hasDescription = children.some(el => el.classList.contains('app-description'));
    const hasButton = children.some(el => el.tagName === 'BUTTON' && el.classList.contains('open-btn'));

    expect(hasIcon).toBe(true);
    expect(hasTitle).toBe(true);
    expect(hasDescription).toBe(true);
    expect(hasButton).toBe(true);
  });

  /**
   * Validates: Requirement 1.4
   */
  test('#app-secured-overdraft is the last child of the Credit .app-grid', () => {
    const creditBody = document.getElementById('body-credit');
    const appGrid = creditBody.querySelector('.app-grid');
    expect(appGrid).not.toBeNull();

    const appCards = appGrid.querySelectorAll('.app-card');
    const lastCard = appCards[appCards.length - 1];
    expect(lastCard.id).toBe('app-secured-overdraft');
  });

  /**
   * Validates: Requirement 2.1
   */
  test('Credit section badge text is "4 apps"', () => {
    const creditSection = document.getElementById('section-credit');
    const badge = creditSection.querySelector('.app-count-badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent.trim()).toBe('4 apps');
  });

  /**
   * Validates: Requirement 3.1
   * appData is const in an inline script — access it by evaluating a script in the same window
   */
  test('appData contains the correct entry for app-secured-overdraft', () => {
    // appData is defined as const in the page's inline script; access it via window eval
    const appData = dom.window.eval('typeof appData !== "undefined" ? appData : undefined');
    expect(appData).toBeDefined();

    const entry = appData.find(app => app.id === 'app-secured-overdraft');
    expect(entry).toBeDefined();
    expect(entry.title).toBe('Secured Overdraft Application Form');
    expect(entry.section).toBe('credit');
    expect(entry.keywords).toEqual(['secured', 'overdraft', 'sod', 'loan', 'application', 'form']);
    expect(entry.url).toBe('Secured Overdraft Application Form/Retail Secured Overdraft Application Form.html');
    expect(entry.icon).toBe('fa-file-signature');
  });

  /**
   * Validates: Requirement 5.1
   */
  test('toggle checkbox exists with correct id, class, and data-section', () => {
    const toggle = document.getElementById('toggle-app-secured-overdraft');
    expect(toggle).not.toBeNull();
    expect(toggle.tagName).toBe('INPUT');
    expect(toggle.type).toBe('checkbox');
    expect(toggle.classList.contains('app-toggle')).toBe(true);
    expect(toggle.getAttribute('data-section')).toBe('credit');
  });
});

describe('Behavior: App Visibility Toggle Persistence', () => {
  /**
   * Validates: Requirements 4.2, 5.3
   */
  test('unchecking toggle hides card and persists to localStorage', () => {
    const dom = createDOM();
    const { document, localStorage } = dom.window;

    const toggle = document.getElementById('toggle-app-secured-overdraft');
    expect(toggle).not.toBeNull();

    // Initially checked
    toggle.checked = true;

    // Uncheck the toggle
    toggle.checked = false;

    // Call updateAppVisibility to persist
    dom.window.updateAppVisibility();

    // Verify card is hidden
    const card = document.getElementById('app-secured-overdraft');
    expect(card.style.display).toBe('none');

    // Verify localStorage persistence
    const stored = JSON.parse(localStorage.getItem('bankops_app_visibility'));
    expect(stored['app-secured-overdraft']).toBe(false);

    dom.window.close();
  });

  /**
   * Validates: Requirements 4.3, 5.3
   */
  test('checking toggle shows card and persists to localStorage', () => {
    const dom = createDOM();
    const { document, localStorage } = dom.window;

    const toggle = document.getElementById('toggle-app-secured-overdraft');

    // Start by hiding: uncheck and persist
    toggle.checked = false;
    dom.window.updateAppVisibility();

    // Now check the toggle
    toggle.checked = true;
    dom.window.updateAppVisibility();

    // Verify card is visible (empty string means visible)
    const card = document.getElementById('app-secured-overdraft');
    expect(card.style.display).toBe('');

    // Verify localStorage persistence
    const stored = JSON.parse(localStorage.getItem('bankops_app_visibility'));
    expect(stored['app-secured-overdraft']).toBe(true);

    dom.window.close();
  });

  /**
   * Validates: Requirements 4.4, 5.3
   */
  test('load with saved preference false results in hidden card', () => {
    const savedPrefs = {
      bankops_app_visibility: JSON.stringify({ 'app-secured-overdraft': false }),
    };
    const dom = createDOM(savedPrefs);
    const { document } = dom.window;

    // Manually call loadAppPreferences and applyAppVisibility since the page load
    // scripts may partially fail due to missing external dependencies
    dom.window.loadAppPreferences();
    const appPrefs = JSON.parse(dom.window.localStorage.getItem('bankops_app_visibility')) || {};
    dom.window.applyAppVisibility(appPrefs);

    const card = document.getElementById('app-secured-overdraft');
    expect(card.style.display).toBe('none');

    // Also verify the toggle checkbox is unchecked
    const toggle = document.getElementById('toggle-app-secured-overdraft');
    expect(toggle.checked).toBe(false);

    dom.window.close();
  });

  /**
   * Validates: Requirement 5.4
   */
  test('reset sets toggle to checked and card to visible', () => {
    const savedPrefs = {
      bankops_app_visibility: JSON.stringify({ 'app-secured-overdraft': false }),
    };
    const dom = createDOM(savedPrefs);
    const { document } = dom.window;

    // Apply initial state: card hidden
    dom.window.loadAppPreferences();
    const appPrefs = JSON.parse(dom.window.localStorage.getItem('bankops_app_visibility')) || {};
    dom.window.applyAppVisibility(appPrefs);

    const card = document.getElementById('app-secured-overdraft');
    expect(card.style.display).toBe('none');

    // Call reset
    dom.window.resetSectionVisibility();

    // After reset, toggle should be checked and card visible
    const toggle = document.getElementById('toggle-app-secured-overdraft');
    expect(toggle.checked).toBe(true);
    expect(card.style.display).toBe('');

    dom.window.close();
  });
});
