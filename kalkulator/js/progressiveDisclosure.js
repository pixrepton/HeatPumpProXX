// === FILE: progressiveDisclosure.js ===
// Cienka warstwa integracji: deleguje logikę do formEngine,
// bez własnych sekwencji / disabled. Służy tylko do odświeżania
// stanu sekcji oraz opcjonalnych hooków dla sliderów.

(function(window) {
  'use strict';

  function getEngine() {
    if (window.formEngine && typeof window.formEngine.init === 'function') {
      return window.formEngine;
    }
    return null;
  }

  const progressiveDisclosure = {
    initialized: false,

    init() {
      if (this.initialized) return;
      const engine = getEngine();
      if (!engine) {
        console.warn('[progressiveDisclosure] formEngine nie jest dostępny');
        return;
      }

      // formEngine.init jest wywoływany w calculatorInit – tutaj tylko
      // upewniamy się, że sekcje są odświeżone po jego starcie.
      try {
        if (typeof engine.softRefresh === 'function') {
          engine.softRefresh();
        }
        if (typeof engine.updateSectionButtons === 'function') {
          engine.updateSectionButtons();
        }
        this.initialized = true;
      } catch (e) {
        console.warn('[progressiveDisclosure] Błąd podczas inicjalizacji:', e);
      }
    },

    /**
     * Wywoływane z tabNavigation.showTab – odświeża widoczność/wymagalność
     * po zmianie sekcji.
     */
    updateTab(/* index */) {
      const engine = getEngine();
      if (engine && typeof engine.softRefresh === 'function') {
        engine.softRefresh();
      }
    },

    /**
     * Aktualizuje stan przycisków „Dalej” na podstawie sectionFields
     * i wymaganych pól w formEngine.
     */
    updateButton() {
      const engine = getEngine();
      if (engine && typeof engine.updateSectionButtons === 'function') {
        engine.updateSectionButtons();
      }
    },

    /**
     * Hook dla przycisków potwierdzających slider – jeśli ktoś zewnętrznie
     * wywoła tę funkcję, przekaż zmianę do formEngine.
     */
    handleSliderConfirm(fieldName) {
      const engine = getEngine();
      if (engine && typeof engine.handleExternalUpdate === 'function') {
        try {
          engine.handleExternalUpdate(fieldName);
        } catch (e) {
          console.warn('[progressiveDisclosure] Błąd handleSliderConfirm:', e);
        }
      }
    },

    handleSliderChange(fieldName) {
      const engine = getEngine();
      if (engine && typeof engine.handleExternalUpdate === 'function') {
        try {
          engine.handleExternalUpdate(fieldName);
        } catch (e) {
          console.warn('[progressiveDisclosure] Błąd handleSliderChange:', e);
        }
      }
    }
  };

  window.progressiveDisclosure = progressiveDisclosure;
})(window);

