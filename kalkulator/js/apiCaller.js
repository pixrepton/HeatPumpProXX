// === FILE: apiCaller.js ===
// 🧠 Obsługuje: Wywołanie API do obliczeń OZC (używa ozc-engine.js jako głównego, cieplo-proxy.php jako fallback)

(function (window) {
  "use strict";

  const LOG = (typeof window !== "undefined" && window.HP_LOG) || {
    info: function () {},
    warn: function () {},
    error: function () {},
    group: function () {},
    groupEnd: function () {},
  };

  LOG.info("module:apiCaller", "loaded");

  let isAPICallInProgress = false;

  /**
   * Wywołuje obliczenia OZC używając ozc-engine.js jako głównego, cieplo-proxy.php jako fallback
   *
   * @param {Object} payload - Dane wejściowe w formacie CieploApiPayload
   * @returns {Promise<Object>} - Wynik obliczeń
   */
  async function callCieplo(payload) {
    console.log("🚀 [FLOW-1] callCieplo() STARTED");
    console.log("📦 [FLOW-1] Payload:", payload);

    if (isAPICallInProgress) {
      console.warn("⚠️ [FLOW-1] API call already in progress - skipping");
      LOG.warn("flow", "API call skipped – already in progress");
      return { success: false, error: "Call already in progress" };
    }

    isAPICallInProgress = true;

    try {
      console.log("✅ [FLOW-2] API calculation started");
      LOG.info("flow", "API calculation started");

      // Ensure ozcEngineManager is available before use
      if (typeof window.__ensureOzcEngineManager === "function") {
        window.__ensureOzcEngineManager();
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // PRIORYTET 1: Użyj ozc-engine.js (lokalny silnik przez manager)
      // ═══════════════════════════════════════════════════════════════════════════
      // Użyj ozcEngineManager jako jedynego lokalnego źródła obliczeń
      if (
        window.ozcEngineManager &&
        typeof window.ozcEngineManager.calculate === "function"
      ) {
        try {
          console.log("🔧 [FLOW-3] Using ozcEngineManager (local engine)");
          LOG.info("flow", "Using ozcEngineManager (local engine)");

          const result = await window.ozcEngineManager.calculate(payload);
          console.log("✅ [FLOW-4] ozcEngineManager.calculate() finished");
          console.log("📊 [FLOW-4] Result:", result);

          // ⚠️ DEV MODE: W trybie quick-scenario ignoruj błędy walidacji
          // Sprawdź czy to quick-scenario (payload może mieć flagę lub możemy sprawdzić kontekst)
          const isQuickScenario = window.__quickScenarioActive || false;

          // ✅ FIXED: Sprawdź czy wynik zawiera błędy walidacji (tylko jeśli NIE jest quick-scenario)
          if (!isQuickScenario && result && result.errors && Object.keys(result.errors).length > 0) {
            console.warn("⚠️ [FLOW-4] Validation errors detected:", result.errors);
            isAPICallInProgress = false;

            // Wyświetl błędy użytkownikowi
            let errorMessage = "❌ Błędy walidacji:\n\n";
            Object.entries(result.errors).forEach(([field, message]) => {
              errorMessage += `• ${field}: ${message}\n`;
            });

            if (typeof ErrorHandler !== "undefined" && ErrorHandler.showToast) {
              ErrorHandler.showToast(errorMessage, "error");
            }

            return {
              success: false,
              errors: result.errors,
              message: "Validation Failed",
            };
          }

          // ⚠️ DEV MODE: W quick-scenario loguj błędy, ale kontynuuj
          if (isQuickScenario && result && result.errors && Object.keys(result.errors).length > 0) {
            console.warn("⚠️ [FLOW-4] Quick Scenario: Validation errors (ignored in dev mode):", result.errors);
          }

          // Konwertuj wynik do formatu cieplo.app
          console.log("🔄 [FLOW-5] Converting to cieplo.app format...");
          let finalResult = window.ozcEngineManager.convertToCieploAppFormat(
            result,
            payload
          );
          console.log("✅ [FLOW-5] Conversion finished");
          console.log("📊 [FLOW-5] Final result:", finalResult);

          LOG.info("flow", "Calculation finished via ozcEngineManager", {
            source: "ozcEngineManager",
          });

          // Przejdź do zakładki wyników (index 5, bo zakładki są 0-5)
          console.log("🔀 [FLOW-6] Switching to results tab (showTab(5))...");
          if (typeof window.showTab === "function") {
            window.showTab(5);
            console.log("✅ [FLOW-6] Switched to results tab");
          } else {
            console.error("❌ [FLOW-6] window.showTab is not available!");
          }

          // Zapisz wynik
          console.log("💾 [FLOW-7] Saving result to window.lastCalculationResult");
          window.lastCalculationResult = finalResult;

          // Wyświetl workflow completion animation OD RAZU (ekran 0 konfiguratora)
          console.log("🎬 [FLOW-8] Showing workflow completion animation (screen 0)...");
          if (typeof window.showWorkflowCompletion === "function") {
            window.showWorkflowCompletion(finalResult);
            console.log("✅ [FLOW-8] Workflow completion shown");
          } else {
            console.warn("⚠️ [FLOW-8] window.showWorkflowCompletion not available - falling back to displayResults");
          }

          // W tle: wyświetl wyniki i zainicjuj konfigurator
          console.log("⏱️ [FLOW-8] Scheduling displayResults() in 500ms (background)...");
          setTimeout(() => {
            console.log("🎯 [FLOW-8] Calling displayResults() in background...");
            if (typeof window.displayResults === "function") {
              window.displayResults(finalResult);
              console.log("✅ [FLOW-8] displayResults() called (background)");
            } else {
              console.error("❌ [FLOW-8] window.displayResults is not available!");
              LOG.error(
                "flow",
                "displayResults is not available after ozcEngineManager"
              );
            }
          }, 500);

          isAPICallInProgress = false;
          return {
            success: true,
            result: finalResult,
            source: "ozcEngineManager",
          };
        } catch (ozcError) {
          LOG.warn(
            "flow",
            "ozcEngineManager failed, trying fallback proxy",
            ozcError
          );
          // Kontynuuj do fallback (cieplo-proxy.php)
        }
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // FALLBACK: Użyj cieplo-proxy.php (zdalne API)
      // ═══════════════════════════════════════════════════════════════════════════
      // Standalone/dev: możemy jawnie wyłączyć fallback proxy (np. Five Server nie obsługuje POST do .php jako API)
      if (window.HEATPUMP_CONFIG && window.HEATPUMP_CONFIG.disableFallbackProxy === true) {
        isAPICallInProgress = false;
        const msg =
          "Local OZC engine is unavailable or failed. Fallback proxy is disabled in this environment.";
        console.warn("[apiCaller] " + msg);
        if (typeof ErrorHandler !== "undefined" && ErrorHandler.showToast) {
          ErrorHandler.showToast(msg, "error");
        }
        return { success: false, error: msg, source: "ozcEngineManager" };
      }

      // Fallback proxy URL (preferuj z HEATPUMP_CONFIG, bez hardcode domeny)
      const proxyUrl =
        window.HEATPUMP_CONFIG && window.HEATPUMP_CONFIG.cieploProxyUrl
          ? window.HEATPUMP_CONFIG.cieploProxyUrl
          : window.location.origin + "/cieplo-proxy.php";

      LOG.info("flow", "Using fallback proxy", { proxyUrl });

      const response = await fetch(proxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(payload),
      });

      let data;
      try {
        data = await response.json();
        LOG.info("flow", "Proxy API response received", {
          status: response.status,
        });
      } catch (jsonError) {
        LOG.error("flow", "Proxy JSON parse error", jsonError);
        isAPICallInProgress = false;
        throw new Error(
          `Serwer zwrócił nieprawidłową odpowiedź (status ${response.status})`
        );
      }

      // ⚠️ DEV MODE: W trybie quick-scenario ignoruj błędy walidacji
      const isQuickScenario = window.__quickScenarioActive || false;

      // ✅ FIXED: Sprawdź błędy walidacji PRZED przejściem do kroku 6 (tylko jeśli NIE jest quick-scenario)
      // Obsługa błędów walidacji
      if (!isQuickScenario && data.errors && Object.keys(data.errors).length > 0) {
        let errorMessage = "❌ Błędy walidacji:\n\n";
        Object.entries(data.errors).forEach(([field, message]) => {
          errorMessage += `• ${field}: ${message}\n`;
        });

        if (typeof ErrorHandler !== "undefined" && ErrorHandler.showToast) {
          ErrorHandler.showToast(errorMessage, "error");
        } else {
          alert(errorMessage);
        }

        // Oznacz pola z błędami
        Object.keys(data.errors).forEach((fieldName) => {
          const field =
            document.querySelector(`[name="${fieldName}"]`) ||
            document.querySelector(`[name="${fieldName}[material]"]`) ||
            document.querySelector(`[name="${fieldName}[size]"]`);
          if (field) {
            field.style.border = "2px solid #ff4444";
            field.style.backgroundColor = "#ffe6e6";
          }
        });

        isAPICallInProgress = false;
        return {
          success: false,
          status: response.status,
          errors: data.errors,
          data: data,
          message: "Validation Failed",
        };
      }

      // ⚠️ DEV MODE: W quick-scenario loguj błędy, ale kontynuuj
      if (isQuickScenario && data.errors && Object.keys(data.errors).length > 0) {
        console.warn("⚠️ [FLOW-4] Quick Scenario (Proxy): Validation errors (ignored in dev mode):", data.errors);
      }

      // ✅ FIXED: Przejdź do zakładki wyników TYLKO jeśli nie ma błędów walidacji (lub jest quick-scenario)
      // Przejdź do zakładki wyników (index 5, bo zakładki są 0-5)
      if (typeof window.showTab === "function") {
        window.showTab(5);
        LOG.info("ui", "Switched to results tab (fallback)");
      }

      // Wyciągnij wynik
      const resultData =
        data.result ||
        (data.max_heating_power && data.total_area ? data : null);

      if (resultData) {
        LOG.info("flow", "Proxy calculation finished with result");
        window.lastCalculationResult = resultData;

        setTimeout(() => {
          if (typeof window.displayResults === "function") {
            window.displayResults(resultData);
          } else {
            LOG.error(
              "flow",
              "displayResults is not available after proxy response"
            );
          }
        }, 500);

        isAPICallInProgress = false;
        return {
          success: true,
          status: response.status,
          result: resultData,
          data: data,
          source: "cieplo-proxy.php",
        };
      }

      if (data.id) {
        LOG.warn("flow", "Proxy returned polling ID (not implemented)", {
          id: data.id,
        });
        isAPICallInProgress = false;
        return {
          success: false,
          status: response.status,
          message: "Otrzymano ID - polling niezaimplementowany",
          data: data,
        };
      }

      LOG.warn("flow", "Proxy API returned neither result nor ID", data);
      isAPICallInProgress = false;
      return {
        success: false,
        status: response.status,
        message: `API nie zwróciło wyniku (status ${response.status})`,
        data: data,
      };
    } catch (error) {
      LOG.error("flow", "API call failed", error);

      const errorMessage =
        error.message.includes("Failed to fetch") ||
        error.message.includes("NetworkError")
          ? "❌ Błąd połączenia z serwerem.\nSprawdź połączenie internetowe."
          : `❌ Nie udało się pobrać wyników.\nBłąd: ${error.message}`;

      if (typeof ErrorHandler !== "undefined" && ErrorHandler.showToast) {
        ErrorHandler.showToast(errorMessage, "error");
      } else {
        alert(errorMessage);
      }

      isAPICallInProgress = false;
      return {
        success: false,
        status: 0,
        error: error.message,
        networkError: true,
      };
    }
  }

  // Eksportuj funkcję
  window.callCieplo = callCieplo;
})(window);
