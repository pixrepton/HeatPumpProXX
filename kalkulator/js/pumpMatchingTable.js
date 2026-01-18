/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PUMP MATCHING TABLE — Single Source of Truth
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Tabela doboru pomp ciepła na podstawie mocy z OZC Engine.
 * Używana przez:
 * - resultsRenderer.js (DobierzPompe)
 * - configurator-unified.js (selectHeatPumps)
 * 
 * ⚠️ IMPORTANT: Jeśli zmieniasz zakresy min/max, zaktualizuj w obu miejscach użycia.
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function(window) {
  'use strict';

  // Tabela doboru pomp ciepła - tylko modele ze starego kodu (SDC→WC, ADC)
  // Zakresy min/max to zakresy mocy przy -20°C (dane doborowe Panasonic), NIE zakresy modulacji
  const pumpMatchingTable = {
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

  // Export
  window.PUMP_MATCHING_TABLE = pumpMatchingTable;
})(window);
