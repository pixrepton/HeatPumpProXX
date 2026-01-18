/**
 * PHASE 3C — OZC Engine Interface
 *
 * Abstract interface for OZC (Obliczenia Zapotrzebowania na Ciepło) calculation engines.
 * Allows swapping engines or using fallback mechanisms without changing calling code.
 *
 * @file ozc-engine-interface.js
 * @version 1.0.0
 */

(function(window) {
  'use strict';

  /**
   * Base interface for OZC engines
   * All OZC engines must implement this interface
   */
  class OZCEngineInterface {
    /**
     * Calculate heat demand (zapotrzebowanie na ciepło)
     *
     * @param {Object} payload - Input data (CieploApiPayload format)
     * @returns {Promise<Object>} - Calculation result with designHeatLoss_kW
     * @throws {Error} - If calculation fails
     */
    async calculate(payload) {
      throw new Error('OZCEngineInterface.calculate() must be implemented');
    }

    /**
     * Convert result to Cieplo.app format
     *
     * @param {Object} result - Result from calculate()
     * @param {Object} payload - Original input payload
     * @returns {Object} - Mapped result in Cieplo.app format
     */
    convertToCieploAppFormat(result, payload) {
      throw new Error('OZCEngineInterface.convertToCieploAppFormat() must be implemented');
    }

    /**
     * Get engine metadata
     *
     * @returns {Object} - Engine info (name, version, capabilities)
     */
    getMetadata() {
      return {
        name: 'Unknown Engine',
        version: '0.0.0',
        capabilities: [],
      };
    }

    /**
     * Validate input payload
     *
     * @param {Object} payload - Input data to validate
     * @returns {Object} - { valid: boolean, errors: string[] }
     */
    validatePayload(payload) {
      return { valid: true, errors: [] };
    }
  }

  /**
   * Adapter for existing ozc-engine.js (window.OZCEngine)
   * Wraps the current browser-based engine to implement OZCEngineInterface
   */
  class OZCEngineAdapter extends OZCEngineInterface {
    constructor(engine) {
      super();
      this.engine = engine || window.OZCEngine;
      if (!this.engine) {
        throw new Error('OZCEngine not found. Make sure ozc-engine.js is loaded before this adapter.');
      }
    }

    async calculate(payload) {
      if (!this.engine.calculate) {
        throw new Error('OZCEngine.calculate() is not available');
      }

      try {
        const result = await this.engine.calculate(payload);
        return result;
      } catch (error) {
        throw new Error(`OZCEngine calculation failed: ${error.message}`);
      }
    }

    convertToCieploAppFormat(result, payload) {
      if (!this.engine.convertToCieploAppFormat) {
        // Fallback: return result as-is if conversion not available
        console.warn('[OZCEngineAdapter] convertToCieploAppFormat() not available, returning result as-is');
        return result;
      }

      try {
        return this.engine.convertToCieploAppFormat(result, payload);
      } catch (error) {
        console.warn('[OZCEngineAdapter] Conversion failed, returning result as-is:', error);
        return result;
      }
    }

    getMetadata() {
      return {
        name: 'OZCEngine (Browser)',
        version: this.engine.version || '1.0.0',
        capabilities: ['calculate', 'convertToCieploAppFormat'],
      };
    }

    validatePayload(payload) {
      // Basic validation aligned with OZC payload docs (cieplo.app / ozc-engine.md)
      // NOTE: Do NOT require heated_area/total_area here — these are OUTPUTS, not required inputs.
      const errors = [];

      if (!payload) {
        errors.push('Payload is required');
        return { valid: false, errors };
      }

      if (!payload.building_type) {
        errors.push('building_type is required');
      }

      if (!payload.construction_year) {
        errors.push('construction_year is required');
      }

      if (payload.latitude === undefined || payload.latitude === null) {
        errors.push('latitude is required');
      }
      if (payload.longitude === undefined || payload.longitude === null) {
        errors.push('longitude is required');
      }

      // Geometry: either floor_area or (building_length & building_width)
      const hasFloorArea = payload.floor_area !== undefined && payload.floor_area !== null;
      const hasDims =
        payload.building_length !== undefined &&
        payload.building_length !== null &&
        payload.building_width !== undefined &&
        payload.building_width !== null;
      if (!hasFloorArea && !hasDims) {
        errors.push('floor_area OR (building_length & building_width) is required');
      }

      // Conditional hot water fields
      if (payload.include_hot_water === true) {
        if (!payload.hot_water_persons && payload.hot_water_persons !== 0) {
          errors.push('hot_water_persons is required when include_hot_water=true');
        }
        if (!payload.hot_water_usage) {
          errors.push('hot_water_usage is required when include_hot_water=true');
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    }
  }

  /**
   * Engine Manager - handles engine selection, fallback, and error handling
   */
  class OZCEngineManager {
    constructor() {
      this.primaryEngine = null;
      this.fallbackEngine = null;
      this.currentEngine = null;
      this.engineHistory = [];
    }

    /**
     * Register primary engine
     *
     * @param {OZCEngineInterface} engine - Primary engine to use
     */
    setPrimaryEngine(engine) {
      if (!(engine instanceof OZCEngineInterface)) {
        throw new Error('Engine must implement OZCEngineInterface');
      }
      this.primaryEngine = engine;
      this.currentEngine = engine;
    }

    /**
     * Register fallback engine
     *
     * @param {OZCEngineInterface} engine - Fallback engine to use if primary fails
     */
    setFallbackEngine(engine) {
      if (!(engine instanceof OZCEngineInterface)) {
        throw new Error('Engine must implement OZCEngineInterface');
      }
      this.fallbackEngine = engine;
    }

    /**
     * Calculate with automatic fallback
     *
     * @param {Object} payload - Input data
     * @returns {Promise<Object>} - Calculation result
     */
    async calculate(payload) {
      // Validate payload
      const validation = this.currentEngine?.validatePayload(payload) || { valid: true, errors: [] };
      if (!validation.valid) {
        throw new Error(`Invalid payload: ${validation.errors.join(', ')}`);
      }

      // Try primary engine
      if (this.primaryEngine) {
        try {
          this.currentEngine = this.primaryEngine;
          const result = await this.primaryEngine.calculate(payload);
          this.engineHistory.push({ engine: 'primary', success: true, timestamp: Date.now() });
          return result;
        } catch (error) {
          console.warn('[OZCEngineManager] Primary engine failed, trying fallback:', error);
          this.engineHistory.push({ engine: 'primary', success: false, error: error.message, timestamp: Date.now() });
        }
      }

      // Try fallback engine
      if (this.fallbackEngine) {
        try {
          this.currentEngine = this.fallbackEngine;
          const result = await this.fallbackEngine.calculate(payload);
          this.engineHistory.push({ engine: 'fallback', success: true, timestamp: Date.now() });
          return result;
        } catch (error) {
          console.error('[OZCEngineManager] Fallback engine also failed:', error);
          this.engineHistory.push({ engine: 'fallback', success: false, error: error.message, timestamp: Date.now() });
          throw new Error(`Both primary and fallback engines failed. Last error: ${error.message}`);
        }
      }

      throw new Error('No engine available');
    }

    /**
     * Convert result to Cieplo.app format
     *
     * @param {Object} result - Result from calculate()
     * @param {Object} payload - Original input payload
     * @returns {Object} - Mapped result
     */
    convertToCieploAppFormat(result, payload) {
      if (!this.currentEngine) {
        throw new Error('No engine available');
      }
      return this.currentEngine.convertToCieploAppFormat(result, payload);
    }

    /**
     * Get current engine info
     *
     * @returns {Object} - Engine metadata
     */
    getCurrentEngineInfo() {
      if (!this.currentEngine) {
        return null;
      }
      return this.currentEngine.getMetadata();
    }

    /**
     * Get engine usage history
     *
     * @returns {Array} - History of engine usage
     */
    getHistory() {
      return [...this.engineHistory];
    }
  }

  // Export to window
  window.OZCEngineInterface = OZCEngineInterface;
  window.OZCEngineAdapter = OZCEngineAdapter;
  window.OZCEngineManager = OZCEngineManager;

  // Ensure manager exists whenever OZCEngine is available
  window.__ensureOzcEngineManager = function __ensureOzcEngineManager() {
    try {
      if (window.ozcEngineManager && typeof window.ozcEngineManager.calculate === "function") {
        return true;
      }
      if (!window.OZCEngine) return false;
      if (!window.OZCEngineAdapter || !window.OZCEngineManager) return false;

      const adapter = new window.OZCEngineAdapter(window.OZCEngine);
      const mgr = new window.OZCEngineManager();
      mgr.setPrimaryEngine(adapter);
      window.ozcEngineManager = mgr;
      return true;
    } catch (e) {
      console.warn("[OZCEngineInterface] ensure manager failed:", e);
      return false;
    }
  };

  // Auto-initialize adapter if OZCEngine is available
  if (window.OZCEngine) {
    try {
      const adapter = new OZCEngineAdapter(window.OZCEngine);
      window.ozcEngineManager = new OZCEngineManager();
      window.ozcEngineManager.setPrimaryEngine(adapter);
    } catch (error) {
      console.warn('[OZCEngineInterface] ⚠️ Could not initialize adapter:', error);
    }
  }

  // Ensure manager is available (call once after exports)
  window.__ensureOzcEngineManager && window.__ensureOzcEngineManager();

})(window);
