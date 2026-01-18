// === GDPR COMPLIANCE SYSTEM ===
// System zgodności z RODO dla systemów trackingu TOP-INSTAL

(function () {
  'use strict';

  // GDPR Configuration
  const GDPR_CONFIG = {
    cookieName: 'topinstal_analytics_consent',
    consentDuration: 365, // dni
    requiredForCore: false, // Czy tracking jest wymagany dla działania kalkulatora
    privacyPolicyUrl: '/polityka-prywatnosci',
    categories: {
      necessary: {
        name: 'Niezbędne',
        description: 'Wymagane do działania kalkulatora',
        enabled: true,
        locked: true,
      },
      analytics: {
        name: 'Analityczne',
        description: 'Pomagają nam ulepszać kalkulator',
        enabled: false,
        locked: false,
        modules: ['aiWatchers', 'userPathHistory', 'formAnomalies'],
      },
      functional: {
        name: 'Funkcjonalne',
        description: 'Zapamiętują Twoje preferencje',
        enabled: false,
        locked: false,
        modules: ['formSaving', 'preferences'],
      },
    },
  };

  class GDPRManager {
    constructor() {
      this.consent = this.loadConsent();
      this.consentGiven = false;
      this.modules = new Map();
      this.autoHideTimeout = null;
    }

    loadConsent() {
      try {
        const cookie = document.cookie
          .split('; ')
          .find(row => row.startsWith(GDPR_CONFIG.cookieName + '='));

        if (cookie) {
          const value = cookie.split('=')[1];
          return JSON.parse(decodeURIComponent(value));
        }
      } catch (error) {
        console.error('GDPR: Błąd odczytu zgody:', error);
      }
      return null;
    }

    saveConsent(consent) {
      try {
        const expires = new Date();
        expires.setDate(expires.getDate() + GDPR_CONFIG.consentDuration);

        const consentData = {
          ...consent,
          timestamp: Date.now(),
          version: '1.0',
        };

        document.cookie = `${GDPR_CONFIG.cookieName}=${encodeURIComponent(
          JSON.stringify(consentData)
        )}; expires=${expires.toUTCString()}; path=/; secure; samesite=strict`;
        this.consent = consentData;
        this.consentGiven = true;

        return true;
      } catch (error) {
        console.error('GDPR: Błąd zapisu zgody:', error);
        return false;
      }
    }

    hasConsent(category) {
      if (!this.consent) return false;
      return this.consent[category] === true;
    }

    isConsentValid() {
      if (!this.consent || !this.consent.timestamp) return false;

      const consentAge = Date.now() - this.consent.timestamp;
      const maxAge = GDPR_CONFIG.consentDuration * 24 * 60 * 60 * 1000;

      return consentAge < maxAge;
    }

    registerModule(name, category, initFunction, destroyFunction) {
      if (!name || !category || typeof initFunction !== 'function') {
        console.error('GDPR: Nieprawidłowe parametry rejestracji modułu');
        return;
      }

      this.modules.set(name, {
        category,
        init: initFunction,
        destroy: destroyFunction || function () {},
        active: false,
      });

    }

    initializeModules() {
      this.modules.forEach((module, name) => {
        const shouldEnable =
          GDPR_CONFIG.categories[module.category].locked || this.hasConsent(module.category);

        if (shouldEnable && !module.active) {
          try {
            module.init();
            module.active = true;
          } catch (error) {
            console.error(`GDPR: Błąd inicjalizacji modułu ${name}:`, error);
          }
        } else if (!shouldEnable && module.active) {
          try {
            module.destroy();
            module.active = false;
          } catch (error) {
            console.error(`GDPR: Błąd wyłączenia modułu ${name}:`, error);
          }
        }
      });
    }

    showConsentBanner() {
      if (this.isConsentValid()) {
        this.initializeModules();
        return;
      }

      const banner = this.createConsentBanner();
      document.body.appendChild(banner);

      // Auto-ukryj po 20 sekundach jeśli użytkownik nie kliknie
      this.autoHideTimeout = setTimeout(() => {
        this.acceptAll(banner);
      }, 20000); // 20 sekund
    }

    createConsentBanner() {
      const banner = document.createElement('div');
      banner.id = 'gdpr-consent-banner';
      banner.innerHTML = `
                <div class="gdpr-banner">
                    <div class="gdpr-backdrop"></div>
                    <div class="gdpr-container">
                        <div class="gdpr-header">
                            <div class="gdpr-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 6.5V9C15 10.1 14.1 11 13 11H11C9.9 11 9 10.1 9 9V6.5L3 7V9C3 10.1 3.9 11 5 11H7V22H9V16H15V22H17V11H19C20.1 11 21 10.1 21 9Z" fill="currentColor"/>
                                </svg>
                            </div>
                            <div class="gdpr-title-section">
                                <h3 class="gdpr-title">Cookies</h3>
                                <p class="gdpr-subtitle">·</p>
                            </div>
                        </div>

                        <div class="gdpr-categories">
                            ${Object.entries(GDPR_CONFIG.categories)
                              .map(
                                ([key, cat]) => `
                                <div class="gdpr-category ${
                                  cat.locked ? 'locked' : ''
                                }" data-category="${key}">
                                    <div class="gdpr-category-toggle">
                                        <input type="checkbox"
                                               id="gdpr-${key}"
                                               data-category="${key}"
                                               ${cat.enabled ? 'checked' : ''}
                                               ${cat.locked ? 'disabled' : ''}>
                                        <label for="gdpr-${key}" class="gdpr-toggle-switch">
                                            <span class="gdpr-toggle-slider"></span>
                                        </label>
                                    </div>
                                    <div class="gdpr-category-content">
                                        <div class="gdpr-category-header">
                                            <span class="gdpr-category-name">${cat.name}</span>
                                            ${
                                              cat.locked
                                                ? '<span class="gdpr-locked-badge">Wymagane</span>'
                                                : ''
                                            }
                                        </div>
                                        <span class="gdpr-category-desc">${cat.description}</span>
                                    </div>
                                </div>
                            `
                              )
                              .join('')}
                        </div>

                        <div class="gdpr-actions">
                            <div class="gdpr-actions-primary">
                                <button id="gdpr-accept-all" class="gdpr-btn gdpr-btn-primary">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" fill="currentColor"/>
                                    </svg>
                                    Akceptuj
                                </button>
                                <button id="gdpr-accept-selected" class="gdpr-btn gdpr-btn-secondary">
                                    Wybrane
                                </button>
                                <button id="gdpr-reject-all" class="gdpr-btn gdpr-btn-outline">
                                    Tylko niezbędne
                                </button>
                            </div>
                            <div class="gdpr-actions-secondary">
                                <a href="${
                                  GDPR_CONFIG.privacyPolicyUrl
                                }" target="_blank" class="gdpr-policy-link">
                                    Polityka
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            `;

      // Style CSS - pasek na dole ekranu
      const style = document.createElement('style');
      style.textContent = `
                .gdpr-banner {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    z-index: 9999;
                    font-family: 'Titillium Web', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    animation: gdpr-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    pointer-events: none; /* NIE blokuj interakcji z resztą strony */
                }

                .gdpr-backdrop {
                    display: none;
                }

                .gdpr-container {
                    pointer-events: auto; /* TYLKO kontener ma interakcje */
                }

                .gdpr-container {
                    background: rgba(255, 255, 255, 0.98);
                    backdrop-filter: blur(10px);
                    border-top: 2px solid #d4a574;
                    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
                    padding: 12px 20px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    max-height: none;
                    overflow: visible;
                }

                .gdpr-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-shrink: 0;
                }

                .gdpr-icon {
                    width: 24px;
                    height: 24px;
                    background: linear-gradient(135deg, #d4a574, #b8976a);
                    border-radius: 2px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    flex-shrink: 0;
                }

                .gdpr-icon svg {
                    width: 14px;
                    height: 14px;
                }

                .gdpr-title-section {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .gdpr-title {
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: #1A202C;
                    margin: 0;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                }

                .gdpr-subtitle {
                    font-size: 0.7rem;
                    color: #6B7280;
                    margin: 0;
                }

                .gdpr-description {
                    display: none;
                }

                .gdpr-categories {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex: 1;
                }

                .gdpr-category {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 4px 8px;
                    background: #F8FAFC;
                    border: 1px solid #E2E8F0;
                    border-radius: 2px;
                    transition: all 0.2s ease;
                    cursor: pointer;
                    flex-shrink: 0;
                }

                .gdpr-category:hover:not(.locked) {
                    border-color: #d4a574;
                    background: rgba(220, 20, 60, 0.05);
                }

                .gdpr-category.locked {
                    background: #F1F5F9;
                    border-color: #CBD5E1;
                    cursor: not-allowed;
                    opacity: 0.7;
                }

                .gdpr-category-toggle {
                    flex-shrink: 0;
                }

                .gdpr-category input[type="checkbox"] {
                    display: none;
                }

                .gdpr-toggle-switch {
                    position: relative;
                    display: block;
                    width: 32px;
                    height: 18px;
                    background: #9CA3AF;
                    border-radius: 9px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .gdpr-toggle-slider {
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    width: 14px;
                    height: 14px;
                    background: white;
                    border-radius: 50%;
                    transition: all 0.2s ease;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                }

                .gdpr-category input[type="checkbox"]:checked + .gdpr-toggle-switch {
                    background: #d4a574;
                }

                .gdpr-category input[type="checkbox"]:checked + .gdpr-toggle-switch .gdpr-toggle-slider {
                    transform: translateX(14px);
                }

                .gdpr-category.locked .gdpr-toggle-switch {
                    background: #D1D5DB;
                    cursor: not-allowed;
                }

                .gdpr-category-content {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .gdpr-category-header {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .gdpr-category-name {
                    font-weight: 600;
                    color: #1A202C;
                    font-size: 0.7rem;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                    white-space: nowrap;
                }

                .gdpr-locked-badge {
                    background: #FEF3C7;
                    color: #92400E;
                    padding: 1px 4px;
                    border-radius: 2px;
                    font-size: 0.6rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                }

                .gdpr-category-desc {
                    display: none;
                }

                .gdpr-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-shrink: 0;
                }

                .gdpr-actions-primary {
                    display: flex;
                    gap: 6px;
                }

                .gdpr-actions-secondary {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .gdpr-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 6px 12px;
                    border: none;
                    border-radius: 2px;
                    font-weight: 600;
                    font-size: 0.7rem;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    text-decoration: none;
                    white-space: nowrap;
                    font-family: inherit;
                }

                .gdpr-btn svg {
                    width: 12px;
                    height: 12px;
                }

                .gdpr-btn-primary {
                    background: #d4a574;
                    color: white;
                }

                .gdpr-btn-primary:hover {
                    background: #b8976a;
                }

                .gdpr-btn-secondary {
                    background: #2D3748;
                    color: white;
                }

                .gdpr-btn-secondary:hover {
                    background: #1A202C;
                }

                .gdpr-btn-outline {
                    background: white;
                    color: #374151;
                    border: 1px solid #D1D5DB;
                }

                .gdpr-btn-outline:hover {
                    background: #F3F4F6;
                    border-color: #9CA3AF;
                }

                .gdpr-policy-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    color: #d4a574;
                    text-decoration: none;
                    font-weight: 600;
                    font-size: 0.65rem;
                    transition: color 0.2s ease;
                }

                .gdpr-policy-link svg {
                    width: 10px;
                    height: 10px;
                }

                .gdpr-policy-link:hover {
                    color: #b8976a;
                }

                @keyframes gdpr-slide-up {
                    from {
                        opacity: 0;
                        transform: translateY(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @media (max-width: 1024px) {
                    .gdpr-container {
                        flex-wrap: wrap;
                        gap: 12px;
                    }

                    .gdpr-categories {
                        flex-wrap: wrap;
                        order: 1;
                        width: 100%;
                    }

                    .gdpr-actions {
                        order: 2;
                        width: 100%;
                        justify-content: flex-end;
                    }
                    }

                @media (max-width: 768px) {
                    .gdpr-container {
                        padding: 10px 16px;
                        flex-direction: column;
                        align-items: stretch;
                    }

                    .gdpr-header {
                        justify-content: center;
                    }

                    .gdpr-title-section {
                        flex-direction: column;
                        text-align: center;
                    }

                    .gdpr-categories {
                        justify-content: center;
                    }

                    .gdpr-actions {
                        flex-wrap: wrap;
                        justify-content: center;
                    }

                    .gdpr-policy-link {
                        width: 100%;
                        justify-content: center;
                        margin-top: 4px;
                    }
                }

                @media (max-width: 480px) {
                    .gdpr-btn {
                        padding: 5px 10px;
                        font-size: 0.65rem;
                    }

                    .gdpr-category-name {
                        font-size: 0.65rem;
                    }
                }
            `;
      banner.appendChild(style);

      // Event listeners
      banner.querySelector('#gdpr-accept-all').onclick = () => this.acceptAll(banner);
      banner.querySelector('#gdpr-accept-selected').onclick = () => this.acceptSelected(banner);
      banner.querySelector('#gdpr-reject-all').onclick = () => this.rejectAll(banner);

      // Dodaj event listenery dla kategorii (kliknięcie w całą kategorię)
      banner.querySelectorAll('.gdpr-category:not(.locked)').forEach(category => {
        category.addEventListener('click', e => {
          if (e.target.type !== 'checkbox' && !e.target.closest('.gdpr-toggle-switch')) {
            const checkbox = category.querySelector('input[type="checkbox"]');
            if (checkbox && !checkbox.disabled) {
              checkbox.checked = !checkbox.checked;
              checkbox.dispatchEvent(new Event('change'));
            }
          }
        });
      });

      return banner;
    }

    acceptAll(banner) {
      // Anuluj auto-hide timeout
      if (this.autoHideTimeout) {
        clearTimeout(this.autoHideTimeout);
        this.autoHideTimeout = null;
      }

      const consent = {};
      Object.keys(GDPR_CONFIG.categories).forEach(category => {
        consent[category] = true;
      });

      if (this.saveConsent(consent)) {
        this.removeBanner(banner);
        this.initializeModules();
      }
    }

    acceptSelected(banner) {
      // Anuluj auto-hide timeout
      if (this.autoHideTimeout) {
        clearTimeout(this.autoHideTimeout);
        this.autoHideTimeout = null;
      }

      const consent = {};
      const checkboxes = banner.querySelectorAll('input[type="checkbox"]');

      checkboxes.forEach(cb => {
        consent[cb.dataset.category] = cb.checked;
      });

      if (this.saveConsent(consent)) {
        this.removeBanner(banner);
        this.initializeModules();
      }
    }

    rejectAll(banner) {
      // Anuluj auto-hide timeout
      if (this.autoHideTimeout) {
        clearTimeout(this.autoHideTimeout);
        this.autoHideTimeout = null;
      }

      const consent = {};
      Object.keys(GDPR_CONFIG.categories).forEach(category => {
        consent[category] = GDPR_CONFIG.categories[category].locked;
      });

      if (this.saveConsent(consent)) {
        this.removeBanner(banner);
        this.initializeModules();
      }
    }

    removeBanner(banner) {
      if (banner && banner.parentNode) {
        banner.parentNode.removeChild(banner);
      }
    }

    // Public API for checking consent
    canTrack(category) {
      return GDPR_CONFIG.categories[category]?.locked || this.hasConsent(category);
    }

    // Reset consent (for testing/admin)
    resetConsent() {
      try {
        document.cookie = `${GDPR_CONFIG.cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        localStorage.removeItem(GDPR_CONFIG.cookieName);
        this.consent = null;
        this.consentGiven = false;

        // Zatrzymaj wszystkie moduły
        this.modules.forEach((module, name) => {
          if (module.active) {
            try {
              module.destroy();
              module.active = false;
            } catch (error) {
              console.error(`GDPR: Błąd zatrzymania modułu ${name}:`, error);
            }
          }
        });

      } catch (error) {
        console.error('GDPR: Błąd resetowania zgody:', error);
      }
    }

    // Sprawdza czy można śledzić konkretną kategorię
    canUseCategory(category) {
      const categoryConfig = GDPR_CONFIG.categories[category];
      if (!categoryConfig) {
        console.warn(`GDPR: Nieznana kategoria: ${category}`);
        return false;
      }

      return categoryConfig.locked || this.hasConsent(category);
    }

    // Zwraca status wszystkich kategorii
    getConsentStatus() {
      const status = {};
      Object.keys(GDPR_CONFIG.categories).forEach(category => {
        status[category] = this.canUseCategory(category);
      });
      return status;
    }

    // Wywołuje callback gdy zgoda się zmieni
    onConsentChange(callback) {
      if (typeof callback !== 'function') return;

      // Dodaj do listenersów (można rozszerzyć)
      setTimeout(() => callback(this.getConsentStatus()), 0);
    }
  }

  // GDPR Manager will be initialized in initGDPR (no auto-init)
  // window.GDPRManager = new GDPRManager(); // REMOVED - will be created in initGDPR

  // Google Analytics Domain Fix
  // Zapobiega problemom z cookies GA na localhost/testowych domenach
  if (
    typeof gtag !== 'undefined' &&
    (location.hostname === 'localhost' ||
      location.hostname.includes('127.0.0.1') ||
      location.hostname.includes('.replit.') ||
      location.hostname.includes('test'))
  ) {

    // Override gtag dla środowisk dev/test
    window.gtag = function () {
    };
  }

  // Export init function for bootApp (no auto-init)
  // Auto-init removed - must be called from bootApp
  if (typeof window !== 'undefined') {
    window.__initGDPR = function initGDPR(ctx) {
      // Create GDPR Manager instance
      const gdprManager = new GDPRManager();
      ctx.gdpr = gdprManager;
      window.GDPRManager = gdprManager; // For backward compatibility

      try {
        gdprManager.showConsentBanner();

        // Auto-register podstawowe moduły jeśli są dostępne
        setTimeout(() => {
          if (typeof window.initAIWatchers === 'function') {
            window.registerGDPRModule('aiWatchers', 'analytics', window.initAIWatchers, () => {
              // Funkcja czyszcząca AI Watchers
              if (window.cleanupAIWatchers) window.cleanupAIWatchers();
            });
          }

          if (typeof window.initUserPathHistory === 'function') {
            window.registerGDPRModule(
              'userPathHistory',
              'analytics',
              window.initUserPathHistory,
              () => {
                if (window.cleanupUserPath) window.cleanupUserPath();
              }
            );
          }

        }, 500);
      } catch (error) {
        console.error('GDPR: Błąd inicjalizacji:', error);
      }

      // Export for other modules
      window.canTrack = category => gdprManager.canTrack(category);
      window.registerGDPRModule = (name, category, init, destroy) =>
        gdprManager.registerModule(name, category, init, destroy);

      // Return disposer
      return function disposeGDPR() {
        if (gdprManager.dispose && typeof gdprManager.dispose === 'function') {
          gdprManager.dispose();
        }
        // Cleanup exports
        delete window.canTrack;
        delete window.registerGDPRModule;
        delete window.GDPRManager;
      };
    };
  }

  // Export for other modules (will be set in initGDPR)
  // window.canTrack = category => window.GDPRManager.canTrack(category);
  // window.registerGDPRModule = (name, category, init, destroy) =>
  //   window.GDPRManager.registerModule(name, category, init, destroy);
  window.getGDPRStatus = () => window.GDPRManager.getConsentStatus();
  window.resetGDPRConsent = () => window.GDPRManager.resetConsent();

})();