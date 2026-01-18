/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BUFFER ENGINE — KANONICZNA LOGIKA DOBORU BUFORA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Single Source of Truth dla logiki bufora CO.
 * Używany przez:
 * - configurator-unified.js (główna aplikacja)
 * - MCP Tools (opcjonalnie)
 * - Testy regresyjne (opcjonalnie)
 *
 * ARCHITECTURAL CONTRACT:
 * - Kompleksowa logika 3 osi (FLOW / SEPARATION / STORAGE)
 * - W pełni wykorzystuje buffer-rules.json
 * - Niezależny moduł (może być używany w różnych kontekstach)
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function (window) {
  'use strict';

  /* ==========================================================================
     PHASE 3C — RULES LOADER (Data-Driven Configuration)
     ========================================================================== */
  /**
   * Loads buffer rules from JSON file
   * Falls back to hardcoded defaults if JSON cannot be loaded
   */
  let bufferRulesCache = null;
  async function loadBufferRules() {
    if (bufferRulesCache) return bufferRulesCache;

    try {
      // Użyj dynamicznego URL z konfiguracji WordPress
      const configUrl = window.HEATPUMP_CONFIG?.konfiguratorUrl || '';
      const rulesUrl = configUrl ? `${configUrl}/rules/buffer-rules.json` : './rules/buffer-rules.json';
      const response = await fetch(rulesUrl);
      if (response.ok) {
        bufferRulesCache = await response.json();
        console.log('[BufferEngine] ✅ Buffer rules loaded from JSON');
        return bufferRulesCache;
      }
    } catch (e) {
      console.warn('[BufferEngine] ⚠️ Could not load buffer-rules.json, using defaults:', e);
      // Elegancki, informacyjny komunikat dla użytkownika
      if (typeof window.ErrorHandler !== 'undefined' && window.ErrorHandler.showToast) {
        window.ErrorHandler.showToast('Część rekomendacji w trybie uproszczonym', 'info', 4000);
      }
    }

    // Fallback to hardcoded defaults
    bufferRulesCache = {
      capacityPerKw: {
        underfloor: 10,
        radiators_lt: 20,
        radiators_ht: 25,
        radiators: 20,
        mixed: 15,
      },
      systemVolumePerM2: {
        underfloor: 0.95,
        radiators_lt: 0.6,
        radiators_ht: 0.9,
        radiators: 0.6,
        mixed: 0.9,
      },
      bivalentStorage: {
        solid_fuel_boiler: { litersPerKw: 60, range: [40, 80] },
        fireplace_back_boiler: { minimum: 500, litersPerKw: 50 },
        gas_boiler: { litersPerKw: 0 },
      },
      availableCapacities: { buffer: [50, 80, 100, 120, 150, 200, 300, 400, 500, 800, 1000] },
      minimumCapacities: {
        seriesBuffer: 50,
        parallelBuffer: 100,
        flowProtection: 50,
      },
      separatorSizeClasses: { thresholds: { small: 7, medium: 15 } },
      antiCyclingDefaults: {
        t_min_minutes: 12,
        deltaT_K: 7,
        deltaT_by_type: {
          underfloor: 5,
          radiators_lt: 7,
          radiators_ht: 7,
          radiators: 7,
          mixed: 5,
        },
        minModulationPercent: 0.35,
        waterSpecificHeat: 1.16,
      },
      absoluteRules: {
        threePhaseKSeries: {
          enabled: true,
          phase: 3,
          series: 'K',
          powers: [9, 12, 16],
          requiredCapacity: 200,
        },
      },
      killerCase: { minimumCapacity: 150 },
      cwuRules: {
        baseCapacity: { 1: 150, 2: 150, 3: 200, 4: 200, '5+': 300 },
        usageAdjustments: { shower: 0, shower_bath: 50, bath: 100 },
        materialAdjustments: { inox: 50, emalia: 100 },
        safetyRule: { usage: 'bath', persons_min: 2, minimumCapacity: 200 },
        availableCapacities: [150, 200, 250, 300, 400, 500],
      },
    };
    return bufferRulesCache;
  }

  // Synchronous getter (for use in synchronous code)
  function getBufferRules() {
    if (!bufferRulesCache) {
      console.warn('[BufferEngine] ⚠️ Buffer rules not loaded yet, using defaults');
      loadBufferRules(); // Will set cache with defaults
    }
    return bufferRulesCache;
  }

  /* ==========================================================================
     HELPER FUNCTIONS
     ========================================================================== */

  function roundToMarketSizes(liters) {
    // PHASE 3C — Load from rules JSON
    const rules = getBufferRules();
    const availableSizes = rules?.availableCapacities?.buffer || [
      50, 80, 100, 120, 150, 200, 300, 400, 500, 800, 1000,
    ];
    const v = Math.max(0, Number(liters) || 0);

    // Jeśli wartość jest 0, zwróć 0 (brak bufora - NONE)
    if (v <= 0) {
      return 0;
    }

    // Znajdź najbliższy rozmiar - używamy pierwszego elementu jako initial value
    // ale sprawdzamy wszystkie elementy, więc to powinno działać poprawnie
    let closest = availableSizes[0];
    let minDiff = Math.abs(availableSizes[0] - v);

    for (let i = 1; i < availableSizes.length; i++) {
      const diff = Math.abs(availableSizes[i] - v);
      if (diff < minDiff) {
        minDiff = diff;
        closest = availableSizes[i];
      }
    }

    return closest;
  }

  function normalizeHeatingType(raw) {
    if (!raw) return 'radiators';
    if (raw === 'surface') return 'underfloor';
    return raw;
  }

  /**
   * Calculate safe fallback power for secondary heat source
   * @param {string} secondaryType - 'solid_fuel_boiler' | 'fireplace_back_boiler'
   * @param {number} designHeatLoss_kW - Design heat loss from OZC
   * @param {number} pumpPower - Pump power [kW]
   * @returns {number} - Safe fallback power [kW]
   */
  function calculateFallbackPower(secondaryType, designHeatLoss_kW, pumpPower) {
    const rules = getBufferRules();
    const ruleKey = secondaryType === 'solid_fuel_boiler'
      ? 'solid_fuel_boiler'
      : 'fireplace_back_boiler';
    const rule = rules?.bivalentStorage?.[ruleKey];

    if (!rule) {
      // Fallback do starych wartości jeśli brak reguł
      return secondaryType === 'fireplace_back_boiler' ? 15 : 20;
    }

    const factor = rule.defaultPowerFactor || 1.0;
    const clamp = rule.defaultPowerClamp || [6, 20];

    // Użyj designHeatLoss jeśli dostępne, inaczej pumpPower
    const basePower = designHeatLoss_kW > 0 ? designHeatLoss_kW : pumpPower;
    const calculated = basePower * factor;

    // Clamp do zakresu
    return Math.max(clamp[0], Math.min(clamp[1], calculated));
  }

  const HYDRAULICS_REASON_CODES = {
    FLOW_RISK_UNDERFLOOR_ACTUATORS: 'FLOW_RISK_UNDERFLOOR_ACTUATORS',
    MIXED_CIRCUITS_SEPARATION: 'MIXED_CIRCUITS_SEPARATION',
    LOW_LOAD_HT_RADIATORS_KILLER: 'LOW_LOAD_HT_RADIATORS_KILLER',
    BIVALENT_SOLID_FUEL: 'BIVALENT_SOLID_FUEL',
    BIVALENT_FIREPLACE_WATER_JACKET: 'BIVALENT_FIREPLACE_WATER_JACKET',
    ANTI_CYCLING_STORAGE_REQUIRED: 'ANTI_CYCLING_STORAGE_REQUIRED',
    // Dodatkowe (kompatybilność z istniejącymi twardymi regułami)
    MANUFACTURER_3PH_K_200L: 'MANUFACTURER_3PH_K_200L',
  };

  /* ==========================================================================
     BUFFER SIZING ENGINE — Calculate recommended volume in liters
     ========================================================================== */

  /**
   * Calculate buffer sizing components
   * @param {Object} params - Sizing parameters
   * @returns {Object} - Components with volumes, rationales, and dependencies
   */
  function calculateBufferSizeComponents(params) {
    const {
      pumpPower,
      emitterType,
      heatedArea,
      hasSecondary,
      secondaryType,
      secondaryPower,
      bivalentMode,
      designHeatLoss_kW,
      heatingType,
      radiatorsIsHt,
    } = params;

    // PHASE 3C — Load rules from JSON (Data-Driven Configuration)
    const rules = getBufferRules();
    const antiCyclingDefaults = rules?.antiCyclingDefaults || {};
    const t_min_minutes = antiCyclingDefaults.t_min_minutes || 12; // Acceptable range: 10-15 minutes

    // Dynamiczna delta T w zależności od typu emitera
    const deltaTByType = antiCyclingDefaults.deltaT_by_type || {
      underfloor: 5,
      radiators_lt: 7,
      radiators_ht: 7,
      radiators: 7,
      mixed: 5,
    };
    const deltaT_K = deltaTByType[emitterType] || antiCyclingDefaults.deltaT_K || 7;

    const minModulationPercent = antiCyclingDefaults.minModulationPercent || 0.35; // 35% minimum modulation
    const waterSpecificHeat = antiCyclingDefaults.waterSpecificHeat || 1.16; // kWh/(m³·K)

    // 1) V_anti_cycling — Anti-cycling volume
    const P_min_HP = pumpPower * minModulationPercent;
    const t_min_hours = t_min_minutes / 60;
    const V_anti_liters =
      ((P_min_HP * t_min_hours) / ((waterSpecificHeat * deltaT_K) / 1000)) * 1000; // Convert m³ to liters

    const vAnti = {
      liters: Math.round(V_anti_liters),
      rationale: `Anti-cycling volume: ${
        Math.round(P_min_HP * 10) / 10
      } kW min power × ${t_min_minutes} min runtime / (1.16 × ${deltaT_K} K) = ${Math.round(
        V_anti_liters
      )} l`,
      dependencies: ['pumpPower', 't_min_minutes', 'deltaT_K', 'minModulationPercent'],
    };

    // 2) V_bivalent_storage — Bivalent storage volume
    let vBivalent = {
      liters: 0,
      rationale: 'No secondary heat source',
      dependencies: [],
    };

    if (hasSecondary) {
      if (secondaryType === 'gas_boiler') {
        // Gas boiler: usually 0 (unless specific parallel instability is detected)
        vBivalent = {
          liters: 0,
          rationale: 'Gas boiler can modulate, no storage needed',
          dependencies: ['secondaryType'],
        };
      } else if (secondaryType === 'solid_fuel_boiler') {
        // PHASE 3C — Load from rules JSON
        const solidFuelRule = rules?.bivalentStorage?.solid_fuel_boiler || {
          litersPerKw: 60,
          range: [40, 80],
        };
        const litersPerKw = solidFuelRule.litersPerKw || 60;

        // Użyj secondaryPower jeśli podano, inaczej fallback (nie hardcoded!)
        const powerUsed = secondaryPower != null && !isNaN(secondaryPower) && secondaryPower > 0
          ? secondaryPower
          : calculateFallbackPower('solid_fuel_boiler', designHeatLoss_kW, pumpPower);

        const vBivalentCalc = powerUsed * litersPerKw;
        vBivalent = {
          liters: Math.round(vBivalentCalc),
          rationale: `Solid fuel boiler: ${
            powerUsed
          } kW × ${litersPerKw} l/kW = ${Math.round(vBivalentCalc)} l (range: ${
            solidFuelRule.range?.[0] || 40
          }-${solidFuelRule.range?.[1] || 80} l/kW)${secondaryPower == null || isNaN(secondaryPower) || secondaryPower <= 0 ? ' [fallback]' : ''}`,
          dependencies: ['secondaryType', 'secondaryPower'],
        };
      } else if (secondaryType === 'fireplace_back_boiler') {
        // PHASE 3C — Load from rules JSON
        const fireplaceRule = rules?.bivalentStorage?.fireplace_back_boiler || {
          minimum: 500,
          litersPerKw: 50,
        };
        const minimum = fireplaceRule.minimum || 500;
        const litersPerKw = fireplaceRule.litersPerKw || 50;

        // Użyj secondaryPower jeśli podano, inaczej fallback (nie hardcoded!)
        const powerUsed = secondaryPower != null && !isNaN(secondaryPower) && secondaryPower > 0
          ? secondaryPower
          : calculateFallbackPower('fireplace_back_boiler', designHeatLoss_kW, pumpPower);

        const vBivalentCalc = Math.max(minimum, powerUsed * litersPerKw);
        vBivalent = {
          liters: Math.round(vBivalentCalc),
          rationale: `Fireplace back boiler: max(${minimum}, ${
            powerUsed
          } kW × ${litersPerKw}) = ${Math.round(vBivalentCalc)} l (minimum ${minimum} l)${secondaryPower == null || isNaN(secondaryPower) || secondaryPower <= 0 ? ' [fallback]' : ''}`,
          dependencies: ['secondaryType', 'secondaryPower'],
        };
      }
    }

    // 3) V_hydraulic_minimum — Hydraulic/system volume
    // PHASE 3C — Load from rules JSON
    const capacityPerKw = rules?.capacityPerKw || {
      underfloor: 10,
      radiators_lt: 20,
      radiators_ht: 25,
      radiators: 20,
      mixed: 15,
    };
    const systemVolumePerM2 = rules?.systemVolumePerM2 || {
      underfloor: 0.95,
      radiators_lt: 0.6,
      radiators_ht: 0.9,
      radiators: 0.6,
      mixed: 0.9,
    };

    const requiredWaterVolume = pumpPower * (capacityPerKw[emitterType] || capacityPerKw.radiators);

    // Dla mixed: oblicz proporcjonalnie (średnia ważona 50/50)
    let estimatedSystemVolume;
    if (emitterType === 'mixed' && heatingType === 'mixed') {
      const underfloorValue = systemVolumePerM2.underfloor || 0.95;
      const radiatorsValue = radiatorsIsHt
        ? systemVolumePerM2.radiators_ht || 0.9
        : systemVolumePerM2.radiators_lt || 0.6;
      // Średnia ważona 50/50: (podłogówka + grzejniki) / 2
      const mixedValue = (underfloorValue + radiatorsValue) / 2;
      estimatedSystemVolume = heatedArea * mixedValue;
    } else {
      estimatedSystemVolume =
        heatedArea * (systemVolumePerM2[emitterType] || systemVolumePerM2.radiators);
    }

    const vHydraulic = Math.max(0, requiredWaterVolume - estimatedSystemVolume);

    const vHydraulicObj = {
      liters: Math.round(vHydraulic),
      rationale:
        vHydraulic > 0
          ? `Hydraulic volume: ${Math.round(requiredWaterVolume)} l required - ${Math.round(
              estimatedSystemVolume
            )} l estimated = ${Math.round(vHydraulic)} l needed`
          : `Hydraulic volume: ${Math.round(estimatedSystemVolume)} l estimated ≥ ${Math.round(
              requiredWaterVolume
            )} l required (sufficient)`,
      dependencies: ['pumpPower', 'emitterType', 'heatedArea'],
    };

    return {
      antiCycling: vAnti,
      bivalent: vBivalent,
      hydraulic: vHydraulicObj,
      // DODAJ: informacje o zładzie systemu dla trójstopniowej logiki
      systemVolume: {
        required: Math.round(requiredWaterVolume),
        estimated: Math.round(estimatedSystemVolume),
        sufficient: estimatedSystemVolume >= requiredWaterVolume,
      },
    };
  }

  /**
   * Calculate final recommended buffer volume with three-stage logic
   * @param {Object} components - Output from calculateBufferSizeComponents
   * @param {string} heatingType - 'underfloor' | 'radiators' | 'mixed'
   * @param {boolean} hydraulicSeparationRequired - Whether separator is required
   * @param {Object} options - Additional options
   * @returns {Object} - Final recommendation with setupType (NONE | SERIES_BYPASS | PARALLEL_CLUTCH)
   */
  function calculateFinalBufferRecommendation(
    components,
    heatingType,
    hydraulicSeparationRequired,
    options = {}
  ) {
    // PHASE 3C — Load from rules JSON
    const rules = getBufferRules();
    const availableSizes = rules?.availableCapacities?.buffer || [
      50, 80, 100, 120, 150, 200, 300, 400, 500, 800, 1000,
    ];

    const vAnti = components.antiCycling.liters;
    const vBivalent = components.bivalent.liters;
    const vHydraulic = components.hydraulic.liters;

    // Pobierz informacje o zładzie systemu
    const systemVolume = components.systemVolume || {};
    const estimatedSystemVolume = systemVolume.estimated || 0;
    const requiredWaterVolume = systemVolume.required || 0;
    const systemVolumeSufficient =
      systemVolume.sufficient !== undefined
        ? systemVolume.sufficient
        : estimatedSystemVolume >= requiredWaterVolume;

    // ═══════════════════════════════════════════════════════════════════════════
    // WYMUSZENIA BUFORA — niezależnie od zładu systemu
    // ═══════════════════════════════════════════════════════════════════════════
    const radiatorsIsHt = options.radiatorsIsHt || false;
    const hasSecondary = options.hasSecondary || false;
    const secondaryType = options.secondaryType || null;
    const energyStorageMandatory = options.energyStorageMandatory || false; // Z computeHydraulicsRecommendation

    // Dla HT radiators i gazu jako drugiego źródła - zawsze wymagany bufor
    const requiresBufferForHtRadiators =
      (heatingType === 'radiators' || heatingType === 'mixed') && radiatorsIsHt;
    const requiresBufferForGas = hasSecondary && secondaryType === 'gas_boiler';
    const requiresBufferMandatory =
      energyStorageMandatory || requiresBufferForHtRadiators || requiresBufferForGas;

    // TRÓJSTOPNIOWA LOGIKA BUFORA

    // 1. BRAK BUFORA - gdy zład wystarczający i system prosty
    // ⚠️ ALE: NIE gdy HT radiators, gaz jako drugie źródło, lub energy_storage = MANDATORY
    const isSimpleSystem = heatingType !== 'mixed' && !hydraulicSeparationRequired;

    if (systemVolumeSufficient && isSimpleSystem && vBivalent === 0 && !requiresBufferMandatory) {
      return {
        setupType: 'NONE',
        recommendedCapacity: 0,
        calculatedCapacity: 0,
        components: {
          antiCycling: vAnti,
          bivalent: vBivalent,
          hydraulic: vHydraulic,
        },
        dominantComponent: 'none',
        reasoning:
          'Zład własny instalacji jest wystarczający do stabilnej pracy pompy i poprawnego defrostu',
      };
    }

    // 2. BUFOR SZEREGOWO (z by-passem) - prosty system + deficyt zładu
    if (isSimpleSystem && !systemVolumeSufficient) {
      const deficit = Math.max(vAnti, vHydraulic) - estimatedSystemVolume;
      // PHASE 3C — Load from rules JSON
      const minSeriesBuffer = rules?.minimumCapacities?.seriesBuffer || 50;
      const vRecommended = Math.max(deficit, minSeriesBuffer, vBivalent);

      // Znajdź najbliższy rozmiar
      let closest = availableSizes[0];
      let minDiff = Math.abs(availableSizes[0] - vRecommended);
      for (let i = 1; i < availableSizes.length; i++) {
        const diff = Math.abs(availableSizes[i] - vRecommended);
        if (diff < minDiff) {
          minDiff = diff;
          closest = availableSizes[i];
        }
      }
      const recommendedCapacity = closest;

      // Determine dominant component
      let dominantComponent = 'antiCycling';
      let dominantReason = components.antiCycling.rationale;
      if (vBivalent >= vAnti && vBivalent >= vHydraulic) {
        dominantComponent = 'bivalent';
        dominantReason = components.bivalent.rationale;
      } else if (vHydraulic >= vAnti && vHydraulic >= vBivalent) {
        dominantComponent = 'hydraulic';
        dominantReason = components.hydraulic.rationale;
      }

      return {
        setupType: 'SERIES_BYPASS',
        recommendedCapacity,
        calculatedCapacity: Math.round(vRecommended),
        components: {
          antiCycling: vAnti,
          bivalent: vBivalent,
          hydraulic: vHydraulic,
        },
        dominantComponent,
        reasoning:
          'Konieczne zwiększenie zładu dla poprawnego defrostu i ochrony sprężarki. Montaż na powrocie z zaworem nadmiarowo-upustowym (by-pass) zapewnia najwyższą sprawność',
        installationNote:
          'Wymagany montaż zaworu różnicowego (by-pass) tworzącego krótki obieg przez bufor',
      };
    }

    // 3. BUFOR RÓWNOLEGLE (sprzęgło) - mixed lub wymagana separacja
    const vRecommended = Math.max(vAnti, vBivalent, vHydraulic);
    // PHASE 3C — Load from rules JSON
    const minParallelBuffer = rules?.minimumCapacities?.parallelBuffer || 100;
    const vFinal = Math.max(vRecommended, minParallelBuffer);

    // Znajdź najbliższy rozmiar
    let closest = availableSizes[0];
    let minDiff = Math.abs(availableSizes[0] - vFinal);
    for (let i = 1; i < availableSizes.length; i++) {
      const diff = Math.abs(availableSizes[i] - vFinal);
      if (diff < minDiff) {
        minDiff = diff;
        closest = availableSizes[i];
      }
    }
    const recommendedCapacity = closest;

    // Determine dominant component
    let dominantComponent = 'antiCycling';
    let dominantReason = components.antiCycling.rationale;
    if (vBivalent >= vAnti && vBivalent >= vHydraulic) {
      dominantComponent = 'bivalent';
      dominantReason = components.bivalent.rationale;
    } else if (vHydraulic >= vAnti && vHydraulic >= vBivalent) {
      dominantComponent = 'hydraulic';
      dominantReason = components.hydraulic.rationale;
    }

    return {
      setupType: 'PARALLEL_CLUTCH',
      recommendedCapacity,
      calculatedCapacity: Math.round(vFinal),
      components: {
        antiCycling: vAnti,
        bivalent: vBivalent,
        hydraulic: vHydraulic,
      },
      dominantComponent,
      reasoning:
        'Wymagane rozdzielenie przepływów pompy ciepła i instalacji domowej. Bufor pełni rolę sprzęgła hydraulicznego',
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * PHASE 3A.3 — CANONICAL OUTPUT NORMALIZATION
   * ═══════════════════════════════════════════════════════════════════════════
   * Transform raw buffer decision result to canonical format
   * This ensures UI, PDF, and email all consume the same structure
   *
   * @param {Object} rawResult - Raw result from rulesEngine.buffer()
   * @param {Object} sizingComponents - Output from calculateBufferSizeComponents (optional)
   * @param {Object} sizingResult - Output from calculateFinalBufferRecommendation (optional)
   * @returns {Object} - Canonical buffer recommendation object
   */
  function normalizeBufferRecommendation(rawResult, sizingComponents, sizingResult) {
    // Extract values from raw result (backward compatibility)
    const componentType = rawResult.component_type || rawResult.type || 'none';
    const litersRecommended = rawResult.liters_recommended || rawResult.recommendedCapacity || null;
    const calculatedLiters = rawResult.calculatedCapacity || rawResult.calculatedLiters || null;
    const minLiters = rawResult.recommendedMin || null;
    const maxLiters = rawResult.recommendedMax || null;
    const separatorSize = rawResult.separator_size_class || null;
    const hydraulicSeparationRequired =
      rawResult.hydraulicSeparationRequired || rawResult.separator_required || false;
    const reasons = rawResult.reasons || [];
    const constraints = rawResult.constraints || [];
    const dominantReason = rawResult.dominantReason || rawResult.reasoning || '';
    const requiredSystemVolume = rawResult.requiredWaterVolume || 0;
    const estimatedSystemVolume = rawResult.estimatedSystemVolume || 0;
    const systemVolumeSufficient =
      rawResult.systemVolumeSufficient !== undefined
        ? rawResult.systemVolumeSufficient
        : estimatedSystemVolume >= requiredSystemVolume;

    // Determine canonical type
    let type = 'none';
    if (componentType === 'separator' && (litersRecommended === null || litersRecommended === 0)) {
      type = 'separator';
    } else if (componentType === 'buffer_storage' && litersRecommended > 0) {
      if (hydraulicSeparationRequired) {
        type = 'both'; // Both separator and storage
      } else {
        type = 'storage';
      }
    } else if (componentType === 'separator' && litersRecommended > 0) {
      type = 'both';
    }

    // Build sizing breakdown if available
    let sizing = null;
    if (sizingResult && sizingComponents && (type === 'storage' || type === 'both')) {
      sizing = {
        antiCycling: {
          liters: sizingComponents.antiCycling?.liters || 0,
          rationale:
            sizingComponents.antiCycling?.rationale || 'Anti-cycling volume not calculated',
        },
        bivalent: {
          liters: sizingComponents.bivalent?.liters || 0,
          rationale: sizingComponents.bivalent?.rationale || 'Bivalent volume not calculated',
        },
        hydraulic: {
          liters: sizingComponents.hydraulic?.liters || 0,
          rationale: sizingComponents.hydraulic?.rationale || 'Hydraulic volume not calculated',
        },
        dominantComponent: sizingResult.dominantComponent || 'antiCycling',
      };
    }

    // Build canonical object
    return {
      // CORE DECISION
      type: type,
      required: rawResult.required || false,
      allowZeroBuffer: rawResult.allowZeroBuffer || false,

      // SETUP TYPE (nowe pole)
      setupType: sizingResult?.setupType || (type === 'none' ? 'NONE' : null),

      // STORAGE CAPACITY (only if type === "storage" || type === "both")
      liters: type === 'storage' || type === 'both' ? litersRecommended : null,
      calculatedLiters: type === 'storage' || type === 'both' ? calculatedLiters : null,
      minLiters: type === 'storage' || type === 'both' ? minLiters : null,
      maxLiters: type === 'storage' || type === 'both' ? maxLiters : null,

      // SEPARATOR SPECIFICATION (only if type === "separator" || type === "both")
      separatorSize: type === 'separator' || type === 'both' ? separatorSize : null,
      hydraulicSeparationRequired: hydraulicSeparationRequired,

      // REASONING & EXPLANATION
      dominantReason: dominantReason || reasons.join('; ') || 'Standard calculation',
      reasons: reasons.length > 0 ? reasons : [dominantReason || 'Standard calculation'],
      constraints: constraints,

      // INSTALLATION NOTE (dla SERIES_BYPASS)
      installationNote: sizingResult?.installationNote || null,

      // SIZING BREAKDOWN (only if type === "storage" || type === "both")
      sizing: sizing,

      // SYSTEM VOLUME INFO
      requiredSystemVolume: requiredSystemVolume,
      estimatedSystemVolume: estimatedSystemVolume,
      systemVolumeSufficient: systemVolumeSufficient,
    };
  }

  /* ==========================================================================
     HYDRAULICS RECOMMENDATION ENGINE (FLOW / SEPARATOR / STORAGE) — CANONICAL
     ========================================================================== */

  /**
   * Silnik hydrauliki CO — SINGLE SOURCE OF TRUTH dla UI/PDF/Email
   *
   * @param {Object} inputs - Input parameters object
   * @param {Object} inputs.meta - Dane z kalkulatora (heating_type, max_heating_power, etc.)
   * @param {Object} inputs.selectedPump - Wybrana pompa (optionId, power_kw, phase, etc.)
   * @param {Object} inputs.pumpMatchingTable - Tabela dopasowania pomp (dla lookup)
   * @param {Function} inputs.getHydraulicsInputs - Funkcja do pobrania danych z miniformularza
   * @param {Function} inputs.persistHydraulicsRecommendation - Funkcja do zapisania wyniku (opcjonalna)
   * @param {Object} inputs.state - State object (dla zapisu wyniku, opcjonalny)
   * @returns {Object} - Hydraulics recommendation object
   */
  function computeHydraulicsRecommendation(inputs) {
    // ✅ FIX: Obsługa błędów - zwróć bezpieczny fallback w przypadku błędu
    try {
      // PHASE 3C — Ensure rules are loaded
      const rules = getBufferRules();

      const meta = inputs.meta || {};
      const selectedPump = inputs.selectedPump || {};
      const pumpMatchingTable = inputs.pumpMatchingTable || {};
      const getHydraulicsInputs = inputs.getHydraulicsInputs || (() => ({}));
      const persistHydraulicsRecommendation = inputs.persistHydraulicsRecommendation || (() => {});
      const state = inputs.state || null;

      const heating_type = normalizeHeatingType(
        meta.heating_type || meta.installation_type || 'radiators'
      );

      const hydraulicsInputs = getHydraulicsInputs();

      const has_underfloor_actuators =
        heating_type === 'underfloor' || heating_type === 'mixed'
          ? !!hydraulicsInputs.has_underfloor_actuators
          : false;

      const radiators_is_ht =
        heating_type === 'radiators' || heating_type === 'mixed' ? !!hydraulicsInputs.radiators_is_ht : false;

      // ✅ FIX: Walidacja bivalent_enabled - jeśli enabled ale brak typu, traktuj jak false
      const rawBivalentEnabled = !!hydraulicsInputs.bivalent_enabled;
      const rawBivalentSourceType = hydraulicsInputs.bivalent_source_type || null;
      const bivalent_enabled = rawBivalentEnabled && !!rawBivalentSourceType; // Tylko jeśli oba są ustawione
      const bivalent_source_type = bivalent_enabled ? rawBivalentSourceType : null;

      const pumpOptionId = selectedPump?.optionId || null;
      const pumpData = pumpOptionId ? pumpMatchingTable[pumpOptionId] : null;
      const pumpPhase = pumpData?.phase || selectedPump?.phase || null;
      const pumpPower = Number(
        pumpData?.power ||
          selectedPump?.power_kw ||
          meta.recommended_power_kw ||
          meta.max_heating_power ||
          0
      );

      // Brak twardych danych min. modulacji per model → MVP: 35% nominalnej (spójne z sizing engine)
      const pump_min_modulation_kw = Math.round(pumpPower * 0.35 * 10) / 10;

      // OZC: max_heating_power jest kanoniczne jako designHeatLoss
      const designHeatLoss_kW = Number(meta.max_heating_power || meta.recommended_power_kw || 0);
      const heating_power = Number(meta.recommended_power_kw || designHeatLoss_kW || 0);

      // OŚ A — FLOW_PROTECTION
      let flow_protection = 'NONE';
      if (heating_type === 'radiators') {
        flow_protection = 'NONE'; // twardo: nie pytamy o siłowniki
      } else if (has_underfloor_actuators) {
        flow_protection = 'REQUIRED';
      }
      // UWAGA: flow_protection = 'NONE' dla podłogówki bez sterowników NIE oznacza braku bufora.
      // Bufor może być wymagany z innych powodów (HT radiators, biwalencja, energy_storage = MANDATORY).

      // OŚ B — HYDRAULIC_SEPARATION (MVP)
      let hydraulic_separation = heating_type === 'mixed' ? 'REQUIRED' : 'NONE';

      // OŚ C — ENERGY_STORAGE (ANTI_CYCLING)
      let energy_storage = 'NONE';

      const reason_codes = [];

      // Biwalencja — twarde wymuszenia
      if (bivalent_enabled) {
        if (bivalent_source_type === 'solid_fuel') {
          hydraulic_separation = 'REQUIRED';
          energy_storage = 'MANDATORY';
          reason_codes.push(HYDRAULICS_REASON_CODES.BIVALENT_SOLID_FUEL);
        } else if (bivalent_source_type === 'fireplace_water_jacket') {
          hydraulic_separation = 'REQUIRED';
          energy_storage = 'MANDATORY';
          reason_codes.push(HYDRAULICS_REASON_CODES.BIVALENT_FIREPLACE_WATER_JACKET);
        } else if (bivalent_source_type === 'gas') {
          // Gaz: wymagana separacja hydrauliczna + bufor dla stabilności
          // Bufor zapewnia stabilność pracy i separację między pompą a kotłem gazowym
          // Gaz może pracować równolegle z pompą - potrzebny bufor jako sprzęgło hydrauliczne
          hydraulic_separation = 'REQUIRED';
          energy_storage = 'MANDATORY'; // Bufor wymagany dla gazu (stabilność + separacja)
        }
      }

      // Killer-case: low load + HT radiators → storage mandatory
      const isLowLoad = designHeatLoss_kW > 0 && pump_min_modulation_kw > designHeatLoss_kW;
      const isKillerCase =
        (heating_type === 'radiators' || heating_type === 'mixed') && radiators_is_ht && isLowLoad;

      if (isKillerCase) {
        energy_storage = 'MANDATORY';
        reason_codes.push(HYDRAULICS_REASON_CODES.LOW_LOAD_HT_RADIATORS_KILLER);
      } else if ((heating_type === 'radiators' || heating_type === 'mixed') && radiators_is_ht) {
        // HT radiators (bez low load) → storage mandatory (dla stabilności pracy)
        energy_storage = 'MANDATORY';
        reason_codes.push(HYDRAULICS_REASON_CODES.LOW_LOAD_HT_RADIATORS_KILLER); // Używamy tego samego kodu
      } else if (energy_storage === 'NONE' && isLowLoad) {
        // OPTIONAL: ryzyko taktowania, ale bez killer-case nie wymuszamy
        energy_storage = 'OPTIONAL';
        reason_codes.push(HYDRAULICS_REASON_CODES.ANTI_CYCLING_STORAGE_REQUIRED);
      }

      // PHASE 3C — Load absolute rule from JSON
      const absoluteRule = rules?.absoluteRules?.threePhaseKSeries || {
        enabled: true,
        phase: 3,
        series: 'K',
        powers: [9, 12, 16],
        requiredCapacity: 200,
      };
      if (
        absoluteRule.enabled &&
        meta.generation === absoluteRule.series &&
        pumpPhase === absoluteRule.phase &&
        absoluteRule.powers.includes(pumpPower)
      ) {
        energy_storage = 'MANDATORY';
        reason_codes.push(HYDRAULICS_REASON_CODES.MANUFACTURER_3PH_K_200L);
      }

      // Reason codes dla osi A/B
      if (flow_protection !== 'NONE') {
        reason_codes.push(HYDRAULICS_REASON_CODES.FLOW_RISK_UNDERFLOOR_ACTUATORS);
      }
      if (hydraulic_separation === 'REQUIRED' && heating_type === 'mixed') {
        reason_codes.push(HYDRAULICS_REASON_CODES.MIXED_CIRCUITS_SEPARATION);
      }

      // SYNTEZA → fizyczna rekomendacja (STARE TYPY - dla wewnętrznej logiki)
      let internalRecommendation = 'NONE';
      if (energy_storage === 'MANDATORY') {
        internalRecommendation =
          hydraulic_separation === 'REQUIRED' ? 'SEPARATOR + BUFFER_STORAGE' : 'BUFFER_STORAGE';
      } else if (hydraulic_separation === 'REQUIRED' && energy_storage === 'NONE') {
        internalRecommendation = 'SEPARATOR';
      } else if (
        flow_protection !== 'NONE' &&
        hydraulic_separation === 'NONE' &&
        energy_storage === 'NONE'
      ) {
        // FLOW_PROTECTION → BUFOR_SZEREGOWO (minimum 50L z zaworem różnicowym)
        internalRecommendation = 'FLOW_PROTECTION_DEVICE';
      } else if (energy_storage === 'OPTIONAL') {
        internalRecommendation = hydraulic_separation === 'REQUIRED' ? 'SEPARATOR' : 'NONE';
      }

      // SIZING — oblicz pojemność dla wszystkich przypadków wymagających bufora
      let buffer_liters = null;
      let setupType = 'NONE';
      let finalRecommendation = 'NONE'; // NOWY: 3 typy (NONE, BUFOR_SZEREGOWO, BUFOR_RÓWNOLEGLE)

      // Przygotuj parametry do obliczeń (potrzebne dla wszystkich przypadków z buforem)
      const emitterType =
        heating_type === 'underfloor'
          ? 'underfloor'
          : heating_type === 'mixed'
          ? 'mixed'
          : radiators_is_ht
          ? 'radiators_ht'
          : 'radiators_lt';

      const heatedArea = Number(meta.heated_area || meta.total_area || 0);

      const hasSecondary = bivalent_enabled && !!bivalent_source_type;
      const secondaryType =
        bivalent_source_type === 'gas'
          ? 'gas_boiler'
          : bivalent_source_type === 'solid_fuel'
          ? 'solid_fuel_boiler'
          : bivalent_source_type === 'fireplace_water_jacket'
          ? 'fireplace_back_boiler'
          : null;

      // Pobierz moc z hydraulics_inputs (UI) lub użyj bezpiecznego fallbacku
      const userProvidedPower = hydraulicsInputs.bivalent_source_power_kw != null
        ? Number(hydraulicsInputs.bivalent_source_power_kw)
        : null;

      let secondaryPower = null;
      let powerSource = 'none';

      if (hasSecondary && secondaryType !== 'gas_boiler') {
        if (userProvidedPower != null && !isNaN(userProvidedPower) && userProvidedPower > 0) {
          // Użytkownik podał moc
          secondaryPower = userProvidedPower;
          powerSource = 'user';
        } else {
          // Bezpieczny fallback zależny od danych budynku
          secondaryPower = calculateFallbackPower(secondaryType, designHeatLoss_kW, pumpPower);
          powerSource = 'fallback';
        }
      }

      // Debug logging dla bivalent (tylko gdy enabled)
      if (bivalent_enabled && secondaryType !== 'gas_boiler') {
        console.groupCollapsed('[BufferEngine] Bivalent calculation');
        console.log('sourceType:', secondaryType);
        console.log('secondaryPowerUsed:', secondaryPower, 'kW');
        console.log('userProvided:', powerSource === 'user');
        console.log('fallbackUsed:', powerSource === 'fallback');
        if (powerSource === 'fallback') {
          console.log('fallbackBase:', designHeatLoss_kW > 0 ? designHeatLoss_kW : pumpPower, 'kW');
        }
        console.groupEnd();
      }

      const sizingComponents = calculateBufferSizeComponents({
        pumpPower,
        emitterType,
        heatedArea,
        hasSecondary,
        secondaryType,
        secondaryPower,
        bivalentMode: 'assist',
        designHeatLoss_kW,
        heatingType: heating_type,
        radiatorsIsHt: radiators_is_ht,
      });

      // Debug logging dla V_biv (tylko gdy bivalent enabled i V_biv > 0)
      if (bivalent_enabled && sizingComponents.bivalent.liters > 0) {
        const vBiv = sizingComponents.bivalent.liters;
        console.groupCollapsed('[BufferEngine] Bivalent volume result');
        console.log('V_biv:', vBiv, 'l');
        console.log('powerSource:', powerSource);
        console.log('secondaryPower:', secondaryPower, 'kW');
        console.groupEnd();
      }

      // Oblicz pojemność i setupType dla wszystkich przypadków
      if (internalRecommendation.includes('BUFFER_STORAGE')) {
        const sizingResult = calculateFinalBufferRecommendation(
          sizingComponents,
          heating_type,
          hydraulic_separation === 'REQUIRED',
          {
            radiatorsIsHt: radiators_is_ht,
            hasSecondary: hasSecondary,
            secondaryType: secondaryType,
            energyStorageMandatory: energy_storage === 'MANDATORY',
          }
        );

        setupType = sizingResult.setupType;

        // PHASE 3C — Load absolute rule capacity from JSON
        const absoluteRule = rules?.absoluteRules?.threePhaseKSeries || { requiredCapacity: 200 };
        if (reason_codes.includes(HYDRAULICS_REASON_CODES.MANUFACTURER_3PH_K_200L)) {
          buffer_liters = Math.max(
            absoluteRule.requiredCapacity || 200,
            sizingResult.recommendedCapacity
          );
        } else {
          buffer_liters = sizingResult.recommendedCapacity;
        }

        // Debug logging dla końcowego V_final (tylko gdy bivalent enabled)
        if (bivalent_enabled && buffer_liters != null) {
          console.groupCollapsed('[BufferEngine] Final buffer capacity');
          console.log('V_final:', buffer_liters, 'l');
          console.log('setupType:', setupType);
          console.log('finalRecommendation:', finalRecommendation);
          if (sizingComponents.bivalent.liters > 0) {
            console.log('V_biv contribution:', sizingComponents.bivalent.liters, 'l');
          }
          console.groupEnd();
        }

        // Mapowanie do nowych 3 typów
        if (setupType === 'SERIES_BYPASS') {
          finalRecommendation = 'BUFOR_SZEREGOWO';
        } else if (setupType === 'PARALLEL_CLUTCH') {
          finalRecommendation = 'BUFOR_RÓWNOLEGLE';
        } else {
          finalRecommendation = 'NONE';
        }
      } else if (internalRecommendation === 'SEPARATOR') {
        // SEPARATOR → BUFOR_RÓWNOLEGLE (sprzęgło hydrauliczne)
        // Oblicz pojemność używając tej samej logiki co dla storage
        const sizingResult = calculateFinalBufferRecommendation(
          sizingComponents,
          heating_type,
          true, // hydraulic_separation === 'REQUIRED'
          {
            radiatorsIsHt: radiators_is_ht,
            hasSecondary: hasSecondary,
            secondaryType: secondaryType,
            energyStorageMandatory: false, // Separator bez storage
          }
        );

        setupType = 'PARALLEL_CLUTCH';
        // PHASE 3C — Load from rules JSON
        const minParallelBuffer = rules?.minimumCapacities?.parallelBuffer || 100;
        buffer_liters = Math.max(sizingResult.recommendedCapacity, minParallelBuffer);
        // Zaokrąglij do dostępnych rozmiarów
        buffer_liters = roundToMarketSizes(buffer_liters);
        finalRecommendation = 'BUFOR_RÓWNOLEGLE';
      } else if (internalRecommendation === 'FLOW_PROTECTION_DEVICE') {
        // FLOW_PROTECTION → BUFOR_SZEREGOWO (szeregowo z by-passem, minimum z JSON)
        setupType = 'SERIES_BYPASS';
        // PHASE 3C — Load from rules JSON
        const minFlowProtection = rules?.minimumCapacities?.flowProtection || 50;
        buffer_liters = minFlowProtection; // Najmniejsza dostępna pojemność
        finalRecommendation = 'BUFOR_SZEREGOWO';
      } else {
        // NONE
        finalRecommendation = 'NONE';
        setupType = 'NONE';
        buffer_liters = null;
      }

      // Severity: UX nie podejmuje decyzji, ale komunikuje wagę
      let severity = 'INFO';
      if (energy_storage === 'MANDATORY' || hydraulic_separation === 'REQUIRED') {
        severity = 'MANDATORY';
      } else if (flow_protection !== 'NONE') {
        severity = 'RECOMMENDED';
      }

      const explanationShortParts = [];
      if (finalRecommendation === 'NONE') {
        explanationShortParts.push('Nie potrzebujesz bufora ani sprzęgła.');
      } else if (finalRecommendation === 'BUFOR_SZEREGOWO') {
        if (internalRecommendation === 'FLOW_PROTECTION_DEVICE') {
          explanationShortParts.push(
            `Ryzyko zamknięcia obiegu → bufor szeregowo (${buffer_liters} l) z zaworem różnicowym na by-passie.`
          );
        } else {
          explanationShortParts.push(
            `Bufor szeregowo (${buffer_liters || '—'} l) z zaworem różnicowym na by-passie dla stabilnej pracy sprężarki.`
          );
        }
      } else if (finalRecommendation === 'BUFOR_RÓWNOLEGLE') {
        if (internalRecommendation === 'SEPARATOR') {
          explanationShortParts.push(
            `Bufor równolegle jako sprzęgło hydrauliczne (${buffer_liters || '—'} l) — separacja obiegów.`
          );
        } else {
          explanationShortParts.push(
            `Bufor równolegle jako sprzęgło hydrauliczne (${buffer_liters || '—'} l) — separacja + magazyn energii.`
          );
        }
      }

      // Wypełnij informacje o zładzie systemu (jeśli były obliczane)
      const systemVolumeInfo = sizingComponents?.systemVolume || {};
      const estimatedSystemVolume = systemVolumeInfo.estimated || 0;
      const requiredSystemVolume = systemVolumeInfo.required || 0;
      const systemVolumeSufficient = systemVolumeInfo.sufficient || false;

      const hydraulicsRecommendation = {
        axes: {
          flow_protection,
          hydraulic_separation,
          energy_storage,
        },
        // NOWY: finalRecommendation (NONE, BUFOR_SZEREGOWO, BUFOR_RÓWNOLEGLE)
        recommendation: finalRecommendation,
        // LEGACY: internalRecommendation (dla kompatybilności wstecznej)
        internalRecommendation: internalRecommendation,
        buffer_liters: buffer_liters,
        setupType: setupType,
        severity,
        reason_codes: Array.from(new Set(reason_codes)),
        explanation: {
          short: explanationShortParts.join(' '),
          long: [
            `Oś przepływu: ${flow_protection}.`,
            `Oś separacji: ${hydraulic_separation}.`,
            `Oś magazynowania: ${energy_storage}.`,
            buffer_liters
              ? `Pojemność bufora liczona jako max(V_antiCycling, V_bivalent, V_hydraulic) i zaokrąglona do pojemności rynkowych: ${buffer_liters} l.`
              : finalRecommendation === 'NONE'
              ? 'Zład własny instalacji jest wystarczający do stabilnej pracy pompy.'
              : 'Bufor wymagany dla stabilnej pracy układu.',
          ].join(' '),
        },
        inputs_used: {
          heating_type,
          has_underfloor_actuators,
          radiators_is_ht,
          bivalent_enabled,
          bivalent_source_type,
          designHeatLoss_kW,
          heating_power,
          pump_min_modulation_kw,
        },
        // Dodatkowe pola dla kompatybilności
        type: finalRecommendation !== 'NONE' ? 'storage' : 'none',
        hydraulicSeparationRequired: hydraulic_separation === 'REQUIRED',
        dominantReason: explanationShortParts.join(' ') || (reason_codes[0] || 'Standard calculation'),
        estimatedSystemVolume: estimatedSystemVolume,
        requiredSystemVolume: requiredSystemVolume,
        systemVolumeSufficient: systemVolumeSufficient,
      };

      // Persist: jeśli funkcja jest dostępna
      if (state) {
        if (!state.recommendations) state.recommendations = {};
        state.recommendations.hydraulics = hydraulicsRecommendation;
      }
      persistHydraulicsRecommendation(hydraulicsRecommendation);

      return hydraulicsRecommendation;
    } catch (error) {
      // ✅ FIX: Obsługa błędów - zwróć bezpieczny fallback
      console.error('[BufferEngine] ❌ Błąd w computeHydraulicsRecommendation:', error);
      console.error('   Szczegóły błędu:', {
        inputs: inputs ? 'dostępny' : 'brak',
        meta: inputs?.meta ? 'dostępny' : 'brak',
        selectedPump: inputs?.selectedPump ? 'dostępny' : 'brak',
        errorMessage: error.message,
        errorStack: error.stack,
      });

      const meta = inputs?.meta || {};
      // Zwróć bezpieczny fallback (brak bufora)
      const safeFallback = {
        axes: {
          flow_protection: 'NONE',
          hydraulic_separation: 'NONE',
          energy_storage: 'NONE',
        },
        recommendation: 'NONE', // NOWY: finalRecommendation
        internalRecommendation: 'NONE', // LEGACY
        buffer_liters: null,
        setupType: 'NONE',
        severity: 'INFO',
        reason_codes: [],
        explanation: {
          short: 'Błąd obliczeń - użyj domyślnych wartości. Skontaktuj się z serwisem.',
          long: `Wystąpił błąd podczas obliczania rekomendacji bufora: ${error.message}. Użyto bezpiecznych wartości domyślnych.`,
        },
        inputs_used: {
          heating_type: meta.heating_type || 'radiators',
          has_underfloor_actuators: false,
          radiators_is_ht: false,
          bivalent_enabled: false,
          bivalent_source_type: null,
          designHeatLoss_kW: meta.max_heating_power || 0,
          heating_power: meta.recommended_power_kw || 0,
          pump_min_modulation_kw: 0,
        },
        type: 'none',
        hydraulicSeparationRequired: false,
        dominantReason: 'Błąd obliczeń',
        estimatedSystemVolume: 0,
        requiredSystemVolume: 0,
        systemVolumeSufficient: false,
      };

      // Zapisz fallback do state (dla spójności)
      if (inputs?.state) {
        if (!inputs.state.recommendations) inputs.state.recommendations = {};
        inputs.state.recommendations.hydraulics = safeFallback;
      }
      if (inputs?.persistHydraulicsRecommendation) {
        inputs.persistHydraulicsRecommendation(safeFallback);
      }

      return safeFallback;
    }
  }

  /* ==========================================================================
     PUBLIC API
     ========================================================================== */

  window.BufferEngine = {
    // Main entry point - główna funkcja do wywołania
    computeRecommendation: computeHydraulicsRecommendation,

    // Lower-level functions (dla zaawansowanych przypadków)
    calculateSizeComponents: calculateBufferSizeComponents,
    calculateFinalRecommendation: calculateFinalBufferRecommendation,
    normalizeRecommendation: normalizeBufferRecommendation,

    // Helpers
    getBufferRules,
    loadBufferRules,
    roundToMarketSizes,
    normalizeHeatingType,
    HYDRAULICS_REASON_CODES,
  };

  // Auto-load rules on initialization
  loadBufferRules().catch(e => {
    console.warn('[BufferEngine] ⚠️ Failed to load buffer rules, using defaults:', e);
  });
})(window);

