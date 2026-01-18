// === FILE: aiWatchers.js ===
// Obsługuje: AI Watchers - 5 systemów śledzenia zachowań użytkownika
// GDPR Compliant - wymaga zgody użytkownika

(function () {
  'use strict';

  function canTrack() {
    return typeof window.canTrack === 'function' ? window.canTrack('analytics') : false;
  }

  const DEBUG_LIVE_FORM_DATA = false;
  const DEBUG_USER_PATH = false;
  const DEBUG_TIMESTAMP_LOG = false;
  const DEBUG_FORM_ANOMALIES = false;
  const DEBUG_USER_ACTIVITY = false;

  const stores = new Map();
  let __ctx = null;
  let __root = null;
  let __dom = null;
  let __store = null;
  let __cleanup = null;

  function getInstanceId(ctx) {
    const explicit = ctx?.state?.instanceId;
    if (explicit) return String(explicit);
    const rootId = __root?.getAttribute?.('data-hp-instance');
    return String(rootId || window.formEngine?.__activeInstanceId || 'default');
  }

  function getStep() {
    const appState = __ctx?.state?.getAppState?.();
    if (appState && typeof appState.currentTab === 'number') {
      return appState.currentTab;
    }
    return window.currentTab || 0;
  }

  function ensureStore(instanceId, ctx) {
    const key = String(instanceId || 'default');
    let store = stores.get(key);
    if (!store) {
      store = {
        id: key,
        liveFormData: {},
        userPathHistory: [],
        timestampLog: [],
        formAnomalies: [],
        __initialized: false,
      };
      stores.set(key, store);
    }
    if (ctx && ctx.state) {
      ctx.state.aiWatchers = store;
    }
    return store;
  }

  function getActiveStore() {
    const id = getInstanceId(__ctx);
    return ensureStore(id, __ctx);
  }

  function selectFormElements() {
    if (__root) {
      return Array.from(__root.querySelectorAll('input, select, textarea'));
    }
    return Array.from(hpQsa('input, select, textarea'));
  }

  function initLiveFormData() {
    if (!canTrack()) return;

    __store.liveFormData = __store.liveFormData || {};
    window.liveFormData = __store.liveFormData;

    function updateLiveData(element) {
      if (!element || !element.name) return;

      const value = element.type === 'checkbox' ? element.checked : element.value;
      __store.liveFormData[element.name] = {
        value: value,
        timestamp: Date.now(),
        element_type: element.type,
        step: getStep(),
      };

      if (DEBUG_LIVE_FORM_DATA) {
      }
    }

    const formElements = selectFormElements();
    formElements.forEach(element => {
      const handler = () => updateLiveData(element);
      element.addEventListener('input', handler);
      element.addEventListener('change', handler);
      __cleanup.push(() => {
        try {
          element.removeEventListener('input', handler);
          element.removeEventListener('change', handler);
        } catch (e) {}
      });
    });
  }

  function initUserPathHistory() {
    if (!canTrack()) return;

    __store.userPathHistory = __store.userPathHistory || [];
    window.userPathHistory = __store.userPathHistory;

    function trackFieldFocus(element) {
      if (!element || !element.name) return;

      const pathEntry = {
        field_name: element.name,
        field_type: element.type,
        timestamp: Date.now(),
        step: getStep(),
        sequence_number: __store.userPathHistory.length + 1,
      };

      __store.userPathHistory.push(pathEntry);

      if (DEBUG_USER_PATH) {
      }
    }

    const formElements = selectFormElements();
    formElements.forEach(element => {
      const handler = () => trackFieldFocus(element);
      element.addEventListener('focus', handler);
      __cleanup.push(() => {
        try {
          element.removeEventListener('focus', handler);
        } catch (e) {}
      });
    });
  }

  function initTimestampLog() {
    if (!canTrack()) return;

    __store.timestampLog = __store.timestampLog || [];
    window.timestampLog = __store.timestampLog;

    function logInteraction(label, actionType = 'change', value = null) {
      const logEntry = {
        timestamp: Date.now(),
        datetime: new Date().toISOString(),
        label: label,
        action: actionType,
        value: value,
        step: getStep(),
      };

      __store.timestampLog.push(logEntry);

      if (DEBUG_TIMESTAMP_LOG) {
      }
    }

    const clickHandler = function (e) {
      const target = e.target && e.target.closest ? e.target.closest('button, .btn-next, .btn-prev') : e.target;
      if (!target) return;
      if (__root && !__root.contains(target)) return;
      if (target.matches && target.matches('button, .btn-next, .btn-prev')) {
        logInteraction(target.className || target.textContent, 'click', target.textContent);
      }
    };
    if (__root) {
      __root.addEventListener('click', clickHandler, true);
      __cleanup.push(() => __root.removeEventListener('click', clickHandler, true));
    } else {
      document.addEventListener('click', clickHandler, true);
      __cleanup.push(() => document.removeEventListener('click', clickHandler, true));
    }

    const formElements = selectFormElements();
    formElements.forEach(element => {
      const handler = function () {
        const value = this.type === 'checkbox' ? this.checked : this.value;
        logInteraction(this.name || this.id, 'change', value);
      };
      element.addEventListener('change', handler);
      __cleanup.push(() => {
        try {
          element.removeEventListener('change', handler);
        } catch (e) {}
      });
    });
  }

  function checkForAnomalies(data) {
    const anomalies = [];

    if (__store.userPathHistory && __store.userPathHistory.length > 1) {
      const recent = __store.userPathHistory.slice(-2);
      const timeDiff = recent[1].timestamp - recent[0].timestamp;
      if (timeDiff < 1000) {
        anomalies.push({
          type: 'fast_filling',
          message: 'Bardzo szybkie wypełnianie pól',
          timestamp: Date.now(),
        });
      }
    }

    if (data.heated_area && data.total_area) {
      if (parseFloat(data.heated_area) > parseFloat(data.total_area)) {
        anomalies.push({
          type: 'logic_error',
          message: 'Powierzchnia ogrzewana większa niż całkowita',
          timestamp: Date.now(),
        });
      }
    }

    return anomalies;
  }

  function initFormAnomalies() {
    if (!canTrack()) return;

    __store.formAnomalies = __store.formAnomalies || [];
    window.formAnomalies = __store.formAnomalies;

    let lastCheckTime = 0;
    const CHECK_INTERVAL = 5000;

    function checkAnomaliesOnChange() {
      const now = Date.now();
      if (now - lastCheckTime < CHECK_INTERVAL) return;
      lastCheckTime = now;

      const check = () => {
        const formData = __store.liveFormData || {};
        const anomalies = checkForAnomalies(formData);

        if (anomalies.length > 0) {
          __store.formAnomalies.push(...anomalies);

          if (DEBUG_FORM_ANOMALIES) {
            console.warn('[ANOMALY]', anomalies);
          }

          const target = __root || document;
          target.dispatchEvent(
            new CustomEvent('formAnomaliesDetected', {
              detail: { anomalies: anomalies },
            })
          );
        }
      };

      if (window.requestIdleCallback) {
        requestIdleCallback(check, { timeout: 2000 });
      } else {
        setTimeout(check, 0);
      }
    }

    const form = __root ? __root.querySelector('#heatCalcFormFull') : hpById('heatCalcFormFull');
    if (form) {
      form.addEventListener('change', checkAnomaliesOnChange);
      form.addEventListener('input', checkAnomaliesOnChange);
      __cleanup.push(() => {
        try {
          form.removeEventListener('change', checkAnomaliesOnChange);
          form.removeEventListener('input', checkAnomaliesOnChange);
        } catch (e) {}
      });
    }

    checkAnomaliesOnChange();
  }

  function initUserActivityTracker() {
    if (!canTrack()) return;

    let idleTimer = null;
    let isIdle = false;
    const IDLE_TIME = 30000;

    function resetIdleTimer() {
      if (idleTimer) clearTimeout(idleTimer);

      if (isIdle) {
        isIdle = false;
        if (DEBUG_USER_ACTIVITY) {
        }
        const target = __root || document;
        target.dispatchEvent(new CustomEvent('userBecameActive'));
      }

      idleTimer = setTimeout(() => {
        isIdle = true;
        if (DEBUG_USER_ACTIVITY) {
        }
        const target = __root || document;
        target.dispatchEvent(new CustomEvent('userBecameIdle'));
      }, IDLE_TIME);
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      const target = __root || document;
      target.addEventListener(event, resetIdleTimer, true);
      __cleanup.push(() => {
        try {
          target.removeEventListener(event, resetIdleTimer, true);
        } catch (e) {}
      });
    });

    resetIdleTimer();
  }

  function initAIWatchers(ctx) {
    try {
      __ctx = ctx || null;
      __root = (ctx && ctx.root) ? ctx.root : (window.__HP_ACTIVE_ROOT__ || null);
      __dom = (ctx && ctx.dom) ? ctx.dom : null;

      const instanceId = getInstanceId(ctx);
      __store = ensureStore(instanceId, ctx);

      if (__store.__initialized) return function disposeAIWatchers() {};
      __store.__initialized = true;

      __cleanup = [];

      initLiveFormData();
      initUserPathHistory();
      initTimestampLog();
      initFormAnomalies();
      initUserActivityTracker();

      window.getLiveFormData = () => {
        const s = getActiveStore();
        return s && s.liveFormData ? s.liveFormData : {};
      };
      window.getUserPathHistory = () => {
        const s = getActiveStore();
        return s && s.userPathHistory ? s.userPathHistory : [];
      };
      window.getTimestampLog = () => {
        const s = getActiveStore();
        return s && s.timestampLog ? s.timestampLog : [];
      };
      window.getFormAnomalies = () => {
        const s = getActiveStore();
        return s && s.formAnomalies ? s.formAnomalies : [];
      };

      window.clearLiveFormData = () => {
        const s = getActiveStore();
        if (s) s.liveFormData = {};
        if (s && s.id === getInstanceId(__ctx)) window.liveFormData = s.liveFormData;
      };
      window.clearUserPathHistory = () => {
        const s = getActiveStore();
        if (s) s.userPathHistory = [];
        if (s && s.id === getInstanceId(__ctx)) window.userPathHistory = s.userPathHistory;
      };
      window.clearTimestampLog = () => {
        const s = getActiveStore();
        if (s) s.timestampLog = [];
        if (s && s.id === getInstanceId(__ctx)) window.timestampLog = s.timestampLog;
      };
      window.clearFormAnomalies = () => {
        const s = getActiveStore();
        if (s) s.formAnomalies = [];
        if (s && s.id === getInstanceId(__ctx)) window.formAnomalies = s.formAnomalies;
      };

      window.getInteractionStats = () => {
        const s = getActiveStore();
        const stats = {
          totalFields: s ? Object.keys(s.liveFormData || {}).length : 0,
          pathLength: s ? (s.userPathHistory || []).length : 0,
          totalInteractions: s ? (s.timestampLog || []).length : 0,
          anomaliesCount: s ? (s.formAnomalies || []).length : 0,
          currentStep: getStep(),
        };
        return stats;
      };
    } catch (error) {
      console.error('Błąd podczas inicjalizacji AI Watchers:', error);
    }

    return function disposeAIWatchers() {
      try {
        if (__cleanup && Array.isArray(__cleanup)) {
          __cleanup.forEach(fn => {
            try {
              fn();
            } catch (e) {}
          });
        }
      } finally {
        if (__store) __store.__initialized = false;
        __cleanup = null;
      }
    };
  }

  window.initAIWatchers = initAIWatchers;
  window.checkForAnomalies = checkForAnomalies;

  window.__HP_MODULES__ = window.__HP_MODULES__ || {};
  window.__HP_MODULES__.aiWatchers = {
    init(ctx) {
      return window.initAIWatchers(ctx);
    },
  };
})();
