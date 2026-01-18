(function (window) {
  'use strict';

  const formEngine = window.formEngine || (window.formEngine = {});
  const instances = formEngine.__instances || (formEngine.__instances = new Map());
  let activeInstanceId = formEngine.__activeInstanceId || 'default';
  formEngine.__activeInstanceId = activeInstanceId;

  formEngine.__setActiveInstance = function (id) {
    if (!id) return;
    activeInstanceId = String(id);
    formEngine.__activeInstanceId = activeInstanceId;
  };

  function getInstance(id) {
    const key = String(id || 'default');
    let inst = instances.get(key);
    if (!inst) {
      inst = {
        id: key,
        values: Object.create(null),
        fieldElements: Object.create(null),
        appState: null,
        saveTimeout: null,
      };
      instances.set(key, inst);
    }
    return inst;
  }

  function getActiveInstance() {
    return getInstance(activeInstanceId);
  }

  const SAVE_DEBOUNCE_MS = 400;

  function appStateKey(instanceId) {
    return `wycena2025_appState::${String(instanceId || 'default')}`;
  }

  function ensureAppState(inst) {
    if (!inst.appState) {
      inst.appState = {
        formData: {},
        currentTab: 0,
        lastCalculationResult: null,
        completionAnimationShown: false,
        timestamp: Date.now(),
      };
    }
    return inst.appState;
  }

  function getAppState() {
    return ensureAppState(getActiveInstance());
  }

  function loadFromSessionStorageFor(instanceId) {
    const inst = getInstance(instanceId);
    try {
      const stored = sessionStorage.getItem(appStateKey(inst.id));
      if (stored) {
        inst.appState = JSON.parse(stored);
        return inst.appState;
      }
    } catch (error) {
      console.warn('[AppState] Błąd ładowania z sessionStorage:', error);
    }
    return null;
  }

  function loadFromSessionStorage() {
    return loadFromSessionStorageFor(activeInstanceId);
  }

  function saveToSessionStorageFor(instanceId, state) {
    try {
      sessionStorage.setItem(appStateKey(instanceId), JSON.stringify(state));
      return true;
    } catch (error) {
      console.warn('[AppState] Błąd zapisu do sessionStorage:', error);
      return false;
    }
  }

  function saveToSessionStorage(state) {
    return saveToSessionStorageFor(activeInstanceId, state);
  }

  function updateAppStateFor(instanceId, updates) {
    const inst = getInstance(instanceId);
    const state = ensureAppState(inst);
    Object.assign(state, updates);
    state.timestamp = Date.now();

    if (inst.saveTimeout) {
      clearTimeout(inst.saveTimeout);
    }
    inst.saveTimeout = setTimeout(() => {
      saveToSessionStorageFor(instanceId, state);
      inst.saveTimeout = null;
    }, SAVE_DEBOUNCE_MS);

    return state;
  }

  function updateAppState(updates) {
    return updateAppStateFor(activeInstanceId, updates);
  }

  function getAllValuesForInstance(instanceId) {
    const inst = getInstance(instanceId);
    if (inst.appState && inst.appState.formData && Object.keys(inst.appState.formData).length > 0) {
      return { ...inst.appState.formData, ...inst.values };
    }
    return { ...inst.values };
  }

  function syncFormDataToAppStateFor(instanceId) {
    const formData = getAllValuesForInstance(instanceId);
    updateAppStateFor(instanceId, { formData });
  }

  function syncFormDataToAppState() {
    syncFormDataToAppStateFor(activeInstanceId);
  }

  function syncAppStateToFormEngineFor(instanceId) {
    const inst = getInstance(instanceId);
    const state = ensureAppState(inst);
    if (state.formData && Object.keys(state.formData).length > 0) {
      const prev = activeInstanceId;
      formEngine.__setActiveInstance(instanceId);
      Object.entries(state.formData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          setValue(key, value);
        }
      });
      formEngine.__setActiveInstance(prev);
    }
  }

  function syncAppStateToFormEngine() {
    syncAppStateToFormEngineFor(activeInstanceId);
  }

  function registerField(name, elements) {
    getActiveInstance().fieldElements[name] = elements;
  }

  function getFieldElements(name) {
    return getActiveInstance().fieldElements[name] || null;
  }

  function setValue(name, value) {
    const inst = getActiveInstance();
    const previous = inst.values[name];
    if (typeof value === 'string') {
      inst.values[name] = value.trim();
    } else if (Array.isArray(value)) {
      inst.values[name] = value.slice();
    } else if (value === undefined || value === null) {
      delete inst.values[name];
    } else {
      inst.values[name] = value;
    }
    const changed = previous !== inst.values[name];

    if (changed && inst.appState) {
      syncFormDataToAppState();
    }

    return changed;
  }

  function getValue(name) {
    return getActiveInstance().values[name];
  }

  function getAllValues() {
    return getAllValuesForInstance(activeInstanceId);
  }

  function resetValues() {
    const inst = getActiveInstance();
    Object.keys(inst.values).forEach(key => delete inst.values[key]);
  }

  formEngine.state = {
    registerField,
    getFieldElements,
    setValue,
    getValue,
    getAllValues,
    resetValues,
  };

  if (typeof window !== 'undefined') {
    window.__initState = function initState(ctx = {}) {
      if (!window.formEngine) {
        window.formEngine = formEngine;
      }

      const instanceId =
        ctx?.state?.instanceId ||
        ctx?.root?.getAttribute?.('data-hp-instance') ||
        'default';
      formEngine.__setActiveInstance(instanceId);

      ctx.state = ctx.state || {};
      Object.assign(ctx.state, {
        instanceId,
        formEngine,
        getAppState: () => ensureAppState(getInstance(instanceId)),
        updateAppState: updates => updateAppStateFor(instanceId, updates),
        syncFormDataToAppState: () => syncFormDataToAppStateFor(instanceId),
        syncAppStateToFormEngine: () => syncAppStateToFormEngineFor(instanceId),
        loadFromSessionStorage: () => loadFromSessionStorageFor(instanceId),
        saveToSessionStorage: state => saveToSessionStorageFor(instanceId, state),
      });

      window.loadAppStateFromSessionStorage = loadFromSessionStorage;
      window.saveAppStateToSessionStorage = saveToSessionStorage;
      window.getAppState = getAppState;
      window.updateAppState = updateAppState;
      window.syncFormDataToAppState = syncFormDataToAppState;
      window.syncAppStateToFormEngine = syncAppStateToFormEngine;

      return function disposeState() {
        const inst = getInstance(instanceId);
        if (inst.saveTimeout) {
          clearTimeout(inst.saveTimeout);
          inst.saveTimeout = null;
        }
        inst.appState = null;
      };
    };
    window.__HP_STATE_READY__ = true;
  }
})(window);
