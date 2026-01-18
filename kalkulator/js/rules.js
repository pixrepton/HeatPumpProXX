(function (window) {
  'use strict';

  const formEngine = window.formEngine || (window.formEngine = {});

  function toArray(value) {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
  }

  function parseIntSafe(value) {
    if (value === undefined || value === null || value === '') return null;
    const num = parseInt(value, 10);
    return Number.isFinite(num) ? num : null;
  }

  function getBuildingFloors(state) {
    const parsed = parseIntSafe(state.building_floors);
    return parsed === null ? 0 : parsed;
  }

  function getRoofType(state) {
    return state.building_roof || '';
  }

  function getHeatedFloorNumbers(state) {
    return toArray(state['building_heated_floors[]'])
      .map(parseIntSafe)
      .filter(num => num !== null);
  }

  function hasHeatedFloors(state) {
    return getHeatedFloorNumbers(state).length > 0;
  }

  function atticFloorIndex(state) {
    const floors = getBuildingFloors(state);
    return floors ? floors + 1 : 0;
  }

  function isAtticHeated(state) {
    if (getRoofType(state) !== 'steep') return false;
    const atticFloor = atticFloorIndex(state);
    if (!atticFloor) return false;
    return getHeatedFloorNumbers(state).includes(atticFloor);
  }

  function shouldAskAtticAccess(state) {
    return getRoofType(state) === 'steep' && !isAtticHeated(state);
  }

  // Bramka dla pól poniżej pytania o balkony:
  // - has_balcony === 'no'  → wszystkie pola poniżej (kondygnacje, kubatura) są od razu aktywne
  // - has_balcony === 'yes' → pola poniżej aktywne dopiero po potwierdzeniu slidera number_balcony_doors
  function balconyGateSatisfied(state) {
    if (state.has_balcony === 'no') return true;
    if (state.has_balcony === 'yes') {
      const sliderInput = hpQs('#number_balcony_doors');
      return !!(sliderInput && sliderInput.dataset.sliderConfirmed === 'true');
    }
    return false;
  }

  // Bramka dla zakładki 2 - konstrukcja:
  // 1) wallGateSatisfied:
  //    - construction_type = traditional lub canadian
  //    - suwak wall_size ma ustawione data-slider-confirmed="true"
  // 2) internalIsolationGateSatisfied (tylko canadian):
  //    - wybrany materiał internal_wall_isolation[material]
  //    - suwak internal_wall_isolation_size ma data-slider-confirmed="true"
  function wallGateSatisfied(state) {
    if (state.construction_type !== 'traditional' && state.construction_type !== 'canadian')
      return false;
    const slider = hpQs('#wall_size');
    return !!(slider && slider.dataset.sliderConfirmed === 'true');
  }

  function internalIsolationGateSatisfied(state) {
    if (state.construction_type !== 'canadian') return false;
    if (!state['internal_wall_isolation[material]']) return false;
    const slider = hpQs('#internal_wall_isolation_size');
    return !!(slider && slider.dataset.sliderConfirmed === 'true');
  }

  // Bramka dla zakładki 3 (okna i drzwi)
  function windowsCountGateSatisfied() {
    const slider = hpQs('#number_windows');
    return !!(slider && slider.dataset.sliderConfirmed === 'true');
  }

  function hugeWindowsGateSatisfied() {
    const slider = hpQs('#number_huge_windows');
    return !!(slider && slider.dataset.sliderConfirmed === 'true');
  }

  function doorsGateSatisfied() {
    const slider = hpQs('#number_doors');
    return !!(slider && slider.dataset.sliderConfirmed === 'true');
  }

  // Bramka dla zakładki 4 (izolacje góra/dół)
  function topIsolationGateSatisfied(state) {
    if (state.top_isolation !== 'yes') return false;
    const slider = hpQs('#top_isolation_size');
    return !!(slider && slider.dataset.sliderConfirmed === 'true');
  }

  function bottomIsolationGateSatisfied(state) {
    if (state.bottom_isolation !== 'yes') return false;
    const slider = hpQs('#bottom_isolation_size');
    return !!(slider && slider.dataset.sliderConfirmed === 'true');
  }

  // Funkcja pomocnicza do sprawdzania czy tryb szczegółowy jest aktywny
  function isDetailedInsulationMode(state) {
    const value = state.detailed_insulation_mode;
    // Sprawdź różne możliwe wartości (boolean, string, undefined)
    const isDetailed =
      value === true || value === 'yes' || value === 'true' || value === 1 || value === '1';

    // Debug log dla kontenerów izolacji
    if (state.building_type === 'single_house') {
      console.log('[rules] Detailed insulation mode debug:', {
        value,
        isDetailed,
        type: typeof value,
        building_type: state.building_type,
      });
    }

    return isDetailed;
  }

  // Bramka dla zakładki 5 (źródło + CWU)
  function indoorTemperatureGateSatisfied() {
    const slider = hpQs('#indoor_temperature');
    return !!(slider && slider.dataset.sliderConfirmed === 'true');
  }

  function hotWaterPersonsGateSatisfied(state) {
    if (state.include_hot_water !== 'yes') return false;
    const slider = hpQs('#hot_water_persons');
    return !!(slider && slider.dataset.sliderConfirmed === 'true');
  }

  // Bramka dla potwierdzenia wymiarów (dimensions)
  function dimensionsConfirmed() {
    const dimensionsContainer = hpQs('#dimensionsFields');
    return !!(dimensionsContainer && dimensionsContainer.dataset.dimensionsConfirmed === 'true');
  }

  // Funkcja pomocnicza do parsowania float
  function parseFloatSafe(value) {
    if (value === undefined || value === null || value === '') return null;
    const num = parseFloat(value);
    return Number.isFinite(num) ? num : null;
  }

  function topIsolationCopy(state) {
    const roofType = getRoofType(state);
    const atticHeated = isAtticHeated(state);
    const atticAccess = state.attic_access;
    const base = {
      title: 'Izolacja dachu',
      material: 'Materiał izolacyjny dachu',
      size: 'Grubość izolacji dachu (cm):',
      description:
        'Docieplenie przestrzeni ogrzewanej od góry - może to być strop najwyższego ogrzewanego pomieszczenia lub dach.',
    };

    if (roofType === 'flat') {
      return {
        title: 'Izolacja stropodachu',
        material: 'Materiał izolacyjny stropodachu',
        size: 'Grubość izolacji stropodachu (cm):',
        description:
          'Izolacja stropodachu - dach płaski pełni funkcję stropu najwyższej kondygnacji.',
      };
    }

    if (roofType === 'steep' && !atticHeated && atticAccess === 'accessible') {
      return {
        title: 'Izolacja stropu/stropodachu',
        material: 'Materiał izolacyjny stropu/stropodachu',
        size: 'Grubość izolacji stropu/stropodachu (cm):',
        description: 'Izolacja stropu/stropodachu - poddasze jest dostępne, ale nieogrzewane.',
      };
    }

    return base;
  }

  const sectionFields = {
    0: [
      'building_type',
      'on_corner',
      'construction_year',
      'location_id',
      'whats_over',
      'whats_under',
      'whats_north',
      'whats_south',
      'whats_east',
      'whats_west',
    ],
    1: [
      'building_shape',
      'regular_method',
      'building_length',
      'building_width',
      'floor_area',
      'floor_area_irregular',
      'floor_perimeter',
      'has_basement',
      'has_balcony',
      'number_balcony_doors',
      'building_floors',
      'building_roof',
      'building_heated_floors[]',
      'attic_access',
      'floor_height',
      'garage_type',
    ],
    2: [
      'construction_type',
      'primary_wall_material',
      'wall_size',
      'has_secondary_wall_material',
      'secondary_wall_material',
      'internal_wall_isolation[material]',
      'internal_wall_isolation[size]',
    ],
    3: ['windows_type', 'number_windows', 'number_huge_windows', 'doors_type', 'number_doors'],
    4: [
      'walls_insulation_detailed_mode',
      'roof_insulation_detailed_mode',
      'floor_insulation_detailed_mode',
      'walls_insulation_level',
      'roof_insulation_level',
      'floor_insulation_level',
      'has_external_isolation',
      'external_wall_isolation[material]',
      'external_wall_isolation[size]',
      'top_isolation',
      'top_isolation[material]',
      'top_isolation[size]',
      'bottom_isolation',
      'bottom_isolation[material]',
      'bottom_isolation[size]',
      // Zachowane dla kompatybilności wstecznej
      'detailed_insulation_mode',
    ],
    5: [
      'source_type',
      'indoor_temperature',
      'ventilation_type',
      'heating_type',
      'include_hot_water',
      'hot_water_persons',
      'hot_water_usage',
    ],
  };

  const fieldRules = {
    building_type: { selector: '#building_type', section: 0, required: true },
    construction_year: {
      selector: '#construction_year',
      section: 0,
      requiredWhen: s => !!s.building_type,
      enabledWhen: s => !!s.building_type,
    },
    location_id: {
      selector: '[name="location_id"]',
      section: 0,
      required: true,
      enabledWhen: s => !!s.construction_year,
    },
    on_corner: {
      selector: '#on_corner',
      section: 0,
      visibleWhen: s => s.building_type === 'row_house',
      enabledWhen: s => s.building_type === 'row_house',
      requiredWhen: s => s.building_type === 'row_house',
    },
    whats_over: {
      selector: '#whats_over',
      section: 0,
      visibleWhen: s => s.building_type === 'apartment',
      enabledWhen: s => s.building_type === 'apartment',
      requiredWhen: s => s.building_type === 'apartment',
    },
    whats_under: {
      selector: '#whats_under',
      section: 0,
      visibleWhen: s => s.building_type === 'apartment',
      enabledWhen: s => s.building_type === 'apartment',
      requiredWhen: s => s.building_type === 'apartment',
    },
    whats_north: {
      selector: '#whats_north',
      section: 0,
      visibleWhen: s => s.building_type === 'apartment',
      enabledWhen: s => s.building_type === 'apartment',
      requiredWhen: s => s.building_type === 'apartment',
    },
    whats_south: {
      selector: '#whats_south',
      section: 0,
      visibleWhen: s => s.building_type === 'apartment',
      enabledWhen: s => s.building_type === 'apartment',
      requiredWhen: s => s.building_type === 'apartment',
    },
    whats_east: {
      selector: '#whats_east',
      section: 0,
      visibleWhen: s => s.building_type === 'apartment',
      enabledWhen: s => s.building_type === 'apartment',
      requiredWhen: s => s.building_type === 'apartment',
    },
    whats_west: {
      selector: '#whats_west',
      section: 0,
      visibleWhen: s => s.building_type === 'apartment',
      enabledWhen: s => s.building_type === 'apartment',
      requiredWhen: s => s.building_type === 'apartment',
    },

    building_shape: { selector: '[name="building_shape"]', section: 1, required: true },
    regular_method: {
      selector: '[name="regular_method"]',
      section: 1,
      visibleWhen: s => s.building_shape === 'regular',
      enabledWhen: s => s.building_shape === 'regular',
      requiredWhen: s => s.building_shape === 'regular',
    },
    building_length: {
      selector: '[name="building_length"]',
      section: 1,
      visibleWhen: s => s.regular_method === 'dimensions',
      enabledWhen: s => s.regular_method === 'dimensions',
      requiredWhen: s => s.regular_method === 'dimensions',
    },
    building_width: {
      selector: '[name="building_width"]',
      section: 1,
      visibleWhen: s => s.regular_method === 'dimensions',
      enabledWhen: s => s.regular_method === 'dimensions',
      requiredWhen: s => s.regular_method === 'dimensions',
    },
    floor_area: {
      selector: '[name="floor_area"]',
      section: 1,
      visibleWhen: s => s.regular_method === 'area',
      enabledWhen: s => s.regular_method === 'area',
      requiredWhen: s => s.regular_method === 'area',
    },
    floor_area_irregular: {
      selector: '[name="floor_area_irregular"]',
      section: 1,
      visibleWhen: s => s.building_shape === 'irregular',
      enabledWhen: s => s.building_shape === 'irregular',
      requiredWhen: s => s.building_shape === 'irregular' && !s.floor_perimeter, // Wymagane tylko jeśli nie ma perimeter
    },
    floor_perimeter: {
      selector: '[name="floor_perimeter"]',
      section: 1,
      visibleWhen: s => s.building_shape === 'irregular',
      enabledWhen: s => s.building_shape === 'irregular',
      requiredWhen: s => s.building_shape === 'irregular' && !s.floor_area_irregular, // Wymagane tylko jeśli nie ma area
    },
    has_basement: {
      selector: '#has_basement',
      section: 1,
      required: true,
      visibleWhen: s => {
        // Zawsze widoczne
        return true;
      },
      enabledWhen: s => {
        // Odblokowuje się gdy zakończony jest etap regularFields lub irregularFields
        if (s.building_shape === 'regular') {
          // Dla regularnych: musi być wypełniony regular_method i odpowiednie pola
          if (s.regular_method === 'dimensions') {
            // Wymaga potwierdzenia wymiarów
            return dimensionsConfirmed();
          } else if (s.regular_method === 'area') {
            // Wymaga floor_area > 9 (dwucifrowa wartość)
            const floorArea = parseFloatSafe(s.floor_area);
            return floorArea !== null && floorArea > 9;
          }
          return false;
        } else if (s.building_shape === 'irregular') {
          // Dla nieregularnych: MUSI być wypełnione OBA pola i oba > 9
          const floorAreaIrregular = parseFloatSafe(s.floor_area_irregular);
          const floorPerimeter = parseFloatSafe(s.floor_perimeter);
          return (
            floorAreaIrregular !== null &&
            floorAreaIrregular > 9 &&
            floorPerimeter !== null &&
            floorPerimeter > 9
          );
        }
        return false;
      },
    },
    has_balcony: {
      selector: '#has_balcony',
      section: 1,
      required: true,
      visibleWhen: s => {
        // Zawsze widoczne
        return true;
      },
      enabledWhen: s => {
        // Odblokowuje się po has_basement
        return s.has_basement === 'yes' || s.has_basement === 'no';
      },
    },
    // balconyFields to teraz cały kontener z sliderem (id="balconyFields" jest na .form-field-item)
    balconyFields: {
      selector: '#balconyFields',
      section: 1,
      visibleWhen: s => s.has_balcony === 'yes', // Pokazuj tylko gdy wybrano "Tak"
      enabledWhen: s => s.has_balcony === 'yes',
    },
    number_balcony_doors: {
      selector: '#number_balcony_doors',
      section: 1,
      visibleWhen: s => s.has_balcony === 'yes',
      enabledWhen: s => s.has_balcony === 'yes',
      requiredWhen: s => s.has_balcony === 'yes',
    },
    building_floors: {
      selector: '#building_floors',
      section: 1,
      required: true,
      visibleWhen: s => true, // Zawsze widoczne
      enabledWhen: balconyGateSatisfied,
    },
    building_roof: {
      selector: '#building_roof',
      section: 1,
      required: true,
      enabledWhen: balconyGateSatisfied,
    },
    'building_heated_floors[]': {
      selector: '[name="building_heated_floors[]"]',
      section: 1,
      required: true,
      enabledWhen: balconyGateSatisfied,
    },
    attic_access: {
      selector: '[name="attic_access"]',
      section: 1,
      visibleWhen: shouldAskAtticAccess,
      enabledWhen: s => shouldAskAtticAccess(s) && balconyGateSatisfied(s),
      requiredWhen: shouldAskAtticAccess,
    },
    floor_height: {
      selector: '#floor_height',
      section: 1,
      requiredWhen: hasHeatedFloors,
      enabledWhen: balconyGateSatisfied,
    },
    garage_type: {
      selector: '[name="garage_type"]',
      section: 1,
      required: true,
      enabledWhen: balconyGateSatisfied,
    },

    construction_type: { selector: '[name="construction_type"]', section: 2, required: true },
    primary_wall_material: {
      selector: '#primary_wall_material_select',
      section: 2,
      visibleWhen: s => s.construction_type === 'traditional',
      enabledWhen: s => s.construction_type === 'traditional',
      requiredWhen: s => s.construction_type === 'traditional',
    },
    wall_size: {
      selector: '#wall_size',
      section: 2,
      required: true,
      enabledWhen: s => {
        // Tradycyjna: po wyborze materiału ścian
        // Szkieletowa (canadian): od razu po wyborze konstrukcji
        if (s.construction_type === 'traditional') {
          return !!s.primary_wall_material;
        }
        if (s.construction_type === 'canadian') {
          return true;
        }
        return false;
      },
    },
    'internal_wall_isolation[material]': {
      selector: '[name="internal_wall_isolation[material]"]',
      section: 2,
      visibleWhen: s => s.construction_type === 'canadian',
      enabledWhen: s => {
        // Dla konstrukcji kanadyjskiej: po potwierdzeniu wall_size
        return s.construction_type === 'canadian' && wallGateSatisfied(s);
      },
      requiredWhen: s => s.construction_type === 'canadian',
    },
    'internal_wall_isolation[size]': {
      selector: '[name="internal_wall_isolation[size]"]',
      section: 2,
      visibleWhen: s => s.construction_type === 'canadian',
      enabledWhen: s => {
        // Suwak grubości wewnętrznej izolacji:
        // - aktywny po bramce wallGate (czyli po potwierdzeniu wall_size)
        // - oraz po wyborze materiału internal_wall_isolation[material]
        if (s.construction_type !== 'canadian') return false;
        if (!wallGateSatisfied(s)) return false;
        return !!s['internal_wall_isolation[material]'];
      },
      requiredWhen: s => s.construction_type === 'canadian',
    },
    has_secondary_wall_material: {
      selector: '#has_secondary_wall_material',
      section: 2,
      enabledWhen: s => {
        if (s.construction_type === 'traditional') {
          // Tradycyjna: po potwierdzeniu wall_size (bramka wallGate)
          return wallGateSatisfied(s);
        } else if (s.construction_type === 'canadian') {
          // Kanadyjska: po potwierdzeniu suwaka internal_wall_isolation[size] (bramka internalIsolationGate)
          return internalIsolationGateSatisfied(s);
        }
        return false;
      },
      requiredWhen: s =>
        s.construction_type === 'traditional' || s.construction_type === 'canadian',
    },
    secondary_wall_material: {
      selector: '#secondary_wall_material_select',
      section: 2,
      visibleWhen: s =>
        s.construction_type === 'traditional' && s.has_secondary_wall_material === 'yes',
      enabledWhen: s => s.has_secondary_wall_material === 'yes',
      requiredWhen: s => s.has_secondary_wall_material === 'yes',
    },
    has_external_isolation: {
      selector: '#has_external_isolation',
      section: 4,
      visibleWhen: s => {
        // Dla single_house: widoczne gdy checkbox szczegółowy jest zaznaczony
        if (s.building_type === 'single_house') {
          const checkbox = hpById('walls_insulation_detailed_mode');
          return checkbox && checkbox.checked;
        }
        // Dla innych typów budynków - zawsze widoczne
        return true;
      },
      enabledWhen: s => {
        // Dla single_house w trybie uproszczonym - ukryte
        if (s.building_type === 'single_house') {
          const checkbox = hpById('walls_insulation_detailed_mode');
          if (!(checkbox && checkbox.checked)) return false;
        }
        // W sekcji 4 - zawsze dostępne (bramki z sekcji 2 już spełnione)
        return true;
      },
    },
    'external_wall_isolation[material]': {
      selector: '[name="external_wall_isolation[material]"]',
      section: 4,
      visibleWhen: s => {
        if (s.building_type === 'single_house') {
          const checkbox = hpById('walls_insulation_detailed_mode');
          if (!(checkbox && checkbox.checked)) return false;
        }
        return s.has_external_isolation === 'yes';
      },
      enabledWhen: s => {
        if (s.building_type === 'single_house') {
          const checkbox = hpById('walls_insulation_detailed_mode');
          if (!(checkbox && checkbox.checked)) return false;
        }
        return s.has_external_isolation === 'yes';
      },
      requiredWhen: s => {
        if (s.building_type === 'single_house') {
          const checkbox = hpById('walls_insulation_detailed_mode');
          if (!(checkbox && checkbox.checked)) return false;
        }
        return s.has_external_isolation === 'yes';
      },
    },
    'external_wall_isolation[size]': {
      selector: '[name="external_wall_isolation[size]"]',
      section: 4,
      visibleWhen: s => {
        if (s.building_type === 'single_house') {
          const checkbox = hpById('walls_insulation_detailed_mode');
          if (!(checkbox && checkbox.checked)) return false;
        }
        return s.has_external_isolation === 'yes';
      },
      enabledWhen: s => {
        if (s.building_type === 'single_house') {
          const checkbox = hpById('walls_insulation_detailed_mode');
          if (!(checkbox && checkbox.checked)) return false;
        }
        return s.has_external_isolation === 'yes' && !!s['external_wall_isolation[material]'];
      },
      requiredWhen: s => {
        if (s.building_type === 'single_house') {
          const checkbox = hpById('walls_insulation_detailed_mode');
          if (!(checkbox && checkbox.checked)) return false;
        }
        return s.has_external_isolation === 'yes';
      },
    },

    windows_type: { selector: '#windows_type', section: 3, required: true },
    number_windows: {
      selector: '#number_windows',
      section: 3,
      requiredWhen: s => !!s.windows_type,
      enabledWhen: s => !!s.windows_type,
    },
    number_huge_windows: {
      selector: '#number_huge_windows',
      section: 3,
      requiredWhen: s => !!s.windows_type,
      visibleWhen: s => {
        // ✅ ZAWSZE WIDOCZNE - duże okna są ważne dla obliczeń
        return true;
      },
      enabledWhen: s => {
        // Odblokowuje się po potwierdzeniu suwaka liczby okien
        return !!s.windows_type && windowsCountGateSatisfied();
      },
    },
    doors_type: {
      selector: '#doors_type',
      section: 3,
      requiredWhen: s => {
        // Nie wymagane dla single_house w trybie uproszczonym (gdy wszystkie checkboxy są odznaczone)
        if (s.building_type === 'single_house') {
          const wallsCheckbox = hpById('walls_insulation_detailed_mode');
          const roofCheckbox = hpById('roof_insulation_detailed_mode');
          const floorCheckbox = hpById('floor_insulation_detailed_mode');
          // Jeśli żaden checkbox nie jest zaznaczony, nie wymagaj
          if (!(wallsCheckbox?.checked || roofCheckbox?.checked || floorCheckbox?.checked)) {
            return false;
          }
        }
        // Wymagane dla innych budynków lub single_house w trybie szczegółowym
        return true;
      },
      visibleWhen: s => {
        // ✅ ZAWSZE WIDOCZNE - drzwi są ważne dla obliczeń niezależnie od trybu
        return true;
      },
      enabledWhen: s => {
        // Pole jest dostępne dopiero po potwierdzeniu suwaka dużych okien
        // Jeśli nie ma dużych okien (number_huge_windows = 0), pole jest dostępne od razu
        const hugeWindows = hpQs('#number_huge_windows');
        if (hugeWindows && (hugeWindows.value === '0' || hugeWindows.value === '')) {
          return true; // Brak dużych okien - pole dostępne od razu
        }
        // Wymaga potwierdzenia suwaka dużych okien
        return hugeWindowsGateSatisfied();
      },
    },
    number_doors: {
      selector: '#number_doors',
      section: 3,
      requiredWhen: s => {
        if (s.building_type === 'single_house') {
          const wallsCheckbox = hpById('walls_insulation_detailed_mode');
          const roofCheckbox = hpById('roof_insulation_detailed_mode');
          const floorCheckbox = hpById('floor_insulation_detailed_mode');
          if (!(wallsCheckbox?.checked || roofCheckbox?.checked || floorCheckbox?.checked)) {
            return false;
          }
        }
        return !!s.doors_type;
      },
      enabledWhen: s => {
        // Dostępne gdy wybrano typ drzwi
        return !!s.doors_type;
      },
      visibleWhen: s => {
        // ✅ ZAWSZE WIDOCZNE - liczba drzwi jest ważna dla obliczeń
        return true;
      },
    },

    // NOWE: Checkboxy do przełączania trybu per-field
    walls_insulation_detailed_mode: {
      selector: '#walls_insulation_detailed_mode',
      section: 4,
      visibleWhen: s => s.building_type === 'single_house',
      enabledWhen: s => s.building_type === 'single_house',
    },
    roof_insulation_detailed_mode: {
      selector: '#roof_insulation_detailed_mode',
      section: 4,
      visibleWhen: s => s.building_type === 'single_house',
      enabledWhen: s => s.building_type === 'single_house',
    },
    floor_insulation_detailed_mode: {
      selector: '#floor_insulation_detailed_mode',
      section: 4,
      visibleWhen: s => s.building_type === 'single_house',
      enabledWhen: s => s.building_type === 'single_house',
    },
    // UPROSZCZONE POLA - widoczne gdy checkbox szczegółowy NIE jest zaznaczony
    walls_insulation_level: {
      selector: '#walls_insulation_level',
      section: 4,
      visibleWhen: s => {
        if (s.building_type !== 'single_house') return false;
        // Widoczne gdy checkbox szczegółowy NIE jest zaznaczony
        const checkbox = hpById('walls_insulation_detailed_mode');
        return !(checkbox && checkbox.checked);
      },
      enabledWhen: s => {
        if (s.building_type !== 'single_house') return false;
        const checkbox = hpById('walls_insulation_detailed_mode');
        return !(checkbox && checkbox.checked);
      },
      requiredWhen: s => {
        if (s.building_type !== 'single_house') return false;
        const checkbox = hpById('walls_insulation_detailed_mode');
        return !(checkbox && checkbox.checked);
      },
    },
    roof_insulation_level: {
      selector: '#roof_insulation_level',
      section: 4,
      visibleWhen: s => {
        if (s.building_type !== 'single_house') return false;
        const checkbox = hpById('roof_insulation_detailed_mode');
        return !(checkbox && checkbox.checked);
      },
      enabledWhen: s => {
        if (s.building_type !== 'single_house') return false;
        const checkbox = hpById('roof_insulation_detailed_mode');
        return !(checkbox && checkbox.checked);
      },
      requiredWhen: s => {
        if (s.building_type !== 'single_house') return false;
        const checkbox = hpById('roof_insulation_detailed_mode');
        return !(checkbox && checkbox.checked);
      },
    },
    floor_insulation_level: {
      selector: '#floor_insulation_level',
      section: 4,
      visibleWhen: s => {
        if (s.building_type !== 'single_house') return false;
        const checkbox = hpById('floor_insulation_detailed_mode');
        return !(checkbox && checkbox.checked);
      },
      enabledWhen: s => {
        if (s.building_type !== 'single_house') return false;
        const checkbox = hpById('floor_insulation_detailed_mode');
        return !(checkbox && checkbox.checked);
      },
      requiredWhen: s => {
        if (s.building_type !== 'single_house') return false;
        const checkbox = hpById('floor_insulation_detailed_mode');
        return !(checkbox && checkbox.checked);
      },
    },
    // STARY: detailed_insulation_mode - zachowany dla kompatybilności, ale nie używany w logice
    detailed_insulation_mode: {
      selector: '#detailed_insulation_mode',
      section: 4,
      visibleWhen: s => false, // Ukryty - zastąpiony przez per-field checkboxy
      enabledWhen: s => false,
    },
    // SZCZEGÓŁOWE POLA - widoczne gdy checkbox szczegółowy jest zaznaczony (dla single_house) lub zawsze (dla innych)
    top_isolation: {
      selector: '#top_isolation',
      section: 4,
      required: true,
      visibleWhen: s => {
        if (s.building_type === 'single_house') {
          const checkbox = hpById('roof_insulation_detailed_mode');
          return checkbox && checkbox.checked;
        }
        return true; // Dla innych typów budynków - zawsze widoczne
      },
      enabledWhen: s => {
        if (s.building_type === 'single_house') {
          const checkbox = hpById('roof_insulation_detailed_mode');
          return checkbox && checkbox.checked;
        }
        return true;
      },
    },
    'top_isolation[material]': {
      selector: '[name="top_isolation[material]"]',
      section: 4,
      visibleWhen: s => {
        if (s.building_type === 'single_house') {
          const checkbox = hpById('roof_insulation_detailed_mode');
          if (!(checkbox && checkbox.checked)) return false;
        }
        return s.top_isolation === 'yes';
      },
      enabledWhen: s => {
        if (s.building_type === 'single_house') {
          const checkbox = hpById('roof_insulation_detailed_mode');
          if (!(checkbox && checkbox.checked)) return false;
        }
        return s.top_isolation === 'yes';
      },
      requiredWhen: s => {
        if (s.building_type === 'single_house') {
          const checkbox = hpById('roof_insulation_detailed_mode');
          if (!(checkbox && checkbox.checked)) return false;
        }
        return s.top_isolation === 'yes';
      },
    },
    'top_isolation[size]': {
      selector: '[name="top_isolation[size]"]',
      section: 4,
      visibleWhen: s => {
        if (s.building_type === 'single_house') {
          const checkbox = hpById('roof_insulation_detailed_mode');
          if (!(checkbox && checkbox.checked)) return false;
        }
        return s.top_isolation === 'yes';
      },
      enabledWhen: s => {
        if (s.building_type === 'single_house') {
          const checkbox = hpById('roof_insulation_detailed_mode');
          if (!(checkbox && checkbox.checked)) return false;
        }
        return s.top_isolation === 'yes' && !!s['top_isolation[material]'];
      },
      requiredWhen: s => {
        if (s.building_type === 'single_house') {
          const checkbox = hpById('roof_insulation_detailed_mode');
          if (!(checkbox && checkbox.checked)) return false;
        }
        return s.top_isolation === 'yes';
      },
    },
    bottom_isolation: {
      selector: '#bottom_isolation',
      section: 4,
      required: true,
      visibleWhen: s => {
        if (s.building_type === 'single_house') {
          const checkbox = hpById('floor_insulation_detailed_mode');
          return checkbox && checkbox.checked;
        }
        return true; // Dla innych typów budynków - zawsze widoczne
      },
      enabledWhen: s => {
        if (s.building_type === 'single_house') {
          const checkbox = hpById('floor_insulation_detailed_mode');
          if (!(checkbox && checkbox.checked)) return false;
          return true; // Zawsze dostępne w trybie szczegółowym dla single_house
        }
        // Dla innych typów - zachowujemy bramkę
        if (s.top_isolation === 'no') return true;
        return topIsolationGateSatisfied(s);
      },
    },
    'bottom_isolation[material]': {
      selector: '[name="bottom_isolation[material]"]',
      section: 4,
      visibleWhen: s => {
        if (s.building_type === 'single_house') {
          const checkbox = hpById('floor_insulation_detailed_mode');
          if (!(checkbox && checkbox.checked)) return false;
        }
        return s.bottom_isolation === 'yes';
      },
      enabledWhen: s => {
        if (s.building_type === 'single_house') {
          const checkbox = hpById('floor_insulation_detailed_mode');
          if (!(checkbox && checkbox.checked)) return false;
        }
        return s.bottom_isolation === 'yes';
      },
      requiredWhen: s => {
        if (s.building_type === 'single_house') {
          const checkbox = hpById('floor_insulation_detailed_mode');
          if (!(checkbox && checkbox.checked)) return false;
        }
        return s.bottom_isolation === 'yes';
      },
    },
    'bottom_isolation[size]': {
      selector: '[name="bottom_isolation[size]"]',
      section: 4,
      visibleWhen: s => {
        if (s.building_type === 'single_house') {
          const checkbox = hpById('floor_insulation_detailed_mode');
          if (!(checkbox && checkbox.checked)) return false;
        }
        return s.bottom_isolation === 'yes';
      },
      enabledWhen: s => {
        if (s.building_type === 'single_house') {
          const checkbox = hpById('floor_insulation_detailed_mode');
          if (!(checkbox && checkbox.checked)) return false;
        }
        return s.bottom_isolation === 'yes' && !!s['bottom_isolation[material]'];
      },
      requiredWhen: s => {
        if (s.building_type === 'single_house') {
          const checkbox = hpById('floor_insulation_detailed_mode');
          if (!(checkbox && checkbox.checked)) return false;
        }
        return s.bottom_isolation === 'yes';
      },
    },

    source_type: { selector: '#source_type', section: 5, required: true },
    indoor_temperature: {
      selector: '#indoor_temperature',
      section: 5,
      requiredWhen: s => !!s.source_type,
      enabledWhen: s => !!s.source_type,
    },
    ventilation_type: {
      selector: '#ventilation_type',
      section: 5,
      requiredWhen: s => !!s.source_type,
      enabledWhen: s => {
        // Odblokowuje się po bramce indoorTemperatureGate (czyli po potwierdzeniu suwaka indoor_temperature)
        return indoorTemperatureGateSatisfied();
      },
    },
    heating_type: {
      selector: '#heating_type',
      section: 5,
      requiredWhen: s => !!s.ventilation_type,
      enabledWhen: s => !!s.ventilation_type,
    },
    include_hot_water: {
      selector: '#include_hot_water',
      section: 5,
      required: true,
      enabledWhen: s => !!s.heating_type,
    },
    hot_water_persons: {
      selector: '#hot_water_persons',
      section: 5,
      visibleWhen: s => s.include_hot_water === 'yes',
      enabledWhen: s => s.include_hot_water === 'yes',
      requiredWhen: s => s.include_hot_water === 'yes',
    },
    hot_water_usage: {
      selector: '#hot_water_usage',
      section: 5,
      visibleWhen: s => s.include_hot_water === 'yes',
      enabledWhen: s => {
        // Odblokowuje się po bramce hotWaterPersonsGate (czyli po potwierdzeniu suwaka hot_water_persons)
        return hotWaterPersonsGateSatisfied(s);
      },
      requiredWhen: s => s.include_hot_water === 'yes',
    },
  };

  const containerRules = {
    apartmentFields: {
      selector: '#apartmentFields',
      visibleWhen: s => s.building_type === 'apartment',
    },
    rowHouseFields: {
      selector: '#rowHouseFields',
      visibleWhen: s => s.building_type === 'row_house',
    },
    regularFields: { selector: '#regularFields', visibleWhen: s => s.building_shape === 'regular' },
    irregularFields: {
      selector: '#irregularFields',
      visibleWhen: s => s.building_shape === 'irregular',
    },
    dimensionsFields: {
      selector: '#dimensionsFields',
      visibleWhen: s => s.building_shape === 'regular' && s.regular_method === 'dimensions',
      displayType: 'grid',
    },
    areaField: {
      selector: '#areaField',
      visibleWhen: s => s.building_shape === 'regular' && s.regular_method === 'area',
    },
    regularAreaHelpBox: {
      selector: '#regularAreaHelpBox',
      visibleWhen: s => s.building_shape === 'regular' && s.regular_method === 'area',
    },
    irregularAreaHelpBox: {
      selector: '#irregularAreaHelpBox',
      visibleWhen: s => s.building_shape === 'irregular',
    },
    // STARE SEKCJE - usunięte (zastąpione przez per-field tryb)
    // simplifiedInsulationMode i detailedInsulationMode zostały usunięte z HTML
    topIsolationFields: {
      selector: '#topIsolationFields',
      visibleWhen: s => {
        // Dla single_house - tylko gdy checkbox szczegółowy jest zaznaczony i top_isolation === 'yes'
        if (s.building_type === 'single_house') {
          const checkbox = hpById('roof_insulation_detailed_mode');
          if (!(checkbox && checkbox.checked)) return false;
          return s.top_isolation === 'yes';
        }
        // Dla innych typów budynków - zawsze gdy top_isolation === 'yes'
        return s.top_isolation === 'yes';
      },
    },
    bottomIsolationFields: {
      selector: '#bottomIsolationFields',
      visibleWhen: s => {
        // Dla single_house - tylko gdy checkbox szczegółowy jest zaznaczony i bottom_isolation === 'yes'
        if (s.building_type === 'single_house') {
          const checkbox = hpById('floor_insulation_detailed_mode');
          if (!(checkbox && checkbox.checked)) return false;
          return s.bottom_isolation === 'yes';
        }
        // Dla innych typów budynków - zawsze gdy bottom_isolation === 'yes'
        return s.bottom_isolation === 'yes';
      },
    },
    traditionalOptions: {
      selector: '#traditionalOptions',
      visibleWhen: s => s.construction_type === 'traditional',
    },
    canadianOptions: {
      selector: '#canadianOptions',
      visibleWhen: s => s.construction_type === 'canadian',
    },
    secondaryWallFields: {
      selector: '#secondaryWallFields',
      visibleWhen: s => s.has_secondary_wall_material === 'yes',
    },
    externalIsolationFields: {
      selector: '#externalIsolationFields',
      visibleWhen: s => {
        // Dla single_house - tylko gdy checkbox szczegółowy jest zaznaczony i has_external_isolation === 'yes'
        if (s.building_type === 'single_house') {
          const checkbox = hpById('walls_insulation_detailed_mode');
          if (!(checkbox && checkbox.checked)) return false;
          return s.has_external_isolation === 'yes';
        }
        // Dla innych typów budynków - zawsze gdy has_external_isolation === 'yes'
        return s.has_external_isolation === 'yes';
      },
    },
    hotWaterOptions: {
      selector: '#hotWaterOptions',
      visibleWhen: s => s.include_hot_water === 'yes',
    },
    atticAccessFields: { selector: '#atticAccessFields', visibleWhen: shouldAskAtticAccess },
  };

  const labelRules = {
    topIsolationLabel: { selector: '#topIsolationLabel', text: s => topIsolationCopy(s).title },
    topIsolationMaterialLabel: {
      selector: '#topIsolationMaterialLabel',
      text: s => topIsolationCopy(s).material,
    },
    topIsolationSizeLabel: {
      selector: '#topIsolationSizeLabel',
      text: s => topIsolationCopy(s).size,
    },
    topIsolationDescription: {
      selector: '#topIsolationDescription',
      text: s => topIsolationCopy(s).description,
    },
  };

  const sectionRules = [
    { id: 0, nextButton: '.btn-next1' },
    { id: 1, nextButton: '.btn-next2' },
    { id: 2, nextButton: '.btn-next3' },
    { id: 3, nextButton: '.btn-next4' },
    { id: 4, nextButton: '.btn-next5' },
    { id: 5, nextButton: '.btn-finish' },
  ];

  const effects = [
    {
      fields: ['building_floors', 'has_basement', 'building_roof'],
      run: () => {
        if (typeof window.renderHeatedFloors === 'function') {
          window.renderHeatedFloors();
        }
      },
    },
  ];

  formEngine.rules = {
    fields: fieldRules,
    containers: containerRules,
    labels: labelRules,
    sections: sectionRules,
    sectionFields,
    effects,
  };
})(window);
