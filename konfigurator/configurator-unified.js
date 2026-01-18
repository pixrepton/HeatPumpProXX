// configurator-unified.js
// Kompleksowy, zunifikowany konfigurator maszynowni TOP-INSTAL
// Łączy najlepsze cechy configurator-new.js i configurator.js
// Gotowy do produkcji - pełna funkcjonalność: pricing, rules engine, export, advanced summary

(function (window) {
  "use strict";

  function init(ctx) {
    console.log("[KONFIG:INIT] 🚀 Configurator init() started");
    console.log("[KONFIG:INIT] 📦 Context:", {
      hasRoot: !!ctx.root,
      hasDom: !!ctx.dom,
      hasState: !!ctx.state,
    });

    const { root, dom, state: appState } = ctx;
    const disposers = [];
    const doc = root.ownerDocument;
    const view = doc.defaultView || window;
    const config = appState?.config || {};
    // BufferEngine may load async, so check both appState and window
    const bufferEngine = appState?.bufferEngine || window.BufferEngine || null;
    const motion = appState?.motion || null;
    const getAppState = appState?.getAppState;
    const updateAppState = appState?.updateAppState;
    const debug = appState?.debug || view;

    console.log("[KONFIG:INIT] 🔧 BufferEngine available:", !!bufferEngine);
    console.log("[KONFIG:INIT] 🎨 Motion system available:", !!motion);

    function trackTimeout(handler, delay) {
      const id = view.setTimeout(handler, delay);
      disposers.push(() => view.clearTimeout(id));
      return id;
    }

    function trackInterval(handler, delay) {
      const id = view.setInterval(handler, delay);
      disposers.push(() => view.clearInterval(id));
      return id;
    }

    function trackObserver(observer) {
      if (observer && typeof observer.disconnect === "function") {
        disposers.push(() => observer.disconnect());
      }
      return observer;
    }

    function bind(element, event, handler, options) {
      if (!element || !event || typeof handler !== "function") {
        return () => {};
      }
      element.addEventListener(event, handler, options);
      return function off() {
        element.removeEventListener(event, handler, options);
      };
    }

    function trackEvent(element, event, handler, options) {
      disposers.push(bind(element, event, handler, options));
    }

    const setTimeout = trackTimeout;
    const setInterval = trackInterval;
    const clearTimeout = view.clearTimeout.bind(view);
    const clearInterval = view.clearInterval.bind(view);

    const MutationObserver = view.MutationObserver
      ? function MutationObserverProxy(callback) {
          const observer = new view.MutationObserver(callback);
          trackObserver(observer);
          return observer;
        }
      : null;

    let configuratorInitDone = false;

    /* ==========================================================================
     PHASE 3C — RULES LOADER (Data-Driven Configuration)
     ========================================================================== */
    /**
     * Wrapper dla BufferEngine.getBufferRules()
     * Zachowuje kompatybilność z istniejącym kodem
     */
    function getBufferRules() {
      if (bufferEngine && typeof bufferEngine.getBufferRules === "function") {
        return bufferEngine.getBufferRules();
      }
      console.warn(
        "[Configurator] ⚠️ BufferEngine nie jest dostępny, używam pustych reguł"
      );
      // Elegancki, informacyjny komunikat dla użytkownika
      if (
        typeof window.ErrorHandler !== "undefined" &&
        window.ErrorHandler.showToast
      ) {
        window.ErrorHandler.showToast(
          "Część rekomendacji w trybie uproszczonym",
          "info",
          4000
        );
      }
      return {};
    }

    /**
     * Wrapper dla BufferEngine.loadBufferRules()
     * Zachowuje kompatybilność z istniejącym kodem
     */
    async function loadBufferRules() {
      if (bufferEngine && typeof bufferEngine.loadBufferRules === "function") {
        return bufferEngine.loadBufferRules();
      }
      console.warn("[Configurator] ⚠️ BufferEngine nie jest dostępny");
      // Elegancki, informacyjny komunikat dla użytkownika
      if (
        typeof window.ErrorHandler !== "undefined" &&
        window.ErrorHandler.showToast
      ) {
        window.ErrorHandler.showToast(
          "Część rekomendacji w trybie uproszczonym",
          "info",
          4000
        );
      }
      return {};
    }

    /* ==========================================================================
     PUMP MATCHING & SELECTION (z configurator.js)
     ========================================================================== */

    // Tabela doboru pomp ciepła - tylko modele ze starego kodu (SDC→WC, ADC) - Seria K
    // Tabela doboru pomp ciepła - tylko modele ze starego kodu (SDC→WC, ADC)
    // Zakresy min/max to zakresy mocy przy -20°C (dane doborowe Panasonic), NIE zakresy modulacji
    // ⚠️ FIX P1.1: Użyj konsolidowanej tabeli (Single Source of Truth)
    // Fallback do lokalnej tabeli dla kompatybilności wstecznej
    const pumpMatchingTable = window.PUMP_MATCHING_TABLE || {
      // HIGH PERFORMANCE - SPLIT - 1~ (230V) - Seria K
      "KIT-WC03K3E5": {
        min: { surface: 3.0, mixed: 3.0, radiators: 2.5 },
        max: { surface: 4.2, mixed: 4.2, radiators: 3.5 },
        power: 3,
        series: "K",
        type: "split",
        requires3F: false,
        phase: 1,
      },
      "KIT-WC05K3E5": {
        min: { surface: 4.3, mixed: 4.3, radiators: 3.5 },
        max: { surface: 6.5, mixed: 6.4, radiators: 6.0 },
        power: 5,
        series: "K",
        type: "split",
        requires3F: false,
        phase: 1,
      },
      "KIT-WC07K3E5": {
        min: { surface: 5.5, mixed: 5.0, radiators: 4.5 },
        max: { surface: 7.0, mixed: 6.5, radiators: 6.5 },
        power: 7,
        series: "K",
        type: "split",
        requires3F: false,
        phase: 1,
      },
      "KIT-WC09K3E5": {
        min: { surface: 6.7, mixed: 6.5, radiators: 5.5 },
        max: { surface: 8.0, mixed: 8.0, radiators: 7.5 },
        power: 9,
        series: "K",
        type: "split",
        requires3F: false,
        phase: 1,
      },
      // HIGH PERFORMANCE - SPLIT - 3~ (400V) - Seria K
      "KIT-WC09K3E8": {
        min: { surface: 8.0, mixed: 8.1, radiators: 7.5 },
        max: { surface: 11.0, mixed: 10.5, radiators: 10.0 },
        power: 9,
        series: "K",
        type: "split",
        requires3F: true,
        phase: 3,
      },
      "KIT-WC12K9E8": {
        min: { surface: 10.5, mixed: 9.5, radiators: 8.5 },
        max: { surface: 14.5, mixed: 13.5, radiators: 13.0 },
        power: 12,
        series: "K",
        type: "split",
        requires3F: true,
        phase: 3,
      },
      "KIT-WC16K9E8": {
        min: { surface: 12.5, mixed: 11.0, radiators: 10.0 },
        max: { surface: 17.5, mixed: 16.0, radiators: 14.5 },
        power: 16,
        series: "K",
        type: "split",
        requires3F: true,
        phase: 3,
      },
      // HIGH PERFORMANCE - ALL IN ONE 185L - 1~ (230V) - Seria K
      "KIT-ADC03K3E5": {
        min: { surface: 3.0, mixed: 3.0, radiators: 2.5 },
        max: { surface: 4.2, mixed: 4.2, radiators: 3.5 },
        power: 3,
        series: "K",
        type: "all-in-one",
        requires3F: false,
        phase: 1,
        cwu_tank: 185,
      },
      "KIT-ADC05K3E5": {
        min: { surface: 4.3, mixed: 4.3, radiators: 3.5 },
        max: { surface: 6.5, mixed: 6.4, radiators: 6.0 },
        power: 5,
        series: "K",
        type: "all-in-one",
        requires3F: false,
        phase: 1,
        cwu_tank: 185,
      },
      "KIT-ADC07K3E5": {
        min: { surface: 5.5, mixed: 5.0, radiators: 4.5 },
        max: { surface: 7.0, mixed: 6.5, radiators: 6.5 },
        power: 7,
        series: "K",
        type: "all-in-one",
        requires3F: false,
        phase: 1,
        cwu_tank: 185,
      },
      "KIT-ADC09K3E5": {
        min: { surface: 6.7, mixed: 6.5, radiators: 5.5 },
        max: { surface: 8.0, mixed: 8.0, radiators: 7.5 },
        power: 9,
        series: "K",
        type: "all-in-one",
        requires3F: false,
        phase: 1,
        cwu_tank: 185,
      },
      // HIGH PERFORMANCE - ALL IN ONE 185L - 3~ (400V) - Seria K
      "KIT-ADC09K9E8": {
        min: { surface: 8.0, mixed: 8.1, radiators: 7.5 },
        max: { surface: 11.0, mixed: 10.5, radiators: 10.0 },
        power: 9,
        series: "K",
        type: "all-in-one",
        requires3F: true,
        phase: 3,
        cwu_tank: 185,
      },
      "KIT-ADC12K9E8": {
        min: { surface: 10.5, mixed: 9.5, radiators: 8.5 },
        max: { surface: 14.5, mixed: 13.5, radiators: 13.0 },
        power: 12,
        series: "K",
        type: "all-in-one",
        requires3F: true,
        phase: 3,
        cwu_tank: 185,
      },
      "KIT-ADC16K9E8": {
        min: { surface: 12.5, mixed: 11.0, radiators: 10.0 },
        max: { surface: 17.5, mixed: 16.0, radiators: 14.5 },
        power: 16,
        series: "K",
        type: "all-in-one",
        requires3F: true,
        phase: 3,
        cwu_tank: 185,
      },
    };

    // Mapa odpowiedników AIO dla modeli Split - tylko modele ze starego kodu
    const aioMap = {
      "KIT-WC03K3E5": "KIT-ADC03K3E5",
      "KIT-WC05K3E5": "KIT-ADC05K3E5",
      "KIT-WC07K3E5": "KIT-ADC07K3E5",
      "KIT-WC09K3E5": "KIT-ADC09K3E5",
      "KIT-WC09K3E8": "KIT-ADC09K9E8",
      "KIT-WC12K9E8": "KIT-ADC12K9E8",
      "KIT-WC16K9E8": "KIT-ADC16K9E8",
    };

    function findEquivalentAIO(splitModel) {
      if (!splitModel) return null;
      return aioMap[splitModel] || null;
    }

    // Funkcja przypisująca obrazy do pomp – dostosowana do aktualnych plików PNG w katalogu img
    function getPumpImage(type, phase, series, power, model = null) {
      // Użyj dynamicznego URL z konfiguracji WordPress
      const imgUrl = config?.imgUrl || "../img";
      const basePath = imgUrl.endsWith("/") ? imgUrl : imgUrl + "/";

      // SPLIT – osobna jednostka zewnętrzna - Seria K
      if (type === "split") {
        // Standardowe split-y - Seria K
        if (phase === 3) {
          return basePath + "splitk3f.png";
        }
        return basePath + "splitK1f.png";
      }

      // ALL‑IN‑ONE – jednostka wewnętrzna z wbudowanym zasobnikiem - Seria K
      if (type === "all-in-one") {
        if (phase === 3) {
          return basePath + "allinoneK3f.png";
        }
        return basePath + "allinoneK1f.png";
      }

      // Fallback – klasyczna jednostka zewnętrzna
      return basePath + "splitK1f.png";
    }

    // Dobiera pompy ciepła na podstawie wyników kalkulatora
    // ARCHITECTURAL: Uses OZC canonical max_heating_power (heating only, no CWU)
    // Pump selection is based on heating demand, CWU is handled separately by buffer
    function selectHeatPumps(result, heatingType = "radiators") {
      // OZC SINGLE SOURCE OF TRUTH: recommended_power_kw should equal max_heating_power
      const powerDemand =
        result.recommended_power_kw || result.max_heating_power || 0;

      // ═══════════════════════════════════════════════════════════════════════════
      // 📊 SZCZEGÓŁOWE LOGOWANIE DOBORU POMP
      // ═══════════════════════════════════════════════════════════════════════════
      console.log(`[selectHeatPumps] 🔍 START - Dobór pomp dla:`);
      console.log(`  - Zapotrzebowanie: ${powerDemand} kW`);
      console.log(`  - Typ ogrzewania: ${heatingType}`);
      console.log(`  - Input result:`, {
        recommended_power_kw: result.recommended_power_kw,
        max_heating_power: result.max_heating_power,
        heating_type: result.heating_type,
      });

      // ═══════════════════════════════════════════════════════════════════════════
      // SPECJALNE PRZYPADKI
      // ═══════════════════════════════════════════════════════════════════════════

      // 1. Zbyt niska moc (< 1.8kW) + canadian + <80m² + temp<21°C → pompa 3kW
      const constructionType =
        result.construction_type || result.building_construction_type;
      const totalArea = result.total_area || result.heated_area || 0;
      const indoorTemp = result.indoor_temperature || 21;
      const isVeryLowPowerSpecialCase =
        powerDemand < 1.8 &&
        constructionType === "canadian" &&
        totalArea < 80 &&
        indoorTemp < 21;

      if (isVeryLowPowerSpecialCase) {
        const pump3kW = pumpMatchingTable["KIT-WC03K3E5"];
        if (pump3kW) {
          return [
            {
              model: "KIT-WC03K3E5",
              power: pump3kW.power,
              series: pump3kW.series,
              type: pump3kW.type,
              image: getPumpImage(
                pump3kW.type,
                pump3kW.phase,
                pump3kW.series,
                pump3kW.power,
                "KIT-WC03K3E5"
              ),
              phase: pump3kW.phase,
              requires3F: pump3kW.requires3F,
              cwu_tank: pump3kW.cwu_tank || null,
              specialCase: "very_low_power",
              adjustedPowerDisplay: `${powerDemand.toFixed(2)} ± 2 kW`, // Wyświetl z tolerancją dla bardzo niskich mocy
            },
          ];
        }
      }

      // 2. Zbyt wysoka moc (16-25kW) → pompa 16kW 3-fazowa + komunikat
      if (powerDemand >= 16 && powerDemand < 25) {
        const pump16kW3F = pumpMatchingTable["KIT-WC16K9E8"];
        if (pump16kW3F) {
          return [
            {
              model: "KIT-WC16K9E8",
              power: pump16kW3F.power,
              series: pump16kW3F.series,
              type: pump16kW3F.type,
              image: getPumpImage(
                pump16kW3F.type,
                pump16kW3F.phase,
                pump16kW3F.series,
                pump16kW3F.power,
                "KIT-WC16K9E8"
              ),
              phase: pump16kW3F.phase,
              requires3F: pump16kW3F.requires3F,
              cwu_tank: pump16kW3F.cwu_tank || null,
              specialCase: "high_power_termomodernization",
              warningMessage:
                "System wykrył prądożerne połączenie. Budynek najprawdopodobniej wymaga termomodernizacji.",
            },
          ];
        }
      }

      // 3. Zbyt wysoka moc (> 25kW) → nie wyświetlaj konfiguratora
      if (powerDemand >= 25) {
        return []; // Pusty array - konfigurator nie będzie wyświetlony
      }

      const normalizedType =
        heatingType === "underfloor" ? "surface" : heatingType;

      console.log(`[selectHeatPumps] 📐 Znormalizowany typ: ${normalizedType} (z ${heatingType})`);

      // Dobór pomp TYLKO na podstawie mocy - bez sprawdzania fazy
      console.log(`[selectHeatPumps] 🔎 Filtrowanie pomp z tabeli (${Object.keys(pumpMatchingTable).length} modeli)...`);
      let matchingPumps = Object.entries(pumpMatchingTable)
        .filter(([model, data]) => {
          const min = data.min[normalizedType] || data.min.mixed;
          const max = data.max[normalizedType] || data.max.mixed;
          const powerMatch = powerDemand >= min && powerDemand <= max;

          // Szczegółowe logowanie dla wszystkich pomp pasujących mocą
          if (powerMatch) {
            console.log(`[selectHeatPumps] ✅ ${model}: PASUJE MOCĄ (${powerDemand} kW w zakresie ${min}-${max} kW)`);
          }

          return powerMatch;
        })
        .map(([model, data]) => {
          return {
            model: model,
            power: data.power,
            series: data.series,
            type: data.type,
            image: getPumpImage(
              data.type,
              data.phase,
              data.series,
              data.power,
              model
            ),
            phase: data.phase,
            requires3F: data.requires3F,
            cwu_tank: data.cwu_tank || null,
          };
        });


      matchingPumps.sort((a, b) => a.power - b.power);
      if (matchingPumps.length > 0) {
        console.log(`[selectHeatPumps] ✅ Znaleziono ${matchingPumps.length} pasujących pomp:`, matchingPumps.map(p => p.model).join(', '));
      } else {
        console.warn(`[selectHeatPumps] ❌ Brak pasujących pomp dla ${powerDemand} kW, typ: ${normalizedType}`);
      }
      return matchingPumps;
    }

    // Przygotowuje profile pomp (Split + AIO) dla konfiguratora
    function preparePumpProfiles(calcInput) {
      console.log(`[preparePumpProfiles] 🚀 START - Przygotowanie profili pomp`);
      console.log(`[preparePumpProfiles] 📦 Input:`, {
        max_heating_power: calcInput.max_heating_power,
        recommended_power_kw: calcInput.recommended_power_kw,
        heating_type: calcInput.heating_type,
        installation_type: calcInput.installation_type,
      });

      const heatingType =
        calcInput.heating_type || calcInput.installation_type || "radiators";
      console.log(`[preparePumpProfiles] 🔥 Typ ogrzewania: ${heatingType}`);

      const matched = selectHeatPumps(calcInput, heatingType);
      console.log(`[preparePumpProfiles] 📊 Wynik selectHeatPumps: ${matched?.length || 0} pomp`);

      if (!matched || matched.length === 0) {
        console.warn("[Configurator] ❌ Brak pasujących pomp");
        console.warn("[Configurator] 📋 Szczegóły:", {
          powerDemand: calcInput.recommended_power_kw || calcInput.max_heating_power,
          heatingType: heatingType,
        });
        return [];
      }

      console.log(`[preparePumpProfiles] ✅ Znaleziono ${matched.length} pomp:`, matched.map(p => `${p.model} (${p.power}kW)`).join(', '));

      const recommended = matched[0]; // Pierwsza pompa to rekomendowany Split

      // Jeśli to specjalny przypadek (very_low_power lub high_power_termomodernization), nie szukaj AIO
      if (recommended.specialCase) {
        return [
          {
            id: "hp",
            label: "Split",
            variant: "Rekomendowana – split",
            type: "split",
            isRecommended: true,
            model: recommended.model,
            power_kw: recommended.power,
            series: recommended.series,
            image: recommended.image,
            minPhase: recommended.phase || 1,
            requires3F: recommended.requires3F || false,
            specialCase: recommended.specialCase,
            adjustedPowerDisplay: recommended.adjustedPowerDisplay,
            warningMessage: recommended.warningMessage,
          },
        ];
      }


      const aioModel = findEquivalentAIO(recommended.model);
      const aioData = aioModel ? pumpMatchingTable[aioModel] : null;

      return [
        {
          id: "hp",
          label: "Split",
          variant: "Rekomendowana – split",
          type: "split",
          isRecommended: true,
          model: recommended.model,
          power_kw: recommended.power,
          series: recommended.series,
          image: recommended.image,
          minPhase: recommended.phase || 1,
          requires3F: recommended.requires3F || false,
          warningMessage: recommended.warningMessage || null,
        },
        {
          id: "aio",
          label: "All-in-One",
          variant: "All-in-One",
          type: "all-in-one",
          isRecommended: false,
          model: aioModel,
          power_kw: recommended.power,
          series: aioData?.series || "ADC",
          image: aioData
            ? getPumpImage(
                "all-in-one",
                aioData.phase || recommended.phase || 1,
                aioData.series,
                aioData.power,
                aioModel
              )
            : (config?.imgUrl || "../img") + "/aioK.png",
          minPhase: aioData?.phase || recommended.phase || 1,
          requires3F: aioData?.requires3F || recommended.requires3F || false,
          disabled: !aioModel,
          cwu_tank: aioData?.cwu_tank || null,
        },
      ];
    }

    // Loader panasonic.json
    let panasonicDB = null;
    let panasonicDBPromise = null;

    async function loadPanasonicDB() {
      if (panasonicDBPromise) return panasonicDBPromise;

      panasonicDBPromise = (async () => {
        try {
          // Użyj dynamicznego URL z konfiguracji WordPress
          const configUrl = config?.konfiguratorUrl || "../konfigurator";
          const jsonUrl = `${configUrl}/panasonic.json`;
          const response = await fetch(jsonUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const data = await response.json();

          // panasonic.json to array, więc zwracamy bezpośrednio
          panasonicDB = Array.isArray(data) ? data : [];
          return panasonicDB;
        } catch (e) {
          console.warn("[Configurator] ⚠️ Błąd ładowania panasonic.json:", e);
          // Elegancki, informacyjny komunikat dla użytkownika
          if (
            typeof window.ErrorHandler !== "undefined" &&
            window.ErrorHandler.showToast
          ) {
            window.ErrorHandler.showToast(
              "Część rekomendacji w trybie uproszczonym",
              "info",
              4000
            );
          }
          return [];
        }
      })();

      return panasonicDBPromise;
    }

    // Mapuje model pompy do danych z panasonic.json
    function getPumpDataFromDB(model) {
      if (!panasonicDB || !model) return null;
      return panasonicDB.find((p) => p.kit === model) || null;
    }

    /* ==========================================================================
     STATE MANAGEMENT
     ========================================================================== */

    let steps = [];
    let navPrev = null;
    let navNext = null;
    let currentStepNumberEl = null;
    let totalStepsNumberEl = null;
    let summaryBody = null;
    let totalSteps = 0;
    let currentStepIndex = 0;

    // Stan konfiguratora - rozszerzony o pricing i products
    const state = {
      selections: {},
      meta: null, // Dane z kalkulatora
      selectedPump: null,
      selectedCwuProduct: null,
      selectedBufferProduct: null,
      recommendations: {
        hydraulics: null, // Single Source of Truth: hydraulicsRecommendation
      },
      pricing: {
        total_netto_pln: 0,
        total_brutto_pln: 0,
        items: [],
      },
    };
    let lastSelectionPayload = null;

    // ═══════════════════════════════════════════════════════════════════════════
    // CONFIGURATOR STATE PERSISTENCE — zapis/odczyt stanu przy przełączaniu widoków
    // ═══════════════════════════════════════════════════════════════════════════
    const CONFIGURATOR_STATE_KEY_BASE = "wycena2025_configuratorState";

    function getConfiguratorStateKey() {
      const instanceId =
        appState?.instanceId ||
        root?.getAttribute?.("data-hp-instance") ||
        "default";
      return `${CONFIGURATOR_STATE_KEY_BASE}::${String(instanceId)}`;
    }

    /**
     * Zapisuje stan konfiguratora do sessionStorage
     */
    function saveConfiguratorState() {
      try {
        const stateToSave = {
          selections: state.selections,
          selectedPump: state.selectedPump,
          meta: state.meta,
          recommendations: state.recommendations,
          pricing: state.pricing,
          currentStepIndex: currentStepIndex,
          timestamp: Date.now(),
        };
        view.sessionStorage.setItem(
          getConfiguratorStateKey(),
          JSON.stringify(stateToSave)
        );
        return true;
      } catch (error) {
        console.warn(
          "[Configurator] ❌ Błąd zapisu stanu do sessionStorage:",
          error
        );
        return false;
      }
    }

    /**
     * Ładuje stan konfiguratora z sessionStorage
     */
    function loadConfiguratorState() {
      try {
        const stored = view.sessionStorage.getItem(getConfiguratorStateKey());
        if (stored) {
          const savedState = JSON.parse(stored);
          return savedState;
        }
      } catch (error) {
        console.warn(
          "[Configurator] ❌ Błąd ładowania stanu z sessionStorage:",
          error
        );
      }
      return null;
    }

    /**
     * Przywraca stan konfiguratora (selekcje, wybory użytkownika)
     */
    function restoreConfiguratorState(savedState) {
      if (!savedState) return false;

      try {
        // Przywróć selekcje
        if (
          savedState.selections &&
          Object.keys(savedState.selections).length > 0
        ) {
          state.selections = { ...savedState.selections };
        }

        // Przywróć selectedPump
        if (savedState.selectedPump) {
          state.selectedPump = savedState.selectedPump;
        }

        // Przywróć currentStepIndex
        if (savedState.currentStepIndex !== undefined) {
          currentStepIndex = savedState.currentStepIndex;
        }

        // Przywróć pricing (jeśli istnieje)
        if (savedState.pricing) {
          state.pricing = { ...savedState.pricing };
        }

        // Przywróć recommendations (jeśli istnieje)
        if (savedState.recommendations) {
          state.recommendations = { ...savedState.recommendations };
        }

        // Zaktualizuj UI na podstawie przywróconego stanu
        restoreSelectionsToUI();

        // Przelicz reguły i ceny
        const evaluated = evaluateRules();
        applyRulesToUI(evaluated);
        calculateTotalPrice();
        buildPricingItems();
        updateSummary();
        exposeSelectionOnWindow();

        return true;
      } catch (error) {
        console.warn("[Configurator] ❌ Błąd przywracania stanu:", error);
        return false;
      }
    }

    /**
     * Przywraca selekcje do UI (zaznacza karty, aktualizuje sticky bar)
     */
    function restoreSelectionsToUI() {
      Object.entries(state.selections).forEach(([stepKey, selection]) => {
        if (!selection || !selection.optionId) return;

        // Znajdź kartę z danym optionId
        const card = dom.qs(`[data-option-id="${selection.optionId}"]`);
        if (card) {
          // Zaznacz kartę
          const stepSection = card.closest(".config-step");
          if (stepSection) {
            stepSection
              .querySelectorAll(".option-card.selected, .product-card.selected")
              .forEach((c) => {
                c.classList.remove("selected");
              });
            card.classList.add("selected");
          }

          // Aktualizuj sticky bar
          updateSelectionsBar(stepKey, selection.label);
        }
      });

      // Przywróć currentStepIndex
      if (currentStepIndex >= 0 && currentStepIndex < steps.length) {
        showStep(currentStepIndex, true); // noScroll = true
      }
    }

    // Handlery eventów
    let cardClickHandler = null;
    let navClickHandler = null;
    let summaryClickHandler = null;

    // Konfiguracja kroków z ikonami
    const summaryConfig = [
      { stepKey: "pompa", label: "Pompa ciepła", icon: "ri-settings-5-fill" },
      { stepKey: "cwu", label: "Zasobnik CWU", icon: "ri-showers-fill" },
      { stepKey: "bufor", label: "Bufor CO", icon: "ri-drop-fill" },
      {
        stepKey: "cyrkulacja",
        label: "Cyrkulacja CWU",
        icon: "ri-refresh-fill",
      },
      { stepKey: "service", label: "Service Cloud", icon: "ri-cloud-fill" },
      {
        stepKey: "posadowienie",
        label: "Posadowienie jednostki zewnętrznej",
        icon: "ri-building-fill",
      },
      {
        stepKey: "reduktor",
        label: "Reduktor ciśnienia",
        icon: "ri-scale-fill",
      },
      {
        stepKey: "woda",
        label: "Stacja uzdatniania wody",
        icon: "ri-drop-fill",
      },
    ];

    // Eksport stanu na zewnątrz
    if (appState) {
      appState.configuratorSelections = state.selections;
      appState.configuratorState = state;
    }

    /* ==========================================================================
     config_data (sessionStorage) — integracja z kalkulatorem + Single Source of Truth
     ========================================================================== */

    const CONFIG_DATA_STORAGE_KEY = "config_data";

    function readConfigDataFromSessionStorage() {
      console.log(
        "[KONFIG:SSoT] 📖 Reading config_data from sessionStorage..."
      );
      try {
        const raw = view.sessionStorage.getItem(CONFIG_DATA_STORAGE_KEY);
        if (!raw) {
          console.warn(
            "[KONFIG:SSoT] ⚠️ No config_data found in sessionStorage"
          );
          return null;
        }
        const parsed = JSON.parse(raw);
        const valid = parsed && typeof parsed === "object" ? parsed : null;
        if (valid) {
          console.log(
            "[KONFIG:SSoT] ✅ config_data loaded from sessionStorage:",
            {
              keys: Object.keys(valid),
              has_hydraulics_inputs: !!valid.hydraulics_inputs,
              has_recommendations: !!valid.recommendations,
              heated_area: valid.heated_area,
              max_heating_power: valid.max_heating_power,
            }
          );
        } else {
          console.error("[KONFIG:SSoT] ❌ Invalid config_data structure");
        }
        return valid;
      } catch (e) {
        console.error(
          "[KONFIG:SSoT] ❌ Nie udało się odczytać config_data z sessionStorage",
          e
        );
        return null;
      }
    }

    function writeConfigDataToSessionStorage(configData) {
      console.log("[KONFIG:SSoT] 💾 Writing config_data to sessionStorage...");
      console.log("[KONFIG:SSoT] 📊 Data to save:", {
        keys: Object.keys(configData || {}),
        hydraulics_inputs: configData?.hydraulics_inputs,
        recommendations: configData?.recommendations
          ? Object.keys(configData.recommendations)
          : [],
      });
      try {
        view.sessionStorage.setItem(
          CONFIG_DATA_STORAGE_KEY,
          JSON.stringify(configData)
        );
        console.log("[KONFIG:SSoT] ✅ config_data saved successfully");
        return true;
      } catch (e) {
        console.error(
          "[KONFIG:SSoT] ❌ Nie udało się zapisać config_data do sessionStorage",
          e
        );
        return false;
      }
    }

    function ensureConfigDataShape(configData) {
      console.log("[KONFIG:SSoT] 🔧 Normalizing config_data shape...");
      const hadData = !!(configData && typeof configData === "object");
      const next =
        configData && typeof configData === "object" ? { ...configData } : {};

      const hadHydraulics = !!(
        next.hydraulics_inputs && typeof next.hydraulics_inputs === "object"
      );

      if (
        !next.hydraulics_inputs ||
        typeof next.hydraulics_inputs !== "object"
      ) {
        console.log("[KONFIG:SSoT] 🆕 Creating default hydraulics_inputs");
        next.hydraulics_inputs = {
          has_underfloor_actuators: false,
          radiators_is_ht: false,
          bivalent_enabled: false,
          bivalent_source_type: null,
          bivalent_source_power_kw: null,
        };
      } else {
        console.log(
          "[KONFIG:SSoT] ✅ Normalizing existing hydraulics_inputs:",
          next.hydraulics_inputs
        );
        next.hydraulics_inputs = {
          has_underfloor_actuators:
            !!next.hydraulics_inputs.has_underfloor_actuators,
          radiators_is_ht: !!next.hydraulics_inputs.radiators_is_ht,
          bivalent_enabled: !!next.hydraulics_inputs.bivalent_enabled,
          bivalent_source_type:
            next.hydraulics_inputs.bivalent_source_type === "gas" ||
            next.hydraulics_inputs.bivalent_source_type === "solid_fuel" ||
            next.hydraulics_inputs.bivalent_source_type ===
              "fireplace_water_jacket"
              ? next.hydraulics_inputs.bivalent_source_type
              : null,
          bivalent_source_power_kw:
            next.hydraulics_inputs.bivalent_source_power_kw != null
              ? Number(next.hydraulics_inputs.bivalent_source_power_kw) || null
              : null,
        };
      }

      if (!next.recommendations || typeof next.recommendations !== "object") {
        console.log("[KONFIG:SSoT] 🆕 Creating empty recommendations object");
        next.recommendations = {};
      }

      console.log("[KONFIG:SSoT] ✅ Shape ensured:", {
        hadData,
        hadHydraulics,
        final_hydraulics: next.hydraulics_inputs,
        has_recommendations: !!next.recommendations,
      });

      return next;
    }

    function getHydraulicsInputs() {
      console.log("[KONFIG:SSoT] 🔍 Getting hydraulics inputs...");
      const configData = ensureConfigDataShape(
        readConfigDataFromSessionStorage()
      );
      console.log(
        "[KONFIG:SSoT] ✅ Hydraulics inputs retrieved:",
        configData.hydraulics_inputs
      );
      return configData.hydraulics_inputs;
    }

    function setHydraulicsInputs(partial) {
      console.log(
        "[KONFIG:SSoT] ✏️ Setting hydraulics inputs (partial update):",
        partial
      );
      const current = ensureConfigDataShape(readConfigDataFromSessionStorage());
      const next = ensureConfigDataShape({
        ...current,
        hydraulics_inputs: {
          ...current.hydraulics_inputs,
          ...partial,
        },
      });
      console.log(
        "[KONFIG:SSoT] 📊 Updated hydraulics_inputs:",
        next.hydraulics_inputs
      );
      writeConfigDataToSessionStorage(next);
      return next.hydraulics_inputs;
    }

    function persistHydraulicsRecommendationToConfigData(
      hydraulicsRecommendation
    ) {
      console.log(
        "[KONFIG:DECYZJE] 🎯 Persisting hydraulics recommendation to config_data..."
      );
      console.log(
        "[KONFIG:DECYZJE] 📊 Recommendation:",
        hydraulicsRecommendation
      );
      const current = ensureConfigDataShape(readConfigDataFromSessionStorage());
      const next = ensureConfigDataShape({
        ...current,
        recommendations: {
          ...current.recommendations,
          hydraulics: hydraulicsRecommendation,
        },
      });
      console.log("[KONFIG:DECYZJE] ✅ Recommendation persisted successfully");
      writeConfigDataToSessionStorage(next);
    }

    /* ==========================================================================
     PRICING ENGINE (z configurator.js)
     ========================================================================== */

    const PRICING_CATALOG = {
      pumps: {
        base: {
          "3kW": 25000,
          "5kW": 28000,
          "7kW": 32000,
          "9kW": 36000,
          "12kW": 42000,
          "16kW": 48000,
        },
        aio_premium: 5000,
        tcap_premium: 8000,
      },
      cwu: {
        emalia: {
          150: 2800,
          200: 3200,
          250: 3600,
          300: 4000,
          400: 4800,
          500: 5600,
        },
        inox: {
          150: 4200,
          200: 4800,
          250: 5400,
          300: 6000,
          400: 7200,
          500: 8400,
        },
      },
      buffer: {
        50: 1500,
        80: 1800,
        100: 2000,
        120: 2200,
        150: 2500,
        200: 3000,
        400: 4500,
        500: 5500,
      },
      accessories: {
        service_cloud: 0,
        magnetic_filter_standard: 0,
        magnetic_filter_premium: 1200,
        circulation_pump: 800,
        pressure_reducer: 450,
        water_softener: 4900,
        foundation_concrete: 0,
        foundation_wall: 1200,
        foundation_composite: 1800,
        hydro_safety_standard: 0,
        hydro_safety_extended: 1500,
        flushing_standard: 800,
        flushing_premium: 1200,
      },
    };

    function calculatePumpPrice(pumpData, powerKw) {
      if (!pumpData || !powerKw) return 0;
      const powerRounded = Math.round(powerKw);
      const availablePowers = [3, 5, 7, 9, 12, 16];
      const closestPower = availablePowers.reduce((prev, curr) => {
        return Math.abs(curr - powerRounded) < Math.abs(prev - powerRounded)
          ? curr
          : prev;
      }, availablePowers[0]);
      const basePrice =
        PRICING_CATALOG.pumps.base[`${closestPower}kW`] ||
        PRICING_CATALOG.pumps.base["7kW"];

      // Premium za AIO/T-CAP
      const optionId = pumpData.optionId || "";
      if (optionId.includes("aio") || optionId.includes("premium")) {
        return basePrice + PRICING_CATALOG.pumps.aio_premium;
      }
      if (optionId.includes("tcap")) {
        return basePrice + PRICING_CATALOG.pumps.tcap_premium;
      }
      return basePrice;
    }

    function calculateCwuPrice(optionId, capacity) {
      if (!optionId || !capacity) return 0;
      const material = optionId.includes("inox") ? "inox" : "emalia";
      const catalog = PRICING_CATALOG.cwu[material];
      if (!catalog) return 0;

      // Wyciągnij pojemność z optionId (np. "cwu-200" -> 200)
      const capacityMatch = optionId.match(/(\d+)/);
      const actualCapacity = capacityMatch
        ? Number(capacityMatch[1])
        : capacity;

      const availableCapacities = Object.keys(catalog)
        .map(Number)
        .sort((a, b) => a - b);
      const closestCapacity = availableCapacities.reduce((prev, curr) => {
        return Math.abs(curr - actualCapacity) < Math.abs(prev - actualCapacity)
          ? curr
          : prev;
      }, availableCapacities[0]);
      return catalog[closestCapacity] || 0;
    }

    function calculateBufferPrice(optionId) {
      if (!optionId) return 0;
      const capacityMatch = optionId.match(/(\d+)/);
      if (!capacityMatch) return 0;
      const capacity = Number(capacityMatch[1]);

      const catalog = PRICING_CATALOG.buffer;
      const availableCapacities = Object.keys(catalog)
        .map(Number)
        .sort((a, b) => a - b);
      const closestCapacity = availableCapacities.reduce((prev, curr) => {
        return Math.abs(curr - capacity) < Math.abs(prev - capacity)
          ? curr
          : prev;
      }, availableCapacities[0]);
      return catalog[closestCapacity] || 0;
    }

    function calculateAccessoryPrice(optionId) {
      if (!optionId) return 0;

      // Mapowanie optionId na klucze z PRICING_CATALOG
      const mapping = {
        "cyrkulacja-tak": "circulation_pump",
        "reduktor-tak": "pressure_reducer",
        "woda-tak": "water_softener",
        "posadowienie-sciana": "foundation_wall",
        "posadowienie-eko": "foundation_composite",
      };

      const catalogKey = mapping[optionId];
      return catalogKey ? PRICING_CATALOG.accessories[catalogKey] || 0 : 0;
    }

    function calculateTotalPrice() {
      let total = 0;

      // Pompa
      if (state.selectedPump && state.meta?.recommended_power_kw) {
        total += calculatePumpPrice(
          state.selectedPump,
          state.meta.recommended_power_kw
        );
      }

      // CWU
      const cwuSelection = state.selections.cwu;
      if (cwuSelection && cwuSelection.optionId) {
        const capacity = extractCapacityFromOptionId(cwuSelection.optionId);
        total += calculateCwuPrice(cwuSelection.optionId, capacity);
      }

      // Bufor
      const bufferSelection = state.selections.bufor;
      if (bufferSelection && bufferSelection.optionId) {
        total += calculateBufferPrice(bufferSelection.optionId);
      }

      // Akcesoria
      if (state.selections.cyrkulacja?.optionId === "cyrkulacja-tak") {
        total += calculateAccessoryPrice("cyrkulacja-tak");
      }
      if (state.selections.reduktor?.optionId === "reduktor-tak") {
        total += calculateAccessoryPrice("reduktor-tak");
      }
      if (state.selections.woda?.optionId === "woda-tak") {
        total += calculateAccessoryPrice("woda-tak");
      }
      if (state.selections.posadowienie?.optionId === "posadowienie-sciana") {
        total += calculateAccessoryPrice("posadowienie-sciana");
      } else if (
        state.selections.posadowienie?.optionId === "posadowienie-eko"
      ) {
        total += calculateAccessoryPrice("posadowienie-eko");
      }

      state.pricing.total_netto_pln = total;
      state.pricing.total_brutto_pln = total * 1.23; // VAT 23%

      return total;
    }

    function buildPricingItems() {
      const items = [];

      // Pompa
      if (state.selectedPump && state.meta?.recommended_power_kw) {
        const price = calculatePumpPrice(
          state.selectedPump,
          state.meta.recommended_power_kw
        );
        if (price > 0) {
          items.push({
            name: `Pompa ciepła ${state.selectedPump.label || "Split"} ${
              state.meta.recommended_power_kw
            } kW`,
            quantity: 1,
            unit_price_pln: price,
            total_pln: price,
          });
        }
      }

      // CWU
      const cwuSelection = state.selections.cwu;
      if (cwuSelection && cwuSelection.optionId) {
        const capacity = extractCapacityFromOptionId(cwuSelection.optionId);
        const price = calculateCwuPrice(cwuSelection.optionId, capacity);
        if (price > 0) {
          items.push({
            name: `Zasobnik CWU ${cwuSelection.label || capacity + "L"}`,
            quantity: 1,
            unit_price_pln: price,
            total_pln: price,
          });
        }
      }

      // Bufor
      const bufferSelection = state.selections.bufor;
      if (bufferSelection && bufferSelection.optionId) {
        const price = calculateBufferPrice(bufferSelection.optionId);
        if (price > 0) {
          items.push({
            name: `Bufor CO ${
              bufferSelection.label || bufferSelection.optionId
            }`,
            quantity: 1,
            unit_price_pln: price,
            total_pln: price,
          });
        }
      }

      // Akcesoria
      if (state.selections.cyrkulacja?.optionId === "cyrkulacja-tak") {
        items.push({
          name: "Pompa cyrkulacyjna CWU",
          quantity: 1,
          unit_price_pln: 800,
          total_pln: 800,
        });
      }
      if (state.selections.reduktor?.optionId === "reduktor-tak") {
        items.push({
          name: "Reduktor ciśnienia",
          quantity: 1,
          unit_price_pln: 450,
          total_pln: 450,
        });
      }
      if (state.selections.woda?.optionId === "woda-tak") {
        items.push({
          name: "Stacja uzdatniania wody",
          quantity: 1,
          unit_price_pln: 4900,
          total_pln: 4900,
        });
      }
      if (state.selections.posadowienie?.optionId === "posadowienie-sciana") {
        items.push({
          name: "Konsola ścienna",
          quantity: 1,
          unit_price_pln: 1200,
          total_pln: 1200,
        });
      } else if (
        state.selections.posadowienie?.optionId === "posadowienie-eko"
      ) {
        items.push({
          name: "Podstawa kompozytowa",
          quantity: 1,
          unit_price_pln: 1800,
          total_pln: 1800,
        });
      }

      state.pricing.items = items;
      return items;
    }

    function formatPrice(price, showVat = false) {
      if (!price || price === 0) return showVat ? "0,00 zł (netto)" : "W cenie";
      const netto = price;
      const brutto = price * 1.23;
      if (showVat) {
        return `${netto.toLocaleString("pl-PL", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} zł (netto) / ${brutto.toLocaleString("pl-PL", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} zł (brutto)`;
      }
      return `${netto.toLocaleString("pl-PL", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} zł`;
    }

    function extractCapacityFromOptionId(optionId) {
      const match = optionId.match(/(\d+)/);
      return match ? Number(match[1]) : 0;
    }

    /* ==========================================================================
     RULES ENGINE (z configurator.js - pełna wersja)
     ========================================================================== */

    /* ==========================================================================
     HYDRAULICS RECOMMENDATION ENGINE (FLOW / SEPARATOR / STORAGE) — CANONICAL
     ========================================================================== */

    /**
     * Silnik hydrauliki CO — SINGLE SOURCE OF TRUTH dla UI/PDF/Email
     *
     * Wrapper dla BufferEngine.computeRecommendation()
     * Zachowuje kompatybilność z istniejącym kodem (przyjmuje state)
     *
     * Zwraca obiekt zgodny z kontraktem:
     * `config_data.recommendations.hydraulics = hydraulicsRecommendation`
     */
    function computeHydraulicsRecommendation(state) {
      console.log("[KONFIG:DECYZJE] 🔬 Computing hydraulics recommendation...");
      console.log("[KONFIG:DECYZJE] 📊 Input state:", {
        hasMeta: !!state?.meta,
        hasSelectedPump: !!state?.selectedPump,
        max_heating_power: state?.meta?.max_heating_power,
        heating_type: state?.meta?.heating_type,
      });

      // Sprawdź czy BufferEngine jest dostępny
      if (
        !bufferEngine ||
        typeof bufferEngine.computeRecommendation !== "function"
      ) {
        console.error(
          "[KONFIG:DECYZJE] ❌ BufferEngine nie jest dostępny! Upewnij się, że buffer-engine.js jest załadowany przed configurator-unified.js"
        );
        // Elegancki, informacyjny komunikat dla użytkownika
        if (
          typeof window.ErrorHandler !== "undefined" &&
          window.ErrorHandler.showToast
        ) {
          window.ErrorHandler.showToast(
            "Część rekomendacji w trybie uproszczonym",
            "info",
            4000
          );
        }
        // Zwróć bezpieczny fallback
        const safeFallback = {
          axes: {
            flow_protection: "NONE",
            hydraulic_separation: "NONE",
            energy_storage: "NONE",
          },
          recommendation: "NONE",
          buffer_liters: null,
          severity: "INFO",
          reason_codes: [],
          explanation: {
            short:
              "Błąd: BufferEngine nie jest dostępny. Sprawdź kolejność ładowania skryptów.",
            long: "BufferEngine nie jest dostępny. Upewnij się, że buffer-engine.js jest załadowany przed configurator-unified.js",
          },
          inputs_used: {
            heating_type: state?.meta?.heating_type || "radiators",
            has_underfloor_actuators: false,
            radiators_is_ht: false,
            bivalent_enabled: false,
            bivalent_source_type: null,
            designHeatLoss_kW: state?.meta?.max_heating_power || 0,
            heating_power: state?.meta?.recommended_power_kw || 0,
            pump_min_modulation_kw: 0,
          },
          type: "none",
          setupType: "NONE",
          hydraulicSeparationRequired: false,
          dominantReason: "BufferEngine nie dostępny",
          estimatedSystemVolume: 0,
          requiredSystemVolume: 0,
          systemVolumeSufficient: false,
        };
        if (state) {
          if (!state.recommendations) state.recommendations = {};
          state.recommendations.hydraulics = safeFallback;
        }
        persistHydraulicsRecommendationToConfigData(safeFallback);
        return safeFallback;
      }

      // Przygotuj parametry dla BufferEngine
      const inputs = {
        // Dane z kalkulatora
        meta: state?.meta || {},
        // Wybrana pompa
        selectedPump: state?.selectedPump || {},
        // Tabela pomp (dla lookup)
        pumpMatchingTable: pumpMatchingTable,
        // Funkcja do pobrania danych z miniformularza
        getHydraulicsInputs: getHydraulicsInputs,
        // Funkcja do zapisania wyniku
        persistHydraulicsRecommendation:
          persistHydraulicsRecommendationToConfigData,
        // State (dla zapisu wyniku)
        state: state,
      };

      console.log(
        "[KONFIG:DECYZJE] 📤 Calling BufferEngine.computeRecommendation()..."
      );
      console.log("[KONFIG:DECYZJE] 📊 Inputs prepared:", {
        hasMeta: !!inputs.meta,
        hasSelectedPump: !!inputs.selectedPump,
        hasPumpTable: !!inputs.pumpMatchingTable,
      });

      // Wywołaj BufferEngine
      const recommendation = bufferEngine.computeRecommendation(inputs);

      console.log("[KONFIG:DECYZJE] ✅ BufferEngine recommendation received:", {
        recommendation: recommendation?.recommendation,
        buffer_liters: recommendation?.buffer_liters,
        type: recommendation?.type,
        severity: recommendation?.severity,
      });

      return recommendation;
    }

    // Wrapper dla calculateBufferSizeComponents (dla kompatybilności)
    function calculateBufferSizeComponents(params) {
      if (
        bufferEngine &&
        typeof bufferEngine.calculateSizeComponents === "function"
      ) {
        return bufferEngine.calculateSizeComponents(params);
      }
      console.error(
        "[Configurator] ❌ BufferEngine.calculateSizeComponents nie jest dostępny!"
      );
      return {
        antiCycling: {
          liters: 0,
          rationale: "BufferEngine nie dostępny",
          dependencies: [],
        },
        bivalent: {
          liters: 0,
          rationale: "BufferEngine nie dostępny",
          dependencies: [],
        },
        hydraulic: {
          liters: 0,
          rationale: "BufferEngine nie dostępny",
          dependencies: [],
        },
        systemVolume: { required: 0, estimated: 0, sufficient: false },
      };
    }

    // Wrapper dla calculateFinalBufferRecommendation (dla kompatybilności)
    function calculateFinalBufferRecommendation(
      components,
      heatingType,
      hydraulicSeparationRequired,
      options = {}
    ) {
      if (
        bufferEngine &&
        typeof bufferEngine.calculateFinalRecommendation === "function"
      ) {
        return bufferEngine.calculateFinalRecommendation(
          components,
          heatingType,
          hydraulicSeparationRequired,
          options
        );
      }
      console.error(
        "[Configurator] ❌ BufferEngine.calculateFinalRecommendation nie jest dostępny!"
      );
      return {
        setupType: "NONE",
        recommendedCapacity: 0,
        calculatedCapacity: 0,
        components: {
          antiCycling: { liters: 0 },
          bivalent: { liters: 0 },
          hydraulic: { liters: 0 },
        },
        dominantComponent: "none",
        reasoning: "BufferEngine nie dostępny",
      };
    }

    // Wrapper dla normalizeBufferRecommendation (dla kompatybilności)
    function normalizeBufferRecommendation(
      rawResult,
      sizingComponents,
      sizingResult
    ) {
      if (
        bufferEngine &&
        typeof bufferEngine.normalizeRecommendation === "function"
      ) {
        return bufferEngine.normalizeRecommendation(
          rawResult,
          sizingComponents,
          sizingResult
        );
      }
      console.error(
        "[Configurator] ❌ BufferEngine.normalizeRecommendation nie jest dostępny!"
      );
      return {
        type: "none",
        required: false,
        allowZeroBuffer: true,
        setupType: "NONE",
        liters: null,
        calculatedLiters: null,
        separatorSize: null,
        hydraulicSeparationRequired: false,
        dominantReason: "BufferEngine nie dostępny",
        reasons: [],
        constraints: [],
        sizing: null,
        requiredSystemVolume: 0,
        estimatedSystemVolume: 0,
        systemVolumeSufficient: false,
      };
    }

    // Wrapper dla roundToMarketSizes (dla kompatybilności)
    function roundToMarketSizes(liters) {
      if (
        bufferEngine &&
        typeof bufferEngine.roundToMarketSizes === "function"
      ) {
        return bufferEngine.roundToMarketSizes(liters);
      }
      console.error(
        "[Configurator] ❌ BufferEngine.roundToMarketSizes nie jest dostępny!"
      );
      return 0;
    }

    // Wrapper dla normalizeHeatingType (dla kompatybilności)
    function normalizeHeatingType(raw) {
      if (
        bufferEngine &&
        typeof bufferEngine.normalizeHeatingType === "function"
      ) {
        return bufferEngine.normalizeHeatingType(raw);
      }
      if (!raw) return "radiators";
      if (raw === "surface") return "underfloor";
      return raw;
    }

    // Eksport HYDRAULICS_REASON_CODES dla kompatybilności
    const HYDRAULICS_REASON_CODES = bufferEngine?.HYDRAULICS_REASON_CODES || {
      FLOW_RISK_UNDERFLOOR_ACTUATORS: "FLOW_RISK_UNDERFLOOR_ACTUATORS",
      MIXED_CIRCUITS_SEPARATION: "MIXED_CIRCUITS_SEPARATION",
      LOW_LOAD_HT_RADIATORS_KILLER: "LOW_LOAD_HT_RADIATORS_KILLER",
      BIVALENT_SOLID_FUEL: "BIVALENT_SOLID_FUEL",
      BIVALENT_FIREPLACE_WATER_JACKET: "BIVALENT_FIREPLACE_WATER_JACKET",
      ANTI_CYCLING_STORAGE_REQUIRED: "ANTI_CYCLING_STORAGE_REQUIRED",
      MANUFACTURER_3PH_K_200L: "MANUFACTURER_3PH_K_200L",
    };

    const rulesEngine = {
      // CWU – decyzja o włączeniu + zalecana pojemność
      cwu(state) {
        const includeHot = !!state.meta?.include_hot_water;
        const persons = Number(
          state.meta?.hot_water_persons || state.meta?.cwu_people || 0
        );
        const profile =
          state.meta?.hot_water_usage || state.meta?.cwu_profile || null;
        const isAIO =
          state.selectedPump?.type === "aio" ||
          state.selectedPump?.type === "all-in-one" ||
          state.selectedPump?.optionId?.includes("aio");

        // ✅ NOWA LOGIKA: skip jeśli nie chce CWU lub AIO
        const skip = !includeHot || persons === 0 || isAIO;
        const enabled = includeHot && !isAIO && persons > 0;
        const required = includeHot && !isAIO && persons > 0;

        // Określ powód pominięcia (dla sticky bar i wyników)
        let skipReason = null;
        if (skip) {
          if (!includeHot || persons === 0) {
            skipReason = "brak";
          } else if (isAIO) {
            skipReason = "brak (pompa AIO ma wbudowany zasobnik)";
          }
        }

        let recommendedCapacity = null;

        if (enabled) {
          // ⚠️ FIX P1.3: Sanity check dla persons (walidacja zakresu)
          const validPersons =
            Number.isFinite(persons) && persons > 0 && persons < 20
              ? Math.round(persons)
              : 0;
          // ✅ FIX: Walidacja profile - użyj domyślnego jeśli null
          const validProfile = profile || "shower_bath";

          // PHASE 3C — Load from rules JSON (Data-Driven Configuration)
          const rules = getBufferRules();
          const cwuRules = rules?.cwuRules || {
            baseCapacity: { 1: 150, 2: 150, 3: 200, 4: 200, "5+": 300 },
            usageAdjustments: { shower: 0, shower_bath: 50, bath: 100 },
            materialAdjustments: { inox: 50, emalia: 100 },
            safetyRule: { usage: "bath", persons_min: 2, minimumCapacity: 200 },
            availableCapacities: [150, 200, 250, 300, 400, 500],
          };

          if (validPersons > 0) {
            const baseCapacityMap = cwuRules.baseCapacity || {};
            if (validPersons <= 2)
              recommendedCapacity = baseCapacityMap["2"] || 150;
            else if (validPersons <= 4)
              recommendedCapacity = baseCapacityMap["4"] || 200;
            else if (validPersons <= 6)
              recommendedCapacity = baseCapacityMap["5+"] || 250;
            else recommendedCapacity = baseCapacityMap["5+"] || 300;
          } else {
            // ✅ FIX: Fallback jeśli persons jest niepoprawne
            recommendedCapacity = 200; // Domyślna wartość
          }

          const usageAdjustments = cwuRules.usageAdjustments || {
            shower: 0,
            shower_bath: 50,
            bath: 100,
          };
          let extra = 0;
          if (validProfile === "shower_bath") {
            extra = usageAdjustments.shower_bath || 50;
          } else if (validProfile === "bath") {
            extra = usageAdjustments.bath || 100;
          }

          if (recommendedCapacity) {
            recommendedCapacity += extra;
            const allowed = cwuRules.availableCapacities || [
              150, 200, 250, 300, 400, 500,
            ];
            recommendedCapacity = allowed.reduce((best, candidate) => {
              if (best === null) return candidate;
              return Math.abs(candidate - recommendedCapacity) <
                Math.abs(best - recommendedCapacity)
                ? candidate
                : best;
            }, null);
          }

          // ✅ FIX: Upewnij się że recommendedCapacity nie jest null po wszystkich obliczeniach
          if (!recommendedCapacity) {
            recommendedCapacity = 200; // Fallback bezpieczeństwa
          }

          // Safety rule: bath + persons >= 2 → minimum 200 L
          const safetyRule = cwuRules.safetyRule || {
            usage: "bath",
            persons_min: 2,
            minimumCapacity: 200,
          };
          if (
            validProfile === safetyRule.usage &&
            validPersons >= safetyRule.persons_min
          ) {
            if (
              !recommendedCapacity ||
              recommendedCapacity < safetyRule.minimumCapacity
            ) {
              recommendedCapacity = safetyRule.minimumCapacity;
            }
          }
        }

        return {
          enabled,
          required,
          recommendedCapacity,
          skip, // ✅ NOWA FLAGA
          skipReason, // ✅ NOWA FLAGA
        };
      },

      // BUFOR CO – wymagany / zakres (rozszerzona logika)
      buffer(state) {
        // ✅ SINGLE SOURCE OF TRUTH (Wycena2025):
        // Zamiast liczyć "bufor" heurystykami w UI, wyliczamy kanoniczny obiekt hydrauliki
        // i mapujemy go do legacy API tego kroku.
        const hr = computeHydraulicsRecommendation(state);

        const pumpOptionIdLegacy = state?.selectedPump?.optionId || null;
        const pumpDataLegacy = pumpOptionIdLegacy
          ? pumpMatchingTable[pumpOptionIdLegacy]
          : null;
        const pumpPowerLegacy = Number(
          pumpDataLegacy?.power || state?.selectedPump?.power_kw || 0
        );
        // PHASE 3C — Load from rules JSON
        const rules = getBufferRules();
        const separatorThresholds = rules?.separatorSizeClasses?.thresholds || {
          small: 7,
          medium: 15,
        };
        const separatorSizeClass =
          pumpPowerLegacy < separatorThresholds.small
            ? "small"
            : pumpPowerLegacy < separatorThresholds.medium
            ? "medium"
            : "large";

        // NOWY: Mapowanie do 3 typów (NONE, BUFOR_SZEREGOWO, BUFOR_RÓWNOLEGLE)
        let type = "none";
        let liters = null;
        let hydraulicSeparationRequired = false;

        if (hr.recommendation === "BUFOR_SZEREGOWO") {
          type = "storage"; // Bufor szeregowo z by-passem
          liters = hr.buffer_liters;
          hydraulicSeparationRequired = false;
        } else if (hr.recommendation === "BUFOR_RÓWNOLEGLE") {
          type = "both"; // Bufor równolegle jako sprzęgło hydrauliczne
          liters = hr.buffer_liters;
          hydraulicSeparationRequired = true; // Sprzęgło = separacja hydrauliczna
        } else {
          // NONE
          type = "none";
          liters = null;
          hydraulicSeparationRequired = false;
        }

        return {
          type,
          required: hr.severity === "MANDATORY",
          allowZeroBuffer: hr.recommendation === "NONE",
          liters,
          recommendedCapacity: hr.buffer_liters || 0, // legacy convenience
          separatorSize:
            hr.recommendation === "BUFOR_RÓWNOLEGLE"
              ? separatorSizeClass
              : null,
          hydraulicSeparationRequired,
          dominantReason: hr.explanation?.short || "",
          reasons: hr.reason_codes || [],
          constraints: [],
          hydraulicsRecommendation: hr, // passthrough
        };
      },

      // CYRKULACJA CWU
      circulation(state) {
        const includeHot = !!state.meta?.include_hot_water;
        const persons = Number(
          state.meta?.hot_water_persons || state.meta?.cwu_people || 0
        );
        const hotWaterUsage =
          state.meta?.hot_water_usage || state.meta?.cwu_profile || null;
        return {
          enabled: includeHot,
          recommended: persons >= 4 || hotWaterUsage === "comfort",
        };
      },

      // SERVICE CLOUD
      serviceCloud(state) {
        const generation = state.meta?.generation || "K";
        return {
          enabled: generation === "K",
          aiDiagnosticsEnabled: generation === "K",
        };
      },

      // FILTRY / ZABEZPIECZENIA HYDRAULICZNE
      hydraulics(state) {
        const year = Number(
          state.meta?.building_year || state.meta?.construction_year || 2020
        );
        const modernized = !!state.meta?.heat_source_prev;
        const autoSelectMagnet = modernized || year < 1990;
        const requireFlush = modernized || year < 2005;
        const recommendFlush = !requireFlush && year >= 2005 && year < 2015;
        return {
          autoSelectMagnet,
          requireFlush,
          recommendFlush,
        };
      },

      // POSADOWIENIE JEDNOSTKI ZEWNĘTRZNEJ
      mounting(selectedPump, state) {
        const buildingType = state.meta?.building_type || "single_house";
        const weight = Number(selectedPump?.weight || 70);
        const allowedWall = buildingType !== "apartment" && weight <= 65;
        const warnWall = weight > 65;
        return {
          allowedWall,
          warnWall,
        };
      },

      // ELEKTRYKA
      electric(selectedPump, state) {
        const totalPower = Number(
          (state.meta?.power_total_kw ?? state.meta?.max_heating_power) || 0
        );
        const requiresUpgrade = totalPower > 9;
        return {
          requiresUpgrade,
        };
      },

      // UZDATNIANIE WODY
      water(state) {
        return { recommendSoftener: true };
      },

      // PŁUKANIE / CHEMIA
      flushing(state) {
        const year = Number(
          state.meta?.building_year || state.meta?.construction_year || 2020
        );
        const requireFlush = year < 2005;
        const recommendFlush = year >= 2005 && year < 2015;
        return { requireFlush, recommendFlush };
      },

      // PODSUMOWANIE KOMPLETNOŚCI MASZYNOWNI
      summary(state, derived) {
        const missing = [];
        if (!state.selections.pompa) missing.push("Pompa");
        if (derived.cwuRules.required && !state.selections.cwu) {
          missing.push("Zasobnik CWU");
        }
        if (derived.bufferRules.required && !state.selections.bufor) {
          missing.push("Bufor CO");
        }
        return {
          complete: missing.length === 0,
          missing,
        };
      },
    };

    // UICallbacks - operacje na DOM
    const UICallbacks = {
      setSectionEnabled(sectionKey, isEnabled) {
        const step = dom.qs(`[data-step-key="${sectionKey}"]`);
        if (!step) return;
        step.classList.toggle("section-disabled", !isEnabled);
        step.querySelectorAll(".option-card").forEach((card) => {
          card.classList.toggle("disabled", !isEnabled);
          if (!isEnabled) card.classList.remove("selected");
        });
      },

      setSectionRequired(sectionKey, isRequired) {
        const step = dom.qs(`[data-step-key="${sectionKey}"]`);
        if (!step) return;
        step.classList.toggle("section-required", !!isRequired);
      },

      markRecommended(sectionKey, recommendedValue) {
        if (!recommendedValue) return;
        const step = dom.qs(`[data-step-key="${sectionKey}"]`);
        if (!step) return;
        step.querySelectorAll(".option-card").forEach((card) => {
          const optionId = card.getAttribute("data-option-id") || "";
          const capacity = extractCapacityFromOptionId(optionId);
          card.classList.toggle(
            "recommended",
            capacity === Number(recommendedValue)
          );
        });
      },

      autoSelect(optionKey) {
        const card = dom.qs(`[data-option-id="${optionKey}"]`);
        if (!card) return;
        if (!card.classList.contains("selected")) {
          card.classList.add("selected");
          captureSelectionForCard(card);
        }
      },

      forceSelect(optionKey) {
        const card = dom.qs(`[data-option-id="${optionKey}"]`);
        if (!card) return;
        card.classList.add("selected", "forced");
        captureSelectionForCard(card);
      },

      warnOnOption(optionKey, condition) {
        const card = dom.qs(`[data-option-id="${optionKey}"]`);
        if (!card) return;
        card.classList.toggle("warn", !!condition);
      },
    };

    function evaluateRules() {
      if (!state.meta) return null;

      const cwuRules = rulesEngine.cwu(state);
      const bufferRules = rulesEngine.buffer(state);
      // ✅ FIX: Użyj tylko świeżo obliczonego hydraulicsRecommendation z bufferRules
      // Usunięto fallback do state.recommendations?.hydraulics (może być stary cache)
      const hydraulicsRecommendation =
        bufferRules?.hydraulicsRecommendation || null;

      // ✅ Dodaj separatorSize do hydraulicsRecommendation jeśli jest dostępne
      // separatorSize powinno być już w hydraulicsRecommendation z BufferEngine,
      // ale na wszelki wypadek sprawdźmy bufferRules jako fallback
      if (
        hydraulicsRecommendation &&
        !hydraulicsRecommendation.separatorSize &&
        bufferRules?.separatorSize
      ) {
        hydraulicsRecommendation.separatorSize = bufferRules.separatorSize;
      }
      const circulationRules = rulesEngine.circulation(state);
      const scRules = rulesEngine.serviceCloud(state);
      const hydraulicsRules = rulesEngine.hydraulics(state);
      const mountingRules = rulesEngine.mounting(state.selectedPump, state);
      const electricRules = rulesEngine.electric(state.selectedPump, state);
      const waterRules = rulesEngine.water(state);
      const flushingRules = rulesEngine.flushing(state);
      const summary = rulesEngine.summary(state, {
        cwuRules,
        bufferRules,
        hydraulicsRules,
        flushingRules,
      });

      return {
        cwuRules,
        bufferRules,
        hydraulicsRecommendation,
        circulationRules,
        scRules,
        hydraulicsRules,
        mountingRules,
        electricRules,
        waterRules,
        flushingRules,
        summary,
      };
    }

    function applyRulesToUI(evaluated) {
      if (!evaluated) return;

      // CWU
      if (evaluated.cwuRules.skip) {
        // ✅ Ukryj sekcję całkowicie i ustaw "brak" w sticky bar
        const cwuStep = dom.qs('[data-step-key="cwu"]');
        if (cwuStep) {
          cwuStep.style.display = "none";
          cwuStep.classList.add("section-skipped");
        }
        // Ustaw w sticky bar
        updateSelectionsBar("cwu", evaluated.cwuRules.skipReason || "brak");
        // Ustaw w state.selections dla wyników
        state.selections.cwu = {
          optionId: "cwu-none",
          label: evaluated.cwuRules.skipReason || "brak",
        };
      } else {
        UICallbacks.setSectionEnabled("cwu", evaluated.cwuRules.enabled);
        if (evaluated.cwuRules.recommendedCapacity) {
          UICallbacks.markRecommended(
            "cwu",
            evaluated.cwuRules.recommendedCapacity
          );
        }
      }

      // Bufor
      UICallbacks.setSectionRequired("bufor", evaluated.bufferRules.required);

      // Cyrkulacja
      UICallbacks.setSectionEnabled(
        "cyrkulacja",
        evaluated.circulationRules.enabled
      );

      // Service Cloud
      UICallbacks.setSectionEnabled("service", evaluated.scRules.enabled);

      // Hydraulika - auto-select filtr jeśli wymagane
      if (evaluated.hydraulicsRules.autoSelectMagnet) {
        UICallbacks.autoSelect("filter-basic");
      }

      // Posadowienie - warning dla ściany
      if (evaluated.mountingRules.warnWall) {
        UICallbacks.warnOnOption("posadowienie-sciana", true);
      }
      UICallbacks.setSectionEnabled(
        "posadowienie",
        evaluated.mountingRules.allowedWall
      );

      // Uzdatnianie - rekomenduj (TYLKO jeśli użytkownik jeszcze nie wybrał)
      if (evaluated.waterRules.recommendSoftener) {
        const existingWaterSelection = state.selections.woda;
        if (!existingWaterSelection || !existingWaterSelection.optionId) {
          UICallbacks.autoSelect("woda-tak");
        }
      }
    }

    // Funkcja recompute do przeliczania reguł (z configurator.js)
    // ⚠️ FIX P1.2: recompute() musi być natychmiastowe (deterministyczne) dla PDF/getSelection
    function recompute() {
      if (appState) {
        appState.configuratorState = state;
        appState.configuratorSelections = state.selections;
      }
      const evaluated = evaluateRules();
      applyRulesToUI(evaluated);
      // ✅ FIX: Użyj hydraulicsRecommendation z evaluateRules() (już świeże, obliczone w rulesEngine.buffer())
      // Usunięto podwójne wywołanie computeHydraulicsRecommendation() - było niepotrzebne i mogło powodować niespójność
      if (evaluated && evaluated.hydraulicsRecommendation) {
        renderHydraulicsCOSectionFromRecommendation(
          evaluated.hydraulicsRecommendation
        );
      }
      updateSummary();
      exposeSelectionOnWindow();
    }

    // ⚠️ FIX P1.2: Debounce wrapper dla eventów UI (aby uniknąć wielokrotnych obliczeń przy szybkich zmianach)
    let requestRecomputeTimeout = null;
    function requestRecompute() {
      if (requestRecomputeTimeout) {
        clearTimeout(requestRecomputeTimeout);
      }
      requestRecomputeTimeout = setTimeout(() => {
        recompute();
        requestRecomputeTimeout = null;
      }, 100); // 100ms debounce dla UI events
    }

    if (appState) {
      appState.configuratorRecompute = recompute;
      appState.configuratorApi = {
        recompute,
        evaluateRules,
        selectOption,
        selectOptionById,
        selectBufferCapacity,
        selectRecommended,
        getState: () => state,
        getSelection: () =>
          lastSelectionPayload || appState.configuratorSelection || null,
      };
    }

    /* ==========================================================================
     DATA EXPORT (z configurator.js)
     ========================================================================== */

    function exposeSelectionOnWindow() {
      const totalPrice = calculateTotalPrice();
      const pricingItems = buildPricingItems();

      const payload = {
        meta: state.meta,
        selections: state.selections,
        recommendations: state.recommendations || {},
        products: {
          pump: state.selectedPump || null,
          cwu: state.selections.cwu || null,
          buffer: state.selections.bufor || null,
        },
        pricing: {
          total_netto_pln: state.pricing.total_netto_pln,
          total_brutto_pln: state.pricing.total_brutto_pln,
          items: pricingItems,
        },
      };

      lastSelectionPayload = payload;

      if (appState) {
        appState.configuratorSelection = payload;
        appState.configuratorSelections = state.selections;
        appState.configuratorState = state;
      }

      if (
        typeof getAppState === "function" &&
        typeof updateAppState === "function"
      ) {
        const current = getAppState();
        if (current && typeof current.lastCalculationResult === "object") {
          updateAppState({
            lastCalculationResult: {
              ...current.lastCalculationResult,
              configurator: payload,
            },
          });
        }
      }
    }

    /* ==========================================================================
     HELPER FUNCTIONS (z configurator.js)
     ========================================================================== */

    function getSummaryIcon(key) {
      const icons = {
        meta: "ri-bar-chart-fill",
        pump_variant: "ri-settings-5-fill",
        pompa: "ri-settings-5-fill",
        cwu: "ri-showers-fill",
        buffer: "ri-drop-fill",
        bufor: "ri-drop-fill",
        circulation: "ri-refresh-fill",
        cyrkulacja: "ri-refresh-fill",
        service_cloud: "ri-cloud-fill",
        service: "ri-cloud-fill",
        magnetic_filter: "ri-magnet-fill",
        hydro_safety: "ri-shield-fill",
        foundation: "ri-building-fill",
        posadowienie: "ri-building-fill",
        reducer: "ri-scale-fill",
        reduktor: "ri-scale-fill",
        softener: "ri-drop-fill",
        woda: "ri-drop-fill",
        flushing: "ri-sparkling-fill",
        electrical: "ri-flashlight-fill",
      };
      return icons[key] || "ri-check-fill";
    }

    function getSummaryKeyFromLabel(label) {
      const map = {
        Pompa: "pompa",
        "Zasobnik CWU": "cwu",
        "Bufor CO": "bufor",
        "Cyrkulacja CWU": "cyrkulacja",
        "Service Cloud": "service",
        "Posadowienie jednostki zewnętrznej": "posadowienie",
        "Reduktor ciśnienia": "reduktor",
        "Stacja uzdatniania wody": "woda",
      };
      return map[label] || "";
    }

    // Formatowanie mocy w kW
    function formatPower(v) {
      if (!v || v === 0) return "—";
      return `${v.toFixed(1)} kW`;
    }

    // Rozwiązuje produkt CWU na podstawie typu i pojemności (z configurator.js)
    function resolveCwuProduct(cwuData, typeId, capacity) {
      if (
        !cwuData ||
        !typeId ||
        capacity === null ||
        typeof capacity === "undefined"
      ) {
        return null;
      }
      // Nowa struktura: types[].products[]
      if (cwuData.types) {
        const type = cwuData.types.find((t) => t.id === typeId);
        if (type && type.products) {
          const product = type.products.find(
            (p) => p.capacity === Number(capacity)
          );
          if (product)
            return {
              ...product,
              typeId,
              capacity_l: product.capacity_l ?? Number(capacity),
            };
        }
      }
      // Stara struktura: catalog[typeId][capacity]
      if (cwuData.catalog) {
        const typeCatalog = cwuData.catalog[typeId];
        if (typeCatalog) {
          const key = String(capacity);
          const product = typeCatalog[key];
          if (product) {
            return {
              ...product,
              typeId,
              capacity_l: product.capacity_l ?? Number(capacity),
            };
          }
        }
      }
      return null;
    }

    // Rozwiązuje produkt bufora na podstawie pojemności (z configurator.js)
    function resolveBufferProduct(bufferData, capacity) {
      if (!bufferData || capacity === null || typeof capacity === "undefined") {
        return null;
      }
      // Nowa struktura: products[]
      if (bufferData.products) {
        const product = bufferData.products.find(
          (p) => p.capacity === Number(capacity)
        );
        if (product)
          return {
            ...product,
            capacity_l: product.capacity_l ?? Number(capacity),
          };
      }
      // Stara struktura: catalog[capacity]
      if (bufferData.catalog) {
        const key = String(capacity);
        const product = bufferData.catalog[key];
        if (product) {
          return {
            ...product,
            capacity_l: product.capacity_l ?? Number(capacity),
          };
        }
      }
      return null;
    }

    // Pełna funkcja budująca wiersze podsumowania (z configurator.js)
    function buildSummaryRows(state) {
      const rows = [];
      if (!state || !state.selections || !state.data || !state.meta)
        return rows;

      const { selections, data, meta } = state;

      // Pompa – wariant
      if (selections.pompa && selections.pompa.label) {
        rows.push({
          key: "pump_variant",
          label: "Pompa ciepła",
          value: selections.pompa.label,
          badge: "",
        });
      } else if (state.selectedPump && state.selectedPump.label) {
        rows.push({
          key: "pump_variant",
          label: "Pompa ciepła",
          value: state.selectedPump.label,
          badge: "",
        });
      }

      // CWU - nowa struktura (typ + pojemność)
      let cwuValue = "Nie wybrano";
      // ✅ NOWA LOGIKA: Sprawdź czy CWU jest pominięte (skip)
      const evaluated = evaluateRules();
      if (evaluated?.cwuRules?.skip) {
        cwuValue = evaluated.cwuRules.skipReason || "brak";
      } else if (selections.cwu) {
        // Unified używa obiektu z optionId i label
        if (selections.cwu.label) {
          cwuValue = selections.cwu.label;
        } else if (typeof selections.cwu === "string") {
          // Fallback dla starej struktury stringowej
          const cwuData = data.cwuOptions;
          if (cwuData && !cwuData.disabled) {
            const parts = selections.cwu.split("-");
            if (parts.length >= 3) {
              const typeId = parts.slice(0, 2).join("-");
              const capacity = parts[2];
              const type = cwuData.types?.find((t) => t.id === typeId);
              const product = resolveCwuProduct(cwuData, typeId, capacity);
              if (product && product.label) {
                cwuValue = product.label;
              } else if (type) {
                cwuValue = `${type.title} ${capacity} l`;
              } else {
                cwuValue = `Zasobnik ${capacity} l`;
              }
            }
          } else if (cwuData && cwuData.disabled) {
            cwuValue = "Wyłączone (pompa AIO)";
          }
        }
      }
      rows.push({
        key: "cwu",
        label: "Zasobnik CWU",
        value: cwuValue,
        badge: "",
      });

      // Bufor
      let bufferValue = "Nie wybrano";
      if (selections.bufor) {
        if (selections.bufor.label) {
          bufferValue = selections.bufor.label;
        } else if (typeof selections.bufor === "string") {
          const capacityMatch = selections.bufor.match(/buffer-(\d+)/);
          const capacity = capacityMatch ? Number(capacityMatch[1]) : null;
          if (capacity && data.bufferConfig) {
            const product = resolveBufferProduct(data.bufferConfig, capacity);
            if (product?.label) {
              bufferValue = product.label;
            } else {
              bufferValue = `Bufor ${capacity} l`;
            }
          }
        }
      }
      rows.push({
        key: "buffer",
        label: "Bufor / sprzęgło",
        value: bufferValue,
        badge: "",
      });

      // Cyrkulacja
      const cyrOpt = data.circulationOptions?.find(
        (o) =>
          o.id === selections.cyrkulacja?.optionId ||
          selections.cyrkulacja === o.id
      );
      rows.push({
        key: "circulation",
        label: "Cyrkulacja CWU",
        value: cyrOpt
          ? cyrOpt.label
          : selections.cyrkulacja?.label || "Nie wybrano",
        badge: "",
      });

      // Service Cloud
      const svcOpt = data.serviceCloudOptions?.find(
        (o) =>
          o.id === selections.service?.optionId || selections.service === o.id
      );
      rows.push({
        key: "service_cloud",
        label: "Service Cloud",
        value: svcOpt
          ? svcOpt.label
          : selections.service?.label || "Włączone (domyślnie)",
        badge: "",
      });

      // Filtr magnetyczny
      const filtOpt = data.magneticFilterOptions?.find(
        (o) =>
          o.id === selections.magnetic_filter?.optionId ||
          selections.magnetic_filter === o.id
      );
      rows.push({
        key: "magnetic_filter",
        label: "Filtr magnetyczny",
        value: filtOpt
          ? filtOpt.label
          : selections.magnetic_filter?.label || "Nie wybrano",
        badge: "",
      });

      // Zabezpieczenia hydrauliczne
      const hydOpt = data.hydroSafetyOptions?.find(
        (o) =>
          o.id === selections.hydro_safety?.optionId ||
          selections.hydro_safety === o.id
      );
      rows.push({
        key: "hydro_safety",
        label: "Zabezpieczenia hydrauliczne",
        value: hydOpt
          ? hydOpt.label
          : selections.hydro_safety?.label || "Nie wybrano",
        badge: "",
      });

      // Posadowienie
      const fundOpt = data.foundationOptions?.find(
        (o) =>
          o.id === selections.posadowienie?.optionId ||
          selections.posadowienie === o.id
      );
      rows.push({
        key: "foundation",
        label: "Posadowienie jednostki zewnętrznej",
        value: fundOpt
          ? fundOpt.label
          : selections.posadowienie?.label || "Nie wybrano",
        badge: "",
      });

      // Reduktor ciśnienia
      const redOpt = data.reducerOptions?.find(
        (o) =>
          o.id === selections.reduktor?.optionId || selections.reduktor === o.id
      );
      rows.push({
        key: "reducer",
        label: "Reduktor ciśnienia",
        value: redOpt
          ? redOpt.label
          : selections.reduktor?.label || "Nie wybrano",
        badge: "",
      });

      // Stacja uzdatniania
      const softOpt = data.softenerOptions?.find(
        (o) => o.id === selections.woda?.optionId || selections.woda === o.id
      );
      rows.push({
        key: "softener",
        label: "Stacja uzdatniania wody",
        value: softOpt
          ? softOpt.label
          : selections.woda?.label || "Nie wybrano",
        badge: "",
      });

      // Płukanie
      const flushOpt = data.flushingOptions?.find(
        (o) =>
          o.id === selections.flushing?.optionId || selections.flushing === o.id
      );
      rows.push({
        key: "flushing",
        label: "Płukanie instalacji + inhibitor",
        value: flushOpt
          ? flushOpt.label
          : selections.flushing?.label || "Nie wybrano",
        badge: "",
      });

      // Zasilanie elektryczne
      const elOpt = data.electricalOptions?.find(
        (o) =>
          o.id === selections.electrical?.optionId ||
          selections.electrical === o.id
      );
      rows.push({
        key: "electrical",
        label: "Zasilanie elektryczne",
        value: elOpt
          ? elOpt.label
          : selections.electrical?.label || "Informacyjnie",
        badge: "",
      });

      // Dane meta – powierzchnia / moc
      if (meta.heated_area || meta.power_total_kw) {
        rows.unshift({
          key: "meta",
          label: "Profil budynku",
          value: [
            meta.heated_area
              ? `${
                  meta.heated_area.toFixed
                    ? meta.heated_area.toFixed(0)
                    : meta.heated_area
                } m²`
              : null,
            meta.power_total_kw
              ? `${
                  meta.power_total_kw.toFixed
                    ? meta.power_total_kw.toFixed(1)
                    : meta.power_total_kw
                } kW`
              : null,
          ]
            .filter(Boolean)
            .join(" · "),
          badge: "",
        });
      }

      return rows;
    }

    // Auto-wybór początkowy (z configurator.js)
    function applyInitialAutoSelection(state, selectCardProgrammatically) {
      if (!state || !state.data || !state.meta) return;
      const { meta, data, selections } = state;

      // Service Cloud – zawsze auto-select (obowiązkowe)
      if (!selections.service || !selections.service.optionId) {
        if (typeof selectCardProgrammatically === "function") {
          selectCardProgrammatically("service", "service-cloud");
        }
      }

      // Zasobnik CWU – ustaw rekomendowaną pojemność + typ domyślny
      if (!selections.cwu || !selections.cwu.optionId) {
        const cwuData = data.cwuOptions;
        if (cwuData && !cwuData.disabled) {
          const defaultTypeId =
            cwuData.defaultTypeId || cwuData.types?.[0]?.id || "cwu-emalia";
          const defaultCapacity =
            cwuData.recommendedCapacity ||
            (Array.isArray(cwuData.capacities) ? cwuData.capacities[0] : null);
          if (
            defaultTypeId &&
            defaultCapacity &&
            typeof selectCardProgrammatically === "function"
          ) {
            selectCardProgrammatically(
              "cwu",
              `${defaultTypeId}-${defaultCapacity}`
            );
          }
        }
      }

      // Bufor CO – prosty dobór wg typu instalacji
      if (!selections.bufor || !selections.bufor.optionId) {
        const bufferData = data.bufferConfig;
        if (bufferData && typeof selectCardProgrammatically === "function") {
          const initialCapacity =
            bufferData.recommendedCapacity || bufferData.capacities?.[0];
          if (initialCapacity) {
            selectCardProgrammatically("bufor", `buffer-${initialCapacity}`);
          }
        }
      }
    }

    /* ==========================================================================
     NAVIGATION & UI HELPERS (z configurator-new.js)
     ========================================================================== */

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    /* ==========================================================================
     STICKY SELECTIONS BAR - Aktualizacja wybranych komponentów
     ========================================================================== */

    function updateSelectionsBar(stepKey, displayLabel) {
      // Mapowanie stepKey → data-type w sticky pasku
      const typeMapping = {
        pompa: "pompa",
        cwu: "cwu",
        bufor: "bufor",
        cyrkulacja: "cyrkulacja",
        service: "service",
        posadowienie: "posadowienie",
        reduktor: "reduktor",
        woda: "uzdatnianie",
      };

      const dataType = typeMapping[stepKey];
      if (!dataType) return;

      const selectionItem = dom.qs(`.selection-item[data-type="${dataType}"]`);
      if (!selectionItem) return;

      const valueEl = selectionItem.querySelector(".selection-value");
      if (!valueEl) return;
      const currentValue = valueEl.textContent.trim();
      const wasEmpty =
        valueEl.hasAttribute("data-empty") ||
        currentValue === "" ||
        currentValue === "—" ||
        currentValue === "-";

      // Skróć zbyt długie nazwy (max 30 znaków)
      let shortLabel = displayLabel || "—";
      if (shortLabel.length > 30) {
        shortLabel = shortLabel.substring(0, 27) + "...";
      }

      valueEl.textContent = shortLabel;
      valueEl.removeAttribute("data-empty");

      if (wasEmpty && motion && typeof motion.animateAttach === "function") {
        motion.animateAttach(selectionItem);
      }
    }

    function captureSelectionForCard(card) {
      const stepSection = card.closest(".config-step");
      if (!stepSection) return;

      const stepKey = stepSection.dataset.stepKey;
      if (!stepKey) return;

      const optionId = card.getAttribute("data-option-id") || null;
      // Dla product-card użyj product-title, dla option-card użyj option-title
      const titleEl =
        card.querySelector(".product-title") ||
        card.querySelector(".option-title");
      const label = titleEl ? titleEl.textContent.trim() : optionId || "";

      // Usuń selekcję z innych kart w tym kroku (obsługuj oba typy kart)
      stepSection
        .querySelectorAll(".option-card.selected, .product-card.selected")
        .forEach((c) => {
          if (c !== card) c.classList.remove("selected");
        });

      card.classList.add("selected");

      // Zapisz w state
      state.selections[stepKey] = {
        optionId,
        label,
      };

      // Aktualizuj sticky pasek z wybranymi komponentami
      updateSelectionsBar(stepKey, label);

      // Aktualizuj selectedPump jeśli to pompa
      if (stepKey === "pompa") {
        state.selectedPump = {
          optionId,
          label,
          type: optionId?.includes("aio") ? "all-in-one" : "split",
          power_kw: state.meta?.recommended_power_kw || null,
        };
      }

      // Przelicz reguły i ceny
      const evaluated = evaluateRules();
      applyRulesToUI(evaluated);
      calculateTotalPrice();
      buildPricingItems();

      // Zaktualizuj podsumowanie
      updateSummary();

      // Eksportuj dane
      exposeSelectionOnWindow();

      // ✅ Zapisz stan do sessionStorage (dla przełączania widoków)
      saveConfiguratorState();
    }

    function selectOption(stepKey, optionId) {
      if (!stepKey || !optionId) return false;
      const step = dom.qs(`[data-step-key="${stepKey}"]`);
      if (!step) return false;
      const card = step.querySelector(`[data-option-id="${optionId}"]`);
      if (!card) return false;
      captureSelectionForCard(card);
      return true;
    }

    function selectOptionById(optionId) {
      if (!optionId) return false;
      const card = dom.qs(`[data-option-id="${optionId}"]`);
      if (!card) return false;
      captureSelectionForCard(card);
      return true;
    }

    function selectRecommended(stepKey) {
      if (!stepKey) return false;
      const step = dom.qs(`[data-step-key="${stepKey}"]`);
      if (!step) return false;
      const badge = step.querySelector(".badge-recommended");
      const card = badge ? badge.closest(".product-card, .option-card") : null;
      if (card) {
        captureSelectionForCard(card);
        return true;
      }
      const fallbackCard = step.querySelector(".product-card, .option-card");
      if (fallbackCard) {
        captureSelectionForCard(fallbackCard);
        return true;
      }
      return false;
    }

    function selectBufferCapacity(capacity) {
      if (typeof capacity === "undefined" || capacity === null) return false;
      const optionId = `buffer-${capacity}`;
      return selectOption("bufor", optionId) || selectOptionById(optionId);
    }

    function showStep(index, noScroll = false) {
      let targetIndex = clamp(index, 0, totalSteps - 1);

      // ✅ NOWA LOGIKA: Znajdź następną aktywną sekcję jeśli obecna jest skipped
      const targetStep = steps[targetIndex];
      if (targetStep && targetStep.classList.contains("section-skipped")) {
        // Znajdź następną aktywną sekcję w przód
        for (let i = targetIndex + 1; i < steps.length; i++) {
          if (!steps[i].classList.contains("section-skipped")) {
            targetIndex = i;
            break;
          }
        }
        // Jeśli nie znaleziono w przód, szukaj w tył
        if (
          targetIndex === index ||
          steps[targetIndex].classList.contains("section-skipped")
        ) {
          for (let i = targetIndex - 1; i >= 0; i--) {
            if (!steps[i].classList.contains("section-skipped")) {
              targetIndex = i;
              break;
            }
          }
        }
      }

      currentStepIndex = targetIndex;

      if (steps.length === 0) {
        console.error("[Configurator] ❌ Brak kroków!");
        return;
      }

      steps.forEach((step, i) => {
        if (i === currentStepIndex) {
          step.classList.add("active");
          // ✅ NAPRAWA: Wymuś display: block przez inline style z !important (nadpisze CSS)
          step.style.setProperty("display", "block", "important");
          step.style.setProperty("opacity", "1", "important");
          step.style.setProperty("visibility", "visible", "important");
        } else {
          step.classList.remove("active");
          step.style.setProperty("display", "none", "important");
        }
      });

      // Przelicz aktywne kroki (bez skipped)
      const activeSteps = steps.filter(
        (step) => !step.classList.contains("section-skipped")
      );
      const activeStepIndex = activeSteps.indexOf(steps[currentStepIndex]);

      if (currentStepNumberEl) {
        currentStepNumberEl.textContent = String(activeStepIndex + 1);
      }
      if (totalStepsNumberEl) {
        totalStepsNumberEl.textContent = String(activeSteps.length);
      }

      updateNavButtons();

      // Scroll TYLKO jeśli faktycznie nawigujemy po krokach (nie przy pierwszym pokazaniu)
      if (!noScroll) {
        const activeStep = steps[currentStepIndex];
        if (activeStep) {
          setTimeout(() => {
            activeStep.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }, 100);
        }
      }
    }

    function updateNavButtons() {
      // Przelicz aktywne kroki (bez skipped)
      const activeSteps = steps.filter(
        (step) => !step.classList.contains("section-skipped")
      );
      const activeStepIndex = activeSteps.indexOf(steps[currentStepIndex]);

      if (navPrev) {
        navPrev.disabled = activeStepIndex === 0;
      }
      if (navNext) {
        if (activeStepIndex === activeSteps.length - 1) {
          navNext.textContent = "Zakończ";
          navNext.disabled = true;
        } else {
          navNext.textContent = "Dalej →";
          navNext.disabled = false;
        }
      }
    }

    function updateSummary() {
      if (!summaryBody) return;

      summaryBody.innerHTML = "";

      summaryConfig.forEach((rowCfg) => {
        const tr = doc.createElement("tr");

        const tdTitle = doc.createElement("td");
        tdTitle.className = "section-title";
        tdTitle.innerHTML = `<i class="${rowCfg.icon}" aria-hidden="true"></i> ${rowCfg.label}`;

        const tdValue = doc.createElement("td");
        tdValue.className = "section-value";

        const tdStatus = doc.createElement("td");
        tdStatus.className = "section-status";

        const sel = state.selections[rowCfg.stepKey];

        // ✅ NOWA LOGIKA: Dla CWU pokaż "brak" jeśli skip
        if (rowCfg.stepKey === "cwu") {
          const evaluated = evaluateRules();
          if (evaluated?.cwuRules?.skip) {
            tdValue.textContent = evaluated.cwuRules.skipReason || "brak";
            tdStatus.textContent = "—";
          } else if (sel && sel.label) {
            tdValue.textContent = sel.label;
            const statusBadge = doc.createElement("span");
            statusBadge.className = "status-selected";
            statusBadge.textContent = "✓ Wybrano";
            tdStatus.appendChild(statusBadge);
          } else {
            tdValue.textContent = "Nie wybrano";
            tdStatus.textContent = "—";
          }
        } else if (sel && sel.label) {
          tdValue.textContent = sel.label;
          const statusBadge = doc.createElement("span");
          statusBadge.className = "status-selected";
          statusBadge.textContent = "✓ Wybrano";
          tdStatus.appendChild(statusBadge);
        } else {
          tdValue.textContent = "Nie wybrano";
          tdStatus.textContent = "—";
        }

        tr.appendChild(tdTitle);
        tr.appendChild(tdValue);
        tr.appendChild(tdStatus);
        summaryBody.appendChild(tr);
      });

      // Ceny usunięte z konfiguratora — nie pokazujemy wiersza z ceną całkowitą.

      // Dodaj status kompletności (jeśli jest element banner)
      const evaluated = evaluateRules();
      if (evaluated && evaluated.summary) {
        const banner = dom.qs("#config-summary-status");
        if (banner) {
          if (evaluated.summary.complete) {
            banner.className = "summary-banner summary-banner--complete";
            banner.innerHTML = `
            <div class="summary-banner-icon">✅</div>
            <div class="summary-banner-content">
              <strong>Maszynownia skompletowana technicznie</strong>
              <p>Możesz wygenerować ofertę PDF i przesłać zapytanie.</p>
            </div>
          `;
          } else {
            banner.className = "summary-banner summary-banner--incomplete";
            const missingCount = evaluated.summary.missing.length;
            banner.innerHTML = `
            <div class="summary-banner-icon">⚠️</div>
            <div class="summary-banner-content">
              <strong>Brakuje jeszcze ${missingCount} element${
              missingCount === 1 ? "" : missingCount < 5 ? "y" : "ów"
            }</strong>
              <p>Uzupełnij je, aby instalacja spełniała standard serwisowy i gwarancyjny.</p>
            </div>
          `;
          }
        }
      }
    }

    /* ==========================================================================
     EVENT BINDING (z configurator-new.js)
     ========================================================================== */

    function bindCardClicks() {
      const stepsContainer = dom.byId("configurator-steps");
      if (!stepsContainer) {
        console.warn("[Configurator] ⚠️ Brak #configurator-steps");
        return;
      }

      if (cardClickHandler) {
        stepsContainer.removeEventListener("click", cardClickHandler);
      }

      cardClickHandler = function (e) {
        // Obsługuj zarówno option-card jak i product-card
        const card =
          e.target.closest(".option-card") || e.target.closest(".product-card");
        if (!card || card.classList.contains("disabled")) return;

        captureSelectionForCard(card);
      };

      trackEvent(stepsContainer, "click", cardClickHandler);
    }

    function bindNavigation() {
      const app = dom.byId("configurator-app");
      if (!app) {
        console.warn("[Configurator] ⚠️ Brak #configurator-app");
        return;
      }

      if (navClickHandler) {
        app.removeEventListener("click", navClickHandler);
      }

      navClickHandler = function (e) {
        // Zapobiegaj domyślnemu zachowaniu (przeładowanie strony)
        if (
          e.target.id === "nav-prev" ||
          e.target.closest("#nav-prev") ||
          e.target.id === "nav-next" ||
          e.target.closest("#nav-next")
        ) {
          e.preventDefault();
          e.stopPropagation();
        }

        if (e.target.id === "nav-prev" || e.target.closest("#nav-prev")) {
          // ✅ NOWA LOGIKA: Znajdź poprzednią aktywną sekcję (pomijając skipped)
          const activeSteps = steps.filter(
            (step) => !step.classList.contains("section-skipped")
          );
          const currentActiveIndex = activeSteps.indexOf(
            steps[currentStepIndex]
          );
          if (currentActiveIndex > 0) {
            const prevActiveStep = activeSteps[currentActiveIndex - 1];
            const prevIndex = steps.indexOf(prevActiveStep);
            showStep(prevIndex);
          }
        } else if (
          e.target.id === "nav-next" ||
          e.target.closest("#nav-next")
        ) {
          // ✅ NOWA LOGIKA: Znajdź następną aktywną sekcję (pomijając skipped)
          const activeSteps = steps.filter(
            (step) => !step.classList.contains("section-skipped")
          );
          const currentActiveIndex = activeSteps.indexOf(
            steps[currentStepIndex]
          );
          if (currentActiveIndex < activeSteps.length - 1) {
            const nextActiveStep = activeSteps[currentActiveIndex + 1];
            const nextIndex = steps.indexOf(nextActiveStep);
            showStep(nextIndex);
          }
        }
      };

      trackEvent(app, "click", navClickHandler);
    }

    function bindSummaryActions() {
      const app = dom.byId("configurator-app");
      if (!app) return;

      // Znajdź kontener konfiguratora (configurator-page) dla szerszego event delegation
      const configuratorContainer = dom.qs(".configurator-page") || app;

      if (summaryClickHandler) {
        configuratorContainer.removeEventListener("click", summaryClickHandler);
      }

      summaryClickHandler = function (e) {
        const action =
          e.target.getAttribute("data-action") ||
          (e.target.closest("[data-action]") &&
            e.target.closest("[data-action]").getAttribute("data-action"));

        if (!action) return;

        if (action === "back-to-config") {
          const normalSteps = steps.filter(
            (step) => step.dataset.stepKey !== "summary"
          );
          const lastNormal = normalSteps[normalSteps.length - 1];
          const idx = steps.indexOf(lastNormal);
          if (idx !== -1) showStep(idx);
        } else if (action === "download-pdf") {
          root.dispatchEvent(
            new CustomEvent("hp:downloadPdf", { bubbles: true })
          );
        } else if (action === "send-email") {
          root.dispatchEvent(
            new CustomEvent("hp:showPdfForm", { bubbles: true })
          );
        } else if (action === "print") {
          view.print();
        } else if (action === "collect-customer-data") {
          root.dispatchEvent(
            new CustomEvent("hp:collectCustomerData", { bubbles: true })
          );
        } else if (action === "hide-pdf-form") {
          root.dispatchEvent(
            new CustomEvent("hp:hidePdfForm", { bubbles: true })
          );
        } else if (action === "go-back") {
          root.dispatchEvent(
            new CustomEvent("hp:goBackToForm", { bubbles: true })
          );
        } else if (action === "start-new") {
          root.dispatchEvent(
            new CustomEvent("hp:startNewCalculation", { bubbles: true })
          );
        }
      };

      trackEvent(configuratorContainer, "click", summaryClickHandler);
    }

    /* ==========================================================================
     PUMP CARD RENDERING (nowa funkcjonalność)
     ========================================================================== */

    // Renderuje kartę pompy z pełnymi danymi z panasonic.json
    function renderPumpCard(pumpProfile, panasonicData, isRecommended = false) {
      if (!pumpProfile) return "";

      const dbData = panasonicData || {};
      const cop = dbData.heating?.A7W35_COP || null;
      const copStr = cop ? `${cop.toFixed(1)} (A7/W35)` : "—";
      const refrigerant = dbData.refrigerant || "R32";
      const soundDb = dbData.outdoor_unit?.sound_dB || null;
      const dimensions = dbData.outdoor_unit?.dimensions_mm;
      const dimStr = dimensions
        ? `${dimensions.w}×${dimensions.d}×${dimensions.h}`
        : "—";

      // Dla AIO - pokaż pojemność CWU
      const cwuTank =
        pumpProfile.cwu_tank ||
        (pumpProfile.type === "all-in-one" ? 185 : null);

      const typeLabel =
        pumpProfile.type === "split"
          ? "Pompa ciepła typu Split"
          : "Pompa ciepła ze zintegrowanym zasobnikiem";

      // Użyj adjustedPowerDisplay dla specjalnych przypadków (np. "1.5 ± 2 kW")
      const powerDisplay = pumpProfile.adjustedPowerDisplay
        ? pumpProfile.adjustedPowerDisplay.replace(" kW", "kW")
        : `${pumpProfile.power_kw}kW`;
      const title =
        pumpProfile.type === "split"
          ? `Panasonic Aquarea ${powerDisplay}`
          : `Panasonic Aquarea All-in-One ${powerDisplay}`;

      const description =
        pumpProfile.type === "split"
          ? "System dzielony z jednostką wewnętrzną i zewnętrzną. Elastyczny montaż."
          : `Kompaktowe rozwiązanie z wbudowanym zasobnikiem CWU ${
              cwuTank || 185
            }L.`;

      const price = calculatePumpPrice(pumpProfile, pumpProfile.power_kw);
      const priceStr = price > 0 ? price.toLocaleString("pl-PL") : "—";

      // ❌ USUNIĘTO: selectedClass - karty nie mogą być automatycznie selected
      // const selectedClass = isRecommended ? 'selected' : '';
      const recommendedBadge = isRecommended
        ? '<div class="badge-recommended">★ Rekomendowane</div>'
        : "";
      const refrigerantBadge = refrigerant
        ? `<div class="refrigerant-badge">${refrigerant} REFRIGERANT</div>`
        : "";

      return `
      <button type="button" class="product-card ui-option" data-option-id="${
        pumpProfile.id
      }" data-pump-model="${pumpProfile.model || ""}">
        <div class="product-image">
          <img src="${
            pumpProfile.image || (config?.imgUrl || "../img") + "/split-k.png"
          }" alt="${title}" />
          ${recommendedBadge}
          ${refrigerantBadge}
        </div>
        <div class="product-content">
          <div class="product-subtitle">${typeLabel}</div>
          <h4 class="product-title">${title}</h4>
          <p class="product-description">${description}</p>
          <div class="specs-list">
            <div class="spec-row">
              <span class="spec-label">Moc grzewcza</span>
              <span class="spec-value">${
                pumpProfile.adjustedPowerDisplay || `${pumpProfile.power_kw} kW`
              }</span>
            </div>
            ${
              pumpProfile.warningMessage
                ? `
            <div class="spec-row warning-row" style="color: #8b6914; font-weight: 700; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e5e5;">
              <span class="spec-label">⚠️ Uwaga</span>
              <span class="spec-value" style="font-size: 0.9em;">${pumpProfile.warningMessage}</span>
            </div>
            `
                : ""
            }
            <div class="spec-row">
              <span class="spec-label">COP</span>
              <span class="spec-value">${copStr}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Czynnik</span>
              <span class="spec-value">${refrigerant}</span>
            </div>
            ${
              soundDb
                ? `
            <div class="spec-row">
              <span class="spec-label">Poziom hałasu</span>
              <span class="spec-value">${soundDb} dB</span>
            </div>
            `
                : ""
            }
            ${
              cwuTank
                ? `
            <div class="spec-row">
              <span class="spec-label">Zasobnik CWU</span>
              <span class="spec-value">${cwuTank} L</span>
            </div>
            `
                : ""
            }
            ${
              dimensions
                ? `
            <div class="spec-row">
              <span class="spec-label">Wymiary</span>
              <span class="spec-value">${dimStr}</span>
            </div>
            `
                : ""
            }
          </div>
          <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
        </div>
      </button>
    `;
    }

    // Renderuje sekcję pompy z 2 kartami (Split + AIO)
    async function renderPumpSection(pumpProfiles) {
      if (!pumpProfiles || pumpProfiles.length === 0) {
        console.warn("[Configurator] Brak profili pomp do renderowania");
        return "";
      }

      // Załaduj panasonic.json jeśli jeszcze nie załadowany
      if (!panasonicDB) {
        await loadPanasonicDB();
      }

      const splitProfile =
        pumpProfiles.find((p) => p.type === "split" && p.id === "hp") ||
        pumpProfiles[0];
      const aioProfile = pumpProfiles.find(
        (p) => p.type === "all-in-one" && p.id === "aio"
      );

      if (!splitProfile) {
        console.warn("[Configurator] Brak profilu Split");
        return "";
      }

      // Pobierz dane z panasonic.json
      const splitData = getPumpDataFromDB(splitProfile.model);
      const aioData = aioProfile ? getPumpDataFromDB(aioProfile.model) : null;

      const splitCard = renderPumpCard(splitProfile, splitData, true);
      const aioCard =
        aioProfile && !aioProfile.disabled
          ? renderPumpCard(aioProfile, aioData, false)
          : "";

      const heatDemand = state.meta?.max_heating_power || null;
      const recommendedPumpPower =
        splitProfile?.power || splitProfile?.power_kw || null;

      return `
      <div class="section-container">
        <div class="section-header">
          <div class="section-header-content">
            <div class="section-icon">⚡</div>
            <div>
              <h2 class="section-title">Pompa ciepła</h2>
              <p class="section-description">${
                heatDemand && recommendedPumpPower
                  ? `Szacunkowe zapotrzebowanie cieplne Twojego budynku w temperaturze projektowej wynosi ${heatDemand.toFixed(
                      2
                    )} kW. System rekomenduje pompę ciepła o mocy znamionowej ${recommendedPumpPower} kW jako optymalne rozwiązanie pod kątem komfortu, kosztów i żywotności urządzenia.`
                  : "Wybierz preferowany model pompy ciepła."
              }</p>
            </div>
          </div>
        </div>
        <div class="options-grid">
          ${splitCard}
          ${aioCard}
        </div>
        <div class="recommendation-note">
          <p><strong>Wynik kalkulacji:</strong> ${
            heatDemand
              ? `Zapotrzebowanie: ${heatDemand.toFixed(2)} kW`
              : "Brak danych"
          }</p>
        </div>
      </div>
    `;
    }

    /* ==========================================================================
     CWU CARD RENDERING (nowa funkcjonalność)
     ========================================================================== */

    // Dane o zasobnikach CWU
    const cwuData = {
      emalia: {
        name: "Galmet SG(S)",
        material: "Emalia",
        anode: "Magnezowa",
        warranty: "5 lat",
        description:
          "Sprawdzony zbiornik z wewnętrzną powłoką emaliowaną. Ekonomiczne rozwiązanie.",
        image: (config?.imgUrl || "../img") + "/cwu-emalia.png",
      },
      inox: {
        name: "Viqtis",
        material: "AISI 316L",
        anode: "Nie wymaga",
        warranty: "10 lat",
        description:
          "Premium zbiornik INOX. Maksymalna trwałość, bez konieczności wymiany anody.",
        image: (config?.imgUrl || "../img") + "/cwu-nierdzewka.png",
      },
    };

    // Renderuje kartę zasobnika CWU z pełnymi danymi
    function renderCwuCard(type, capacity, isRecommended = false) {
      const data = cwuData[type];
      if (!data) return "";

      const price = calculateCwuPrice(`cwu-${type}`, capacity);
      const priceStr = price > 0 ? price.toLocaleString("pl-PL") : "—";

      // ❌ USUNIĘTO: selectedClass - karty nie mogą być automatycznie selected
      // const selectedClass = isRecommended ? 'selected' : '';
      const recommendedBadge = isRecommended
        ? '<span class="badge-recommended">★ Rekomendowane</span>'
        : "";

      const subtitle =
        type === "inox"
          ? "Zasobnik ze stali nierdzewnej"
          : "Zasobnik z powłoką emaliowaną";

      return `
      <button type="button" class="product-card ui-option" data-option-id="cwu-${type}-${capacity}">
        <div class="product-image">
          <img src="${data.image}" alt="${
        data.name
      } ${capacity}L" onerror="this.src='${
        config?.imgUrl || "../img"
      }/dom.png';" />
          ${recommendedBadge}
        </div>
        <div class="product-content">
          <span class="product-subtitle">${subtitle}</span>
          <h4 class="product-title">${data.name} ${capacity}L</h4>
          <p class="product-description">${data.description}</p>
          <div class="specs-list">
            <div class="spec-row">
              <span class="spec-label">Pojemność</span>
              <span class="spec-value">${capacity} L</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">${
                type === "inox" ? "Materiał" : "Powłoka"
              }</span>
              <span class="spec-value">${data.material}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Anoda</span>
              <span class="spec-value">${data.anode}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Gwarancja</span>
              <span class="spec-value">${data.warranty}</span>
            </div>
          </div>
          <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
        </div>
      </button>
    `;
    }

    // Renderuje sekcję CWU z 2 kartami (Emalia + INOX) dla rekomendowanej pojemności
    function renderCwuSection(recommendedCapacity) {
      if (!recommendedCapacity) {
        console.warn("[Configurator] Brak rekomendowanej pojemności CWU");
        return "";
      }

      const emaliaCard = renderCwuCard("emalia", recommendedCapacity, true);
      const inoxCard = renderCwuCard("inox", recommendedCapacity, false);

      return emaliaCard + inoxCard;
    }

    // Renderuje kartę bufora CO
    // Opcjonalnie przyjmuje dodatkowy opis separatora i sposób montażu
    function renderBufferCard(
      capacity,
      isRecommended = false,
      allowZero = false,
      separatorInfo = null,
      setupType = null,
      installationNote = null
    ) {
      const bufferData = {
        50: {
          subtitle: "Kompaktowy",
          title: "Bufor 50L",
          description:
            "Bufor dla mniejszych instalacji z ograniczoną przestrzenią.",
          dimensions: "Ø400×600",
          price: 1400,
          image: null, // Obraz nie istnieje - użyj fallback w renderBufferCard
        },
        100: {
          subtitle: "Standardowy",
          title: "Bufor 100L",
          description: "Optymalny bufor dla większości instalacji domowych.",
          dimensions: "Ø500×800",
          price: 2100,
          image: null, // Obraz nie istnieje - użyj fallback w renderBufferCard
        },
        200: {
          subtitle: "Duży",
          title: "Bufor 200L",
          description:
            "Duży bufor dla większych instalacji i zwiększonego komfortu.",
          dimensions: "Ø600×1000",
          price: 3000,
          image: null, // Obraz nie istnieje - użyj fallback w renderBufferCard
        },
      };

      const data = bufferData[capacity];

      // Określ sposób montażu na podstawie setupType
      let installationText = "";
      if (setupType === "SERIES_BYPASS") {
        installationText =
          'System rekomenduje wpięcie w instalację szeregowo - podłączenie na powrocie z instalacji + by-pass "krótki obieg" z zaworem różnicy ciśnień.';
      } else if (setupType === "PARALLEL_CLUTCH") {
        installationText =
          "System wskazuje na wpięcie bufora równolegle między pompą ciepła a odbiornikami ciepła - tzw. sprzęgło hydrauliczne. Wymagany dodatkowy zespół pompowy/pompowo-mieszający zostanie uwzględniony w wycenie.";
      } else if (installationNote) {
        installationText = installationNote;
      }

      // Fallback obrazka - użyj dom.png jeśli nie ma dedykowanego
      // TODO: Dodać dedykowane obrazy buforów gdy będą dostępne
      const imgUrl = config?.imgUrl || "../img";
      const imagePath = data?.image || `${imgUrl}/bufor${capacity}.png`;

      if (!data) {
        // Fallback - użyj calculateBufferPrice
        const price = calculateBufferPrice(`buffer-${capacity}`);
        return `
        <button type="button" class="product-card ui-option ${
          isRecommended ? "selected" : ""
        }" data-option-id="buffer-${capacity}">
          <div class="product-image">
            <img src="${imagePath}" alt="Bufor ${capacity}L" onerror="this.src='${
          config?.imgUrl || "../img"
        }/dom.png';" />
            ${
              isRecommended
                ? '<span class="badge-recommended">★ Rekomendowane</span>'
                : ""
            }
          </div>
          <div class="product-content">
            <span class="product-subtitle">Bufor CO</span>
            <h4 class="product-title">Bufor ${capacity}L</h4>
            <p class="product-description">${
              separatorInfo ? separatorInfo : ""
            }Bufor centralnego ogrzewania.</p>
            ${
              installationText
                ? `<div class="installation-note"><strong>Sposób montażu:</strong> ${installationText}</div>`
                : ""
            }
            <div class="specs-list">
              <div class="spec-row">
                <span class="spec-label">Pojemność</span>
                <span class="spec-value">${capacity} L</span>
              </div>
            </div>
            <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
          </div>
        </button>
      `;
      }

      // ❌ USUNIĘTO: selectedClass - karty nie mogą być automatycznie selected
      // const selectedClass = isRecommended ? 'selected' : '';
      const recommendedBadge = isRecommended
        ? '<span class="badge-recommended">★ Rekomendowane</span>'
        : "";

      return `
      <button type="button" class="product-card ui-option" data-option-id="buffer-${capacity}">
        <div class="product-image">
          <img src="${imagePath}" alt="${data.title}" onerror="this.src='${
        config?.imgUrl || "../img"
      }/dom.png';" />
          ${recommendedBadge}
        </div>
        <div class="product-content">
          <span class="product-subtitle">${data.subtitle}</span>
          <h4 class="product-title">${data.title}</h4>
          <p class="product-description">${separatorInfo ? separatorInfo : ""}${
        data.description
      }</p>
          ${
            installationText
              ? `<div class="installation-note"><strong>Sposób montażu:</strong> ${installationText}</div>`
              : ""
          }
          <div class="specs-list">
            <div class="spec-row">
              <span class="spec-label">Pojemność</span>
              <span class="spec-value">${capacity} L</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Wymiary</span>
              <span class="spec-value">${data.dimensions}</span>
            </div>
          </div>
          <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
        </div>
      </button>
    `;
    }

    // Renderuje sekcję bufora CO z kartami
    function renderBufferSection(recommendedCapacity, allowZero = false) {
      const capacities = [50, 100, 200];
      let cards = "";

      capacities.forEach((capacity) => {
        const isRecommended = capacity === recommendedCapacity;
        cards += renderBufferCard(capacity, isRecommended, allowZero);
      });

      // Opcja "Bez bufora" tylko jeśli allowZero
      if (allowZero && recommendedCapacity === 0) {
        cards += `
        <button type="button" class="product-card ui-option" data-option-id="buffer-0">
          <div class="product-content">
            <span class="product-subtitle">Opcja specjalna</span>
            <h4 class="product-title">Bez bufora</h4>
            <p class="product-description">Tylko dla specyficznych instalacji po konsultacji.</p>
            <div class="specs-list">
              <div class="spec-row">
                <span class="spec-label">Uwaga</span>
                <span class="spec-value">Wymaga konsultacji</span>
              </div>
            </div>
            <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
          </div>
        </button>
      `;
      }

      return cards;
    }

    /* ==========================================================================
     HYDRAULICS INPUTS STEP (UI) — zapis do sessionStorage.config_data.hydraulics_inputs
     ========================================================================== */

    function renderHydraulicsInputsGrid() {
      const heating_type = normalizeHeatingType(
        state?.meta?.heating_type ||
          state?.meta?.installation_type ||
          "radiators"
      );
      const inputs = getHydraulicsInputs();

      const showUnderfloorActuators =
        heating_type === "underfloor" || heating_type === "mixed";
      const showRadiatorsHT =
        heating_type === "radiators" || heating_type === "mixed";

      const underfloorActuatorsCard = showUnderfloorActuators
        ? `
        <div class="form-field-item">
          <label class="form-label">Siłowniki / sterowanie strefowe</label>
          <div class="form-field">
            <label style="display:flex;gap:12px;align-items:flex-start;cursor:pointer;">
              <input id="hydraulics-has-underfloor-actuators" type="checkbox" style="margin-top:4px;width:20px;height:20px;flex-shrink:0;" ${
                inputs.has_underfloor_actuators ? "checked" : ""
              } />
            <span>
              Czy masz siłowniki / termostaty pokojowe sterujące pętlami podłogówki?
                <p class="micro-note" style="margin: 8px 0 0 0;">
                Jeśli instalacja może się „zamknąć”, potrzebujesz ochrony minimalnego przepływu.
                </p>
            </span>
          </label>
          </div>
        </div>
      `
        : "";

      const radiatorsHTCard = showRadiatorsHT
        ? `
        <div class="form-field-item">
          <label class="form-label">Grzejniki wysokotemperaturowe (HT)</label>
          <div class="form-field">
            <label style="display:flex;gap:12px;align-items:flex-start;cursor:pointer;">
              <input id="hydraulics-radiators-is-ht" type="checkbox" style="margin-top:4px;width:20px;height:20px;flex-shrink:0;" ${
                inputs.radiators_is_ht ? "checked" : ""
              } />
                <span>
                  Grzejniki starszego typu (wysokotemperaturowe)?
                <p class="micro-note" style="margin: 8px 0 0 0;">
                    TODO: podmienić obrazek HT na właściwy asset.
                </p>
                </span>
              </label>
          </div>
        </div>
      `
        : "";

      const bivalentCard = `
      <div class="form-field-item">
        <label class="form-label">Biwalencja</label>
        <div class="form-field">
          <label style="display:flex;gap:12px;align-items:flex-start;cursor:pointer;margin-bottom:16px;">
            <input id="hydraulics-bivalent-enabled" type="checkbox" style="margin-top:4px;width:20px;height:20px;flex-shrink:0;" ${
              inputs.bivalent_enabled ? "checked" : ""
            } />
          <span>Czy instalacja ma drugie źródło ciepła?</span>
        </label>
          <div id="hydraulics-bivalent-type-wrap" class="form-field-item form-field-item--subsequent" style="${
            inputs.bivalent_enabled ? "" : "display:none;"
          }">
            <label for="hydraulics-bivalent-source-type" class="form-label">Typ drugiego źródła</label>
            <select id="hydraulics-bivalent-source-type" class="form-select">
            <option value="" ${
              inputs.bivalent_source_type ? "" : "selected"
            }>— wybierz —</option>
            <option value="gas" ${
              inputs.bivalent_source_type === "gas" ? "selected" : ""
            }>Gaz</option>
            <option value="solid_fuel" ${
              inputs.bivalent_source_type === "solid_fuel" ? "selected" : ""
            }>Kocioł stałopalny (węgiel/pellet/drewno)</option>
            <option value="fireplace_water_jacket" ${
              inputs.bivalent_source_type === "fireplace_water_jacket"
                ? "selected"
                : ""
            }>Kominek z płaszczem wodnym</option>
          </select>
            <p class="micro-note" style="margin: 8px 0 0 0;">
            Dla stałopalnych/kominka bufor i sprzęgło są wymagane (bezpieczeństwo).
            </p>
            <div id="hydraulics-bivalent-power-wrap" class="form-field-item form-field-item--subsequent" style="${
              inputs.bivalent_enabled &&
              (inputs.bivalent_source_type === "solid_fuel" ||
                inputs.bivalent_source_type === "fireplace_water_jacket")
                ? ""
                : "display:none;"
            }">
              <label for="hydraulics-bivalent-source-power" class="form-label">
                Moc drugiego źródła [kW]
              </label>
              <input
                type="number"
                id="hydraulics-bivalent-source-power"
                class="form-input"
                min="1"
                max="50"
                step="0.5"
                value="${
                  inputs.bivalent_source_power_kw != null
                    ? inputs.bivalent_source_power_kw
                    : ""
                }"
                placeholder="—"
              />
              <p class="micro-note" style="margin: 8px 0 0 0;">
                Podaj moc kotła/kominka. Jeśli nie wiesz — zostaw puste, przyjmiemy bezpieczną wartość.
              </p>
            </div>
          </div>
        </div>
      </div>
    `;

      return `
      <div class="form-row-mosaic form-card">
        ${underfloorActuatorsCard}
        ${radiatorsHTCard}
        ${bivalentCard}
      </div>
    `;
    }

    function bindHydraulicsInputsHandlers() {
      const hasActuatorsEl = dom.byId("hydraulics-has-underfloor-actuators");
      const radiatorsIsHtEl = dom.byId("hydraulics-radiators-is-ht");
      const bivalentEnabledEl = dom.byId("hydraulics-bivalent-enabled");
      const bivalentTypeWrapEl = dom.byId("hydraulics-bivalent-type-wrap");
      const bivalentSourceEl = dom.byId("hydraulics-bivalent-source-type");

      if (hasActuatorsEl) {
        trackEvent(hasActuatorsEl, "change", () => {
          setHydraulicsInputs({
            has_underfloor_actuators: !!hasActuatorsEl.checked,
          });
          requestRecompute();
        });
      }
      if (radiatorsIsHtEl) {
        trackEvent(radiatorsIsHtEl, "change", () => {
          setHydraulicsInputs({ radiators_is_ht: !!radiatorsIsHtEl.checked });
          requestRecompute();
        });
      }
      if (bivalentEnabledEl) {
        trackEvent(bivalentEnabledEl, "change", () => {
          const enabled = !!bivalentEnabledEl.checked;
          const currentType = enabled
            ? getHydraulicsInputs().bivalent_source_type || null
            : null;
          setHydraulicsInputs({
            bivalent_enabled: enabled,
            bivalent_source_type: currentType,
            bivalent_source_power_kw: enabled ? getHydraulicsInputs().bivalent_source_power_kw : null,
          });
          if (bivalentTypeWrapEl) {
            bivalentTypeWrapEl.style.display = enabled ? "" : "none";
          }
          // Pokaż/ukryj pole mocy
          const powerWrapEl = dom.byId("hydraulics-bivalent-power-wrap");
          if (powerWrapEl) {
            powerWrapEl.style.display =
              enabled &&
              (currentType === "solid_fuel" ||
                currentType === "fireplace_water_jacket")
                ? ""
                : "none";
          }
          requestRecompute();
        });
      }
      if (bivalentSourceEl) {
        trackEvent(bivalentSourceEl, "change", () => {
          const v = bivalentSourceEl.value || null;
          setHydraulicsInputs({ bivalent_source_type: v });

          // Pokaż/ukryj pole mocy w zależności od typu
          const powerWrapEl = dom.byId("hydraulics-bivalent-power-wrap");
          if (powerWrapEl) {
            powerWrapEl.style.display =
              v === "solid_fuel" || v === "fireplace_water_jacket" ? "" : "none";
          }

          // Jeśli typ nie wymaga mocy, wyczyść wartość
          if (v !== "solid_fuel" && v !== "fireplace_water_jacket") {
            setHydraulicsInputs({ bivalent_source_power_kw: null });
          }

          requestRecompute();
        });
      }

      const bivalentPowerEl = dom.byId("hydraulics-bivalent-source-power");
      if (bivalentPowerEl) {
        trackEvent(bivalentPowerEl, "input", () => {
          const v = bivalentPowerEl.value;
          const numValue = v === "" ? null : Number(v);
          // Walidacja: min 1, max 50, lub null jeśli puste
          const validatedValue =
            numValue == null
              ? null
              : isNaN(numValue)
              ? null
              : Math.max(1, Math.min(50, numValue));
          setHydraulicsInputs({ bivalent_source_power_kw: validatedValue });
          requestRecompute();
        });
      }
    }

    function renderHydraulicsInputsStep() {
      const grid = dom.byId("hydraulics-inputs-grid");
      if (!grid) return;
      grid.innerHTML = renderHydraulicsInputsGrid();
      bindHydraulicsInputsHandlers();
    }

    /* ==========================================================================
     HYDRAULICS CO RENDERING (UI) — renderuje WYŁĄCZNIE z hydraulicsRecommendation
     ========================================================================== */

    function renderHydraulicsCOCard(hr) {
      if (!hr) return "";

      const badge =
        hr.severity === "MANDATORY"
          ? '<span class="badge-recommended">WYMAGANE</span>'
          : hr.severity === "RECOMMENDED"
          ? '<span class="badge-recommended">ZALECANE</span>'
          : '<span class="badge-recommended">INFO</span>';

      const pumpOptionIdLegacy = state?.selectedPump?.optionId || null;
      const pumpDataLegacy = pumpOptionIdLegacy
        ? pumpMatchingTable[pumpOptionIdLegacy]
        : null;
      const pumpPowerLegacy = Number(
        pumpDataLegacy?.power || state?.selectedPump?.power_kw || 0
      );
      const separatorSizeClass =
        pumpPowerLegacy < 7
          ? "small"
          : pumpPowerLegacy < 15
          ? "medium"
          : "large";

      let optionId = "hydraulics-none";
      let title = "Brak bufora i sprzęgła";
      let subtitle =
        "Najlepsza instalacja to taka, która nie potrzebuje „protezy”";

      if (hr.recommendation === "BUFOR_SZEREGOWO") {
        optionId = `buffer-${hr.buffer_liters || 0}`;
        title = `Bufor szeregowo ${hr.buffer_liters || "—"} L`;
        subtitle = "Szeregowo z zaworem różnicowym na by-passie";
      } else if (hr.recommendation === "BUFOR_RÓWNOLEGLE") {
        optionId = `buffer-${hr.buffer_liters || 0}`;
        title = `Bufor równolegle ${hr.buffer_liters || "—"} L`;
        subtitle = "Sprzęgło hydrauliczne (separacja obiegów)";
      }

      return `
      <button type="button" class="product-card ui-option" data-option-id="${optionId}">
        <div class="product-content">
          ${badge}
          <span class="product-subtitle">${subtitle}</span>
          <h4 class="product-title">${title}</h4>
          <p class="product-description">${hr.explanation?.short || ""}</p>
          <div class="specs-list">
            <div class="spec-row">
              <span class="spec-label">Oś: przepływ</span>
              <span class="spec-value">${hr.axes?.flow_protection || "—"}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Oś: separacja</span>
              <span class="spec-value">${
                hr.axes?.hydraulic_separation || "—"
              }</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Oś: magazyn</span>
              <span class="spec-value">${hr.axes?.energy_storage || "—"}</span>
            </div>
          </div>
          <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
        </div>
      </button>
    `;
    }

    function renderHydraulicsCOSectionFromRecommendation(hr) {
      const bufferStep = dom.qs('[data-step-key="bufor"]');
      if (!bufferStep) return;
      const optionsGrid = bufferStep.querySelector(".options-grid");
      if (!optionsGrid) return;

      // ✅ Renderuj TYLKO jedną kartę zgodnie z rekomendacją logiki bufora
      const recommendedCapacity = hr.buffer_liters || 0;
      let cards = "";

      // Decyzja na podstawie rekomendacji (NOWE: 3 typy)
      if (hr.recommendation === "NONE" || recommendedCapacity === 0) {
        // Brak bufora - renderuj kartę "Bez bufora" z informacjami o korzyściach
        cards = `
        <button type="button" class="product-card ui-option" data-option-id="buffer-0">
          <div class="product-image">
            <img src="${
              config?.imgUrl || "../img"
            }/dom.png" alt="Instalacja bez bufora" />
            <span class="badge-recommended">✓ Optymalne rozwiązanie</span>
          </div>
          <div class="product-content">
            <span class="product-subtitle">Rekomendacja systemu</span>
            <h4 class="product-title">Bufor nie wymagany</h4>
            <p class="product-description">
              System nie wykrył potrzeby zastosowania bufora w Twojej instalacji.
              Zład własny instalacji jest wystarczający do stabilnej pracy pompy i poprawnego defrostu.
            </p>
            <div class="installation-note">
              <strong>Korzyści instalacji bez bufora:</strong>
              <ul style="margin: 8px 0 0 0; padding-left: 20px; color: var(--color-text-secondary);">
                <li>Niższe koszty inwestycyjne - brak dodatkowego komponentu</li>
                <li>Prostsza instalacja - mniej elementów do montażu</li>
                <li>Mniejsze straty ciepła - brak dodatkowego zbiornika</li>
                <li>Mniejsza przestrzeń wymagana w maszynowni</li>
                <li>Wyższa sprawność systemu - bezpośrednie połączenie pompy z odbiornikami</li>
              </ul>
            </div>
            <div class="specs-list">
              <div class="spec-row">
                <span class="spec-label">Uzasadnienie</span>
                <span class="spec-value">${
                  hr.dominantReason || "Zład wystarczający"
                }</span>
              </div>
            </div>
            <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
          </div>
        </button>
      `;
      } else if (
        hr.recommendation === "BUFOR_SZEREGOWO" &&
        recommendedCapacity > 0
      ) {
        // Bufor szeregowo - renderuj kartę z buforem (szeregowo z by-passem)
        cards = renderBufferCard(
          recommendedCapacity,
          true,
          false,
          null, // separatorInfo - nie potrzebny dla szeregowo
          "SERIES_BYPASS",
          null
        );
      } else if (
        hr.recommendation === "BUFOR_RÓWNOLEGLE" &&
        recommendedCapacity > 0
      ) {
        // Bufor równolegle - renderuj kartę z buforem (sprzęgło hydrauliczne)
        cards = renderBufferCard(
          recommendedCapacity,
          true,
          false,
          null, // separatorInfo - nie potrzebny, sposób montażu jest w installationNote
          "PARALLEL_CLUTCH",
          null
        );
      } else {
        // Fallback - jeśli nie ma jasnej rekomendacji, użyj rekomendowanej pojemności
        if (recommendedCapacity > 0) {
          cards = renderBufferCard(recommendedCapacity, true, false);
        } else {
          // Jeśli brak pojemności, pokaż "Bez bufora"
          cards = `
          <button type="button" class="product-card ui-option" data-option-id="buffer-0">
            <div class="product-content">
              <span class="product-subtitle">Opcja specjalna</span>
              <h4 class="product-title">Bez bufora</h4>
              <p class="product-description">Zbiornik buforowy nie jest wymagany - stabilna praca pompy ciepła bez zbiornika buforowego.</p>
              <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
            </div>
          </button>
        `;
        }
      }

      optionsGrid.innerHTML = cards;
      // Usuń grid-3-col, bo mamy tylko jedną kartę
      optionsGrid.classList.remove("grid-3-col");

      // ═══════════════════════════════════════════════════════════════════════════
      // 📊 KROK 3: BUFOR CO — Szczegółowe logowanie
      // ═══════════════════════════════════════════════════════════════════════════
      if (debug.__DEBUG_CONFIGURATOR) {
        if (hr.sizing) {
        }

        if (hr.recommendation === "NONE") {
        } else if (hr.recommendation === "BUFOR_SZEREGOWO") {
        } else if (hr.recommendation === "BUFOR_RÓWNOLEGLE") {
        }
      }

      // ❌ USUNIĘTO: Auto-wybieranie rekomendowanej karty - użytkownik musi sam wybrać
      // ✅ Przywróć wybór użytkownika jeśli istnieje
      const existingBufferSelection = state.selections.bufor;
      if (existingBufferSelection && existingBufferSelection.optionId) {
        const selectedCard = optionsGrid.querySelector(
          `[data-option-id="${existingBufferSelection.optionId}"]`
        );
        if (selectedCard) {
          selectedCard.classList.add("selected");
          // NIE wywołuj captureSelectionForCard - selekcja już jest w state
        }
      }

      // ✅ Przenieś recommendation-note do section-description (jak w kroku 1)
      const sectionDescription = bufferStep.querySelector(
        ".section-description"
      );
      if (sectionDescription) {
        // Usuń istniejące recommendation-note jeśli istnieje
        const existingNote = bufferStep.querySelector(".recommendation-note");
        if (existingNote) {
          existingNote.remove();
        }

        let descriptionText = "";

        if (hr.recommendation === "BUFOR_SZEREGOWO") {
          descriptionText = `Z uwagi na ryzyko automatycznego zamknięcia obiegu (sterowniki pokojowe) → WYMAGANY zbiornik buforowy. System dopasował: bufor wpięty w instalację szeregowo - podłączenie na powrocie z instalacji + by-pass "krótki obieg" z zaworem różnicy ciśnień.`;
        } else if (hr.recommendation === "BUFOR_RÓWNOLEGLE") {
          descriptionText = `System rekomenduje zbiornik buforowy ${recommendedCapacity}L — separacja obiegów/źródeł + magazyn energii.`;
        } else {
          descriptionText =
            "Zbiornik buforowy nie jest wymagany - stabilna praca pompy ciepła bez zbiornika buforowego.";
        }

        sectionDescription.textContent = descriptionText;
      }
    }

    // Renderuje kartę cyrkulacji CWU
    function renderCirculationCard(type, isRecommended = false) {
      const data = {
        tak: {
          subtitle: "Komfort",
          title: "Z cyrkulacją CWU",
          description: "Ciepła woda natychmiast w każdym punkcie poboru.",
          specs: [
            { label: "Czas oczekiwania", value: "< 3 sek" },
            { label: "Pobór mocy", value: "5-8 W" },
          ],
          price: 1800,
          optionId: "cyrkulacja-tak",
        },
        nie: {
          subtitle: "Standard",
          title: "Bez cyrkulacji",
          description: "Klasyczna instalacja bez dodatkowej cyrkulacji.",
          specs: [
            { label: "Czas oczekiwania", value: "Zależny od odległości" },
          ],
          price: 0,
          optionId: "cyrkulacja-nie",
        },
      };

      const cardData = data[type];
      if (!cardData) return "";

      const selectedClass = isRecommended ? "selected" : "";
      const recommendedBadge = isRecommended
        ? '<span class="badge-recommended">★ Rekomendowane</span>'
        : "";
      const priceStr =
        cardData.price > 0 ? cardData.price.toLocaleString("pl-PL") : "0";

      return `
      <button type="button" class="product-card ui-option ${selectedClass}" data-option-id="${
        cardData.optionId
      }">
        <div class="product-content">
          ${recommendedBadge}
          <span class="product-subtitle">${cardData.subtitle}</span>
          <h4 class="product-title">${cardData.title}</h4>
          <p class="product-description">${cardData.description}</p>
          <div class="specs-list">
            ${cardData.specs
              .map(
                (spec) => `
              <div class="spec-row">
                <span class="spec-label">${spec.label}</span>
                <span class="spec-value">${spec.value}</span>
              </div>
            `
              )
              .join("")}
          </div>
          <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
        </div>
      </button>
    `;
    }

    // Renderuje sekcję cyrkulacji CWU
    function renderCirculationSection() {
      const withCard = renderCirculationCard("tak", false);
      const withoutCard = renderCirculationCard("nie", true);
      return withCard + withoutCard;
    }

    // Renderuje kartę Service Cloud (Premium)
    function renderServiceCard() {
      return `
      <button type="button" class="product-card ui-option" data-option-id="service-cloud">
        <div class="product-content">
          <span class="badge-recommended">★ Rekomendowane</span>
          <span class="product-subtitle">Pełna obsługa 24/7</span>
          <h4 class="product-title">Service Cloud Premium</h4>
          <p class="product-description">Monitoring, diagnostyka i priorytetowy serwis.</p>
          <div class="specs-list">
            <div class="spec-row">
              <span class="spec-label">Monitoring</span>
              <span class="spec-value">24/7</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Reakcja serwisu</span>
              <span class="spec-value">< 24h</span>
            </div>
          </div>
          <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
        </div>
      </button>
    `;
    }

    // Renderuje kartę posadowienia
    function renderFoundationCard(type, isRecommended = false) {
      const data = {
        grunt: {
          subtitle: "Montaż naziemny",
          title: "Stopa betonowa",
          description:
            "Klasyczne posadowienie na przygotowanej stopie betonowej.",
          specs: [{ label: "Wymiary stopy", value: "80×80 cm" }],
          price: 1200,
          optionId: "posadowienie-grunt",
        },
        sciana: {
          subtitle: "Montaż na ścianie",
          title: "Konsola ścienna",
          description: "Oszczędność miejsca, montaż na elewacji budynku.",
          specs: [{ label: "Izolacja", value: "Akustyczna" }],
          price: 1600,
          optionId: "posadowienie-sciana",
        },
        dach: {
          subtitle: "Montaż na dachu",
          title: "Konstrukcja dachowa",
          description: "Dla dachów płaskich, rama stalowa z matami.",
          specs: [{ label: "Konstrukcja", value: "Stalowa" }],
          price: 2400,
          optionId: "posadowienie-dach",
        },
      };

      const cardData = data[type];
      if (!cardData) return "";

      const selectedClass = isRecommended ? "selected" : "";
      const recommendedBadge = isRecommended
        ? '<span class="badge-recommended">★ Rekomendowane</span>'
        : "";

      return `
      <button type="button" class="product-card ui-option ${selectedClass}" data-option-id="${
        cardData.optionId
      }">
        <div class="product-content">
          ${recommendedBadge}
          <span class="product-subtitle">${cardData.subtitle}</span>
          <h4 class="product-title">${cardData.title}</h4>
          <p class="product-description">${cardData.description}</p>
          <div class="specs-list">
            ${cardData.specs
              .map(
                (spec) => `
              <div class="spec-row">
                <span class="spec-label">${spec.label}</span>
                <span class="spec-value">${spec.value}</span>
              </div>
            `
              )
              .join("")}
          </div>
          <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
          <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
        </div>
      </button>
    `;
    }

    // Renderuje sekcję posadowienia
    function renderFoundationSection() {
      const gruntCard = renderFoundationCard("grunt", true);
      const scianaCard = renderFoundationCard("sciana", false);
      const dachCard = renderFoundationCard("dach", false);
      return gruntCard + scianaCard + dachCard;
    }

    // Renderuje kartę reduktora ciśnienia
    function renderReducerCard(isRecommended = false) {
      const selectedClass = isRecommended ? "selected" : "";
      const recommendedBadge = isRecommended
        ? '<span class="badge-recommended">★ Rekomendowane</span>'
        : "";

      return `
      <button type="button" class="product-card ui-option ${selectedClass}" data-option-id="reduktor-tak">
        <div class="product-content">
          ${recommendedBadge}
          <span class="product-subtitle">Zalecane przy >4 bar</span>
          <h4 class="product-title">Z reduktorem ciśnienia</h4>
          <p class="product-description">Reduktor nastawny z manometrem i filtrem.</p>
          <div class="specs-list">
            <div class="spec-row">
              <span class="spec-label">Zakres</span>
              <span class="spec-value">1-6 bar</span>
            </div>
          </div>
          <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
        </div>
      </button>
    `;
    }

    // Renderuje sekcję reduktora ciśnienia
    function renderReducerSection() {
      return renderReducerCard(false);
    }

    // Renderuje kartę stacji uzdatniania wody
    function renderWaterStationCard(type, isRecommended = false) {
      const data = {
        kompleksowa: {
          subtitle: "Filtracja + zmiękczanie",
          title: "Stacja kompleksowa",
          description: "Pełne uzdatnianie wody dla maksymalnej ochrony.",
          specs: [{ label: "Funkcje", value: "Zmiękczanie + filtracja" }],
          price: 4200,
          optionId: "woda-tak",
        },
        podstawowa: {
          subtitle: "Filtr mechaniczny",
          title: "Filtracja podstawowa",
          description: "Podstawowa ochrona przed zanieczyszczeniami.",
          specs: [{ label: "Filtracja", value: "50 μm" }],
          price: 320,
          optionId: "woda-filtr",
        },
        brak: {
          subtitle: "Przy dobrej jakości wody",
          title: "Bez uzdatniania",
          description: "Gdy woda miejska nie wymaga uzdatniania.",
          specs: [{ label: "Wymaga", value: "Analizy wody" }],
          price: 0,
          optionId: "woda-nie",
        },
      };

      const cardData = data[type];
      if (!cardData) return "";

      const selectedClass = isRecommended ? "selected" : "";
      const recommendedBadge = isRecommended
        ? '<span class="badge-recommended">★ Rekomendowane</span>'
        : "";

      return `
      <button type="button" class="product-card ui-option ${selectedClass}" data-option-id="${
        cardData.optionId
      }">
        <div class="product-content">
          ${recommendedBadge}
          <span class="product-subtitle">${cardData.subtitle}</span>
          <h4 class="product-title">${cardData.title}</h4>
          <p class="product-description">${cardData.description}</p>
          <div class="specs-list">
            ${cardData.specs
              .map(
                (spec) => `
              <div class="spec-row">
                <span class="spec-label">${spec.label}</span>
                <span class="spec-value">${spec.value}</span>
              </div>
            `
              )
              .join("")}
          </div>
          <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
        </div>
      </button>
    `;
    }

    // Renderuje sekcję stacji uzdatniania wody
    function renderWaterStationSection() {
      const kompleksowaCard = renderWaterStationCard("kompleksowa", false);
      const podstawowaCard = renderWaterStationCard("podstawowa", true);
      const brakCard = renderWaterStationCard("brak", false);
      return kompleksowaCard + podstawowaCard + brakCard;
    }

    /* ==========================================================================
     POPULATE WITH CALCULATOR DATA (z configurator-new.js + rozszerzone)
     ========================================================================== */

    async function populateConfiguratorWithCalculatorData(options = {}) {
      const appSnapshot =
        typeof getAppState === "function" ? getAppState() : null;
      const calcData =
        options.building || options || appSnapshot?.lastCalculationResult;
      if (!calcData) {
        // To jest normalna sytuacja przy pierwszym załadowaniu strony (przed wykonaniem obliczeń)
        // Nie logujemy jako błąd, tylko jako informację
        if (debug.__DEBUG_CONFIGURATOR) {
        }
        return;
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // 📊 LOGOWANIE DANYCH PRZEKAZANYCH DO KONFIGURATORA
      // ═══════════════════════════════════════════════════════════════════════════

      // Logowanie zarekomendowanej pompy (jeśli dostępna)
      if (calcData.pump_selection) {
        const ps = calcData.pump_selection;
      } else {
        console.warn("⚠️ BRAK DANYCH: pump_selection nie jest dostępne");
        console.warn(
          "   Przyczyna: Kalkulator nie dobrał pompy lub nie przekazał wyników"
        );
      }

      // ✅ PRZYWRÓĆ STAN KONFIGURATORA jeśli istnieje (z sessionStorage)
      const savedState = loadConfiguratorState();
      const hasRestoredState =
        savedState && Object.keys(savedState.selections || {}).length > 0;
      if (hasRestoredState) {
        // Tymczasowo zapisz meta (będzie nadpisane poniżej, ale potrzebne do restoreConfiguratorState)
        const tempMeta = state.meta;
        state.meta = savedState.meta || tempMeta;
        restoreConfiguratorState(savedState);
        // Meta zostanie zaktualizowane poniżej z calcData
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // OZC SINGLE SOURCE OF TRUTH — DO NOT DERIVE POWER ELSEWHERE
      // ═══════════════════════════════════════════════════════════════════════════
      // ARCHITECTURAL: max_heating_power is canonical from OZCEngine.designHeatLoss_kW
      // recommended_power_kw MUST equal max_heating_power (heating only, no CWU)
      // power_total_kw = max_heating_power + hot_water_power (for sizing, not selection)
      // ═══════════════════════════════════════════════════════════════════════════
      // Zapisz meta w state
      // NOTE: W trybie local/quickscenario część pól CWU może żyć w calcData.parameters (payload wejściowy),
      // a nie w root obiekcie wyniku. Bez tego CWU bywa błędnie skipowane jako "brak".
      const params =
        (calcData && (calcData.parameters || calcData.payload || calcData.input || null)) ||
        (typeof window !== "undefined" && window.lastSentPayload) ||
        {};

      const includeHotRaw =
        calcData.include_hot_water !== undefined
          ? calcData.include_hot_water
          : params.include_hot_water;
      const includeHot =
        includeHotRaw === true ||
        includeHotRaw === "yes" ||
        includeHotRaw === "true" ||
        includeHotRaw === 1 ||
        includeHotRaw === "1";

      const hotWaterPersonsRaw =
        calcData.hot_water_persons !== undefined
          ? calcData.hot_water_persons
          : params.hot_water_persons;
      const hotWaterPersons = Number(hotWaterPersonsRaw || 0) || 0;

      const hotWaterUsage =
        calcData.hot_water_usage !== undefined
          ? calcData.hot_water_usage
          : params.hot_water_usage;

      state.meta = {
        max_heating_power: calcData.max_heating_power, // CANONICAL: from OZC
        hot_water_power: calcData.hot_water_power,
        recommended_power_kw:
          calcData.recommended_power_kw || calcData.max_heating_power, // MUST equal max_heating_power
        power_total_kw:
          (calcData.max_heating_power || 0) + (calcData.hot_water_power || 0), // For sizing only
        heated_area: calcData.heated_area,
        total_area: calcData.total_area,
        heating_type: calcData.heating_type || calcData.installation_type,
        installation_type: calcData.heating_type || calcData.installation_type,
        include_hot_water: includeHot,
        hot_water_persons: hotWaterPersons,
        cwu_people: hotWaterPersons,
        hot_water_usage: hotWaterUsage,
        cwu_profile: hotWaterUsage,
        building_type: calcData.building_type,
        building_year: calcData.building_year || calcData.construction_year,
        construction_year: calcData.building_year || calcData.construction_year,
        construction_type: calcData.construction_type,
        indoor_temperature: calcData.indoor_temperature,
        heat_source_prev: calcData.heat_source_prev || calcData.source_type,
        generation: "K",
      };

      // Przygotuj profile pomp
      const pumpProfiles = preparePumpProfiles(state.meta);
      if (pumpProfiles.length === 0) {
        console.warn(
          "[Configurator] Brak profili pomp - sprawdzam czy to przypadek >25kW"
        );
        // Jeśli moc >= 25kW, ukryj konfigurator i wyświetl komunikat w profilu energetycznym
        if (state.meta.recommended_power_kw >= 25) {
          // Scope do root elementu (jeśli dostępny)
          const rootElement =
            options.rootElement ||
            dom.qs("#configurator-app")?.closest('[id*="configurator"]') ||
            root;
          const configuratorView =
            rootElement.querySelector("#configurator-view") ||
            rootElement.querySelector("#configurator-app");
          if (configuratorView) {
            configuratorView.innerHTML = `
            <div class="glass-box" style="padding: 40px; text-align: center;">
              <h2 style="color: #8b6914; margin-bottom: 20px;">⚠️ Obsługa niedostępna</h2>
              <p style="font-size: 1.1em; line-height: 1.6;">
                Obsługa budynków o mocy w temp. projektowej większej niż 25kW niedostępna.
              </p>
              <p style="margin-top: 20px; color: #666;">
                Zalecamy termomodernizację budynku przed doborem pompy ciepła.
              </p>
            </div>
          `;
          }
          return;
        }
        console.warn("[Configurator] Brak profili pomp - używam fallback");
        return;
      }

      // Scope do root elementu (jeśli dostępny)
      const rootElement =
        options.rootElement || dom.qs("#configurator-app") || root;

      // Renderuj sekcję pompy z pełnymi kartami
      const pumpStep = rootElement.querySelector('[data-step-key="pompa"]');
      if (pumpStep) {
        const optionsGrid = pumpStep.querySelector(".options-grid");
        if (optionsGrid) {
          // Renderuj karty dynamicznie
          const splitProfile =
            pumpProfiles.find((p) => p.type === "split" && p.id === "hp") ||
            pumpProfiles[0];
          const aioProfile = pumpProfiles.find(
            (p) => p.type === "all-in-one" && p.id === "aio"
          );

          // Załaduj panasonic.json jeśli jeszcze nie załadowany
          if (!panasonicDB) {
            await loadPanasonicDB();
          }

          const splitData = getPumpDataFromDB(splitProfile.model);
          const aioData = aioProfile
            ? getPumpDataFromDB(aioProfile.model)
            : null;

          const splitCard = renderPumpCard(splitProfile, splitData, true);
          const aioCard =
            aioProfile && !aioProfile.disabled
              ? renderPumpCard(aioProfile, aioData, false)
              : "";

          optionsGrid.innerHTML = splitCard + aioCard;

          // ═══════════════════════════════════════════════════════════════════════════
          // 📊 KROK 1: POMPA CIEPŁA — Szczegółowe logowanie
          // ═══════════════════════════════════════════════════════════════════════════
          if (debug.__DEBUG_CONFIGURATOR) {
            if (aioProfile && !aioProfile.disabled) {
            } else {
            }
          }

          // ❌ USUNIĘTO: Auto-wybieranie rekomendowanej karty - użytkownik musi sam wybrać
          if (hasRestoredState) {
            // ✅ Jeśli przywrócono stan, zaktualizuj tylko panasonicData dla wybranej pompy
            if (state.selectedPump && state.selectedPump.model) {
              const pumpData = getPumpDataFromDB(state.selectedPump.model);
              if (pumpData) {
                state.selectedPump.panasonicData = pumpData;
              }
            }
          }

          // Aktualizuj treści dla KROKU 1 - POMPA CIEPŁA
          const heatDemand = state.meta?.max_heating_power || null;
          const recommendedPumpPower =
            splitProfile?.power || aioProfile?.power || null;
          const sectionDescription = pumpStep.querySelector(
            ".section-description"
          );

          // Usuń istniejące recommendation-note jeśli istnieje
          const existingNote = pumpStep.querySelector(".recommendation-note");
          if (existingNote) {
            existingNote.remove();
          }

          if (heatDemand && recommendedPumpPower) {
            // Mamy zapotrzebowanie i rekomendowaną moc znamionową pompy
            if (sectionDescription) {
              const descriptionText = `Szacunkowe zapotrzebowanie cieplne Twojego budynku w temperaturze projektowej wynosi ${heatDemand.toFixed(
                2
              )} kW. System rekomenduje pompę ciepła o mocy znamionowej ${recommendedPumpPower} kW jako optymalne rozwiązanie pod kątem komfortu, kosztów i żywotności urządzenia.`;
              sectionDescription.textContent = descriptionText;
            }
          } else if (heatDemand) {
            // Mamy tylko zapotrzebowanie
            if (sectionDescription) {
              sectionDescription.textContent = `Szacunkowe zapotrzebowanie cieplne Twojego budynku w temperaturze projektowej wynosi ${heatDemand.toFixed(
                2
              )} kW. Wybierz preferowany model pompy ciepła.`;
            }
          } else {
            // Brak danych
            if (sectionDescription) {
              sectionDescription.textContent =
                "Na podstawie obliczeń rekomendujemy pompę o odpowiedniej mocy. Wybierz preferowany model.";
            }
          }
        }
      }

      // ✅ Jeśli przywrócono stan, NIE nadpisuj selekcji - tylko zaktualizuj meta i przelicz
      // hasRestoredState jest już zdefiniowane wyżej (linia 4117)

      // Przelicz reguły przed auto-wyborem
      const evaluated = evaluateRules();

      // ═══════════════════════════════════════════════════════════════════════════
      // 📊 LOGOWANIE WYNIKÓW DOBORU KOMPONENTÓW
      // ═══════════════════════════════════════════════════════════════════════════

      if (!evaluated) {
        console.error("❌ BŁĄD: evaluateRules() zwróciło null/undefined");
        console.error(
          "   Przyczyna: Nie udało się obliczyć reguł doboru komponentów"
        );
        console.error(
          "   Rozwiązanie: Sprawdź czy state.meta jest poprawnie wypełnione"
        );
      } else {
        // 1. Dobrana pojemność CWU
        if (evaluated.cwuRules) {
          if (evaluated.cwuRules.skip) {
          } else if (evaluated.cwuRules.recommendedCapacity) {
          } else {
            console.warn("⚠️ Zasobnik CWU: Brak rekomendowanej pojemności");
            console.warn("   Szczegóły cwuRules:", evaluated.cwuRules);
          }
        } else {
          console.error(
            "❌ Zasobnik CWU: Nie udało się obliczyć reguł (evaluated.cwuRules jest null)"
          );
        }

        // 2. Dobrany bufor i pojemność
        if (evaluated.bufferRules) {
          const bufferRules = evaluated.bufferRules;
          const hydraulicsRec = bufferRules.hydraulicsRecommendation || null;

          if (bufferRules.required) {
            const bufferLiters =
              hydraulicsRec?.buffer_liters ||
              bufferRules.recommendedCapacity ||
              null;
            const bufferType =
              hydraulicsRec?.type || bufferRules.type || "unknown";

            if (!bufferLiters) {
              console.warn(
                "⚠️ Bufor wymagany, ale brak rekomendowanej pojemności"
              );
              console.warn("   Szczegóły bufferRules:", bufferRules);
              console.warn(
                "   Szczegóły hydraulicsRecommendation:",
                hydraulicsRec
              );
            }
          } else {
          }
        } else {
          console.error(
            "❌ Bufor CO: Nie udało się obliczyć reguł (evaluated.bufferRules jest null)"
          );
        }
      }

      // Krok: pytania instalacyjne (sessionStorage.config_data.hydraulics_inputs)
      renderHydraulicsInputsStep();

      // Renderuj karty CWU dynamicznie
      if (evaluated && evaluated.cwuRules.skip) {
        // ✅ NOWA LOGIKA: Ukryj sekcję i ustaw "brak" w sticky bar
        const cwuStep = dom.qs('[data-step-key="cwu"]');
        if (cwuStep) {
          cwuStep.style.display = "none";
          cwuStep.classList.add("section-skipped");
        }
        // Ustaw "brak" w sticky bar
        const skipReason = evaluated.cwuRules.skipReason || "brak";
        updateSelectionsBar("cwu", skipReason);
        // Ustaw w state.selections dla wyników
        state.selections.cwu = {
          optionId: "cwu-none",
          label: skipReason,
        };
      } else if (evaluated && evaluated.cwuRules.enabled) {
        const cwuStep = dom.qs('[data-step-key="cwu"]');
        if (cwuStep) {
          // Upewnij się, że sekcja jest widoczna (może być ukryta z poprzedniego stanu)
          cwuStep.style.display = "";
          cwuStep.classList.remove("section-skipped");

          // ✅ FALLBACK: Jeśli brak recommendedCapacity, użyj domyślnej wartości
          const recommendedCapacity =
            evaluated.cwuRules.recommendedCapacity || 200;
          const optionsGrid = cwuStep.querySelector(".options-grid");

          if (optionsGrid) {
            // Renderuj karty dynamicznie
            const cards = renderCwuSection(recommendedCapacity);
            optionsGrid.innerHTML = cards;

            // ═══════════════════════════════════════════════════════════════════════════
            // 📊 KROK 2: ZASOBNIK CWU — Szczegółowe logowanie
            // ═══════════════════════════════════════════════════════════════════════════
            if (debug.__DEBUG_CONFIGURATOR) {
              if (evaluated.cwuRules.recommendedCapacity) {
                const people =
                  state.meta?.hot_water_persons ||
                  state.meta?.cwu_people ||
                  null;
                const profile =
                  state.meta?.hot_water_usage ||
                  state.meta?.cwu_profile ||
                  null;
              }
            }

            // ❌ USUNIĘTO: Auto-wybieranie rekomendowanej karty - użytkownik musi sam wybrać

            // Usuń istniejące recommendation-note jeśli istnieje
            const existingNote = cwuStep.querySelector(".recommendation-note");
            if (existingNote) {
              existingNote.remove();
            }

            // Zaktualizuj opis w headerze zgodnie z tabelą WARUNEK → TEKST
            const sectionDescription = cwuStep.querySelector(
              ".section-description"
            );
            if (sectionDescription) {
              // Zaktualizuj recommendation-note zgodnie z tabelą WARUNEK → TEKST
              const people =
                state.meta?.hot_water_persons || state.meta?.cwu_people || null;
              const profile =
                state.meta?.hot_water_usage || state.meta?.cwu_profile || null;
              let profileLabel = "";
              if (profile === "bath" || profile === "comfort") {
                profileLabel = "podwyższone zużycie";
              } else if (profile === "shower_bath" || profile === "standard") {
                profileLabel = "standardowe zużycie";
              } else if (profile === "eco") {
                profileLabel = "małe zużycie";
              } else {
                profileLabel = "standardowe zużycie"; // domyślne
              }

              let peopleText = "";
              if (people) {
                if (people === 1) {
                  peopleText = "1 osoba";
                } else if (people < 5) {
                  peopleText = `${people} osoby`;
                } else {
                  peopleText = `${people} osób`;
                }
              }

              // Generuj opis w nowym formacie
              let descriptionText = "";
              if (people && profile) {
                // Mamy pełne dane: osoby i profil
                descriptionText = `Rekomendowana pojemność zasobnika ciepłej wody dobrana do liczby domowników i stylu użytkowania (${peopleText}, ${profileLabel}) to ${recommendedCapacity} L.`;
              } else if (people) {
                // Mamy tylko liczbę osób
                descriptionText = `Rekomendowana pojemność zasobnika ciepłej wody dobrana do liczby domowników (${peopleText}) to ${recommendedCapacity} L.`;
              } else if (profile) {
                // Mamy tylko profil
                descriptionText = `Rekomendowana pojemność zasobnika ciepłej wody dobrana do stylu użytkowania (${profileLabel}) to ${recommendedCapacity} L.`;
              } else {
                // Brak danych - ogólny opis
                descriptionText = `Rekomendowana pojemność zasobnika ciepłej wody to ${recommendedCapacity} L.`;
              }

              sectionDescription.textContent = descriptionText;
            }
          }
        }
      }

      // Renderuj HYDRAULIKĘ CO wyłącznie z hydraulicsRecommendation (single source)
      // ✅ FIX: Użyj hydraulicsRecommendation z evaluateRules() (już świeże, obliczone w rulesEngine.buffer())
      // Usunięto podwójne wywołanie computeHydraulicsRecommendation() - było niepotrzebne
      if (evaluated && evaluated.hydraulicsRecommendation) {
        renderHydraulicsCOSectionFromRecommendation(
          evaluated.hydraulicsRecommendation
        );
      }

      // Renderuj karty cyrkulacji CWU dynamicznie
      if (evaluated && evaluated.circulationRules) {
        const circulationStep = dom.qs('[data-step-key="cyrkulacja"]');
        if (circulationStep) {
          const isEnabled = evaluated.circulationRules.enabled === true;
          const isRecommended = evaluated.circulationRules.recommended === true;

          if (isEnabled) {
            const optionsGrid = circulationStep.querySelector(".options-grid");
            if (optionsGrid) {
              const cards = renderCirculationSection();
              optionsGrid.innerHTML = cards;

              // ❌ USUNIĘTO: Auto-wybieranie - użytkownik musi sam wybrać
            }
          }

          // Aktualizuj treści dla KROKU 4 - CYRKULACJA CWU
          const sectionDescription = circulationStep.querySelector(
            ".section-description"
          );

          // Usuń istniejące recommendation-note jeśli istnieje
          const existingNote = circulationStep.querySelector(
            ".recommendation-note"
          );
          if (existingNote) {
            existingNote.remove();
          }

          if (!isEnabled) {
            // enabled = false
            if (sectionDescription) {
              sectionDescription.innerHTML =
                "Sekcja wyłączona — wybrana konfiguracja zawiera wbudowany zasobnik CWU.<br>Cyrkulacja CWU nie dotyczy tej konfiguracji.";
            }
          } else if (isRecommended) {
            // recommended = true
            if (sectionDescription) {
              sectionDescription.innerHTML =
                "Cyrkulacja CWU zapewnia niemal natychmiastowy dostęp do ciepłej wody. Rekomendowana w większych domach lub gdy komfort jest priorytetem.<br>Rekomendujemy cyrkulację CWU. Skraca czas oczekiwania na ciepłą wodę i ogranicza jej marnowanie w długiej instalacji.";
            }
          } else {
            // recommended = false
            if (sectionDescription) {
              sectionDescription.innerHTML =
                "Cyrkulacja CWU zapewnia wygodę użytkowania ciepłej wody.<br>Cyrkulacja jest opcjonalna. W tej instalacji czas oczekiwania na ciepłą wodę będzie krótki nawet bez niej.";
            }
          }
        }
      }

      // Renderuj kartę Service Cloud dynamicznie (tylko 1 karta - Basic)
      const serviceStep = dom.qs('[data-step-key="service"]');
      if (serviceStep) {
        const optionsGrid = serviceStep.querySelector(".options-grid");
        if (optionsGrid) {
          const card = renderServiceCard();
          optionsGrid.innerHTML = card;

          // ❌ USUNIĘTO: Auto-wybieranie - użytkownik musi sam wybrać
        }

        // Aktualizuj treści dla KROKU 5 - SERVICE CLOUD
        const isEnabled = evaluated?.serviceCloudRules?.enabled === true;
        const sectionDescription = serviceStep.querySelector(
          ".section-description"
        );

        // Usuń istniejące recommendation-note jeśli istnieje
        const existingNote = serviceStep.querySelector(".recommendation-note");
        if (existingNote) {
          existingNote.remove();
        }

        if (isEnabled) {
          // Dostępny
          if (sectionDescription) {
            sectionDescription.innerHTML =
              "Zdalne monitorowanie i opieka serwisowa instalacji przez specjalistów TOP-INSTAL.<br>Service Cloud jest w standardzie TOP-INSTAL — bez dopłat. Umożliwia zdalną diagnostykę, optymalizację ustawień i szybszą reakcję serwisową.";
          }
        } else {
          // Niedostępny
          if (sectionDescription) {
            sectionDescription.innerHTML =
              "Service Cloud dostępny tylko dla wybranych serii pomp.<br>Funkcja niedostępna dla wybranej konfiguracji pompy.";
          }
        }
      }

      // Renderuj karty posadowienia dynamicznie
      const foundationStep = dom.qs('[data-step-key="posadowienie"]');
      if (foundationStep) {
        const optionsGrid = foundationStep.querySelector(".options-grid");
        if (optionsGrid) {
          const cards = renderFoundationSection();
          optionsGrid.innerHTML = cards;

          // ❌ USUNIĘTO: Auto-wybieranie - użytkownik musi sam wybrać
        }

        // Aktualizuj treści dla KROKU 6 - POSADOWIENIE
        const pumpWeight =
          state.selectedPump?.weight ||
          state.selectedPump?.panasonicData?.weight ||
          70;
        const isHeavy = pumpWeight > 65;
        const sectionDescription = foundationStep.querySelector(
          ".section-description"
        );

        // Usuń istniejące recommendation-note jeśli istnieje
        const existingNote = foundationStep.querySelector(
          ".recommendation-note"
        );
        if (existingNote) {
          existingNote.remove();
        }

        // Zawsze
        if (sectionDescription) {
          const mainText =
            "Sposób montażu jednostki zewnętrznej wpływa na stabilność pracy, hałas i trwałość instalacji.";
          let noteText =
            "Rekomendujemy montaż na fundamencie betonowym (w cenie). Zapewnia stabilność, redukcję drgań i prawidłowe odprowadzenie kondensatu.";

          if (isHeavy) {
            noteText +=
              " Uwaga: masa pompy przekracza 65 kg — montaż na konsoli ściennej wymaga dodatkowej analizy konstrukcyjnej.";
          }

          sectionDescription.innerHTML = `${mainText}<br>${noteText}`;
        }
      }

      // Renderuj kartę reduktora ciśnienia dynamicznie
      const reducerStep = dom.qs('[data-step-key="reduktor"]');
      if (reducerStep) {
        const optionsGrid = reducerStep.querySelector(".options-grid");
        if (optionsGrid) {
          const card = renderReducerSection();
          optionsGrid.innerHTML = card;
        }

        // Aktualizuj treści dla KROKU 7 - REDUKTOR CIŚNIENIA
        const waterPressure = state.meta?.water_pressure || null;
        const sectionDescription = reducerStep.querySelector(
          ".section-description"
        );

        // Usuń istniejące recommendation-note jeśli istnieje
        const existingNote = reducerStep.querySelector(".recommendation-note");
        if (existingNote) {
          existingNote.remove();
        }

        let descText = "";
        let noteText = "";

        if (waterPressure === null) {
          // Brak danych
          descText =
            "Reduktor chroni instalację przed zbyt wysokim ciśnieniem wody.";
          noteText =
            "Rekomendujemy reduktor dla większości instalacji — zapewnia poprawność montażu i komfort użytkowania.";
        } else if (waterPressure > 5) {
          // > 5 bar
          descText =
            "Reduktor chroni instalację przed zbyt wysokim ciśnieniem wody.";
          noteText =
            "Reduktor ciśnienia jest wymagany. Zbyt wysokie ciśnienie może prowadzić do uszkodzeń armatury i zbiornika CWU.";
        } else if (waterPressure >= 3) {
          // 3-5 bar
          descText = "Reduktor chroni instalację przed skokami ciśnienia.";
          noteText =
            "Rekomendujemy reduktor ciśnienia dla stabilnej pracy instalacji i komfortu użytkowania.";
        } else {
          // < 3 bar
          descText = "Reduktor chroni instalację przed nadmiernym ciśnieniem.";
          noteText =
            "Reduktor nie jest wymagany, ale można go dodać opcjonalnie jako dodatkowe zabezpieczenie.";
        }

        if (sectionDescription) {
          sectionDescription.innerHTML = `${descText}<br>${noteText}`;
        }
      }

      // Renderuj karty stacji uzdatniania wody dynamicznie
      const waterStep = dom.qs('[data-step-key="woda"]');
      if (waterStep) {
        const optionsGrid = waterStep.querySelector(".options-grid");
        if (optionsGrid) {
          const cards = renderWaterStationSection();
          optionsGrid.innerHTML = cards;

          // ❌ USUNIĘTO: Auto-wybieranie - użytkownik musi sam wybrać
        }

        // Aktualizuj treści dla KROKU 8 - UZDATNIANIE WODY
        const waterHardness = state.meta?.water_hardness || null;
        const sectionDescription = waterStep.querySelector(
          ".section-description"
        );

        // Usuń istniejące recommendation-note jeśli istnieje
        const existingNote = waterStep.querySelector(".recommendation-note");
        if (existingNote) {
          existingNote.remove();
        }

        // Zawsze
        if (sectionDescription) {
          const mainText =
            "Jakość wody ma bezpośredni wpływ na trwałość pompy ciepła i zasobnika CWU.";
          let noteText =
            "Rekomendujemy uzdatnianie wody w celu ochrony instalacji przed kamieniem i korozją.";

          if (waterHardness && waterHardness > 15) {
            // Twarda woda (przykładowa wartość > 15)
            noteText +=
              " Dla twardej wody zalecana jest stacja kompleksowa (filtracja + zmiękczanie), aby wydłużyć żywotność instalacji.";
          }

          sectionDescription.innerHTML = `${mainText}<br>${noteText}`;
        }
      }

      // Zastosuj reguły do UI
      applyRulesToUI(evaluated);

      // Przelicz ceny
      calculateTotalPrice();
      buildPricingItems();

      updateSummary();
      exposeSelectionOnWindow();
    }

    function readInitialSelections() {
      steps.forEach((step) => {
        const stepKey = step.dataset.stepKey;
        if (!stepKey || stepKey === "summary") return;

        const preselected = step.querySelector(".option-card.selected");
        if (preselected) {
          captureSelectionForCard(preselected);
        }
      });

      updateSummary();
    }

    /* ==========================================================================
     STICKY SELECTIONS BAR CONTROLLER (jak progress bar w kalkulatorze)
     ========================================================================== */

    const SelectionsBarController = {
      selectionsBar: null,
      placeholder: null,
      header: null,
      triggerOffset: 0,

      init() {
        this.selectionsBar = dom.byId("configurator-selections-bar");
        this.placeholder = dom.byId("selections-sticky-placeholder");
        this.header = dom.qs(".top-preview-header");

        if (!this.selectionsBar) {
          console.warn("[SelectionsBar] Nie znaleziono paska komponentów");
          return;
        }

        // Upewnij się, że selections bar nie ma klasy sticky na początku
        this.selectionsBar.classList.remove("sticky");

        // Upewnij się, że placeholder jest ukryty na początku
        if (this.placeholder) {
          this.placeholder.style.display = "none";
          this.placeholder.classList.remove("active");
        }

        // Ustaw początkową pozycję triggera
        this.updateTriggerOffset();

        // Setup sticky behavior
        this.setupSticky();

        // Recalculate trigger po załadowaniu obrazów
        trackEvent(view, "load", () => {
          setTimeout(() => {
            this.updateTriggerOffset();
            // Wywołaj handleScroll po updateTriggerOffset, aby ustawić początkowy stan
            if (this.setupSticky && typeof this.handleScroll === "function") {
              this.handleScroll();
            }
          }, 100);
        });

        // Recalculate on window resize
        trackEvent(view, "resize", () => {
          this.updateTriggerOffset();
        });

        // Log tylko w trybie debug
        if (debug.__DEBUG_SELECTIONS_BAR) {
        }
      },

      updateTriggerOffset() {
        if (this.selectionsBar && this.header) {
          const headerHeight = this.header.offsetHeight || 60;
          // Pobierz pozycję selections bar względem viewport (nie offsetTop, bo może być zmieniony przez sticky)
          const barRect = this.selectionsBar.getBoundingClientRect();
          const scrollTop = view.pageYOffset || doc.documentElement.scrollTop;
          const barTop = barRect.top + scrollTop;

          // Trigger: standardowo przykleja się gdy bar dojedzie pod header.
          // UX tweak (desktop): nie przyklejaj "za wcześnie" — dopiero gdy user realnie zjedzie w dół
          // (np. po mini przewinięciu headera / wyników). Dzięki temu nie "zjada" ekranu od razu.
          const isDesktop =
            !!(view.matchMedia && view.matchMedia("(min-width: 1024px)").matches);
          const desktopExtra = isDesktop ? Math.max(160, Math.min(320, barRect.height * 2)) : 0;
          this.triggerOffset = barTop - headerHeight + desktopExtra;

          // Ustaw CSS variable dla sticky top position
          doc.documentElement.style.setProperty(
            "--header-height",
            `${headerHeight}px`
          );

          // Log tylko w trybie debug
          if (debug.__DEBUG_SELECTIONS_BAR) {
          }
        }
      },

      setupSticky() {
        let ticking = false;

        this.handleScroll = () => {
          if (!ticking) {
            view.requestAnimationFrame(() => {
              const scrollTop =
                view.pageYOffset ||
                doc.documentElement.scrollTop ||
                view.scrollY;

              if (this.selectionsBar) {
                // Sprawdź czy scroll przekroczył trigger
                const shouldBeSticky = scrollTop > this.triggerOffset;

                if (
                  shouldBeSticky &&
                  !this.selectionsBar.classList.contains("sticky")
                ) {
                  // Przyklej do góry
                  this.selectionsBar.classList.add("sticky");
                  if (this.placeholder) {
                    // Ustaw wysokość placeholder na wysokość paska (zapobiega skokowi treści)
                    const barHeight = this.selectionsBar.offsetHeight;
                    this.placeholder.style.height = `${barHeight}px`;
                    this.placeholder.style.display = "block";
                    this.placeholder.classList.add("active");
                  }
                  // Log tylko w trybie debug
                  if (debug.__DEBUG_SELECTIONS_BAR) {
                  }
                } else if (
                  !shouldBeSticky &&
                  this.selectionsBar.classList.contains("sticky")
                ) {
                  // Odklej od góry
                  this.selectionsBar.classList.remove("sticky");
                  if (this.placeholder) {
                    this.placeholder.style.display = "none";
                    this.placeholder.classList.remove("active");
                  }
                  // Log tylko w trybie debug
                  if (debug.__DEBUG_SELECTIONS_BAR) {
                  }
                }
              }

              ticking = false;
            });
            ticking = true;
          }
        };

        // Wywołaj na początku, aby ustawić początkowy stan
        this.handleScroll();

        trackEvent(view, "scroll", this.handleScroll);
      },
    };

    /* ==========================================================================
     INITIALIZATION (z configurator-new.js)
     ========================================================================== */

    function initConfigurator(rootElement, options = {}) {
      // Scope do root elementu
      if (!rootElement) {
        console.error("[Configurator] ❌ Brak rootElement");
        return false;
      }

      const app = rootElement.querySelector("#configurator-app") || rootElement;
      if (!app) {
        console.warn("[Configurator] ⚠️ Brak #configurator-app w rootElement");
        return false;
      }

      if (app.dataset.initialized === "true") {
        return true;
      }

      const stepsContainer = app.querySelector("#configurator-steps");
      if (!stepsContainer) {
        console.error("[Configurator] ❌ Brak #configurator-steps");
        return false;
      }

      steps = Array.from(stepsContainer.querySelectorAll(".config-step"));
      if (!steps.length) {
        console.error("[Configurator] ❌ Brak kroków");
        return false;
      }

      navPrev = app.querySelector("#nav-prev");
      navNext = app.querySelector("#nav-next");
      currentStepNumberEl = app.querySelector("#current-step-number");
      totalStepsNumberEl = app.querySelector("#total-steps-number");
      summaryBody = app.querySelector("#summary-rows");

      totalSteps = steps.length;
      currentStepIndex = 0;

      if (totalStepsNumberEl) {
        totalStepsNumberEl.textContent = String(totalSteps);
      }

      bindCardClicks();
      bindNavigation();
      bindSummaryActions();

      readInitialSelections();
      showStep(0, true); // noScroll = true przy pierwszym pokazaniu

      // Przelicz reguły i ceny po inicjalizacji
      const evaluated = evaluateRules();
      if (evaluated) {
        applyRulesToUI(evaluated);
      }
      calculateTotalPrice();
      buildPricingItems();
      exposeSelectionOnWindow();

      // Inicjalizuj sticky selections bar controller
      SelectionsBarController.init();

      app.dataset.initialized = "true";
      return true;
    }

    function initConfiguratorApp(rootElement, options = {}) {
      if (!rootElement) {
        console.error("[Configurator] ❌ rootElement jest wymagany");
        return false;
      }

      loadBufferRules().catch((e) => {
        console.warn(
          "[Configurator] ⚠️ Failed to load buffer rules, using defaults:",
          e
        );
      });

      const result = initConfigurator(rootElement, options);

      if (result && options.building) {
        setTimeout(() => {
          populateConfiguratorWithCalculatorData(options);
        }, 100);
      }

      return result;
    }

    function destroyConfiguratorApp() {
      const app = dom.byId("configurator-app");
      if (app) {
        app.dataset.initialized = "false";
      }
    }

    if (appState) {
      appState.configurator = {
        init: initConfiguratorApp,
        destroy: destroyConfiguratorApp,
        saveState: saveConfiguratorState,
        loadState: loadConfiguratorState,
        restoreState: restoreConfiguratorState,
        recompute: recompute,
        initFromResults(input) {
          console.log("[KONFIG:INIT] 🎬 initFromResults() called");
          console.log("[KONFIG:INIT] 📊 Input:", {
            hasInput: !!input,
            id: input?.id,
            heated_area: input?.heated_area,
            max_heating_power: input?.max_heating_power,
            hasPumpSelection: !!input?.pump_selection,
          });

          if (configuratorInitDone) {
            console.log(
              "[KONFIG:INIT] ⚠️ Configurator already initialized - skipping"
            );
            return;
          }

          configuratorInitDone = true;
          console.log("[KONFIG:INIT] ✅ Marking configuratorInitDone = true");

          const app = dom.byId("configurator-app");
          if (!app) {
            console.error(
              "[KONFIG:INIT] ❌ #configurator-app not found in DOM!"
            );
            return;
          }

          console.log(
            "[KONFIG:INIT] 🎨 Found #configurator-app, initializing..."
          );
          console.log("[KONFIG:INIT] 📊 Options:", {
            building: {
              id: input?.id,
              heated_area: input?.heated_area,
              max_heating_power: input?.max_heating_power,
            },
            system: {
              heatPumpModel: input?.pump_selection?.hp?.model || null,
              mode: "mono",
            },
          });

          initConfiguratorApp(app, {
            building: input,
            system: {
              heatPumpModel: input?.pump_selection?.hp?.model || null,
              mode: "mono",
            },
            defaults: {
              buffer: "auto",
              cwu: "standard",
            },
            rootElement: app,
          });

          console.log("[KONFIG:INIT] ✅ initConfiguratorApp() completed");
        },
      };
    }

    console.log(
      "[KONFIG:INIT] 📡 Dispatching 'heatpump:configuratorReady' event"
    );
    view.dispatchEvent(
      new CustomEvent("heatpump:configuratorReady", { detail: { root } })
    );
    console.log("[KONFIG:INIT] ✅ Configurator init() completed successfully");

    return function disposer() {
      console.log(
        "[KONFIG:INIT] 🧹 Configurator disposer() called - cleaning up..."
      );

      disposers.forEach((fn) => {
        try {
          fn();
        } catch (e) {
          console.error(e);
        }
      });
    };
  }

  window.__HP_MODULES__ = window.__HP_MODULES__ || {};
  window.__HP_MODULES__.configurator = { init };
})(window);
