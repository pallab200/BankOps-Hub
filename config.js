/**
 * BankOps Hub Configuration
 * Securely loads API keys from environment variables (Netlify) or localStorage
 */

const BankOpsConfig = {
    /**
     * Initialize configuration on page load
     * In production (Netlify), GEMINI_API_KEY will be injected via environment variables
     * In development, falls back to localStorage or prompt
     */
    init: function() {
        // Check localStorage for user-provided key
        if (localStorage.getItem('gemini_api_key')) {
            this.GEMINI_API_KEY = localStorage.getItem('gemini_api_key');
        }
        // Check environment variable if available
        else if (typeof process !== 'undefined' && process.env.GEMINI_API_KEY) {
            this.GEMINI_API_KEY = process.env.GEMINI_API_KEY;
            localStorage.setItem('gemini_api_key', this.GEMINI_API_KEY);
        }
        // No default - require user to configure
        else {
            this.GEMINI_API_KEY = '';
            console.warn('[BankOpsConfig] No API key configured. Please provide your Gemini API key via settings or environment variable.');
        }

        console.log('[BankOpsConfig] Configuration initialized');
        if (this.GEMINI_API_KEY) {
            console.log('[BankOpsConfig] Gemini API key loaded successfully');
        } else {
            console.warn('[BankOpsConfig] No Gemini API key found - chat feature may be unavailable');
        }
    },

    /**
     * Get Gemini API key
     * @returns {string} API key
     */
    getGeminiApiKey: function() {
        return this.GEMINI_API_KEY || '';
    },

    /**
     * Set Gemini API key (for manual configuration if needed)
     * @param {string} key - API key to store
     */
    setGeminiApiKey: function(key) {
        this.GEMINI_API_KEY = key;
        localStorage.setItem('gemini_api_key', key);
        console.log('[BankOpsConfig] Gemini API key updated');
    },

    /**
     * Clear stored API keys
     */
    clearApiKeys: function() {
        this.GEMINI_API_KEY = '';
        localStorage.removeItem('gemini_api_key');
        console.log('[BankOpsConfig] API keys cleared');
    }
};

// Initialize configuration immediately when script loads
BankOpsConfig.init();
