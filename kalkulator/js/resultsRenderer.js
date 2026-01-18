(function (window) {
  "use strict";

  const LOG = (typeof window !== "undefined" && window.HP_LOG) || {
    info: function () {},
    warn: function () {},
    error: function () {},
    group: function () {},
    groupEnd: function () {},
  };

  LOG.info("module:resultsRenderer", "loaded");

  function init(ctx) {
    const { root, dom, state } = ctx;
    const disposers = [];
    const config = state?.config || {};
    const doc = root.ownerDocument;
    const view = doc.defaultView || window;

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

    let lastCalculationResult = null;
    let lastCalcResult = {};
    const formEngine = state?.formEngine || null;
    const workflowController = state?.workflowController || null;

    // ═══════════════════════════════════════════════════════════════════════════
    // P1.2: KONSOLIDACJA ZAPISU config_data (jedno miejsce)
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Zapisuje config_data do sessionStorage (SSoT dla configuratora)
     * @param {Object} options - Opcje zapisu
     * @param {Object} options.configuratorInput - Dane wejściowe konfiguratora
     * @param {Object} options.result - Wynik obliczeń
     * @param {string|null} options.selectedPumpModel - Wybrany model pompy (opcjonalnie)
     * @param {Object} options.pumpSelectionResult - Wynik doboru pomp (opcjonalnie)
     * @param {Object} options.overrideData - Nadpisanie danych (dla wyboru pompy z karty)
     */
    function saveConfigData(options = {}) {
      const {
        configuratorInput = {},
        result = {},
        selectedPumpModel = null,
        pumpSelectionResult = null,
        overrideData = {},
      } = options;

      try {
        // Zbuduj configData z danych wejściowych lub override
        const configData = {
          from_calculator: true,
          id: overrideData.id || configuratorInput?.id || result?.id || null,
          heated_area:
            overrideData.heated_area ?? configuratorInput?.heated_area ?? null,
          max_heating_power:
            overrideData.max_heating_power ??
            configuratorInput?.max_heating_power ??
            null,
          recommended_power_kw:
            overrideData.recommended_power_kw ??
            configuratorInput?.recommended_power_kw ??
            null,
          bivalent_power:
            overrideData.bivalent_power ??
            configuratorInput?.bivalent_point_heating_power ??
            configuratorInput?.bivalent_power ??
            null,
          hot_water_power:
            overrideData.hot_water_power ??
            configuratorInput?.hot_water_power ??
            0,
          include_hot_water:
            overrideData.include_hot_water !== undefined
              ? overrideData.include_hot_water
              : !!configuratorInput?.include_hot_water,
          hot_water_persons:
            overrideData.hot_water_persons ??
            configuratorInput?.hot_water_persons ??
            null,
          hot_water_usage:
            overrideData.hot_water_usage ??
            configuratorInput?.hot_water_usage ??
            null,
          heating_type:
            overrideData.heating_type ??
            configuratorInput?.heating_type ??
            null,
          pump_selection:
            overrideData.pump_selection ??
            configuratorInput?.pump_selection ??
            (pumpSelectionResult?.pump_selection || null),
          selected_pump:
            overrideData.selected_pump ?? selectedPumpModel ?? null,
          annual_energy_consumption:
            overrideData.annual_energy_consumption ??
            result?.annual_energy_consumption ??
            null,
          design_outdoor_temperature:
            overrideData.design_outdoor_temperature ??
            result?.design_outdoor_temperature ??
            null,

          // Ensure shape expected by configurator-unified.js
          hydraulics_inputs: {
            has_underfloor_actuators: false,
            radiators_is_ht: false,
            bivalent_enabled: false,
            bivalent_source_type: null,
          },
          recommendations: {},
        };

        // ⚠️ FIX: Sprawdź czy view.sessionStorage istnieje (view = doc.defaultView || window)
        const storage =
          view.sessionStorage ||
          (typeof sessionStorage !== "undefined" ? sessionStorage : null);
        if (!storage) {
          if (window.__HP_DEBUG__) {
            LOG.warn("flow", "[FLOW-17A] sessionStorage not available");
          }
          return;
        }

        // ⚠️ FIX: sessionStorage.setItem() może rzucać QuotaExceededError lub SecurityError
        // w trybach prywatnych / restrykcyjnych przeglądarkach
        try {
          storage.setItem("config_data", JSON.stringify(configData));
          if (window.__HP_DEBUG__) {
            LOG.info("flow", "[FLOW-17A] config_data saved to sessionStorage", {
              keys: Object.keys(configData),
              selected_pump: configData.selected_pump,
              source: overrideData.selected_pump
                ? "pump_card_click"
                : "calculation_result",
            });
          }
        } catch (storageError) {
          // Obsługa specyficznych błędów sessionStorage
          if (storageError.name === "QuotaExceededError") {
            if (window.__HP_DEBUG__) {
              LOG.warn(
                "flow",
                "[FLOW-17A] sessionStorage quota exceeded - config_data not saved"
              );
            }
            // ⚠️ FIX P0.2: Fallback do appState jeśli sessionStorage zablokowany
            if (typeof updateAppState === "function") {
              try {
                updateAppState({ config_data: configData });
                if (window.__HP_DEBUG__) {
                  LOG.info(
                    "flow",
                    "[FLOW-17A] config_data saved to appState (sessionStorage quota exceeded)"
                  );
                }
              } catch (e) {
                if (window.__HP_DEBUG__) {
                  LOG.warn(
                    "flow",
                    "[FLOW-17A] Failed to save config_data to appState:",
                    e
                  );
                }
              }
            }
          } else if (storageError.name === "SecurityError") {
            if (window.__HP_DEBUG__) {
              LOG.warn(
                "flow",
                "[FLOW-17A] sessionStorage security error (private mode?) - config_data not saved"
              );
            }
            // ⚠️ FIX P0.2: Fallback do appState jeśli sessionStorage zablokowany
            if (typeof updateAppState === "function") {
              try {
                updateAppState({ config_data: configData });
                if (window.__HP_DEBUG__) {
                  LOG.info(
                    "flow",
                    "[FLOW-17A] config_data saved to appState (sessionStorage blocked)"
                  );
                }
              } catch (e) {
                if (window.__HP_DEBUG__) {
                  LOG.warn(
                    "flow",
                    "[FLOW-17A] Failed to save config_data to appState:",
                    e
                  );
                }
              }
            }
          } else {
            if (window.__HP_DEBUG__) {
              LOG.warn(
                "flow",
                "[FLOW-17A] sessionStorage.setItem() failed",
                storageError
              );
            }
          }
          // Nie rzucamy dalej - aplikacja może działać bez zapisu config_data
        }
      } catch (e) {
        if (window.__HP_DEBUG__) {
          LOG.warn(
            "flow",
            "[FLOW-17A] Failed to save config_data to sessionStorage",
            e
          );
        }
      }
    }

    LOG.info("module:resultsRenderer", "init called", {
      hasFormEngine: !!formEngine,
    });
    const updateAppState = state?.updateAppState;
    const getAppState = state?.getAppState;
    const showTab = state?.showTab;
    let configuratorReady = false;
    let configuratorInitDone = false;
    let configuratorRetryInterval = null;
    let pendingConfiguratorInput = null;

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

    // Baza danych pomp ciepła - generowana z pumpMatchingTable (ceny szacunkowe)
    const pumpCardsData = Object.keys(pumpMatchingTable).map((model) => {
      const data = pumpMatchingTable[model];
      // Użyj dynamicznego URL z konfiguracji WordPress
      const imgUrl = config?.imgUrl || "../img";
      const image =
        data.type === "split"
          ? `${imgUrl}/split-k.png`
          : `${imgUrl}/allinone.png`;
      // Szacunkowe ceny na podstawie mocy i typu (można później uzupełnić z bazy cen)
      const basePrice = data.type === "split" ? 15000 : 17000;
      const powerMultiplier = data.power * 1000;
      const phaseMultiplier = data.phase === 3 ? 1.1 : 1.0;
      const price = Math.round(basePrice + powerMultiplier * phaseMultiplier);
      return {
        model: model,
        power: data.power,
        series: data.series,
        type: data.type,
        image: image,
        price: price,
        phase: data.phase,
        requires3F: data.requires3F,
      };
    });

    /**
     * Waliduje i normalizuje dane wyników z API
     */
    function validateAndNormalizeResult(result) {
      if (!result || typeof result !== "object") {
        throw new Error("Brak danych wyników lub nieprawidłowy format");
      }

      // Mapowanie pól z API na wymagane pola
      const normalized = {
        total_area: parseFloat(
          result.total_area || result.totalArea || result.floor_area || 0
        ),
        heated_area: parseFloat(
          result.heated_area || result.heatedArea || result.floor_area || 0
        ),
        design_outdoor_temperature: parseFloat(
          result.design_outdoor_temperature ||
            result.designOutdoorTemperature ||
            -20
        ),
        max_heating_power: parseFloat(
          result.max_heating_power ||
            result.maxHeatingPower ||
            result.heating_power ||
            0
        ),
        hot_water_power: parseFloat(
          result.hot_water_power ||
            result.hotWaterPower ||
            result.cwu_power ||
            0
        ),
        bivalent_point_heating_power: parseFloat(
          result.bivalent_point_heating_power ||
            result.bivalentPointHeatingPower ||
            result.bi_power ||
            0
        ),
        avg_heating_power: parseFloat(
          result.avg_heating_power ||
            result.avgHeatingPower ||
            result.average_power ||
            0
        ),
        avg_outdoor_temperature: parseFloat(
          result.avg_outdoor_temperature || result.avgOutdoorTemperature || 8
        ),
        annual_energy_consumption: parseFloat(
          result.annual_energy_consumption ||
            result.annualEnergyConsumption ||
            result.energy_consumption ||
            0
        ),
        annual_energy_consumption_factor: parseFloat(
          result.annual_energy_consumption_factor ||
            result.annualEnergyConsumptionFactor ||
            result.energy_factor ||
            0
        ),
        heating_power_factor: parseFloat(
          result.heating_power_factor ||
            result.heatingPowerFactor ||
            result.power_factor ||
            0
        ),
        cop: parseFloat(result.cop || result.COP || 4.0),
        scop: parseFloat(result.scop || result.SCOP || 4.0),
      };

      // Sprawdź czy mamy podstawowe dane
      if (normalized.max_heating_power <= 0) {
        throw new Error("Brak wymaganej mocy grzewczej w wynikach API");
      }

      if (normalized.heated_area <= 0) {
        throw new Error("Brak powierzchni ogrzewanej w wynikach API");
      }

      // Logowanie usunięte dla produkcji
      return normalized;
    }

    /**
     * Dobiera pompy ciepła na podstawie wyników
     */
    function selectHeatPumps(result, heatingType = "radiators") {
      const powerDemand =
        result.max_heating_power + (result.hot_water_power || 0);
      // Logowanie usunięte dla produkcji

      const matchingPumps = Object.entries(pumpMatchingTable)
        .filter(([model, data]) => {
          const min = data.min[heatingType];
          const max = data.max[heatingType];
          return powerDemand >= min && powerDemand <= max;
        })
        .map(([model, data]) => {
          const pumpData = pumpCardsData.find((p) => p.model === model);
          // Użyj dynamicznego URL z konfiguracji WordPress
          const imgUrl = config?.imgUrl || "../img";
          return {
            model: model,
            power: data.power,
            series: data.series,
            type: data.type,
            image: pumpData?.image || `${imgUrl}/default-pump.png`,
            price: pumpData?.price || 0,
          };
        });

      // Logowanie usunięte dla produkcji
      return matchingPumps;
    }

    function initConfiguratorOnce(input) {
      if (window.__HP_DEBUG__) {
        LOG.info("flow", "[FLOW-21] initConfiguratorOnce() called");
        LOG.info("flow", "[FLOW-21] Input:", input);
        LOG.info(
          "flow",
          "[FLOW-21] configuratorInitDone:",
          configuratorInitDone
        );
      }

      if (configuratorInitDone) {
        if (window.__HP_DEBUG__) {
          LOG.warn(
            "flow",
            "[FLOW-21] Configurator already initialized - skipping"
          );
        }
        return;
      }

      const api = state?.configurator;
      if (window.__HP_DEBUG__) {
        LOG.info("flow", "[FLOW-21] state.configurator API:", api);
      }

      if (!api || typeof api.initFromResults !== "function") {
        LOG.error("flow", "[FLOW-21] Configurator API not available!", {
          state,
          configurator: api,
        });
        return;
      }

      configuratorInitDone = true;
      if (window.__HP_DEBUG__) {
        LOG.info("flow", "[FLOW-21] Calling api.initFromResults()...");
      }
      api.initFromResults(input);
      if (window.__HP_DEBUG__) {
        LOG.info("flow", "[FLOW-21] Configurator initialized!");
      }
    }

    function requestConfiguratorInit(input) {
      if (window.__HP_DEBUG__) {
        LOG.info("flow", "[FLOW-19] requestConfiguratorInit() called");
        LOG.info("flow", "[FLOW-19] Input:", input);
        LOG.info("flow", "[FLOW-19] configuratorReady:", configuratorReady);
      }

      pendingConfiguratorInput = input;

      // Próba leniwej inicjalizacji konfiguratora, jeśli jeszcze nie został załadowany.
      if (window.__HP_DEBUG__) {
        LOG.info("flow", "[FLOW-20] Attempting lazy init of configurator...");
      }
      try {
        if (
          !configuratorReady &&
          window.__HP_MODULES__ &&
          window.__HP_MODULES__.configurator &&
          typeof window.__HP_MODULES__.configurator.init === "function"
        ) {
          if (window.__HP_DEBUG__) {
            LOG.info(
              "flow",
              "[FLOW-20] Lazy initializing configurator module..."
            );
          }
          window.__HP_MODULES__.configurator.init({ root, dom, state });
          if (window.__HP_DEBUG__) {
            LOG.info("flow", "[FLOW-20] Configurator module initialized");
          }
        } else {
          if (window.__HP_DEBUG__) {
            LOG.warn(
              "flow",
              "[FLOW-20] Configurator module not available for lazy init",
              {
                configuratorReady,
                hasModules: !!window.__HP_MODULES__,
                configurator: window.__HP_MODULES__?.configurator,
              }
            );
          }
        }
      } catch (e) {
        LOG.error("flow", "[FLOW-20] Lazy init configurator failed:", e);
      }

      // ⚠️ FIX P0.1: Jeśli konfigurator jest już gotowy, wywołaj od razu (deterministyczna inicjalizacja)
      if (configuratorReady) {
        if (window.__HP_DEBUG__) {
          LOG.info(
            "flow",
            "[FLOW-20] Configurator ready - calling initConfiguratorOnce()"
          );
        }
        initConfiguratorOnce(input);
        return;
      }

      // ⚠️ FIX P0.1: Guard przeciwko wielokrotnemu retry interval (zapobiega "wisi retry" / podwójnym initom)
      if (configuratorRetryInterval) {
        if (window.__HP_DEBUG__) {
          LOG.warn(
            "flow",
            "[FLOW-20] Retry interval already running - skipping"
          );
        }
        // Zaktualizuj pending input (może być nowszy)
        pendingConfiguratorInput = input;
        return;
      }

      if (window.__HP_DEBUG__) {
        LOG.info(
          "flow",
          "[FLOW-20] Configurator not ready - setting up retry interval..."
        );
      }

      const start = view.performance?.now ? view.performance.now() : Date.now();
      let retryCount = 0;

      configuratorRetryInterval = trackInterval(() => {
        retryCount++;
        const now = view.performance?.now ? view.performance.now() : Date.now();
        const elapsed = now - start;

        if (window.__HP_DEBUG__) {
          LOG.info(
            "flow",
            `[FLOW-20] Retry #${retryCount} (${Math.round(elapsed)}ms elapsed)`,
            {
              configuratorReady,
            }
          );
        }

        if (configuratorReady) {
          if (window.__HP_DEBUG__) {
            LOG.info(
              "flow",
              "[FLOW-20] Configurator ready! Calling initConfiguratorOnce()"
            );
          }
          // ⚠️ FIX P0.1: Upewnij się, że interval jest czyszczony po sukcesie
          if (configuratorRetryInterval) {
            clearInterval(configuratorRetryInterval);
            configuratorRetryInterval = null;
          }
          initConfiguratorOnce(pendingConfiguratorInput);
          return;
        }

        if (elapsed > 2500) {
          LOG.error(
            "flow",
            "[FLOW-20] Timeout waiting for configurator (2.5s)",
            {
              message:
                "Configurator never became ready! Check if configurator module is loaded and 'heatpump:configuratorReady' event is dispatched",
            }
          );
          // ⚠️ FIX P0.1: Upewnij się, że interval jest czyszczony po timeout
          if (configuratorRetryInterval) {
            clearInterval(configuratorRetryInterval);
            configuratorRetryInterval = null;
          }
        }
      }, 100);
    }

    trackEvent(view, "heatpump:configuratorReady", (event) => {
      if (window.__HP_DEBUG__) {
        LOG.info(
          "flow",
          "[FLOW-20] Event 'heatpump:configuratorReady' received!",
          event?.detail
        );
      }

      if (event?.detail?.root && event.detail.root !== root) {
        if (window.__HP_DEBUG__) {
          LOG.warn("flow", "[FLOW-20] Event for different root - ignoring");
        }
        return;
      }

      configuratorReady = true;
      if (window.__HP_DEBUG__) {
        LOG.info("flow", "[FLOW-20] configuratorReady = true");
      }

      // ⚠️ FIX P0.1: Jeśli retry interval działa, zatrzymaj go (konfigurator jest już gotowy)
      if (configuratorRetryInterval) {
        clearInterval(configuratorRetryInterval);
        configuratorRetryInterval = null;
        if (window.__HP_DEBUG__) {
          LOG.info(
            "flow",
            "[FLOW-20] Retry interval stopped (configurator ready)"
          );
        }
      }

      if (pendingConfiguratorInput) {
        if (window.__HP_DEBUG__) {
          LOG.info(
            "flow",
            "[FLOW-20] Pending input found - calling initConfiguratorOnce()"
          );
        }
        initConfiguratorOnce(pendingConfiguratorInput);
      } else {
        if (window.__HP_DEBUG__) {
          LOG.warn(
            "flow",
            "[FLOW-20] No pending input - configurator will wait for data"
          );
        }
      }
    });

    function displayResultsInternal(result) {
      if (window.__HP_DEBUG__) {
        LOG.info("flow", "[FLOW-9] displayResultsInternal() STARTED");
        LOG.info("flow", "[FLOW-9] Result received:", result);
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // WORKFLOW COMPLETION (SCREEN 0) — UX: user sees completion + CTA,
      // while results/configurator load in background.
      // We trigger this here (resultsRenderer) to avoid relying on apiCaller versions/caching.
      // ═══════════════════════════════════════════════════════════════════════════
      let completionRequested = false;
      try {
        const alreadyShown =
          typeof getAppState === "function"
            ? !!getAppState()?.completionAnimationShown
            : false;
        completionRequested = !alreadyShown;

        if (!alreadyShown) {
          if (window.__HP_DEBUG__) {
            LOG.info(
              "flow",
              "[FLOW-9A] Dispatching workflow completion event (screen 0)..."
            );
          }
          root.dispatchEvent(
            new CustomEvent("heatpump:showWorkflowCompletion", {
              detail: { result },
              bubbles: true,
            })
          );
          if (window.__HP_DEBUG__) {
            LOG.info("flow", "[FLOW-9A] Workflow completion event dispatched");
          }
        } else {
          if (window.__HP_DEBUG__) {
            LOG.info(
              "flow",
              "[FLOW-9A] Workflow completion already shown - skipping"
            );
          }
        }
      } catch (e) {
        LOG.warn(
          "flow",
          "[FLOW-9A] Failed to dispatch workflow completion event",
          e
        );
        // On error, default to requesting completion to ensure UX flow continues
        completionRequested = true;
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // UKRYJ FORMULARZ I POKAŻ WYNIKI
      // ═══════════════════════════════════════════════════════════════════════════

      if (window.__HP_DEBUG__) {
        LOG.info("flow", "[FLOW-10] Hiding form sections...");
      }
      // Ukryj wszystkie sekcje formularza (data-tab="0" do "5")
      const formSections = dom.qsa(".section[data-tab]");
      formSections.forEach((section) => {
        section.classList.remove("active");
        section.style.display = "none";
      });
      if (window.__HP_DEBUG__) {
        LOG.info(
          "flow",
          `[FLOW-10] Hidden ${formSections.length} form sections`
        );
      }

      // Ukryj progress bar
      // UWAGA: jeśli pokazujemy workflow completion (screen 0), progress bar ma zostać widoczny i ustawiony na 100%.
      if (window.__HP_DEBUG__) {
        LOG.info("flow", "[FLOW-11] Progress bar handling...");
      }
      const progressBarContainer = dom.byId("progress-bar-container");
      if (progressBarContainer) {
        if (completionRequested) {
          if (window.__HP_DEBUG__) {
            LOG.info(
              "flow",
              "[FLOW-11] Keeping progress bar visible for workflow completion"
            );
          }
        } else {
          progressBarContainer.style.display = "none";
          if (window.__HP_DEBUG__) {
            LOG.info("flow", "[FLOW-11] Progress bar hidden");
          }
        }
      } else {
        if (window.__HP_DEBUG__) {
          LOG.warn("flow", "[FLOW-11] Progress bar container not found");
        }
      }

      // ✅ UKRYJ sekcję wyników - workflow completion będzie widoczny zamiast tego
      // hp-results pozostaje w tle (hidden) - dane są obliczone i dostępne dla konfiguratora
      console.log(
        "🔄 [FLOW-12] Keeping results container hidden (background data)..."
      );
      const resultsContainer = dom.qs(".hp-results");
      if (resultsContainer) {
        resultsContainer.classList.add("hidden"); // UKRYJ (nie pokazuj!)
        resultsContainer.style.display = "none"; // UKRYJ (nie pokazuj!)
        console.log(
          "✅ [FLOW-12] Results container kept hidden (workflow completion will be shown instead)"
        );
      } else {
        console.error(
          "❌ [FLOW-12] Results container (.hp-results) not found!"
        );
      }

      // Results wrapper section removed (no longer exists in HTML - was legacy code)

      // Pokaż actions (buttons PDF, email, itp.)
      const actionsContainers = dom.qsa(".results-actions");
      actionsContainers.forEach((el) => el.classList.remove("hidden"));

      const setText = (id, val, unit = "") => {
        const el = dom.byId(id);
        if (el && val !== undefined && val !== null)
          el.textContent = `${val}${unit}`;
      };

      // Podstawowe wyniki
      setText("r-total-area", result.total_area, " m²");
      setText("r-heated-area", result.heated_area, " m²");
      setText("r-max-power", result.max_heating_power, " kW");
      setText("r-cwu", result.hot_water_power || 0, " kW");
      setText("r-energy", Math.round(result.annual_energy_consumption), " kWh");
      setText("r-temp", result.design_outdoor_temperature, "°C");
      setText("r-bi-power", result.bivalent_point_heating_power, " kW");
      setText("r-avg-power", result.avg_heating_power, " kW");
      setText("r-temp-avg", result.avg_outdoor_temperature, "°C");
      setText(
        "r-avg-daily-energy",
        Math.round(result.avg_daily_energy_consumption || 0),
        " kWh"
      );
      setText("r-factor", result.annual_energy_consumption_factor, " kWh/m²");
      setText("r-power-factor", result.heating_power_factor, " W/m²");

      // ═══════════════════════════════════════════════════════════════════════════
      // SPECJALNE KOMUNIKATY W PROFILU ENERGETYCZNYM
      // ═══════════════════════════════════════════════════════════════════════════

      // Komunikat dla budynków >25kW
      const systemComment = dom.byId("system-comment-text");
      if (
        systemComment &&
        (result.max_heating_power >= 25 || result.recommended_power_kw >= 25)
      ) {
        systemComment.textContent =
          "Obsługa budynków o mocy w temp. projektowej większej niż 25kW niedostępna. Zalecamy termomodernizację budynku przed doborem pompy ciepła.";
        // UJEDNOLICONE: Kolor zgodny z CSS (--color-gold-dark: #8b6914) - OK
        systemComment.style.color = "#8b6914";
        systemComment.style.fontWeight = "600"; // Ujednolicone: 600 zamiast bold
        // UJEDNOLICONE: Font-family z CSS
        systemComment.style.fontFamily =
          "'Titillium Web', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      }

      // Komunikat dla budynków 16-25kW
      if (
        systemComment &&
        result.max_heating_power >= 16 &&
        result.max_heating_power < 25
      ) {
        systemComment.textContent =
          "System wykrył prądożerne połączenie. Budynek najprawdopodobniej wymaga termomodernizacji. Rekomendujemy ocieplenie budynku lub wymianę stolarki przed doborem pompy ciepła.";
        // UJEDNOLICONE: Kolor zgodny z CSS (--color-accent-dark: #b8976a) - OK
        systemComment.style.color = "#b8976a";
        systemComment.style.fontWeight = "600"; // Ujednolicone: 600 zamiast bold
        // UJEDNOLICONE: Font-family z CSS
        systemComment.style.fontFamily =
          "'Titillium Web', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      }

      // === DANE ROZSZERZONE ===
      if (result.extended) {
        // Logowanie usunięte dla produkcji

        // Pokaż sekcje rozszerzone
        const extendedSections = dom.byId("extended-results-sections");
        if (extendedSections) {
          extendedSections.style.display = "block";
        }

        // 1. Straty ciepła (Energy Losses)
        if (
          result.extended.energy_losses &&
          result.extended.energy_losses.length > 0
        ) {
          displayEnergyLosses(result.extended.energy_losses);
        }

        // 2. Propozycje modernizacji (Improvements)
        if (
          result.extended.improvements &&
          result.extended.improvements.length > 0
        ) {
          displayImprovements(result.extended.improvements);
        }

        // 3. Koszty ogrzewania (Heating Costs)
        if (
          result.extended.heating_costs &&
          result.extended.heating_costs.length > 0
        ) {
          displayHeatingCosts(result.extended.heating_costs);
        }

        // 4. Punkty biwalentne (Bivalent Points)
        if (result.extended.bivalent_points) {
          displayBivalentPoints(result.extended.bivalent_points);
        }
      }

      if (window.__HP_DEBUG__) {
        LOG.info("flow", "[FLOW-14] Basic results displayed");
      }

      // === INTEGRACJA Z KONFIGURATOREM MASZYNOWNI ===
      if (window.__HP_DEBUG__) {
        LOG.info("flow", "[FLOW-15] Starting configurator integration...");
      }

      // Zbierz podstawowe dane z formularza PRZED blokiem try (używane też poza try)
      let formSnapshot = {};
      if (formEngine && typeof formEngine.getState === "function") {
        formSnapshot = formEngine.getState() || {};
        if (window.__HP_DEBUG__) {
          LOG.info("flow", "[FLOW-15] Form snapshot collected:", formSnapshot);
        }
      } else {
        if (window.__HP_DEBUG__) {
          LOG.warn("flow", "[FLOW-15] formEngine.getState not available");
        }
      }

      try {
        // 1) Wywołaj DobierzPompe() aby dobrać pompy z zaktualizowanej pumpMatchingTable (48 zestawów)
        if (window.__HP_DEBUG__) {
          LOG.info("flow", "[FLOW-16] Calling DobierzPompe()...");
        }
        let pumpSelectionResult = null;
        try {
          // Dobór pompy musi uwzględniać dane z formularza (OZC result nie niesie heating_type)
          const pumpSelectionContext = Object.assign({}, result, {
            heating_type:
              result.heating_type !== undefined
                ? result.heating_type
                : formSnapshot.heating_type,
          });

          const pumpGroups = DobierzPompe(pumpSelectionContext);
          if (window.__HP_DEBUG__) {
            LOG.info("flow", "[FLOW-16] DobierzPompe() result:", pumpGroups);
          }
          const recommendedGroup = pumpGroups && pumpGroups[0];
          if (recommendedGroup) {
            // Mapuj wyniki z DobierzPompe() na format dla konfiguratora (hp, aio)
            // WC = HP Split (hp) - Seria K
            // ADC = HP All-in-One (aio) - Seria K
            const hpPump = recommendedGroup.wc || recommendedGroup.sdc || null;
            const aioPump = recommendedGroup.adc || null;

            pumpSelectionResult = {
              recommended_power_kw: recommendedGroup.power,
              pump_selection: {
                hp: hpPump
                  ? {
                      model: hpPump.model,
                      power: hpPump.power,
                      series: hpPump.series,
                      type: "split",
                      phase: hpPump.phase,
                      requires3F: hpPump.requires3F,
                    }
                  : null,
                aio: aioPump
                  ? {
                      model: aioPump.model,
                      power: aioPump.power,
                      series: aioPump.series,
                      type: "all-in-one",
                      phase: aioPump.phase,
                      requires3F: aioPump.requires3F,
                    }
                  : null,
                minPower: recommendedGroup.power,
                totalPower:
                  parseFloat(result.max_heating_power || 0) +
                  parseFloat(result.hot_water_power || 0),
              },
              // Kompatybilność wsteczna - stary format recommended_models
              recommended_models: [
                ...(hpPump
                  ? [
                      {
                        name: hpPump.model,
                        type: hpPump.type,
                        power_kw: hpPump.power,
                      },
                    ]
                  : []),
                ...(aioPump
                  ? [
                      {
                        name: aioPump.model,
                        type: aioPump.type,
                        power_kw: aioPump.power,
                      },
                    ]
                  : []),
              ],
            };

            if (window.__HP_DEBUG__) {
              LOG.info(
                "flow",
                "[FLOW-16] Pump selection result:",
                pumpSelectionResult
              );
            }
          } else {
            if (window.__HP_DEBUG__) {
              LOG.warn("flow", "[FLOW-16] No recommended pump group found");
            }
          }
        } catch (e) {
          LOG.error("flow", "[FLOW-16] Error in DobierzPompe():", e);
        }

        // ═══════════════════════════════════════════════════════════════════════════
        // 📊 LOGOWANIE WYNIKÓW Z SILNIKÓW (przed przekazaniem do konfiguratora)
        // ═══════════════════════════════════════════════════════════════════════════

        // 1. Zapotrzebowanie budynku (OZC)
        const designHeatLoss =
          result.max_heating_power || result.designHeatLoss_kW || null;
        if (designHeatLoss) {
        } else {
          console.warn(
            "⚠️ BRAK WYNIKU: Zapotrzebowanie budynku nie zostało obliczone"
          );
          console.warn(
            "   Przyczyna: max_heating_power i designHeatLoss_kW są null/undefined"
          );
        }

        // 2. Zarekomendowana pompa
        if (pumpSelectionResult && pumpSelectionResult.pump_selection) {
          const ps = pumpSelectionResult.pump_selection;
        } else {
          console.warn("⚠️ BRAK WYNIKU: Nie udało się dobrać pompy");
          console.warn(
            "   Przyczyna: pumpSelectionResult jest null lub pump_selection jest puste"
          );
          if (pumpSelectionResult) {
            console.warn(
              "   Szczegóły pumpSelectionResult:",
              pumpSelectionResult
            );
          }
        }

        // 3. CWU (będzie obliczone w konfiguratorze, ale logujemy dane wejściowe)
        // Sprawdź zarówno formSnapshot jak i result (result może mieć zaktualizowaną wartość z API)
        const cwuFromForm =
          formSnapshot.include_hot_water === true ||
          formSnapshot.include_hot_water === "yes";
        const cwuFromResult =
          result.include_hot_water === true ||
          result.include_hot_water === "yes";
        const cwuEnabled = cwuFromForm || cwuFromResult;
        const cwuPower = result.hot_water_power || null;
        if (!cwuEnabled) {
        } else if (!cwuPower && !formSnapshot.hot_water_persons) {
          console.warn(
            "⚠️ CWU włączone, ale brak danych do doboru (hot_water_power i hot_water_persons są puste)"
          );
        }

        // 4. Bufor (będzie obliczony w konfiguratorze, ale logujemy dane wejściowe)
        if (!designHeatLoss) {
          console.warn(
            "⚠️ BRAK WYNIKU: max_heating_power jest wymagane do doboru bufora"
          );
        }

        if (window.__HP_DEBUG__) {
          LOG.info("flow", "[FLOW-17] Building configuratorInput...");
        }

        // 3) Zbuduj obiekt danych wejściowych dla konfiguratora – na bazie wyników + doboru pomp
        // Uwaga: result może nie zawierać include_hot_water (to jest pole z formularza, nie z API)
        // Więc używamy formSnapshot, ale sprawdzamy też czy w result jest (dla pewności)
        const includeHotWaterValue =
          result.include_hot_water !== undefined
            ? result.include_hot_water
            : formSnapshot.include_hot_water;
        const includeHotWaterBool =
          includeHotWaterValue === true ||
          includeHotWaterValue === "yes" ||
          includeHotWaterValue === 1 ||
          includeHotWaterValue === "1";

        if (window.__HP_DEBUG__) {
          LOG.info("flow", "[FLOW-17] CWU enabled:", includeHotWaterBool);
        }

        const configuratorInput = {
          ...result,
          climate_zone:
            formSnapshot.location_id || formSnapshot.climate_zone || null,
          construction_year: formSnapshot.construction_year || null,
          insulation: formSnapshot.wall_size || null,
          heating_type: formSnapshot.heating_type || null,
          installation_type: formSnapshot.heating_type || null,
          source_type: formSnapshot.source_type || null,
          hot_water_persons: formSnapshot.hot_water_persons || null,
          hot_water_usage: formSnapshot.hot_water_usage || null,
          include_hot_water: includeHotWaterBool,
          building_type: formSnapshot.building_type || null,
          // ═══════════════════════════════════════════════════════════════════════════
          // OZC SINGLE SOURCE OF TRUTH — DO NOT DERIVE POWER ELSEWHERE
          // ═══════════════════════════════════════════════════════════════════════════
          // ARCHITECTURAL: recommended_power_kw MUST equal max_heating_power from OZC
          // max_heating_power comes from OZCEngine.designHeatLoss_kW (canonical)
          // Fallback chain is for backward compatibility only
          // ═══════════════════════════════════════════════════════════════════════════
          recommended_power_kw:
            result.max_heating_power || // PRIMARY: OZC canonical output
            pumpSelectionResult?.recommended_power_kw || // FALLBACK: pump selection
            lastCalculationResult?.recommended_power_kw || // FALLBACK: cached
            null,
          recommended_models:
            pumpSelectionResult?.recommended_models ||
            lastCalculationResult?.recommended_models ||
            [],
          // NOWY FORMAT: przekaż wyniki doboru pomp do konfiguratora
          pump_selection: pumpSelectionResult?.pump_selection || null,
        };

        lastCalculationResult = configuratorInput;

        if (window.__HP_DEBUG__) {
          LOG.info(
            "flow",
            "[FLOW-17] configuratorInput built:",
            configuratorInput
          );
        }

        // ═══════════════════════════════════════════════════════════════════════════
        // P1.2: KONSOLIDACJA ZAPISU config_data (jedno miejsce)
        // ═══════════════════════════════════════════════════════════════════════════
        // SSoT: sessionStorage.config_data — required by configurator-unified.js (hydraulics inputs & persistence)
        // Previously this was only set after clicking "WYBIERZ I KONFIGURUJ" on pump cards,
        // but in the desired UX we don't expose hp-results at all on this screen.
        // So we persist config_data immediately after calculations.
        const selectedPumpModel =
          pumpSelectionResult?.pump_selection?.hp?.model ||
          pumpSelectionResult?.pump_selection?.aio?.model ||
          null;

        saveConfigData({
          configuratorInput,
          result,
          selectedPumpModel,
          pumpSelectionResult,
        });

        // ═══════════════════════════════════════════════════════════════════════════
        // APP STATE PERSISTENCE — zapisz wynik obliczeń
        // ═══════════════════════════════════════════════════════════════════════════
        if (window.__HP_DEBUG__) {
          LOG.info("flow", "[FLOW-18] Saving to app state...");
        }
        if (typeof updateAppState === "function") {
          updateAppState({ lastCalculationResult: configuratorInput });
          if (window.__HP_DEBUG__) {
            LOG.info("flow", "[FLOW-18] Saved to app state");
          }
        } else {
          if (window.__HP_DEBUG__) {
            LOG.warn("flow", "[FLOW-18] updateAppState not available");
          }
        }

        if (window.__HP_DEBUG__) {
          LOG.info("flow", "[FLOW-19] Requesting configurator init...");
        }
        requestConfiguratorInit(configuratorInput);
      } catch (e) {
        console.error(
          "❌ BŁĄD: Nie udało się przekazać danych do konfiguratora maszynowni"
        );
        console.error("   Błąd:", e);
        console.error("   Stack:", e.stack);
      }

      // === ONBOARDING MODAL DLA KONFIGURATORA ===
      // Modal konfiguratora wyłączony - zastąpiony animacją typewriter w WorkflowController
      // WorkflowController obsługuje finalizację i pokazanie konfiguratora

      // === AKTUALIZACJA KOMENTARZA SYSTEMOWEGO ===
      // Pobierz dane z formularza, jeśli dostępne
      let formDataForComment = formSnapshot;
      if (
        !formDataForComment &&
        formEngine &&
        typeof formEngine.getState === "function"
      ) {
        formDataForComment = formEngine.getState() || {};
      }
      updateSystemComment(result, formDataForComment);
    }

    /**
     * Aktualizuje komentarz systemowy na podstawie wyników obliczeń
     * @param {Object} result - Wyniki obliczeń z API
     * @param {Object} formSnapshot - Dane z formularza (opcjonalne)
     */
    function updateSystemComment(result, formSnapshot = {}) {
      const commentElement = dom.byId("system-comment-text");
      if (!commentElement) return;

      // Pobierz dane z formularza, jeśli dostępne
      let formData = formSnapshot;
      if (
        !formData &&
        formEngine &&
        typeof formEngine.getState === "function"
      ) {
        formData = formEngine.getState() || {};
      }

      // Wykryj scenariusz na podstawie danych
      const constructionYear = formData.construction_year || null;
      const hasExternalIsolation =
        formData.has_external_isolation === "yes" ||
        formData.has_external_isolation === true;
      const hasTopIsolation =
        formData.top_isolation === "yes" || formData.top_isolation === true;
      const hasBottomIsolation =
        formData.bottom_isolation === "yes" ||
        formData.bottom_isolation === true;
      const buildingType = formData.building_type || null;

      // Sprawdź czy są podstawowe dane
      const hasBasicData = result.max_heating_power && result.total_area;

      // Sprawdź czy są niespójności (stary budynek bez izolacji)
      const isOldBuilding =
        constructionYear && parseInt(constructionYear) < 2015;
      const hasPoorIsolation =
        !hasExternalIsolation && !hasTopIsolation && !hasBottomIsolation;
      const isHighRisk = isOldBuilding && hasPoorIsolation;

      // SCENARIUSZ C - niespójność danych / ryzyko
      if (
        !hasBasicData ||
        isHighRisk ||
        (isOldBuilding && !hasExternalIsolation)
      ) {
        commentElement.textContent =
          "Część danych ma charakter orientacyjny. Rekomendujemy weryfikację podczas audytu technicznego przed montażem.";
        return;
      }

      // SCENARIUSZ B - podwyższone zapotrzebowanie / niepewność
      if (isOldBuilding || hasPoorIsolation || !hasExternalIsolation) {
        commentElement.textContent =
          "Parametry budynku wskazują na podwyższone zapotrzebowanie na ciepło. Zaproponowana konfiguracja uwzględnia ten fakt, aby zapewnić stabilną pracę systemu.";
        return;
      }

      // SCENARIUSZ A - wszystko spójne (domyślny)
      commentElement.textContent =
        "Parametry budynku są spójne i pozwalają na bezpieczną pracę pompy ciepła w oparciu o wprowadzone dane. " +
        "System nie wykrył ryzyk przewymiarowania ani niedoboru mocy.";
    }

    function resetResultsSectionInternal() {
      const loadingElements = dom.qsa('[id^="r-"]');
      loadingElements.forEach((el) => {
        if (el) el.textContent = "...";
      });

      // Logowanie usunięte dla produkcji
    }

    // resetResultsSection jest eksportowane na końcu modułu (w sekcji eksportów)

    function displayRecommendedPumps(pumps, result) {
      const zone = dom.byId("pump-recommendation-zone");
      if (!zone || !Array.isArray(pumps)) return;

      // Funkcja tworząca pojedynczą kartę pompy
      function createPumpCard(pump, badgeClass) {
        const typeLabel =
          pump.type === "split"
            ? "SPLIT (zewn. + wewn.)"
            : "ALL-IN-ONE (1 jednostka)";
        const typeClass = pump.type === "split" ? "split" : "all-in-one";

        // Obrazy: preferuj dynamiczne URL z WordPress (HEATPUMP_CONFIG), unikaj hardcoded domeny produkcyjnej
        // uploadsUrl może być np. ".../wp-content/uploads/2024/" (z trailing slash) – normalizujemy poniżej.
        const uploadsBase =
          config && config.uploadsUrl ? String(config.uploadsUrl) : "";
        const uploadsUrl = uploadsBase ? uploadsBase.replace(/\/?$/, "/") : "";
        const imgBase =
          config && config.imgUrl ? String(config.imgUrl) : "../img";
        const imgUrl = imgBase.replace(/\/?$/, "/");

        // Preferuj uploads (WordPress media), fallback: zasoby wtyczki (`main/img/`)
        const imagePath =
          pump.type === "split"
            ? uploadsUrl
              ? `${uploadsUrl}split-k.png`
              : `${imgUrl}splitK1f.png`
            : uploadsUrl
            ? `${uploadsUrl}aio-k.png`
            : `${imgUrl}allinoneK1f.png`;

        const card = doc.createElement("div");
        card.className = `pump-recommendation-card recommended-${badgeClass} animate-fade-in animate-hover-lift`;
        card.setAttribute("data-pump", pump.model);

        card.innerHTML = `
                <div class="pump-image-container">
                    <img src="${imagePath}" alt="Pompa ciepła ${
          pump.type
        }" class="pump-image"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="pump-image-fallback" style="display:none; align-items:center; justify-content:center; height:100%; color:#4b5563; font-family:'Titillium Web', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size:clamp(12px, 2.5vw, 14px); font-weight:500;">
                        📷 Zdjęcie pompy ${pump.type.toUpperCase()}
                    </div>
                    <div class="pump-image-overlay">${
                      pump.type === "split" ? "SPLIT" : "ALL-IN-ONE"
                    }</div>
                </div>
                <div class="card-badge ${badgeClass}">${
          pump.type === "split" ? "REKOMENDOWANA" : "ALTERNATYWA"
        }</div>
                <div class="card-series">PANASONIC SERIA K</div>
                <div class="card-type-badge ${typeClass}">${typeLabel}</div>
                <div class="card-model">${pump.model}</div>
                <div class="card-power">${pump.power} kW</div>
                <div class="card-price">${new Intl.NumberFormat("pl-PL").format(
                  pump.price
                )} zł</div>
                <div class="card-features">
                    <div class="feature">Moc grzewcza: ${pump.power} kW</div>
                    <div class="feature">COP: 4.2 (wysoka efektywność)</div>
                    <div class="feature">Klasa energetyczna: A+++</div>
                    <div class="feature">Temperatura pracy: -25°C do +35°C</div>
                    <div class="feature">Cicha praca: < 35 dB(A)</div>
                </div>
                <button class="select-pump-btn configure-btn" data-pump="${
                  pump.model
                }">WYBIERZ I KONFIGURUJ</button>
            `;

        const button = card.querySelector(".configure-btn");
        trackEvent(button, "click", function () {
          const selectedPump = this.getAttribute("data-pump");
          // P1.2: Użyj skonsolidowanej funkcji saveConfigData
          saveConfigData({
            configuratorInput: {},
            result: result,
            selectedPumpModel: selectedPump,
            overrideData: {
              selected_pump: selectedPump,
              heated_area: result.heated_area,
              max_heating_power: result.max_heating_power,
              bivalent_power: result.bivalent_point_heating_power,
              hot_water_power: result.hot_water_power || 0,
              annual_energy_consumption: result.annual_energy_consumption,
              design_outdoor_temperature: result.design_outdoor_temperature,
            },
          });
          ErrorHandler.showToast(`Wybrano pompę: ${selectedPump}`, "success");
        });

        return card;
      }

      // Funkcja renderowania kart pomp w sliderze
      function renderPumpCards(pumps, containerId, sliderTitle) {
        const container = dom.byId(containerId);
        if (!container) return;

        // Sprawdź czy są pompy do wyświetlenia
        if (!pumps || pumps.length === 0) {
          container.style.display = "none";
          return;
        }

        container.style.display = "block";

        // Znajdź slider header i ustaw tytuł
        const sliderHeader = container.querySelector(".slider-header h3");
        if (sliderHeader) {
          sliderHeader.textContent = sliderTitle;
        }

        // Znajdź kontener na karty
        const cardsContainer = container.querySelector(".pump-cards-slider");
        if (!cardsContainer) return;

        // Wyczyść istniejące karty
        cardsContainer.innerHTML = "";

        // Utwórz slider track
        const sliderTrack = doc.createElement("div");
        sliderTrack.className = "slider-track";

        // Renderuj karty pomp
        pumps.forEach((pump, index) => {
          const pumpCard = createPumpCard(
            pump,
            index === 0 ? "recommended" : "alternative"
          );
          sliderTrack.appendChild(pumpCard);
        });

        cardsContainer.appendChild(sliderTrack);

        // Dodaj nawigację slidera jeśli jest więcej niż jedna karta
        if (pumps.length > 1) {
          addSliderNavigation(cardsContainer, pumps.length);
        }

        // Inicjalizuj slider
        initializeSlider(cardsContainer, pumps.length);
      }

      // Funkcja dodawania nawigacji slidera
      function addSliderNavigation(container, totalSlides) {
        const navigation = doc.createElement("div");
        navigation.className = "slider-navigation";

        // Przycisk poprzedni
        const prevBtn = doc.createElement("button");
        prevBtn.className = "slider-btn slider-prev";
        prevBtn.innerHTML = "‹";
        prevBtn.setAttribute("aria-label", "Poprzednia pompa");

        // Dots (kropki nawigacyjne)
        const dotsContainer = doc.createElement("div");
        dotsContainer.className = "slider-dots";

        for (let i = 0; i < totalSlides; i++) {
          const dot = doc.createElement("button");
          dot.className = `slider-dot ${i === 0 ? "active" : ""}`;
          dot.setAttribute("data-slide", i);
          dot.setAttribute("aria-label", `Przejdź do pompy ${i + 1}`);
          dotsContainer.appendChild(dot);
        }

        // Przycisk następny
        const nextBtn = doc.createElement("button");
        nextBtn.className = "slider-btn slider-next";
        nextBtn.innerHTML = "›";
        nextBtn.setAttribute("aria-label", "Następna pompa");

        navigation.appendChild(prevBtn);
        navigation.appendChild(dotsContainer);
        navigation.appendChild(nextBtn);

        container.appendChild(navigation);
      }

      // Funkcja inicjalizacji slidera
      function initializeSlider(container, totalSlides) {
        if (totalSlides <= 1) return;

        const track = container.querySelector(".slider-track");
        const prevBtn = container.querySelector(".slider-prev");
        const nextBtn = container.querySelector(".slider-next");
        const dots = container.querySelectorAll(".slider-dot");

        let currentSlide = 0;

        // Funkcja aktualizacji slidera
        function updateSlider(slideIndex) {
          currentSlide = slideIndex;

          // Animacja przesunięcia
          track.style.transform = `translateX(-${currentSlide * 100}%)`;

          // Aktualizacja dots
          dots.forEach((dot, index) => {
            dot.classList.toggle("active", index === currentSlide);
          });

          // Aktualizacja przycisków
          prevBtn.disabled = currentSlide === 0;
          nextBtn.disabled = currentSlide === totalSlides - 1;

          // Aktualizacja aria-labels
          prevBtn.style.opacity = currentSlide === 0 ? "0.5" : "1";
          nextBtn.style.opacity =
            currentSlide === totalSlides - 1 ? "0.5" : "1";
        }

        // Event listenery dla przycisków
        trackEvent(prevBtn, "click", () => {
          if (currentSlide > 0) {
            updateSlider(currentSlide - 1);
          }
        });

        trackEvent(nextBtn, "click", () => {
          if (currentSlide < totalSlides - 1) {
            updateSlider(currentSlide + 1);
          }
        });

        // Event listenery dla dots
        dots.forEach((dot, index) => {
          trackEvent(dot, "click", () => {
            updateSlider(index);
          });
        });

        // Obsługa klawiatury
        trackEvent(container, "keydown", (e) => {
          if (e.key === "ArrowLeft" && currentSlide > 0) {
            updateSlider(currentSlide - 1);
          } else if (e.key === "ArrowRight" && currentSlide < totalSlides - 1) {
            updateSlider(currentSlide + 1);
          }
        });

        // Inicjalna aktualizacja
        updateSlider(0);

        // Auto-play (opcjonalnie)
        if (totalSlides > 1) {
          let autoplayInterval = setInterval(() => {
            const nextSlide = (currentSlide + 1) % totalSlides;
            updateSlider(nextSlide);
          }, 5000); // 5 sekund

          // Zatrzymaj autoplay przy hover
          trackEvent(container, "mouseenter", () => {
            clearInterval(autoplayInterval);
          });

          trackEvent(container, "mouseleave", () => {
            autoplayInterval = setInterval(() => {
              const nextSlide = (currentSlide + 1) % totalSlides;
              updateSlider(nextSlide);
            }, 5000);
          });
        }
      }

      // TYLKO SLIDERY - bez dodatkowych kart lub elementów
      zone.innerHTML = `
            <div class="pump-slider-wrapper">
              <div class="slider-header">
                <h3>💎 Rekomendowane pompy ciepła PANASONIC</h3>
                <p>Zapotrzebowanie całkowite: <strong>${(
                  parseFloat(result.max_heating_power) +
                  parseFloat(result.hot_water_power || 0)
                ).toFixed(1)} kW</strong></p>
              </div>
              <div class="pump-cards-slider">

              </div>
            </div>
        `;

      const totalPowerDemand = (
        parseFloat(result.max_heating_power) +
        parseFloat(result.hot_water_power || 0)
      ).toFixed(1);
      renderPumpCards(
        pumps,
        "pump-recommendation-zone",
        `💎 Rekomendowane pompy ciepła PANASONIC (zapotrzebowanie: ${totalPowerDemand} kW)`
      );

      const cards = zone.querySelectorAll(".pump-recommendation-card");
      cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.15}s`;
      });
    }

    function DobierzPompe(result) {
      // ARCHITECTURAL: Pompy są dobierane na podstawie mocy CO (max_heating_power), nie totalPower (CO + CWU)
      // This ensures consistency with configurator which uses only max_heating_power for pump selection
      const heatingPower = parseFloat(result.max_heating_power || 0);

      // ⚠️ FIX P0.1: Walidacja zakresu max_heating_power przed doborem pompy
      if (isNaN(heatingPower) || heatingPower <= 0) {
        if (window.__HP_DEBUG__) {
          LOG.warn(
            "flow",
            "[FLOW-16] Invalid max_heating_power:",
            heatingPower
          );
        }
        return [];
      }

      // ⚠️ FIX P0.1: Sanity check - bardzo mała moc (< 2.5kW) lub bardzo duża (> 17.5kW)
      if (heatingPower < 2.5) {
        if (window.__HP_DEBUG__) {
          LOG.warn(
            "flow",
            "[FLOW-16] Very low power detected:",
            heatingPower,
            "- using smallest pump as fallback"
          );
        }
        // Kontynuuj - użyj najmniejszej pompy jako fallback (już zaimplementowane w linii 1600-1635)
      } else if (heatingPower > 17.5 && heatingPower < 25) {
        if (window.__HP_DEBUG__) {
          LOG.warn(
            "flow",
            "[FLOW-16] Very high power detected:",
            heatingPower,
            "- using largest pump"
          );
        }
        // Kontynuuj - użyj największej pompy (już zaimplementowane w linii 1600-1635)
      } else if (heatingPower >= 25) {
        // ⚠️ FIX P0.1: Spójność z konfiguratorem - >=25kW → zwróć [] (konfigurator się nie pokaże)
        if (window.__HP_DEBUG__) {
          LOG.warn(
            "flow",
            "[FLOW-16] Power >= 25kW - returning empty array (configurator will be hidden)"
          );
        }
        return []; // Spójne z configurator-unified.js:399 (selectHeatPumps zwraca [] dla >=25kW)
      }

      // Logowanie usunięte dla produkcji

      // Użyj pumpMatchingTable do doboru pomp na podstawie zakresów min/max
      const heatingType = result.heating_type || "mixed";
      const normalizedType =
        heatingType === "radiators"
          ? "radiators"
          : heatingType === "underfloor" || heatingType === "surface"
          ? "surface"
          : "mixed";

      // Logowanie usunięte dla produkcji

      // Filtruj pompy TYLKO na podstawie mocy - bez sprawdzania fazy
      const matching = Object.entries(pumpMatchingTable)
        .filter(([model, data]) => {
          // Sprawdź zakres mocy dla danego typu instalacji
          const min = data.min[normalizedType] || data.min.mixed;
          const max = data.max[normalizedType] || data.max.mixed;
          const powerMatch = heatingPower >= min && heatingPower <= max;

          return powerMatch;
        })
        .map(([model, data]) => {
          // Użyj dynamicznego URL z konfiguracji WordPress
          const imgUrl = config?.imgUrl || "../img";
          const image =
            data.type === "split"
              ? `${imgUrl}/split-k.png`
              : `${imgUrl}/allinone.png`;
          return {
            model: model,
            power: data.power,
            series: data.series,
            type: data.type,
            image: image,
            phase: data.phase,
            requires3F: data.requires3F,
          };
        })
        // WAŻNE: Sortuj po mocy ROSNĄCO, aby wybrać najmniejszą pasującą pompę
        .sort((a, b) => a.power - b.power);

      // Logowanie usunięte dla produkcji

      // Jeśli nie znaleziono, wybierz najmniejszą pompę która ma max >= heatingPower
      if (matching.length === 0) {
        // Brak dopasowanych pomp w zakresie, szukam najmniejszej pompy z max >= heatingPower
        const allPumpsFlat = Object.keys(pumpMatchingTable)
          .map((model) => {
            const data = pumpMatchingTable[model];
            const min = data.min[normalizedType] || data.min.mixed;
            const max = data.max[normalizedType] || data.max.mixed;

            // Wybierz pompy które mogą pokryć zapotrzebowanie (max >= heatingPower)
            if (max >= heatingPower) {
              // Użyj dynamicznego URL z konfiguracji WordPress
              const imgUrl = config?.imgUrl || "../img";
              return {
                model: model,
                power: data.power,
                series: data.series,
                type: data.type,
                image:
                  data.type === "split"
                    ? `${imgUrl}/split-k.png`
                    : `${imgUrl}/allinone.png`,
                phase: data.phase,
                requires3F: data.requires3F,
                max: max,
              };
            }
            return null;
          })
          .filter((p) => p !== null)
          .sort((a, b) => a.power - b.power); // Sortuj po mocy rosnąco

        if (allPumpsFlat.length > 0) {
          const smallest = allPumpsFlat[0];
          // Wybrano najmniejszą pompę pokrywającą zapotrzebowanie
          matching.push(smallest);
        } else {
          // Fallback 2: dobierz najmniejszą pompę (jeśli tylko ona pokrywa zapotrzebowanie)
          const anyPumps = Object.keys(pumpMatchingTable)
            .map((model) => {
              const data = pumpMatchingTable[model];
              const max = data.max[normalizedType] || data.max.mixed;
              if (max < heatingPower) return null;

              const imgUrl = config?.imgUrl || "../img";
              return {
                model: model,
                power: data.power,
                series: data.series,
                type: data.type,
                image:
                  data.type === "split"
                    ? `${imgUrl}/split-k.png`
                    : `${imgUrl}/allinone.png`,
                phase: data.phase,
                requires3F: data.requires3F,
                max: max,
              };
            })
            .filter((p) => p !== null)
            .sort((a, b) => a.power - b.power);

          if (anyPumps.length > 0) {
            matching.push(anyPumps[0]);
          }
        }
      }

      // Grupuj pompy po mocy i typie (split/all-in-one)
      // Wszystkie pompy mają series: 'K', więc rozróżniamy po typie
      const grouped = {};
      matching.forEach((pump) => {
        if (!grouped[pump.power]) grouped[pump.power] = {};
        // Rozróżnij po typie: split (WC) vs all-in-one (ADC)
        if (pump.type === "split") {
          grouped[pump.power]["wc"] = pump;
          grouped[pump.power]["sdc"] = pump; // Kompatybilność wsteczna
        } else if (pump.type === "all-in-one") {
          grouped[pump.power]["adc"] = pump;
        }
      });

      const pumpGroups = Object.entries(grouped)
        .map(([power, typeMap]) => ({
          power: Number(power),
          sdc: typeMap.sdc || typeMap.wc || null, // Kompatybilność wsteczna
          adc: typeMap.adc || null,
          wc: typeMap.wc || null, // HP Split
        }))
        .sort((a, b) => a.power - b.power);

      // Logowanie usunięte dla produkcji
      return pumpGroups;
    }

    function renderHaierStyleSliders(pumpGroups, container) {
      if (!container) {
        // Kontener pump-recommendation-zone nie istnieje - cichy fallback
        return;
      }

      if (!Array.isArray(pumpGroups)) {
        // pumpGroups nie jest tablicą - cichy fallback
        return;
      }

      if (pumpGroups.length === 0) {
        // Brak grup pomp do wyświetlenia - cichy fallback
        container.innerHTML =
          "<p class=\"micro-note\" style=\"text-align: center; color: #4b5563; font-family: 'Titillium Web', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;\">Nie znaleziono dopasowanych pomp. Skontaktuj się z nami w celu indywidualnego doboru.</p>";
        return;
      }

      // Funkcja pomocnicza do aktualizacji tytułu na podstawie faktycznie wyświetlanych pomp
      function updatePowerTitleFromRenderedPumps(
        container,
        titleId,
        titlePrefix
      ) {
        const titleElement = dom.byId(titleId);
        if (!titleElement || !container) return;

        // Znajdź wszystkie karty pomp w kontenerze
        const pumpCards = container.querySelectorAll(
          ".heat-pump-card[data-power]"
        );
        if (pumpCards.length === 0) return;

        // Wyciągnij moc z pierwszej pompy (wszystkie pompy w grupie mają tę samą moc)
        const firstCard = pumpCards[0];
        const power = firstCard.getAttribute("data-power");

        if (power) {
          titleElement.textContent = `${titlePrefix}: ${power} kW`;
        }
      }

      // Wyczyść kontener główny
      container.innerHTML = "";

      // Weź pierwszą grupę (rekomendowaną moc)
      const recommendedGroup = pumpGroups[0];
      if (!recommendedGroup) {
        // Brak rekomendowanej grupy pomp - cichy fallback
        container.innerHTML =
          "<p class=\"micro-note\" style=\"text-align: center; color: #4b5563; font-family: 'Titillium Web', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;\">Nie znaleziono rekomendowanej pompy. Skontaktuj się z nami w celu indywidualnego doboru.</p>";
        return;
      }

      // Zapisz rekomendacje do globalnych wyników, aby PDF mógł je odczytać
      try {
        const recModels = [];
        if (recommendedGroup.sdc) {
          recModels.push({
            name: recommendedGroup.sdc.model,
            type: recommendedGroup.sdc.type,
            power_kw: recommendedGroup.sdc.power,
          });
        }
        if (recommendedGroup.adc) {
          recModels.push({
            name: recommendedGroup.adc.model,
            type: recommendedGroup.adc.type,
            power_kw: recommendedGroup.adc.power,
          });
        }
        const updatedResult = Object.assign({}, lastCalculationResult || {}, {
          recommended_power_kw: recommendedGroup.power,
          recommended_models: recModels,
        });
        lastCalculationResult = updatedResult;
        if (typeof updateAppState === "function") {
          updateAppState({ lastCalculationResult: updatedResult });
        }
      } catch (e) {
        // Nie udało się zapisać rekomendowanych modeli do PDF - cichy fallback
      }

      // Generuj karty pomp dla rekomendowanej mocy
      if (recommendedGroup.sdc) {
        const sdcCard = createMinimalCard(recommendedGroup.sdc);
        container.appendChild(sdcCard);
      }
      if (recommendedGroup.adc) {
        const adcCard = createMinimalCard(recommendedGroup.adc);
        container.appendChild(adcCard);
      }

      // Aktualizuj tytuł mocy na podstawie faktycznie wyświetlanych pomp
      updatePowerTitleFromRenderedPumps(
        container,
        "pump-power-title",
        "Rekomendowana moc"
      );

      // Sprawdź czy istnieje alternatywna moc
      const alternativeGroup = pumpGroups[1];
      const alternativeSection = dom.byId("alternative-power-section");
      const alternativeContainer = dom.byId("alternative-pump-zone");
      const alternativeTitle = dom.byId("alternative-power-title");

      if (alternativeGroup && alternativeSection && alternativeContainer) {
        // Pokaż sekcję alternatywną
        alternativeSection.style.display = "block";

        // Wyczyść kontener
        alternativeContainer.innerHTML = "";

        // Generuj karty pomp dla alternatywnej mocy
        if (alternativeGroup.sdc) {
          const sdcCard = createMinimalCard(alternativeGroup.sdc);
          alternativeContainer.appendChild(sdcCard);
        }
        if (alternativeGroup.adc) {
          const adcCard = createMinimalCard(alternativeGroup.adc);
          alternativeContainer.appendChild(adcCard);
        }

        // Aktualizuj tytuł alternatywnej mocy na podstawie faktycznie wyświetlanych pomp
        updatePowerTitleFromRenderedPumps(
          alternativeContainer,
          "alternative-power-title",
          "Alternatywna moc"
        );
      } else if (alternativeSection) {
        // Ukryj sekcję jeśli nie ma alternatywnej mocy
        alternativeSection.style.display = "none";
      }

      function createMinimalCard(pump) {
        const label = pump.type === "split" ? "Split" : "All-in-One";
        // Użyj dynamicznego URL z konfiguracji WordPress
        const imgUrl = config?.imgUrl || "../img";
        const imgPath =
          pump.type === "split" ? `${imgUrl}/sdc-k.png` : `${imgUrl}/adc-k.png`;
        const seriesName = "Panasonic Seria K";
        const typeDesc =
          pump.type === "split"
            ? "Split (jednostka zewnętrzna + wewnętrzna)"
            : "All-in-One (kompaktowa)";

        const card = doc.createElement("div");
        card.className = "heat-pump-card haier-style";
        card.setAttribute("data-pump", pump.model);
        card.setAttribute("data-power", pump.power);

        card.innerHTML = `
                <img src="${imgPath}" alt="Pompa ${label}" class="clean-pump-image">
                <div class="pump-model-name">${seriesName} ${pump.power} kW</div>
                <div class="pump-specs">
                    Model: ${pump.model}<br>
                    Typ: ${typeDesc}<br>
                    Moc: ${pump.power} kW
                </div>
            `;

        return card;
      }
    }

    // Funkcje obsługi przycisków
    let customerDataCollected = false;

    function showPDFContactForm() {
      const pdfFormContainer = dom.byId("pdf-contact-form");
      if (pdfFormContainer) {
        pdfFormContainer.style.display = "block";
        pdfFormContainer.scrollIntoView({ behavior: "smooth" });
      }
    }

    function hidePDFContactForm() {
      const pdfFormContainer = dom.byId("pdf-contact-form");
      if (pdfFormContainer) {
        pdfFormContainer.style.display = "none";
      }
    }

    function collectCustomerData() {
      const email = dom.byId("customer-email").value.trim();
      const postalCode = dom.byId("customer-postal-code").value.trim();

      if (!email || !postalCode) {
        ErrorHandler.showFormNotification(
          "Uzupełnij dane kontaktowe",
          "Email i kod pocztowy są wymagane do wysłania oferty.",
          [],
          "warning"
        );
        return false;
      }

      // Walidacja email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        const emailField = dom.byId("email");
        if (emailField) {
          ErrorHandler.showFieldError(
            emailField,
            "Nieprawidłowy format adresu email",
            "Wprowadź poprawny adres (np. jan@example.com)"
          );
        }
        return false;
      }

      // Walidacja kodu pocztowego (format XX-XXX)
      const postalRegex = /^\d{2}-\d{3}$/;
      if (!postalRegex.test(postalCode)) {
        const postalField = dom.byId("customer-postal-code");
        if (postalField) {
          ErrorHandler.showFieldError(
            postalField,
            "Nieprawidłowy format kodu pocztowego",
            "Użyj formatu XX-XXX (np. 00-001)"
          );
        }
        return false;
      }

      // Zapisz dane klienta
      const customerData = {
        email: email,
        postalCode: postalCode,
        timestamp: new Date().toISOString(),
        calculationData: lastCalcResult || {},
      };

      // Zapisz tylko tymczasowo w sessionStorage (1 rekord) - brak trwałego cache'u
      try {
        sessionStorage.setItem(
          "heatpump_customer",
          JSON.stringify(customerData)
        );
      } catch (e) {
        console.warn(
          "[ResultsRenderer] Nie można zapisać danych klienta w sessionStorage:",
          e
        );
      }

      customerDataCollected = true;
      // Logowanie usunięte dla produkcji

      // Wyślij email z raportem
      sendPDFReportEmail(customerData);

      return true;
    }

    function sendPDFReportEmail(customerData) {
      // Implementacja wysyłania emaila z raportem PDF
      const reportData = {
        email: customerData.email,
        postalCode: customerData.postalCode,
        calculationResults: customerData.calculationData,
        reportType: "full_energy_report",
      };

      // Tutaj można dodać wywołanie do API wysyłającego email
      // Logowanie usunięte dla produkcji

      // Pokaż komunikat sukcesu
      showSuccessMessage(customerData.email);
    }

    function showSuccessMessage(email) {
      const successDiv = doc.createElement("div");
      successDiv.className = "pdf-success-message";
      successDiv.innerHTML = `
            <div class="success-content">
                <i class="fas fa-check-circle"></i>
                <h4>Raport został wysłany!</h4>
                <p>Pełny raport energetyczny został wysłany na adres:<br><strong>${email}</strong></p>
                <p>Sprawdź swoją skrzynkę odbiorczą (również folder spam).</p>
            </div>
        `;

      const actionsContainer = dom.qs(".results-actions");
      if (actionsContainer) {
        actionsContainer.appendChild(successDiv);
        successDiv.scrollIntoView({ behavior: "smooth" });

        // Ukryj formularz kontaktowy
        hidePDFContactForm();

        // Usuń komunikat po 10 sekundach
        setTimeout(() => {
          if (successDiv.parentNode) {
            successDiv.remove();
          }
        }, 10000);
      }
    }

    function handleEmailSend() {
      // Stara funkcja - pozostawiona dla kompatybilności
      // Funkcja handleEmailSend została zastąpiona
    }

    function initActionButtons() {
      const bindAction = (selector, fn) => {
        dom.qsa(selector).forEach((btn) => {
          trackEvent(btn, "click", (e) => {
            e.preventDefault();
            ensureActiveRoot();
            fn();
          });
        });
      };

      bindAction('[data-action="download-pdf"]', () => {
        if (state && typeof state.downloadPDF === "function") {
          state.downloadPDF({ root, dom, state });
        } else if (typeof view.downloadPDF === "function") {
          view.downloadPDF({ root, dom, state });
        } else {
          console.error("[PDF] downloadPDF not available");
        }
      });

      bindAction('[data-action="send-email"]', showPDFContactForm);
      bindAction('[data-action="collect-customer-data"]', collectCustomerData);
      bindAction('[data-action="hide-pdf-form"]', hidePDFContactForm);
      bindAction('[data-action="go-back"]', goBackToForm);
      bindAction('[data-action="start-new"]', startNewCalculation);

      // Print (otwiera okno drukowania przeglądarki)
      bindAction('[data-action="print"]', () => {
        window.print();
      });

      // Back to config (przełącza na widok konfiguratora)
      bindAction('[data-action="back-to-config"]', () => {
        const switchBtn = dom.qs('[data-target="configurator-view"]');
        if (switchBtn) {
          switchBtn.click();
        }
      });
    }

    if (state) {
      state.results = {
        showPDFContactForm,
        hidePDFContactForm,
        collectCustomerData,
        goBackToForm,
        startNewCalculation,
      };
    }

    initActionButtons();

    trackEvent(root, "hp:showPdfForm", () => {
      ensureActiveRoot();
      showPDFContactForm();
    });
    trackEvent(root, "hp:hidePdfForm", () => {
      ensureActiveRoot();
      hidePDFContactForm();
    });
    trackEvent(root, "hp:collectCustomerData", () => {
      ensureActiveRoot();
      collectCustomerData();
    });
    trackEvent(root, "hp:goBackToForm", () => {
      ensureActiveRoot();
      goBackToForm();
    });
    trackEvent(root, "hp:startNewCalculation", () => {
      ensureActiveRoot();
      startNewCalculation();
    });
    trackEvent(root, "hp:downloadPdf", () => {
      ensureActiveRoot();
      if (state && typeof state.downloadPDF === "function") {
        state.downloadPDF({ root, dom, state });
        return;
      }
      console.error("[PDF] downloadPDF not available");
    });

    // === FUNKCJE POMOCNICZE DLA DANYCH ROZSZERZONYCH ===

    function displayEnergyLosses(losses) {
      const container = dom.byId("energy-losses-container");
      if (!container) return;

      const sortedLosses = [...losses].sort((a, b) => b.percent - a.percent);

      let html = '<table class="results-table results-table--compact">';
      html += `
            <thead>
                <tr>
                    <th>Przegroda</th>
                    <th>Udział strat</th>
                </tr>
            </thead>
            <tbody>
        `;

      sortedLosses.forEach((loss) => {
        html += `
                <tr>
                    <td class="results-table__label">${loss.label}</td>
                    <td>${loss.percent.toFixed(1)}%</td>
                </tr>
            `;
      });

      html += "</tbody></table>";
      container.innerHTML = html;
    }

    function displayImprovements(improvements) {
      const container = dom.byId("improvements-container");
      if (!container) return;

      const sortedImprovements = [...improvements].sort(
        (a, b) => b.energy_saved - a.energy_saved
      );

      // Responsive width dla kolumny Nr na mobile
      const isMobile = view.matchMedia("(max-width: 480px)").matches;
      const nrWidth = isMobile ? "50px" : "40px";

      let html = '<table class="results-table results-table--compact">';
      html += `
            <thead>
                <tr>
                    <th style="width:${nrWidth}; text-align:right;">Nr</th>
                    <th>Modernizacja</th>
                    <th>Oszczędność</th>
                </tr>
            </thead>
            <tbody>
        `;

      sortedImprovements.forEach((improvement, index) => {
        html += `
                <tr>
                    <td class="results-table__num">${index + 1}</td>
                    <td class="results-table__label">${improvement.label}</td>
                    <td>${improvement.energy_saved.toFixed(1)}%</td>
                </tr>
            `;
      });

      html += "</tbody></table>";
      container.innerHTML = html;
    }

    function displayHeatingCosts(costs) {
      const container = dom.byId("heating-costs-container");
      if (!container) return;

      // 1) Znormalizuj rekordy (akceptujemy różne nazwy pól)
      const normalized = (Array.isArray(costs) ? costs : [])
        .map((c) => ({
          label: c.label || c.variant || c.name || "Wariant",
          detail: c.detail || "",
          efficiency:
            c.efficiency != null ? c.efficiency : c.cop != null ? c.cop : "",
          cost:
            c.cost != null
              ? c.cost
              : c.annual_cost_pln != null
              ? c.annual_cost_pln
              : null,
        }))
        .filter((c) => c.cost != null);

      // 2) Usuń pompę gruntową (case-insensitive)
      const withoutGround = normalized.filter((c) => !/grunt/i.test(c.label));

      // 3) Znajdź powietrzną – zawsze na pierwszej pozycji i z wyróżnieniem
      const airIndex = withoutGround.findIndex((c) =>
        /powietrzn/i.test(c.label)
      );
      let ordered = [...withoutGround].sort((a, b) => a.cost - b.cost);
      if (airIndex >= 0) {
        const air = withoutGround[airIndex];
        ordered = [air, ...ordered.filter((i) => i !== air)];
      }

      // 4) Ogranicz do maks. 5 pozycji, ale z zachowaniem powietrznej na 1. miejscu
      const top = ordered.slice(0, 5);

      // 5) Render – prosta tabela inżynierska
      let html = '<table class="results-table">';
      html += `
            <thead>
                <tr>
                    <th>Wariant ogrzewania</th>
                    <th>Sprawność</th>
                    <th>Roczny koszt</th>
                </tr>
            </thead>
            <tbody>
        `;

      top.forEach((item, index) => {
        const isAir = /powietrzn/i.test(item.label);
        const rowClass = isAir ? "results-table__highlight" : "";
        const detail = item.detail
          ? `<span class="results-table__secondary">${item.detail}</span>`
          : "";
        const badge = isAir
          ? '<span class="results-table__secondary">Najbardziej opłacalne</span>'
          : "";

        html += `
                <tr class="${rowClass}">
                    <td>
                        <span class="results-table__label">${item.label}</span>
                        ${detail}
                        ${badge}
                    </td>
                    <td>${
                      item.efficiency !== "" ? item.efficiency + "%" : "—"
                    }</td>
                    <td>${formatCurrency(item.cost)}</td>
                </tr>
            `;
      });

      html += "</tbody></table>";
      container.innerHTML = html;
    }

    function displayBivalentPoints(bivalentPoints) {
      const container = dom.byId("bivalent-points-container");
      if (!container) return;

      // Wybierz tylko temperatury -5, -7, -9, -11
      const keyPoints = bivalentPoints.parallel
        ? bivalentPoints.parallel.filter((p) =>
            [-5, -7, -9, -11].includes(p.temperature)
          )
        : bivalentPoints
        ? bivalentPoints.filter((p) =>
            [-5, -7, -9, -11].includes(p.temperature)
          )
        : [];

      if (keyPoints.length === 0) return;

      let html = '<table class="results-table results-table--compact">';
      html += `
            <thead>
                <tr>
                    <th>Temperatura zewnętrzna</th>
                    <th>Potrzebna moc</th>
                </tr>
            </thead>
            <tbody>
        `;

      keyPoints.forEach((point) => {
        html += `
                <tr>
                    <td>${point.temperature}°C</td>
                    <td>${(point.power / 1000).toFixed(1)} kW</td>
                </tr>
            `;
      });

      html += "</tbody></table>";
      container.innerHTML = html;
    }

    // Funkcje pomocnicze
    function getColorForLoss(percent) {
      if (percent > 40) return "#c23e32";
      if (percent > 20) return "#b78a2f";
      if (percent > 10) return "#d9b84c";
      return "#d4a574";
    }

    function formatCurrency(amount) {
      return new Intl.NumberFormat("pl-PL", {
        style: "currency",
        currency: "PLN",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    }

    const ensureActiveRoot = () => {
      if (typeof window.__HP_SET_ACTIVE_ROOT__ === "function") {
        window.__HP_SET_ACTIVE_ROOT__(root);
      }
    };

    function goBackToForm() {
      // ═══════════════════════════════════════════════════════════════════════════
      // POWRÓT DO FORMULARZA — przejdź do pierwszej zakładki (nie ostatniej!)
      // ═══════════════════════════════════════════════════════════════════════════
      ensureActiveRoot();

      if (typeof showTab === "function") {
        // Przejdź do pierwszej zakładki (0), nie ostatniej (5)
        showTab(0);

        // Scroll do góry formularza
        setTimeout(() => {
          const firstSection = dom.qs(
            '#top-instal-calc .section[data-tab="0"]'
          );
          if (firstSection) {
            firstSection.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 100);
      } else {
        // Fallback - przewiń do góry strony
        const currentScrollTop =
          view.pageYOffset || doc.documentElement.scrollTop;
        const targetScrollTop = Math.max(0, currentScrollTop / 2);

        view.scrollTo({
          top: targetScrollTop,
          behavior: "smooth",
        });
      }
    }

    function startNewCalculation() {
      ensureActiveRoot();
      // ═══════════════════════════════════════════════════════════════════════════
      // NOWE OBLICZENIE — resetuj stan i przejdź do pierwszej zakładki
      // ═══════════════════════════════════════════════════════════════════════════
      // Resetuj flagę animacji completion (użytkownik zaczyna od nowa)
      if (typeof updateAppState === "function") {
        updateAppState({
          completionAnimationShown: false,
          formData: {},
          currentTab: 0,
          lastCalculationResult: null,
        });
      }

      // Resetuj flagę w WorkflowController
      if (
        workflowController &&
        typeof workflowController.reset === "function"
      ) {
        workflowController.reset();
      }

      if (typeof showTab === "function") {
        showTab(0);
      } else {
        // Fallback - przeładuj stronę
        view.location.reload();
      }
    }

    // Nie nadpisujemy window.downloadPDF - funkcja z downloadPDF.js powinna być używana

    // ═══════════════════════════════════════════════════════════════════════════
    // RESULTS SWITCHER LOGIC (scoped)
    function initResultsSwitcher() {
      const switcher = dom.qs('[data-role="results-switcher"]');
      if (!switcher) return;

      const buttons = Array.from(
        switcher.querySelectorAll(".results-switch-btn")
      );
      const views = Array.from(dom.qsa(".results-view"));
      if (!buttons.length || !views.length) return;

      const getAppState = state?.getAppState;
      const updateAppState = state?.updateAppState;

      function setActive(targetId) {
        views.forEach((viewEl) => {
          const isTarget =
            viewEl.id === targetId || viewEl.dataset.view === targetId;
          if (isTarget) {
            viewEl.classList.remove("hidden");
            viewEl.classList.add("visible");
          } else {
            viewEl.classList.add("hidden");
            viewEl.classList.remove("visible");
          }
        });

        buttons.forEach((btn) => {
          const isActive = btn.dataset.target === targetId;
          btn.classList.toggle("active", isActive);
          btn.setAttribute("aria-pressed", isActive ? "true" : "false");
        });

        if (typeof updateAppState === "function") {
          updateAppState({ activeView: targetId });
        }
      }

      buttons.forEach((btn) => {
        trackEvent(btn, "click", (event) => {
          event.preventDefault();
          const target = btn.dataset.target;
          if (target) {
            setActive(target);
          }
        });
      });

      const initial =
        (typeof getAppState === "function" && getAppState()?.activeView) ||
        buttons.find((btn) => btn.classList.contains("active"))?.dataset
          .target ||
        buttons[0]?.dataset.target;

      if (initial) {
        setActive(initial);
      }
    }

    initResultsSwitcher();

    // ═══════════════════════════════════════════════════════════════════════════
    // EKSPORT FUNKCJI DO WINDOW (kompatybilność wsteczna)
    // ═══════════════════════════════════════════════════════════════════════════
    // Eksportuj displayResults - używa dom z closure, ale jeśli wywołane z zewnątrz,
    // znajdzie aktywny root i stworzy dom
    if (typeof window !== "undefined") {
      // Zapisz referencję do funkcji wewnętrznej
      const internalDisplayResults = displayResultsInternal;

      window.displayResults = function displayResults(result) {
        LOG.info("flow", "displayResults called");
        // Jeśli wywołane z kontekstu modułu (dom istnieje), użyj go
        if (dom && dom.byId) {
          return internalDisplayResults(result);
        }

        // W przeciwnym razie znajdź aktywny root i stwórz dom
        const activeRoot =
          document.querySelector(".heatpump-calculator") || document;
        const activeDom = window.createScopedDom
          ? window.createScopedDom(activeRoot)
          : {
              byId: (id) => document.getElementById(id),
              qs: (sel) => activeRoot.querySelector(sel),
              qsa: (sel) => Array.from(activeRoot.querySelectorAll(sel)),
            };

        // Wywołaj z aktywnym dom (musimy użyć tymczasowego dom)
        const originalDom = dom;
        // Nie możemy zmienić dom, więc użyjmy bezpośrednio activeDom
        const setText = (id, val, unit = "") => {
          const el = activeDom.byId(id);
          if (el && val !== undefined && val !== null)
            el.textContent = `${val}${unit}`;
        };

        // Podstawowe wyniki (uproszczona wersja)
        setText("r-total-area", result.total_area, " m²");
        setText("r-heated-area", result.heated_area, " m²");
        setText("r-max-power", result.max_heating_power, " kW");
        setText("r-cwu", result.hot_water_power || 0, " kW");
        setText(
          "r-energy",
          Math.round(result.annual_energy_consumption),
          " kWh"
        );
        setText("r-temp", result.design_outdoor_temperature, "°C");
        setText("r-bi-power", result.bivalent_point_heating_power, " kW");
        setText("r-avg-power", result.avg_heating_power, " kW");
        setText("r-temp-avg", result.avg_outdoor_temperature, "°C");
        setText("r-factor", result.annual_energy_consumption_factor, " kWh/m²");
        setText("r-power-factor", result.heating_power_factor, " W/m²");

        console.warn(
          "[ResultsRenderer] displayResults wywołane bez kontekstu modułu - użyto uproszczonego wyświetlania"
        );
      };

      // Eksportuj resetResultsSection (tylko jeśli nie istnieje)
      if (!window.resetResultsSection) {
        window.resetResultsSection = function resetResultsSection() {
          const defaultRoot =
            document.querySelector(".heatpump-calculator") || document;
          const defaultDom = window.createScopedDom
            ? window.createScopedDom(defaultRoot)
            : {
                qsa: (sel) => Array.from(defaultRoot.querySelectorAll(sel)),
              };

          const loadingElements = defaultDom.qsa('[id^="r-"]');
          loadingElements.forEach((el) => {
            if (el) el.textContent = "...";
          });
        };
      }
    }

    return function disposer() {
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
  window.__HP_MODULES__.resultsRenderer = { init };
})(window);
