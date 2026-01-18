// === ELEMENTOR COMPATIBILITY FIX ===
// Defensywne sprawdzenie dla elementorFrontendConfig i ElementorProFrontendConfig
// Zapobiega błędom ReferenceError w środowisku bez Elementor

// Export init function for bootApp (no IIFE, no side-effects on import)
// Auto-init removed - must be called from bootApp
if (typeof window !== 'undefined') {
  window.__initElementorFix = function initElementorFix(ctx) {
    'use strict';

    // Sprawdź czy jesteśmy w środowisku WordPress z Elementor
    // Defensywne sprawdzenie - zapobiega błędom ReferenceError
    if (typeof window === 'undefined' || window === null) {
        console.warn('⚠️ elementor-fix: window object is not available');
        return () => {};
    }

    // Fix dla elementorFrontendConfig
    if (typeof elementorFrontendConfig === 'undefined') {
        window.elementorFrontendConfig = {
            environmentMode: {
                edit: false,
                wpPreview: false,
                isScriptDebug: false
            },
            i18n: {},
            is_rtl: false,
            breakpoints: {
                xs: 0,
                sm: 480,
                md: 768,
                lg: 1025,
                xl: 1440,
                xxl: 1600
            },
            responsive: {
                breakpoints: {}
            },
            version: '3.0.0',
            urls: {
                assets: '',
                ajaxurl: ''
            }
        };
        if (window.HEATPUMP_CONFIG && window.HEATPUMP_CONFIG.debug) {
        }
    }

    // Fix dla ElementorProFrontendConfig
    if (typeof ElementorProFrontendConfig === 'undefined') {
        window.ElementorProFrontendConfig = {
            ajaxurl: '',
            nonce: '',
            urls: {
                assets: '',
                rest: ''
            },
            settings: {}
        };
    }

    // Try-catch wrapper dla kodu który używa Elementor
    window.safeElementorCall = function(callback) {
        try {
            if (typeof callback === 'function') {
                return callback();
            }
        } catch (error) {
            console.warn('⚠️ Elementor function call failed (safe fallback):', error.message);
            return null;
        }
    };

    // Return disposer (usually noop for elementor-fix)
    return function disposeElementorFix() {
        // Usually no cleanup needed for elementor-fix
    };
  };
}