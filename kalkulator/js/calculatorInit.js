// === FILE: calculatorInit.js ===
// WordPress protection: IIFE guard to prevent multiple executions
(function () {
  "use strict";

  const LOG = (typeof window !== "undefined" && window.HP_LOG) || {
    info: function () {},
    warn: function () {},
    error: function () {},
    group: function () {},
    groupEnd: function () {},
  };

  LOG.group("BOOT");
  LOG.info("init", "calculatorInit.js loaded");

  LOG.info("init", "Init started");

  // Elementor edit mode check - skip initialization in Elementor editor
  if (window.elementorFrontend?.isEditMode?.()) {
    console.warn("[HP] Elementor edit mode - init skipped");
    return;
  }

  const roots = Array.from(
    document.querySelectorAll(
      ".heatpump-calculator, #wycena-calculator-app, #top-instal-calc, .heatpump-calculator-wrapper"
    )
  );
  if (!roots.length) return;

  function isRootVisible(root) {
    try {
      if (!root || !(root instanceof Element)) return false;
      const cs = window.getComputedStyle(root);
      if (!cs) return false;
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      // getClientRects catches many Elementor "template clones" that are not rendered
      if (!root.getClientRects || root.getClientRects().length === 0)
        return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  // Prefer the visible instance if there are duplicates (common with Elementor / templates)
  const activeRoot = roots.find(isRootVisible) || roots[0];
  if (!activeRoot) {
    LOG.warn("init", "Calculator root element not found on page");
    LOG.groupEnd();
    return;
  }

  if (roots.length > 1) {
    LOG.info("init", "Multiple calculator roots detected; initializing one.", {
      roots: roots.length,
      chosenIndex: roots.indexOf(activeRoot),
    });
  }

  if (!window.__HP_STATE_READY__) {
    LOG.error("init", "State not ready");
    LOG.groupEnd();
    return;
  }

  if (typeof window.createScopedDom !== "function") {
    LOG.error("init", "scopedDom is missing");
    LOG.groupEnd();
    return;
  }

  // ✅ GUARD DOPIERO TUTAJ (po sprawdzeniu wszystkich warunków)
  // Zapobiega race condition: guard jest ustawiony dopiero gdy mamy pewność,
  // że wszystkie zależności są gotowe i init może się wykonać do końca
  if (window.__TOPINST_CALC_INIT__) {
    LOG.warn("init", "Init skipped – already initialized");
    LOG.groupEnd();
    return;
  }
  window.__TOPINST_CALC_INIT__ = true;
  LOG.info("init", "Guard set - initialization will proceed");

  const initialized =
    window.__HP_APP_INITIALIZED__ instanceof WeakSet
      ? window.__HP_APP_INITIALIZED__
      : new WeakSet();
  window.__HP_APP_INITIALIZED__ = initialized;

  const disposers = [];

  function initInstance(root) {
    if (initialized.has(root)) return null;
    initialized.add(root);

    const instanceId =
      root.getAttribute("data-hp-instance") ||
      `hp_${Math.random().toString(36).slice(2, 9)}`;
    root.setAttribute("data-hp-instance", instanceId);

    LOG.info("init", "initInstance called", {
      instanceId,
      hasFormEngine: !!window.formEngine,
    });

    if (typeof window.__HP_SET_ACTIVE_ROOT__ === "function") {
      window.__HP_SET_ACTIVE_ROOT__(root);
    }

    const dom = window.createScopedDom(root);
    const state = {
      instanceId: instanceId,
      formEngine: window.formEngine || null,
      getAppState: window.getAppState,
      updateAppState: window.updateAppState,
      motion: window.MotionSystem,
      progressiveDisclosure: window.progressiveDisclosure,
      // BufferEngine may load async, so we check it at runtime in configurator
      bufferEngine: window.BufferEngine || null,
      downloadPDF: window.downloadPDF,
      debug: window,
      config: window.HEATPUMP_CONFIG || {},
      showTab: window.showTab,
    };
    const ctx = { root, dom, state };
    const cleanupFns = [];

    LOG.info("init", "initInstance called", {
      instanceId,
      hasFormEngine: !!state.formEngine,
    });

    const activate = () => {
      if (typeof window.__HP_SET_ACTIVE_ROOT__ === "function") {
        window.__HP_SET_ACTIVE_ROOT__(root);
      }
      if (
        window.formEngine &&
        typeof window.formEngine.__setActiveInstance === "function"
      ) {
        window.formEngine.__setActiveInstance(instanceId);
      }
    };
    activate();
    ["pointerdown", "focusin", "click", "touchstart"].forEach((eventName) => {
      root.addEventListener(eventName, activate, true);
      cleanupFns.push(() =>
        root.removeEventListener(eventName, activate, true)
      );
    });

    // KROK 1: Elementor Fix - MUSI być pierwszy (przed wszystkimi modułami)
    if (typeof window.__initElementorFix === "function") {
      LOG.info("module:elementorFix", "__initElementorFix called");
      const disposeElementorFix = window.__initElementorFix(ctx);
      if (typeof disposeElementorFix === "function")
        cleanupFns.push(disposeElementorFix);
    }

    // KROK 2: State (musi być wcześnie - inne moduły mogą go potrzebować)
    if (typeof window.__initState === "function") {
      LOG.info("module:state", "__initState called");
      const disposeState = window.__initState(ctx);
      if (typeof disposeState === "function") cleanupFns.push(disposeState);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // P1.3: DETERMINISTYCZNY INIT dynamicFields (bez setTimeout-owej loterii)
    // ═══════════════════════════════════════════════════════════════════════════
    // ⚠️ FIX: Guard przeciwko wielokrotnej inicjalizacji (zapobiega duplikacji event listenerów)
    // Używamy flagi na root zamiast WeakSet, bo root może być nowy po rerenderze
    // (WeakSet nie ochroni przed duplikacją jeśli root to nowy obiekt DOM)
    function initDynamicFields() {
      // Sprawdź czy już zainicjalizowane dla tego root (używamy flagi na root + instanceId)
      const rootInstanceId = root.getAttribute('data-hp-instance') || instanceId;
      const guardKey = `__dynamicFieldsInitialized_${rootInstanceId}`;

      if (root[guardKey] === true) {
        LOG.info("module:dynamicFields", "Already initialized for this root, skipping", {
          instanceId: rootInstanceId,
        });
        return;
      }

      if (typeof window.setupDynamicFields === "function") {
        try {
          LOG.info("module:dynamicFields", "setupDynamicFields called", {
            instanceId: rootInstanceId,
            rootId: root.id || root.className || 'unknown',
          });
          window.setupDynamicFields(root); // ✅ FIX Problem #5: Przekaż root dla WordPress multi-instance safety
          root[guardKey] = true; // Oznacz jako zainicjalizowane (flaga na root)
        } catch (e) {
          LOG.warn("module:dynamicFields", "setupDynamicFields error", e);
        }
      } else {
        LOG.warn("module:dynamicFields", "setupDynamicFields function not available");
      }
    }

    // KROK 3: Form Engine
    // ═══════════════════════════════════════════════════════════════════════════
    // P0.3: GUARD "ENGINE READY" - retry pattern zamiast setTimeout-owej loterii
    // ═══════════════════════════════════════════════════════════════════════════
    function waitForFormEngineReady(maxRetries = 5, delayMs = 50) {
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const checkReady = () => {
          attempts++;
          if (
            window.formEngine &&
            window.formEngine.state &&
            typeof window.formEngine.state.setValue === 'function' &&
            typeof window.formEngine.init === 'function'
          ) {
            resolve(window.formEngine);
            return;
          }
          if (attempts >= maxRetries) {
            LOG.warn("module:formEngine", "FormEngine not ready after retries", {
              attempts,
              hasFormEngine: !!window.formEngine,
              hasState: !!(window.formEngine && window.formEngine.state),
            });
            reject(new Error('FormEngine not ready after retries'));
            return;
          }
          setTimeout(checkReady, delayMs);
        };
        checkReady();
      });
    }

    // ⚠️ FIX: Inicjalizuj moduły zależne od formEngine PO Promise.then
    // Zapisz referencję do Promise, aby moduły mogły na nią poczekać
    const formEngineInitPromise = waitForFormEngineReady()
      .then((formEngine) => {
        LOG.info("module:formEngine", "FormEngine ready, initializing", {
          instanceId,
        });
        state.formEngine = formEngine;
        const dispose = formEngine.init(root);
        if (typeof dispose === "function") cleanupFns.push(dispose);

        // P1.3: Po formEngine.init wywołaj initDynamicFields deterministycznie
        // Użyj requestAnimationFrame dla pewności, że DOM jest gotowy
        if (view.requestAnimationFrame) {
          view.requestAnimationFrame(() => {
            initDynamicFields();
          });
        } else {
          // Fallback dla starszych przeglądarek
          setTimeout(initDynamicFields, 0);
        }

        return formEngine; // Zwróć formEngine dla innych modułów
      })
      .catch((error) => {
        LOG.error("module:formEngine", "FormEngine initialization failed", error);
        // Bezpieczny return - nie crashujemy aplikacji
        // Inne moduły mogą działać bez formEngine (z ograniczeniami)
        // Fallback: spróbuj initDynamicFields bez formEngine
        if (window.requestAnimationFrame) {
          window.requestAnimationFrame(() => {
            initDynamicFields();
          });
        } else {
          setTimeout(initDynamicFields, 100);
        }
        // Zwróć null aby moduły wiedziały, że formEngine nie jest dostępny
        return null;
      });

    // Zapisz Promise w state, aby moduły mogły na nią poczekać
    state.formEngineInitPromise = formEngineInitPromise;

    // KROK 4: Motion System (po state - używany przez UI)
    if (typeof window.__initMotion === "function") {
      LOG.info("module:motionSystem", "__initMotion called");
      const disposeMotion = window.__initMotion(ctx);
      if (typeof disposeMotion === "function") cleanupFns.push(disposeMotion);
    }

    // KROK 5: Moduły z window.__HP_MODULES__
    const modules = window.__HP_MODULES__ || {};
    const initModule = (key) => {
      const mod = modules[key];
      if (mod && typeof mod.init === "function") {
        LOG.info("module:" + key, "init called");
        const dispose = mod.init(ctx);
        if (typeof dispose === "function") cleanupFns.push(dispose);
      }
    };

    // Workflow Controller (progress bar, sticky behavior)
    initModule("workflowController");

    // Calculator UI (wszystkie event listeners dla UI)
    initModule("calculatorUI");

    // Results Renderer (renderowanie wyników)
    initModule("resultsRenderer");

    // ✅ FIX Problem #6: Konfigurator - inicjalizuj podczas startu (eager)
    // Zapewnia że moduł jest gotowy i event 'heatpump:configuratorReady' zostanie dispatchowany
    // PRZED tym jak resultsRenderer go potrzebuje (eliminuje race condition)
    // DOM konfiguratora będzie wypełniony później przez resultsRenderer.initFromResults()
    initModule("configurator");

    // KROK 6: Onboarding System (modały) - po workflow
    if (typeof window.__initOnboarding === "function") {
      LOG.info("module:onboarding", "__initOnboarding called");
      const disposeOnboarding = window.__initOnboarding(ctx);
      if (typeof disposeOnboarding === "function")
        cleanupFns.push(disposeOnboarding);
    }

    // KROK 7: GDPR Compliance (banner) - po onboarding
    if (typeof window.__initGDPR === "function") {
      LOG.info("module:gdpr", "__initGDPR called");
      const disposeGDPR = window.__initGDPR(ctx);
      if (typeof disposeGDPR === "function") cleanupFns.push(disposeGDPR);
    }

    // Mobile Controller
    initModule("mobileController");

    // AI Coach Dock
    initModule("aiCoachDock");

    // Quick Scenario (tryb szybkiego scenariusza) - jeśli dostępny
    if (typeof window.__initQuickScenario === "function") {
      try {
        LOG.info("module:quickScenario", "__initQuickScenario called");
        const disposeQuick = window.__initQuickScenario(ctx);
        if (typeof disposeQuick === "function") {
          cleanupFns.push(disposeQuick);
        }
      } catch (e) {
        LOG.warn("module:quickScenario", "__initQuickScenario error", e);
      }
    }

    // KROK 8: Download PDF (przycisk PDF) - na końcu
    if (typeof window.__initDownloadPDF === "function") {
      LOG.info("module:downloadPDF", "__initDownloadPDF called");
      const disposeDownloadPDF = window.__initDownloadPDF(ctx);
      if (typeof disposeDownloadPDF === "function")
        cleanupFns.push(disposeDownloadPDF);
    }

    // KROK 9: Dynamic Fields - inicjalizacja dynamicznych pól formularza
    // ═══════════════════════════════════════════════════════════════════════════
    // P1.3: initDynamicFields jest już zdefiniowane wyżej i wywoływane
    // deterministycznie po formEngine.init (w Promise.then)
    // ═══════════════════════════════════════════════════════════════════════════


    return function disposeInstance() {
      cleanupFns.forEach((fn) => {
        try {
          fn();
        } catch (e) {
          console.error("Dispose error:", e);
        }
      });
      if (initialized.has(root)) {
        initialized.delete(root);
      }
    };
  }

  // Init only one active root to avoid cross-instance event mixing (formEngine is single-active-instance)
  const dispose = initInstance(activeRoot);
  if (dispose) disposers.push(dispose);
  LOG.info("init", "Init finished");
  LOG.groupEnd();

  window.__HP_DISPOSE_ALL__ = function () {
    disposers.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error("Dispose error:", e);
      }
    });
  };

  // Diagnostic helpers for quick checklist testing
  window.HP_DIAG = window.HP_DIAG || {};
  window.HP_DIAG.checkConfiguratorOnPage = function () {
    const roots = Array.from(document.querySelectorAll(".heatpump-calculator"));
    const results = [];
    roots.forEach((root) => {
      const inst = root.getAttribute("data-hp-instance") || null;
      const cfg = root.querySelector(".machine-room-configurator-section");
      const visible = cfg
        ? window.getComputedStyle(cfg).display !== "none" &&
          cfg.offsetParent !== null
        : false;
      results.push({
        instance: inst,
        hasConfiguratorDom: !!cfg,
        visible: visible,
      });
    });
    console.debug("[HP_DIAG] checkConfiguratorOnPage:", results);
    return results;
  };

  window.HP_DIAG.checkButtonsClickable = function () {
    const root = document.querySelector(".heatpump-calculator");
    if (!root) {
      console.warn("[HP_DIAG] No .heatpump-calculator root found");
      return null;
    }
    const elems = Array.from(
      root.querySelectorAll(
        'button, [role="button"], input[type="submit"], .btn-next, .btn-finish, .quick-scenario-ok'
      )
    );
    const report = elems.map((el) => {
      const cs = window.getComputedStyle(el);
      return {
        tag: el.tagName,
        selector:
          el.className ||
          el.id ||
          el.getAttribute("data-action") ||
          el.getAttribute("data-role") ||
          null,
        disabled: el.disabled === true,
        pointerEvents: cs.pointerEvents,
        listenerFlag: el.dataset.listenerAttached === "true",
      };
    });
    console.debug("[HP_DIAG] checkButtonsClickable", report);
    return report;
  };

  window.HP_DIAG.checkQuickScenario = function () {
    const modal = document.getElementById("quick-scenario-modal");
    if (!modal) {
      console.warn("[HP_DIAG] quick scenario modal not found");
      return null;
    }
    const ok = modal.querySelector(".quick-scenario-ok");
    const report = {
      exists: !!ok,
      visible: ok
        ? window.getComputedStyle(ok).display !== "none" &&
          ok.offsetParent !== null
        : false,
      listenerFlag: ok ? ok.dataset.listenerAttached === "true" : false,
    };
    console.debug("[HP_DIAG] checkQuickScenario", report);
    return report;
  };

  window.HP_DIAG.checkConfiguratorMarker = function () {
    const root = document.querySelector(".heatpump-calculator");
    if (!root) {
      console.warn("[HP_DIAG] root not found");
      return null;
    }
    return { dataset: { ...root.dataset } };
  };

  // Enable lightweight click logging for testing "Dalej" / "Oblicz" / quick scenario
  window.HP_DIAG.enableClickLogging = function () {
    if (window.HP_DIAG._clickLogger) return window.HP_DIAG._clickLogger;
    const handler = function (e) {
      const t = e.target.closest(
        ".btn-next, .btn-finish, .quick-scenario-ok, button"
      );
      if (!t) return;
      const classes = (t.className || "").split(/\s+/).filter(Boolean);
      if (
        classes.includes("btn-next") ||
        classes.includes("btn-finish") ||
        classes.includes("quick-scenario-ok")
      ) {
        try {
          console.debug("[HP_DIAG] click detected on", {
            selector:
              t.className ||
              t.id ||
              t.getAttribute("data-action") ||
              t.getAttribute("data-role"),
            datasetListenerFlag: t.dataset.listenerAttached || null,
          });
          t.dataset.hdLastClickedAt = Date.now();
        } catch (err) {}
      }
    };
    document.addEventListener("click", handler, true);
    window.HP_DIAG._clickLogger = {
      off: function () {
        document.removeEventListener("click", handler, true);
        delete window.HP_DIAG._clickLogger;
      },
    };
    console.debug("[HP_DIAG] click logging enabled");
    return window.HP_DIAG._clickLogger;
  };

  window.HP_DIAG.disableClickLogging = function () {
    if (
      window.HP_DIAG._clickLogger &&
      typeof window.HP_DIAG._clickLogger.off === "function"
    ) {
      window.HP_DIAG._clickLogger.off();
    }
  };
})();
