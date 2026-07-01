const fc = require('fast-check');

/**
 * Property-Based Test: Search match correctness
 * Validates: Requirements 3.2
 *
 * For any substring of the Secured Overdraft entry's title, any of its keywords,
 * or the section name "credit" (in any case variation), the filterApps logic SHALL
 * include the app-secured-overdraft entry in the returned matches.
 */

// Replicate the appData entry for secured overdraft
const securedOverdraftEntry = {
  id: 'app-secured-overdraft',
  title: 'Secured Overdraft Application Form',
  section: 'credit',
  keywords: ['secured', 'overdraft', 'sod', 'loan', 'application', 'form'],
  url: 'Secured Overdraft Application Form/Retail Secured Overdraft Application Form.html',
  icon: 'fa-file-signature',
};

// Full appData array matching the production data
const appData = [
  { id: 'app-iss-analyzer', title: 'ISS Analyzer', section: 'credit', keywords: ['iss', 'income', 'analysis', 'salary'], url: 'ISS Analyzer/ISS Analyzer.html', icon: 'fa-chart-line' },
  { id: 'app-credit-commitment', title: 'Credit Commitment Editor', section: 'credit', keywords: ['credit', 'commitment', 'loan', 'lending', 'template'], url: 'Credit Commitment/Credit Commitment.html', icon: 'fa-file-contract' },
  { id: 'app-cib-inquiry', title: 'CIB Inquiry', section: 'credit', keywords: ['cib', 'credit', 'inquiry', 'bureau'], url: 'CIB Inquiry/CIB Inquiry.html', icon: 'fa-search' },
  securedOverdraftEntry,
  { id: 'app-translator', title: 'Translator', section: 'misc', keywords: ['translate', 'language', 'bangla', 'english', 'text'], url: 'Translator/Translator.html', icon: 'fa-language' },
  { id: 'app-text-extractor', title: 'Text Extractor', section: 'misc', keywords: ['ocr', 'extract', 'image', 'scan', 'text'], url: 'Text Extractor/Text Extractor.html', icon: 'fa-file-alt' },
];

// Replicate the core filter logic from BankOps Hub.html filterApps function
function filterApps(query) {
  query = query.trim().toLowerCase();
  if (!query) return [];
  return appData.filter(app => {
    return (
      app.title.toLowerCase().includes(query) ||
      app.keywords.some(kw => kw.includes(query)) ||
      app.section.includes(query)
    );
  });
}

// Helper: generate a random non-empty substring of a given string
function substringArbitrary(str) {
  return fc
    .record({
      start: fc.integer({ min: 0, max: str.length - 1 }),
      length: fc.integer({ min: 1, max: str.length }),
    })
    .map(({ start, length }) => {
      const end = Math.min(start + length, str.length);
      return str.slice(start, end);
    });
}

// Helper: apply random case transformations to a string
function randomCaseTransform(str) {
  return fc
    .array(fc.boolean(), { minLength: str.length, maxLength: str.length })
    .map(flags =>
      str
        .split('')
        .map((ch, i) => (flags[i] ? ch.toUpperCase() : ch.toLowerCase()))
        .join('')
    );
}

// Arbitrary that generates a random substring (with random case) from one of the searchable fields
function searchQueryArbitrary() {
  const title = securedOverdraftEntry.title;
  const keywords = securedOverdraftEntry.keywords;
  const section = securedOverdraftEntry.section;

  // All source strings that should match
  const sources = [title, ...keywords, section];

  return fc
    .integer({ min: 0, max: sources.length - 1 })
    .chain(sourceIndex => {
      const source = sources[sourceIndex];
      return substringArbitrary(source).chain(sub => randomCaseTransform(sub));
    });
}

describe('Property 1: Search match correctness', () => {
  /**
   * **Validates: Requirements 3.2**
   */
  it('filterApps includes app-secured-overdraft for any substring of title/keywords/section with random case', () => {
    fc.assert(
      fc.property(searchQueryArbitrary(), query => {
        const results = filterApps(query);
        const ids = results.map(r => r.id);
        expect(ids).toContain('app-secured-overdraft');
      }),
      { numRuns: 100 }
    );
  });
});
