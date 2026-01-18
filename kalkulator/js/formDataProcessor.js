/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FORM DATA PROCESSOR — FIELD PURPOSE DOCUMENTATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ARCHITECTURAL CONTRACT:
 * Each field collected here MUST be documented with one of:
 * - [OZC] Used by OZC engine for heating power calculation
 * - [API] Sent to cieplo.app API (may be used by external engine)
 * - [UX] User experience only, zero influence on calculations
 * - [CONFIG] Used by configurator for pump/equipment selection
 * - [PDF] Used for PDF/email generation only
 *
 * NO FIELD SHOULD EXIST WITHOUT EXPLICIT PURPOSE.
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // DEBUG INSTRUMENTATION — Pipeline Call Count Tracking
  // ═══════════════════════════════════════════════════════════════════════════
  // Enable with: window.__DEBUG_PIPELINE_CALLS = true
  // Counters are incremented only when flag is enabled
  // ═══════════════════════════════════════════════════════════════════════════
  if (typeof window.__PIPELINE_CALL_COUNTERS === 'undefined') {
    window.__PIPELINE_CALL_COUNTERS = {
      buildJsonData: 0,
      callCieplo: 0,
      reset: function () {
        this.buildJsonData = 0;
        this.callCieplo = 0;
      },
      getReport: function () {
        return {
          buildJsonData: this.buildJsonData,
          callCieplo: this.callCieplo,
          ratio: this.callCieplo > 0 ? (this.buildJsonData / this.callCieplo).toFixed(2) : 'N/A',
        };
      },
    };
  }

  window.buildJsonData = function buildJsonData(options = {}) {
    // Increment counter if debug is enabled
    if (window.__DEBUG_PIPELINE_CALLS) {
      window.__PIPELINE_CALL_COUNTERS.buildJsonData++;
      console.log(
        `[PIPELINE DEBUG] buildJsonData() called (count: ${window.__PIPELINE_CALL_COUNTERS.buildJsonData})`,
        new Error().stack.split('\n').slice(2, 5).join('\n')
      );
    }

    const strict = options && options.strict === true;
    const data = {};
    const debugInfo = {
      defaultValues: [],
      userValues: [],
    };

    // Znajdź formularz
    let form =
      hpById('heatCalcFormFull') ||
      hpById('top-instal-calc') ||
      hpQs("form[data-calc='top-instal']") ||
      hpQs('#top-instal-calc') ||
      null;

    if (!form) {
      console.error('❌ Nie znaleziono formularza kalkulatora w aktywnej instancji');
      console.error('   Sprawdź czy formularz ma prawidłowy ID lub data-attribute');
      console.error('   Próbowane selektory: #heatCalcFormFull, #top-instal-calc, form[data-calc="top-instal"]');
      throw new Error('Nie znaleziono formularza kalkulatora w aktywnej instancji');
    }

    // Funkcje pomocnicze
    const getEl = name => form.querySelector(`[name="${name}"]`);

    const isVisible = el => {
      if (!el) return false;

      // Sprawdź czy element sam jest widoczny
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }

      // Sprawdź czy kontener nadrzędny jest widoczny (dla pól w kontenerach jak #dimensionsFields, #areaField, etc.)
      let parent = el.parentElement;
      while (parent && parent !== form) {
        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
          return false;
        }
        // Sprawdź czy kontener ma klasę 'hidden' (używana przez formularz)
        if (parent.classList.contains('hidden')) {
          return false;
        }
        parent = parent.parentElement;
      }

      return true;
    };

    const get = name => {
      // ═══════════════════════════════════════════════════════════════════════════
      // ŹRÓDŁO PRAWDY: formEngine.state (zawiera wartości ze wszystkich zakładek)
      // ═══════════════════════════════════════════════════════════════════════════
      // formEngine.state przechowuje wartości ze wszystkich zakładek, nawet jeśli są ukryte
      // To jest kluczowe, bo nieaktywne zakładki mają display: none i isVisible() zwróci false
      if (
        typeof window !== 'undefined' &&
        window.formEngine &&
        window.formEngine.state &&
        typeof window.formEngine.state.getValue === 'function'
      ) {
        try {
          const stateValue = window.formEngine.state.getValue(name);
          if (stateValue !== undefined && stateValue !== null && stateValue !== '') {
            // Normalizuj stringi "undefined"/"null"
            if (typeof stateValue === 'string') {
              const trimmed = stateValue.trim();
              if (trimmed === '' || trimmed === 'undefined' || trimmed === 'null') {
                // Pomiń - przejdź do DOM
              } else {
                debugInfo.userValues.push(`${name} = ${stateValue} (from formEngine.state)`);
                return stateValue;
              }
            } else {
              // Nie-string (boolean, number, array) - zwróć bezpośrednio
              debugInfo.userValues.push(`${name} = ${stateValue} (from formEngine.state)`);
              return stateValue;
            }
          }
        } catch (e) {
          console.warn(`[buildJsonData] Błąd podczas pobierania ${name} z formEngine.state:`, e);
        }
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // FALLBACK: DOM (dla pól, które nie są w formEngine.state lub jako backup)
      // ═══════════════════════════════════════════════════════════════════════════
      const el = getEl(name);
      if (!el) return null;

      // Pola hidden — zbieraj wartość jeśli nie jest pusta (nie sprawdzaj widoczności)
      if (el.type === 'hidden') {
        const val = el.value?.trim();
        if (val !== '' && val !== null && val !== 'undefined' && val !== 'null') {
          debugInfo.userValues.push(`${name} = ${val} (hidden from DOM)`);
          return val;
        }
        return null;
      }

      // Dla pozostałych pól: sprawdź widoczność TYLKO jeśli pole jest w aktywnej zakładce
      // Ale jeśli pole ma wartość w DOM i nie ma w state, to też zbierz (może być nowo dodane)
      const isInActiveTab = isVisible(el);

      // Dla checkboxów - sprawdź checked niezależnie od widoczności
      if (el.type === 'checkbox') {
        if (el.checked) {
          debugInfo.userValues.push(`${name} = checked (from DOM)`);
          return el.checked;
        }
        return null;
      }

      // Dla radio buttons - sprawdź checked niezależnie od widoczności
      if (el.type === 'radio') {
        const checked = form.querySelector(`[name="${name}"]:checked`);
        if (checked) {
          debugInfo.userValues.push(`${name} = ${checked.value} (from DOM)`);
          return checked.value;
        }
        return null;
      }

      // Dla pozostałych pól: zbieraj tylko jeśli widoczne LUB jeśli ma wartość (może być w nieaktywnej zakładce ale ma wartość)
      if (!isInActiveTab) {
        // Pole jest w nieaktywnej zakładce - sprawdź czy ma wartość w DOM (może być wypełnione wcześniej)
        const domValue = el.value?.trim();
        if (
          domValue !== '' &&
          domValue !== null &&
          domValue !== 'undefined' &&
          domValue !== 'null'
        ) {
          debugInfo.userValues.push(`${name} = ${domValue} (from DOM, inactive tab)`);
          return domValue;
        }
        return null;
      }

      // Suwaki (range) — zawsze zwracaj ich wartość jeśli widoczne
      if (el.type === 'range') {
        const val = el.value;
        debugInfo.userValues.push(`${name} = ${val} (slider from DOM)`);
        return val;
      }

      const val = el.value?.trim();
      if (val !== '' && val !== null && val !== 'undefined' && val !== 'null') {
        debugInfo.userValues.push(`${name} = ${val} (from DOM)`);
        return val;
      }
      return null;
    };

    const getNum = name => {
      const val = get(name);
      if (val === null) return null;
      const num = parseFloat(val);
      return isNaN(num) ? null : num;
    };

    const getBool = name => {
      const val = get(name);
      if (val === null) return null;
      // Zwróć prawdziwy boolean, nie string
      // Obsługuj checkboxy (checked = true) i radio buttons (value = "yes"/"no")
      if (val === true) return true; // Checkbox checked
      if (val === 'yes' || val === 'true' || val === 1 || val === '1') return true;
      if (val === 'no' || val === 'false' || val === 0 || val === '0') return false;
      return null;
    };

    const getCheckedArray = name => {
      // ═══════════════════════════════════════════════════════════════════════════
      // ŹRÓDŁO PRAWDY: formEngine.state (dla checkboxów array)
      // ═══════════════════════════════════════════════════════════════════════════
      // Sprawdź najpierw formEngine.state (zawiera wartości ze wszystkich zakładek)
      if (
        typeof window !== 'undefined' &&
        window.formEngine &&
        window.formEngine.state &&
        typeof window.formEngine.state.getValue === 'function'
      ) {
        try {
          const stateValue = window.formEngine.state.getValue(name);
          if (Array.isArray(stateValue) && stateValue.length > 0) {
            const normalized = stateValue
              .map(val => parseInt(val))
              .filter(val => !isNaN(val))
              .sort((a, b) => a - b);
            if (normalized.length > 0) {
              debugInfo.userValues.push(
                `${name} = [${normalized.join(', ')}] (from formEngine.state)`
              );
              return normalized;
            }
          }
        } catch (e) {
          console.warn(`[buildJsonData] Błąd podczas pobierania ${name} z formEngine.state:`, e);
        }
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // FALLBACK: DOM (dla checkboxów, które nie są w formEngine.state)
      // ═══════════════════════════════════════════════════════════════════════════
      // Zbieraj wszystkie zaznaczone checkboxy, nawet jeśli są w nieaktywnej zakładce
      // (użytkownik mógł je zaznaczyć wcześniej)
      const els = form.querySelectorAll(`[name="${name}"]:checked`);
      const values = Array.from(els)
        .map(el => parseInt(el.value))
        .filter(val => !isNaN(val))
        .sort((a, b) => a - b);

      if (values.length > 0) {
        debugInfo.userValues.push(`${name} = [${values.join(', ')}] (from DOM)`);
      }
      return values;
    };

    // === POLA OBOWIĄZKOWE - KRYSTALICZNIE IDEALNE ===

    // 1. Typ budynku (enum) - WYMAGANE
    // [OZC] [API] [CONFIG] Determines simplified vs detailed insulation mode
    // [OZC] Affects U-value resolution logic (single_house simplified mode)
    // [CONFIG] Affects pump matching table selection
    const buildingTypeMap = {
      single_house: 'single_house',
      dom_jednorodzinny: 'single_house',
      double_house: 'double_house',
      blizniacza: 'double_house',
      row_house: 'row_house',
      szeregowiec: 'row_house',
      apartment: 'apartment',
      mieszkanie: 'apartment',
      multifamily: 'multifamily',
    };
    // Dla building_type używamy ZAWSZE stanu formEngine jako źródła prawdy (najpewniejsze),
    // a DOM i globalny helper jako fallbacki (mogą być nieaktualne gdy zakładki są ukryte).
    let buildingTypeRaw = null;

    // 🔥 ŹRÓDŁO PRAWDY: stan formEngine (odporne na ukryte zakładki, resety DOM, itp.)
    if (
      typeof window !== 'undefined' &&
      window.formEngine &&
      typeof window.formEngine.getState === 'function'
    ) {
      try {
        const engineState = window.formEngine.getState() || {};
        const stateVal = engineState.building_type;
        if (stateVal !== undefined && stateVal !== null) {
          const stateStr = String(stateVal).trim();
          if (stateStr !== '' && stateStr !== 'undefined' && stateStr !== 'null') {
            buildingTypeRaw = stateStr;
          }
        }
      } catch (e) {
        console.warn(
          'buildJsonData: błąd podczas pobierania building_type z formEngine.getState()',
          e
        );
      }
    }

    // 🔁 Fallback 1: DOM (jeśli formEngine nie ma wartości)
    if (buildingTypeRaw === null || buildingTypeRaw === '') {
      const buildingTypeEl = getEl('building_type');
      if (buildingTypeEl && buildingTypeEl.value !== undefined && buildingTypeEl.value !== null) {
        const rawValue = String(buildingTypeEl.value).trim();
        // Ignoruj wartości "undefined", "null", puste stringi
        if (rawValue !== '' && rawValue !== 'undefined' && rawValue !== 'null') {
          buildingTypeRaw = rawValue;
        }
      }
    }

    if (buildingTypeRaw !== null && buildingTypeRaw !== '') {
      const mappedValue = buildingTypeMap[buildingTypeRaw];
      data.building_type = mappedValue !== undefined ? mappedValue : buildingTypeRaw;
    }

    // 2. Rok budowy (integer) - zgodny z dokumentacją API - OBOWIĄZKOWE
    const constructionYearMap = {
      // Bezpośrednie wartości z HTML (zgodne z API)
      2025: 2025,
      2021: 2021,
      2011: 2011,
      2000: 2000,
      1990: 1990,
      1980: 1980,
      1970: 1970,
      1960: 1960,
      1950: 1950,
      1940: 1940,
      1939: 1939,
      1914: 1914,
      // Zachowaj stare mapowanie dla kompatybilności (przedziały)
      '2020-2024': 2021,
      '2011-2020': 2011,
      '2000-2010': 2000,
      '1990-1999': 1990,
      '1980-1989': 1980,
      '1970-1979': 1970,
      '1960-1969': 1960,
      '1950-1959': 1950,
      '1940-1949': 1940,
      przed_1940: 1939,
      przed_1914: 1914,
    };
    const yearRaw = get('construction_year') || get('construction_year_range');
    if (yearRaw !== null) {
      data.construction_year = constructionYearMap[yearRaw] || getNum('construction_year');
    } else {
      const yearNum = getNum('construction_year');
      if (yearNum !== null) {
        data.construction_year = yearNum;
      } else {
        console.error('[buildJsonData] ❌ construction_year NIE ZOSTAŁO ZEBRANE!');
      }
    }

    // 3. Typ konstrukcji (enum) - OBOWIĄZKOWE
    const constructionTypeMap = {
      traditional: 'traditional',
      murowany: 'traditional',
      tradycyjny: 'traditional',
      canadian: 'canadian',
      szkieletowy: 'canadian',
      kanadyjski: 'canadian',
    };
    const constructionTypeRaw = get('construction_type');
    if (constructionTypeRaw !== null) {
      data.construction_type = constructionTypeMap[constructionTypeRaw] || constructionTypeRaw;
    } else {
      console.error('[buildJsonData] ❌ construction_type NIE ZOSTAŁO ZEBRANE!');
    }

    // 4. Lokalizacja (latitude, longitude) - precyzyjne współrzędne
    // [OZC] [API] Used for climate zone resolution (currently fallback PL_III)
    // [OZC] Future: will map to specific climate zone (theta_e, theta_m_e)
    // [PDF] Displayed in PDF for reference
    const locationMap = {
      PL_DOLNOSLASKIE_WROCLAW: { lat: 51.1079, lon: 17.0385 },
      PL_GDANSK: { lat: 54.352, lon: 18.6466 },
      PL_KUJAWSKOPOMORSKIE_BYDGOSZCZ: { lat: 53.1235, lon: 18.0084 },
      PL_ZAKOPANE: { lat: 49.2992, lon: 19.9496 },
      PL_STREFA_IV: { lat: 49.6216, lon: 20.697 },
      PL_STREFA_I: { lat: 54.352, lon: 18.6466 },
      PL_STREFA_II: { lat: 52.2297, lon: 21.0122 },
      PL_STREFA_III: { lat: 50.0647, lon: 19.945 },
      PL_STREFA_V: { lat: 49.2992, lon: 19.9496 },
      default: { lat: 51.4453433, lon: 16.2334445 }, // Przykład z dokumentacji
    };
    const locationId = get('location_id') || get('climate_zone');
    if (locationId !== null) {
      const coords = locationMap[locationId] || locationMap['default'];
      data.latitude = coords.lat;
      data.longitude = coords.lon;
    } else {
      // Fallback tylko jeśli brak wyboru
      const coords = locationMap['default'];
      data.latitude = coords.lat;
      data.longitude = coords.lon;
    }

    // 5. Wymiary budynku - PROSTA LOGIKA: zbieramy tylko to co jest widoczne w formularzu
    // Formularz sam pokazuje/ukrywa pola na podstawie building_shape i regular_method
    // get() używa formEngine.state jako głównego źródła, więc zbiera wartości ze wszystkich zakładek

    // Kształt budynku
    const buildingShapeMap = {
      regular: 'regular',
      regularny: 'regular',
      czworoboczny: 'regular',
      irregular: 'irregular',
      nieregularny: 'irregular',
      fikuśny: 'irregular',
    };
    const buildingShapeRaw = get('building_shape');
    const buildingShape = buildingShapeRaw
      ? buildingShapeMap[buildingShapeRaw] || buildingShapeRaw
      : null;


    // ═══════════════════════════════════════════════════════════════════════════
    // PROSTA LOGIKA: zbieramy tylko widoczne pola (formularz sam decyduje co pokazać)
    // ═══════════════════════════════════════════════════════════════════════════

    // Dla irregular: zbieramy tylko floor_area_irregular + floor_perimeter (jeśli widoczne)
    if (buildingShape === 'irregular') {
      data.building_shape = 'irregular';

      // floor_area z pola floor_area_irregular (get() zwróci null jeśli pole jest ukryte)
      const floorAreaIrregular = getNum('floor_area_irregular');
      if (floorAreaIrregular !== null && floorAreaIrregular > 0) {
        data.floor_area = floorAreaIrregular;
      }

      // floor_perimeter (get() zwróci null jeśli pole jest ukryte)
      const floorPerimeter = getNum('floor_perimeter');
      if (floorPerimeter !== null && floorPerimeter > 0) {
        data.floor_perimeter = floorPerimeter;
      }
    } else if (buildingShape === 'regular') {
      // Dla regular: zbieramy building_length + building_width LUB floor_area (zależnie od tego co jest widoczne)
      // get() automatycznie zwróci null dla ukrytych pól, więc nie musimy sprawdzać regular_method

      // Spróbuj najpierw building_length + building_width (jeśli widoczne)
      const buildingLength = getNum('building_length');
      const buildingWidth = getNum('building_width');
        console.log(
        '[buildJsonData] building_length:',
        buildingLength,
        'building_width:',
        buildingWidth
      );

      if (
        buildingLength !== null &&
        buildingWidth !== null &&
        buildingLength > 0 &&
        buildingWidth > 0
      ) {
        // WARIANT A: długość + szerokość
        data.building_length = buildingLength;
        data.building_width = buildingWidth;
      } else {
        // WARIANT B: powierzchnia (jeśli building_length/width nie są widoczne)
        const floorArea = getNum('floor_area');
        if (floorArea !== null && floorArea > 0) {
          data.floor_area = floorArea;
        } else {
          console.warn(
            '[buildJsonData] ⚠️ Brak wymiarów budynku - ani building_length/width, ani floor_area'
          );
        }
      }
    } else {
      // building_shape nie wykryte - spróbuj zebrać wymiary bez sprawdzania building_shape
      // (może być sytuacja, gdy użytkownik wypełnił wymiary, ale building_shape nie jest w state)
      console.warn(
        '[buildJsonData] building_shape nie wykryte, próbuję zebrać wymiary bez sprawdzania kształtu'
      );

      const buildingLength = getNum('building_length');
      const buildingWidth = getNum('building_width');
      const floorArea = getNum('floor_area');
      const floorAreaIrregular = getNum('floor_area_irregular');
      const floorPerimeter = getNum('floor_perimeter');

      // Jeśli są wymiary irregular
      if (
        floorAreaIrregular !== null &&
        floorAreaIrregular > 0 &&
        floorPerimeter !== null &&
        floorPerimeter > 0
      ) {
        data.building_shape = 'irregular';
        data.floor_area = floorAreaIrregular;
        data.floor_perimeter = floorPerimeter;
      }
      // Jeśli są wymiary regular (length/width)
      else if (
        buildingLength !== null &&
        buildingWidth !== null &&
        buildingLength > 0 &&
        buildingWidth > 0
      ) {
        data.building_length = buildingLength;
        data.building_width = buildingWidth;
      }
      // Jeśli jest floor_area (regular area)
      else if (floorArea !== null && floorArea > 0) {
        data.floor_area = floorArea;
      }
    }

    // ✅ Nie dodajemy domyślnych wartości - błąd walidacji jeśli puste

    // 6. Kondygnacje - WYMAGANE
    const buildingFloors = getNum('building_floors');
    if (buildingFloors !== null && buildingFloors > 0) {
      data.building_floors = buildingFloors;
    } else {
      console.error('[buildJsonData] ❌ building_floors NIE ZOSTAŁO ZEBRANE!');
    }

    // 7. Ogrzewane kondygnacji (array[integer]) - WYMAGANE
    // ✅ Zbieramy TYLKO zaznaczone checkboxy - nie generujemy automatycznie
    let heatedFloors = getCheckedArray('building_heated_floors[]');
    if (heatedFloors.length > 0) {
      data.building_heated_floors = heatedFloors.sort((a, b) => a - b);
    } else {
      console.error('[buildJsonData] ❌ building_heated_floors[] NIE ZOSTAŁO ZEBRANE!');
    }
    // Jeśli brak zaznaczonych pięter - nie dodajemy do payloadu (błąd walidacji API)

    // 8. Wysokość kondygnacji (enum/double)
    const floorHeightMap = {
      niskie: 2.3,
      2.3: 2.3,
      low: 2.3,
      standardowe: 2.6,
      2.6: 2.6,
      standard: 2.6,
      wysokie: 3.1,
      3.1: 3.1,
      high: 3.1,
      bardzo_wysokie: 4.1,
      4.1: 4.1,
      very_high: 4.1,
    };
    const floorHeightRaw = get('floor_height');
    if (floorHeightRaw !== null) {
      data.floor_height = floorHeightMap[floorHeightRaw] || getNum('floor_height');
    } else {
      const floorHeightNum = getNum('floor_height');
      if (floorHeightNum !== null) {
        data.floor_height = floorHeightNum;
      }
    }

    // 9. Rodzaj dachu (enum)
    const buildingRoofMap = {
      flat: 'flat',
      plaski: 'flat',
      płaski: 'flat',
      oblique: 'oblique',
      skosy: 'oblique',
      skośny: 'oblique',
      steep: 'steep',
      stromy: 'steep',
      poddasze: 'steep',
    };
    const buildingRoofRaw = get('building_roof');
    if (buildingRoofRaw !== null) {
      data.building_roof = buildingRoofMap[buildingRoofRaw] || buildingRoofRaw;
    }

    // 10. Piwnica (boolean) - WYMAGANE
    const hasBasement = getBool('has_basement');
    if (hasBasement !== null) {
      data.has_basement = hasBasement;
    }

    // 11. Balkon (boolean) - WYMAGANE
    const hasBalcony = getBool('has_balcony');
    if (hasBalcony !== null) {
      data.has_balcony = hasBalcony;
    }

    // 12. Garaż (enum) - KRYSTALICZNIE IDEALNE
    const garageTypeMap = {
      none: null,
      brak: null,
      single_unheated: 'single_unheated',
      jeden_nieogrzewany: 'single_unheated',
      single_heated: 'single_heated',
      jeden_ogrzewany: 'single_heated',
      double_unheated: 'double_unheated',
      dwa_nieogrzewane: 'double_unheated',
      double_heated: 'double_heated',
      dwa_ogrzewane: 'double_heated',
    };
    const garageTypeRaw = get('garage_type');
    if (garageTypeRaw !== null) {
      const garageType = garageTypeMap[garageTypeRaw];
      if (garageType !== null && garageType !== undefined) {
        data.garage_type = garageType;
      }
    }

    // 13. Ściany - WYMAGANE
    // Grubość ściany (integer, cm) - zbieraj jeśli slider jest potwierdzony
    const wallSizeEl = getEl('wall_size');
    let wallSize = null;
    if (wallSizeEl) {
      // Sprawdź czy slider jest potwierdzony (data-slider-confirmed="true")
      const isSliderConfirmed = wallSizeEl.dataset.sliderConfirmed === 'true';
      if (isSliderConfirmed) {
        const val = wallSizeEl.value?.trim();
        if (val !== '' && val !== null) {
          const num = parseFloat(val);
          if (!isNaN(num) && num > 0) {
            wallSize = num;
          }
        }
      }
    }
    if (wallSize !== null) {
      data.wall_size = wallSize;
    }

    // 14. Materiał podstawowy ścian (wymagane dla traditional)
    if (data.construction_type === 'traditional') {
      const primaryMaterial = getNum('primary_wall_material');
      if (primaryMaterial !== null && primaryMaterial > 0) {
        data.primary_wall_material = primaryMaterial;
      }
    }

    // 15. Materiał dodatkowy ścian (opcjonalny)
    // [UX ONLY] has_secondary_wall_material - checkbox pokazujący/ukrywający sekcję
    // Nie jest wysyłane do API, tylko kontroluje widoczność UI
    const hasSecondaryMaterial = getBool('has_secondary_wall_material');
    if (hasSecondaryMaterial === true) {
      const secondaryMaterial = getNum('secondary_wall_material');
      if (secondaryMaterial !== null && secondaryMaterial > 0) {
        data.secondary_wall_material = secondaryMaterial;
      }
    }

    // 16. IZOLACJE - KRYSTALICZNIE IDEALNE według dokumentacji API

    // Funkcja pomocnicza do zbierania wartości z pól (dla izolacji)
    const getValueIgnoringDisabled = (name, isNum = false) => {
      // Dla radio buttons - sprawdź checked
      const radioEl = form.querySelector(`input[type="radio"][name="${name}"]`);
      if (radioEl) {
        const checked = form.querySelector(`input[type="radio"][name="${name}"]:checked`);
        if (checked && isVisible(checked)) {
          return checked.value;
        }
        return null;
      }

      // Dla pozostałych pól (select, input hidden, input text)
      const el = getEl(name);
      if (!el) return null;

      // Dla hidden fields z sliderami - sprawdź czy slider jest potwierdzony
      if (el.type === 'hidden' && el.dataset.requiresConfirm === 'true') {
        const isSliderConfirmed = el.dataset.sliderConfirmed === 'true';
        // Zbierz wartość tylko jeśli slider jest potwierdzony
        if (!isSliderConfirmed) {
          return null;
        }
      } else if (el.type === 'select-one' || el.tagName === 'SELECT') {
        // Dla selectów w kontenerze canadianOptions - sprawdź wartość nawet jeśli kontener jest ukryty
        // (jeśli construction_type === "canadian", to te pola są wymagane)
        const canadianContainer = el.closest('#canadianOptions');
        if (canadianContainer && data.construction_type === 'canadian') {
          // Dla canadian zbieraj wartość nawet jeśli kontener jest ukryty
        } else {
          // Dla pozostałych selectów sprawdź widoczność
          if (!isVisible(el)) return null;
        }
      } else {
        // Dla pozostałych pól sprawdź widoczność
        if (!isVisible(el)) return null;
      }

      // Zbierz wartość
      const val = el.value?.trim();
      if (val === '' || val === null) return null;

      if (isNum) {
        const num = parseFloat(val);
        return isNaN(num) ? null : num;
      }
      return val;
    };

    // Izolacja wewnętrzna ściany (wymagane dla canadian)
    if (data.construction_type === 'canadian') {
      // Dla canadian izolacja wewnętrzna jest zawsze wymagana
      // Select material - sprawdź bezpośrednio
      const intMatEl =
        getEl('internal_wall_isolation[material]') || getEl('internal_isolation_material');
      let intMat = null;
      if (intMatEl && intMatEl.value) {
        const matVal = parseInt(intMatEl.value);
        if (!isNaN(matVal) && matVal > 0) {
          intMat = matVal;
        }
      }

      // Hidden field size - sprawdź czy slider jest potwierdzony
      const intSizeEl = getEl('internal_wall_isolation[size]') || getEl('internal_isolation_size');
      let intSize = null;
      if (intSizeEl) {
        const isSliderConfirmed = intSizeEl.dataset.sliderConfirmed === 'true';
        if (isSliderConfirmed) {
          const sizeVal = intSizeEl.value?.trim();
          if (sizeVal !== '' && sizeVal !== null) {
            const num = parseFloat(sizeVal);
            if (!isNaN(num) && num > 0) {
              intSize = num;
            }
          }
        }
      }

      if (intMat !== null && intSize !== null && intSize > 0) {
        data.internal_wall_isolation = { material: intMat, size: intSize };
      }
    } else {
      // Opcjonalnie dla traditional
      // [UX ONLY] has_internal_isolation - checkbox pokazujący/ukrywający sekcję
      // Nie jest wysyłane do API, tylko kontroluje widoczność UI
      const hasInternalIsolation = getBool('has_internal_isolation');
      if (hasInternalIsolation === true) {
        const intMat =
          getNum('internal_wall_isolation[material]') || getNum('internal_isolation_material');
        const intSize =
          getNum('internal_wall_isolation[size]') || getNum('internal_isolation_size');
        if (intMat !== null && intSize !== null && intSize > 0) {
          data.internal_wall_isolation = { material: intMat, size: intSize };
        }
      }
    }

    // UPROSZCZONE POZIOMY IZOLACJI (dla single_house)
    // Sprawdź najpierw czy są uproszczone poziomy (priorytet)
    // Musimy to zrobić PRZED sprawdzaniem szczegółowych danych, aby uniknąć TDZ
    const wallsLevel = get('walls_insulation_level');
    const roofLevel = get('roof_insulation_level');
    const floorLevel = get('floor_insulation_level');

    // Sprawdź czy jest w trybie szczegółowym (P0: per-field checkboxy + kompatybilność wsteczna)
    // UWAGA: globalny checkbox `detailed_insulation_mode` został usunięty z UI.
    // OZC-engine używa `payload.detailed_insulation_mode` do wyboru gałęzi simplified vs detailed.
    const wallsDetailedEl = hpById('walls_insulation_detailed_mode');
    const roofDetailedEl = hpById('roof_insulation_detailed_mode');
    const floorDetailedEl = hpById('floor_insulation_detailed_mode');
    const detailedMode =
      (wallsDetailedEl && wallsDetailedEl.checked) ||
      (roofDetailedEl && roofDetailedEl.checked) ||
      (floorDetailedEl && floorDetailedEl.checked);
    data.detailed_insulation_mode = detailedMode === true;

    if (wallsLevel) {
      data.walls_insulation_level = wallsLevel;
    }
    if (roofLevel) {
      data.roof_insulation_level = roofLevel;
    }
    if (floorLevel) {
      data.floor_insulation_level = floorLevel;
    }

    // Docieplenie zewnętrzne ścian (opcjonalny) - tylko jeśli nie ma uproszczonego poziomu
    if (!wallsLevel) {
      // [UX ONLY] has_external_isolation - checkbox pokazujący/ukrywający sekcję
      // Nie jest wysyłane do API, tylko kontroluje widoczność UI
      // Sprawdź wartość radio buttona nawet jeśli disabled (ale tylko jeśli checked i widoczne)
      const hasExternalIsolationRaw = getValueIgnoringDisabled('has_external_isolation', false);
      const hasExternalIsolation =
        hasExternalIsolationRaw === 'yes' ||
        hasExternalIsolationRaw === 'true' ||
        hasExternalIsolationRaw === true;

      if (hasExternalIsolation === true) {
        // Zbieraj dane nawet jeśli pola są disabled
        // Sprawdź czy kontener jest widoczny - jeśli nie, to zbieraj dane bezpośrednio (użytkownik wybrał "yes")
        const externalContainer = hpById('externalIsolationFields');
        const containerVisible = externalContainer ? isVisible(externalContainer) : false;

        // Funkcja pomocnicza do zbierania wartości z pól izolacji zewnętrznej
        const getExternalIsolationValue = (name, isNum = false) => {
          const el = getEl(name);
          if (!el) return null;

          // Jeśli kontener jest widoczny, sprawdź widoczność elementu
          // Jeśli kontener jest ukryty, ale radio button jest "yes", zbierz dane bezpośrednio
          if (containerVisible && !isVisible(el)) {
            return null;
          }

          // Zbierz wartość nawet jeśli disabled
          const val = el.value?.trim();
          if (val === '' || val === null) return null;

          if (isNum) {
            const num = parseFloat(val);
            return isNaN(num) ? null : num;
          }
          return val;
        };

        const extMat =
          getExternalIsolationValue('external_wall_isolation[material]', true) ||
          getExternalIsolationValue('external_isolation_material', true);
        const extSize =
          getExternalIsolationValue('external_wall_isolation[size]', true) ||
          getExternalIsolationValue('external_isolation_size', true);
        if (extMat !== null && extSize !== null && extSize > 0) {
          data.external_wall_isolation = { material: extMat, size: extSize };
        }
      }
    } // Koniec if (!wallsLevel)

    // Izolacja od góry (opcjonalny) - tylko jeśli nie ma uproszczonego poziomu
    if (!roofLevel) {
      const hasTopIsolation = get('top_isolation');
      if (hasTopIsolation === 'yes') {
        // Spróbuj najpierw po name z nawiasami, potem po ID
        const topMat =
          getNum('top_isolation[material]') ||
          (() => {
            const el = hpById('top_isolation_material');
            if (el && el.value) return parseFloat(el.value);
            return null;
          })();
        const topSize =
          getNum('top_isolation[size]') ||
          (() => {
            const el = hpById('top_isolation_size');
            if (el && el.value) return parseFloat(el.value);
            return null;
          })();
        if (topMat !== null && topSize !== null && topSize > 0) {
          data.top_isolation = { material: topMat, size: topSize };
        }
      }
    }

    // Izolacja od dołu (opcjonalny) - tylko jeśli nie ma uproszczonego poziomu
    if (!floorLevel) {
      const hasBottomIsolation = get('bottom_isolation');
      if (hasBottomIsolation === 'yes') {
        // Spróbuj najpierw po name z nawiasami, potem po ID
        const botMat =
          getNum('bottom_isolation[material]') ||
          (() => {
            const el = hpById('bottom_isolation_material');
            if (el && el.value) return parseFloat(el.value);
            return null;
          })();
        const botSize =
          getNum('bottom_isolation[size]') ||
          (() => {
            const el = hpById('bottom_isolation_size');
            if (el && el.value) return parseFloat(el.value);
            return null;
          })();
        if (botMat !== null && botSize !== null && botSize > 0) {
          data.bottom_isolation = { material: botMat, size: botSize };
        }
      }
    }

    // 17. OKNA I DRZWI - WYMAGANE

    // Liczba drzwi zewnętrznych - OBOWIĄZKOWE
    const numDoors = getNum('number_doors');
    if (numDoors !== null && numDoors > 0) {
      data.number_doors = numDoors;
    } else {
      console.error('[buildJsonData] ❌ number_doors NIE ZOSTAŁO ZEBRANE!');
    }

    // Liczba drzwi balkonowych - ZAWSZE WYMAGANE przez API
    // Gdy has_balcony === true → użyj wartości z formularza (lub domyślnie 1)
    // Gdy has_balcony === false → wyślij 0
    if (data.has_balcony === true) {
      const balconyDoors = getNum('number_balcony_doors');
      // API wymaga tego pola, więc zawsze dodajemy (domyślnie 1)
      if (balconyDoors !== null && balconyDoors >= 0) {
        data.number_balcony_doors = balconyDoors;
      } else {
        // Jeśli pole nie jest wypełnione, użyj domyślnej wartości 1
        data.number_balcony_doors = 1;
      }
    } else if (data.has_balcony === false) {
      // Gdy has_balcony === false, API nadal wymaga tego pola → wyślij 0
      data.number_balcony_doors = 0;
    } else {
      // Fallback - jeśli has_balcony nie jest ustawione, spróbuj pobrać wartość lub użyj 0
      const balconyDoors = getNum('number_balcony_doors');
      data.number_balcony_doors = balconyDoors !== null && balconyDoors >= 0 ? balconyDoors : 0;
    }

    // Liczba okien (typowe okno = 130x150cm)
    const numWindows = getNum('number_windows');
    if (numWindows !== null && numWindows > 0) {
      data.number_windows = numWindows;
    }

    // Liczba dużych przeszkleń (np. 3x3m)
    const numHugeWindows = getNum('number_huge_windows');
    data.number_huge_windows = numHugeWindows !== null && numHugeWindows >= 0 ? numHugeWindows : 0;

    // Typ drzwi zewnętrznych (enum) - OBOWIĄZKOWE (zgodnie z dokumentacją API)
    const doorsTypeMap = {
      old_wooden: 'old_wooden',
      stare_drewniane: 'old_wooden',
      old_metal: 'old_metal',
      stare_metalowe: 'old_metal',
      new_wooden: 'new_wooden',
      nowe_drewniane: 'new_wooden',
      new_metal: 'new_metal',
      nowe_metalowe: 'new_metal',
      new_pvc: 'new_pvc',
      nowe_pvc: 'new_pvc',
    };
    const doorsTypeRaw = get('doors_type');
    if (doorsTypeRaw !== null) {
      data.doors_type = doorsTypeMap[doorsTypeRaw] || doorsTypeRaw;
    } else {
      console.error('[buildJsonData] ❌ doors_type NIE ZOSTAŁO ZEBRANE!');
    }

    // Typ okien (enum) - OBOWIĄZKOWE - KRYSTALICZNIE IDEALNE mapowanie
    const windowsTypeMap = {
      '2021_triple_glass': '2021_triple_glass',
      '2021_double_glass': '2021_double_glass',
      new_triple_glass: 'new_triple_glass',
      new_double_glass: 'new_double_glass',
      semi_new_double_glass: 'semi_new_double_glass',
      old_double_glass: 'old_double_glass',
      old_single_glass: 'old_single_glass',
      trojszybowe_2021: '2021_triple_glass',
      dwuszybowe_2021: '2021_double_glass',
      trojszybowe_2011: 'new_triple_glass',
      dwuszybowe_2011: 'new_double_glass',
      zespolone: 'semi_new_double_glass',
      zwykle_podwojne: 'old_double_glass',
      pojedyncze: 'old_single_glass',
    };
    const windowsTypeRaw = get('windows_type');
    if (windowsTypeRaw !== null) {
      data.windows_type = windowsTypeMap[windowsTypeRaw] || windowsTypeRaw;
    } else {
      console.error('[buildJsonData] ❌ windows_type NIE ZOSTAŁO ZEBRANE!');
    }

    // 18. INSTALACJE - WYMAGANE

    // Temperatura wewnętrzna (double, °C)
    const indoorTemp = getNum('indoor_temperature');
    if (indoorTemp !== null) {
      data.indoor_temperature = indoorTemp;
    }

    // Typ wentylacji (enum)
    const ventilationTypeMap = {
      natural: 'natural',
      naturalna: 'natural',
      grawitacyjna: 'natural',
      mechanical: 'mechanical',
      mechaniczna: 'mechanical',
      mechanical_recovery: 'mechanical_recovery',
      z_odzyskiem: 'mechanical_recovery',
      rekuperacja: 'mechanical_recovery',
    };
    const ventilationTypeRaw = get('ventilation_type');
    if (ventilationTypeRaw !== null) {
      data.ventilation_type = ventilationTypeMap[ventilationTypeRaw] || ventilationTypeRaw;
    }

    // Typ instalacji grzewczej (enum) - WYMAGANE
    const heatingTypeMap = {
      underfloor: 'underfloor',
      podlogowe: 'underfloor',
      podlogowka: 'underfloor',
      radiators: 'radiators',
      kaloryfery: 'radiators',
      grzejniki: 'radiators',
      mixed: 'mixed',
      mieszane: 'mixed',
      mieszany: 'mixed',
    };
    const heatingTypeRaw = get('heating_type');
    if (heatingTypeRaw !== null) {
      data.heating_type = heatingTypeMap[heatingTypeRaw] || heatingTypeRaw;
    }

    // Główne źródło ciepła (enum) - WYMAGANE
    const sourceTypeMap = {
      air_to_water_hp: 'air_to_water_hp',
      pompa_ciepla: 'air_to_water_hp',
      pc: 'air_to_water_hp',
      gas: 'gas',
      gaz: 'gas',
      oil: 'oil',
      olej: 'oil',
      biomass: 'biomass',
      biomasa: 'biomass',
      district_heating: 'district_heating',
      cieplo_sieciowe: 'district_heating',
      siec: 'district_heating',
    };
    const sourceTypeRaw = get('source_type');
    if (sourceTypeRaw !== null) {
      data.source_type = sourceTypeMap[sourceTypeRaw] || sourceTypeRaw;
    }

    // 19. CWU - CIEPŁA WODA UŻYTKOWA (KRYSTALICZNIE IDEALNE)

    // Czy włączyć CWU (boolean) - ZAWSZE WYMAGANE przez API
    const includeHotWater = getBool('include_hot_water') || getBool('includeHotWater');
    // Zawsze wysyłaj include_hot_water (true lub false) - API wymaga tego pola
    data.include_hot_water = includeHotWater === true;

    if (data.include_hot_water === true) {
      // Liczba osób korzystających z CWU (integer) - WYMAGANE gdy include_hot_water=true
      const hotWaterPersons = getNum('hot_water_persons');
      if (hotWaterPersons !== null && hotWaterPersons > 0) {
        data.hot_water_persons = hotWaterPersons;
      }

      // Intensywność wykorzystania CWU (enum) - WYMAGANE gdy include_hot_water=true
      const hotWaterUsageRaw = get('hot_water_usage');

      // KRYSTALICZNIE IDEALNE mapowanie zgodnie z dokumentacją API
      const usageMap = {
        // Wartości z formularza WordPress
        low: 'shower',
        medium: 'shower_bath',
        high: 'bath',
        // Wartości bezpośrednie z API
        shower: 'shower',
        shower_bath: 'shower_bath',
        bath: 'bath',
        // Polskie nazwy
        prysznic: 'shower',
        prysznic_wanna: 'shower_bath',
        wanna: 'bath',
        // Alternatywne nazwy
        tylko_prysznic: 'shower',
        glownie_prysznic: 'shower_bath',
        tylko_wanna: 'bath',
      };

      if (hotWaterUsageRaw !== null) {
        data.hot_water_usage = usageMap[hotWaterUsageRaw] || hotWaterUsageRaw;
      }
    }

    // 20. MIESZKANIE - POLA SPECJALNE (KRYSTALICZNIE IDEALNE)
    if (data.building_type === 'apartment') {
      // Mapowanie zgodnie z dokumentacją API
      const spaceTypeMap = {
        heated_room: 'heated_room',
        ogrzewany_lokal: 'heated_room',
        unheated_room: 'unheated_room',
        nieogrzewany_lokal: 'unheated_room',
        korytarz: 'unheated_room',
        klatka: 'unheated_room',
        outdoor: 'outdoor',
        zewnatrz: 'outdoor',
        swiat_zewnetrzny: 'outdoor',
        ground: 'ground',
        grunt: 'ground',
      };

      // Co powyżej (whats_over) - WYMAGANE (NIE MA "ground" w API dla whats_over!)
      // Opcja "ground" została usunięta z formularza - zgodnie z dokumentacją API
      const whatsOverRaw = get('whats_over');
      if (whatsOverRaw !== null) {
        // Mapowanie bez "ground" - zgodnie z dokumentacją API
        // Fallback pozostaje jako zabezpieczenie na wypadek starych danych z localStorage/sessionStorage
        if (whatsOverRaw === 'ground' || whatsOverRaw === 'grunt') {
          // Fallback do outdoor jeśli użytkownik wybrał ground (nie powinno się zdarzyć po usunięciu z formularza)
          data.whats_over = 'outdoor';
        } else {
          data.whats_over = spaceTypeMap[whatsOverRaw] || whatsOverRaw;
        }
      }

      // Co poniżej (whats_under) - WYMAGANE
      const whatsUnderRaw = get('whats_under');
      if (whatsUnderRaw !== null) {
        data.whats_under = spaceTypeMap[whatsUnderRaw] || whatsUnderRaw;
      }

      // Sąsiedztwo - wszystkie 4 strony WYMAGANE
      const whatsNorthRaw = get('whats_north');
      if (whatsNorthRaw !== null) {
        data.whats_north = spaceTypeMap[whatsNorthRaw] || whatsNorthRaw;
      }

      const whatsSouthRaw = get('whats_south');
      if (whatsSouthRaw !== null) {
        data.whats_south = spaceTypeMap[whatsSouthRaw] || whatsSouthRaw;
      }

      const whatsEastRaw = get('whats_east');
      if (whatsEastRaw !== null) {
        data.whats_east = spaceTypeMap[whatsEastRaw] || whatsEastRaw;
      }

      const whatsWestRaw = get('whats_west');
      if (whatsWestRaw !== null) {
        data.whats_west = spaceTypeMap[whatsWestRaw] || whatsWestRaw;
      }
    }

    // 21. SZEREGOWIEC - POLA SPECJALNE
    if (data.building_type === 'row_house') {
      // on_corner (boolean) - WYMAGANE dla row_house
      const onCorner = getBool('on_corner');
      if (onCorner !== null) {
        data.on_corner = onCorner;
      }
    }

    // 22. BUDYNEK WIELORODZINNY - POLA SPECJALNE (KRYSTALICZNIE IDEALNE)
    if (data.building_type === 'multifamily') {
      // Liczba klatek schodowych (opcjonalne)
      const stairways = getNum('number_stairways');
      if (stairways !== null && stairways > 0) {
        data.number_stairways = stairways;
      }

      // Liczba wind (opcjonalne)
      const elevators = getNum('number_elevators');
      if (elevators !== null && elevators > 0) {
        data.number_elevators = elevators;
      }
    }

    // 23. POLA OPCJONALNE - Jakość izolacji nieogrzewanych przestrzeni
    // Jakość izolacji przestrzeni nieogrzewanej poniżej (opcjonalne)
    const unheatedSpaceUnderRaw = get('unheated_space_under_type');
    if (unheatedSpaceUnderRaw !== null) {
      const unheatedSpaceMap = {
        worst: 'worst',
        poor: 'poor',
        medium: 'medium',
        great: 'great',
      };
      data.unheated_space_under_type =
        unheatedSpaceMap[unheatedSpaceUnderRaw] || unheatedSpaceUnderRaw;
    }

    // Jakość izolacji przestrzeni nieogrzewanej powyżej (opcjonalne)
    const unheatedSpaceOverRaw = get('unheated_space_over_type');
    if (unheatedSpaceOverRaw !== null) {
      const unheatedSpaceMap = {
        worst: 'worst',
        poor: 'poor',
        medium: 'medium',
        great: 'great',
      };
      data.unheated_space_over_type =
        unheatedSpaceMap[unheatedSpaceOverRaw] || unheatedSpaceOverRaw;
    }

    // === FINALNE CZYSZCZENIE - ZGODNIE Z DOKUMENTACJĄ API ===
    // Zgodnie z dokumentacją API:
    // - Wszystkie pola OBOWIĄZKOWE muszą być zawsze w payloadzie (z wartością)
    // - Pola WARUNKOWE muszą być w payloadzie tylko gdy spełnione są warunki
    // - Pola OPCJONALNE mogą być w payloadzie jeśli użytkownik je wybrał/wypełnił
    // - API nie akceptuje null/undefined - usuwamy je przed wysłaniem

    // Usuń pola null/undefined - API cieplo.app nie akceptuje null
    Object.keys(data).forEach(key => {
      if (data[key] === null || data[key] === undefined) {
        delete data[key];
      }
    });

    // Loguj finalny payload przed walidacją
      console.log(
      '%c[buildJsonData] Finalny payload przed walidacją:',
      'color: #d4a574; font-weight: bold;',
      data
    );

    // Walidacja KRYSTALICZNIE IDEALNYCH danych
    // Sprawdź czy jest w trybie uproszczonym dla single_house (per-field)
    const isWallsDetailed = !!(wallsDetailedEl && wallsDetailedEl.checked);
    const isRoofDetailed = !!(roofDetailedEl && roofDetailedEl.checked);
    const isFloorDetailed = !!(floorDetailedEl && floorDetailedEl.checked);

    const isSimplifiedSingleHouseForValidation =
      data.building_type === 'single_house' &&
      !isWallsDetailed &&
      !isRoofDetailed &&
      !isFloorDetailed;

    const requiredFields = [
      'building_type',
      'construction_year',
      'construction_type',
      'latitude',
      'longitude',
      'building_floors',
      'building_heated_floors',
      'floor_height',
      'building_roof',
      'has_basement',
      'has_balcony',
      'wall_size',
      'number_doors',
      'doors_type', // ZAWSZE WYMAGANE (zgodnie z dokumentacją API)
      'number_balcony_doors',
      'number_windows',
      'number_huge_windows',
      'windows_type',
      'indoor_temperature',
      'ventilation_type',
      'heating_type',
      'source_type',
      'include_hot_water',
    ];

    // Izolacje dla single_house: wymagania per-sekcja (żeby nie było fałszywych błędów przy miksie simplified/detailed)
    if (data.building_type === 'single_house') {
      if (!isWallsDetailed) requiredFields.push('walls_insulation_level');
      if (!isRoofDetailed) requiredFields.push('roof_insulation_level');
      if (!isFloorDetailed) requiredFields.push('floor_insulation_level');
    }

    // Sprawdź czy wszystkie wymagane pola są obecne
    let missingFields = [];
    requiredFields.forEach(field => {
      if (data[field] === null || data[field] === undefined) {
        missingFields.push(field);
      }
    });

    // Specjalne walidacje warunkowe
    if (data.construction_type === 'traditional' && !data.primary_wall_material) {
      missingFields.push('primary_wall_material (required for traditional)');
    }

    if (data.construction_type === 'canadian' && !data.internal_wall_isolation) {
      missingFields.push('internal_wall_isolation (required for canadian)');
    }

    if (data.building_type === 'apartment') {
      const apartmentRequired = [
        'whats_over',
        'whats_under',
        'whats_north',
        'whats_south',
        'whats_east',
        'whats_west',
      ];
      apartmentRequired.forEach(field => {
        if (!data[field]) {
          missingFields.push(`${field} (required for apartment)`);
        }
      });
    }

    if (data.building_type === 'row_house') {
      if (data.on_corner === null || data.on_corner === undefined) {
        missingFields.push('on_corner (required for row_house)');
      }
    }

    // Walidacja dla single_house:
    // - jeśli dany obszar jest w trybie uproszczonym → wymagaj *_insulation_level
    // - jeśli dany obszar jest w trybie szczegółowym → wymagaj odpowiedzi Tak/Nie + (gdy Tak) material+rozmiar+potwierdzenie suwaka
    if (data.building_type === 'single_house') {
      if (!isWallsDetailed && !data.walls_insulation_level) {
        missingFields.push('walls_insulation_level (required for single_house when walls are in simplified mode)');
      }
      if (!isRoofDetailed && !data.roof_insulation_level) {
        missingFields.push('roof_insulation_level (required for single_house when roof is in simplified mode)');
      }
      if (!isFloorDetailed && !data.floor_insulation_level) {
        missingFields.push('floor_insulation_level (required for single_house when floor is in simplified mode)');
      }

      if (isWallsDetailed) {
        const hasExternal = getValueIgnoringDisabled('has_external_isolation', false);
        if (!hasExternal) {
          missingFields.push('has_external_isolation (required in detailed walls mode)');
        } else if (hasExternal === 'yes') {
          const mat = getNum('external_wall_isolation[material]') || getNum('external_isolation_material');
          const sizeEl = hpById('external_wall_isolation_size');
          const size = getNum('external_wall_isolation[size]') || getNum('external_isolation_size');
          const confirmed = !!(sizeEl && sizeEl.dataset && sizeEl.dataset.sliderConfirmed === 'true');
          if (!mat) missingFields.push('external_wall_isolation[material] (required when has_external_isolation=yes)');
          if (!size) missingFields.push('external_wall_isolation[size] (required when has_external_isolation=yes)');
          if (!confirmed) missingFields.push('external_wall_isolation_size (confirm slider)');
        }
      }

      if (isRoofDetailed) {
        const hasTop = getValueIgnoringDisabled('top_isolation', false);
        if (!hasTop) {
          missingFields.push('top_isolation (required in detailed roof mode)');
        } else if (hasTop === 'yes') {
          const mat = getNum('top_isolation[material]') || getNum('top_isolation_material');
          const sizeEl = hpById('top_isolation_size');
          const size = getNum('top_isolation[size]') || getNum('top_isolation_size');
          const confirmed = !!(sizeEl && sizeEl.dataset && sizeEl.dataset.sliderConfirmed === 'true');
          if (!mat) missingFields.push('top_isolation[material] (required when top_isolation=yes)');
          if (!size) missingFields.push('top_isolation[size] (required when top_isolation=yes)');
          if (!confirmed) missingFields.push('top_isolation_size (confirm slider)');
        }
      }

      if (isFloorDetailed) {
        const hasBottom = getValueIgnoringDisabled('bottom_isolation', false);
        if (!hasBottom) {
          missingFields.push('bottom_isolation (required in detailed floor mode)');
        } else if (hasBottom === 'yes') {
          const mat = getNum('bottom_isolation[material]') || getNum('bottom_isolation_material');
          const sizeEl = hpById('bottom_isolation_size');
          const size = getNum('bottom_isolation[size]') || getNum('bottom_isolation_size');
          const confirmed = !!(sizeEl && sizeEl.dataset && sizeEl.dataset.sliderConfirmed === 'true');
          if (!mat) missingFields.push('bottom_isolation[material] (required when bottom_isolation=yes)');
          if (!size) missingFields.push('bottom_isolation[size] (required when bottom_isolation=yes)');
          if (!confirmed) missingFields.push('bottom_isolation_size (confirm slider)');
        }
      }
    }

    if (data.include_hot_water === true) {
      if (!data.hot_water_persons)
        missingFields.push('hot_water_persons (required when include_hot_water=true)');
      if (!data.hot_water_usage)
        missingFields.push('hot_water_usage (required when include_hot_water=true)');
    }

    // number_balcony_doors jest ZAWSZE wymagane przez API (nawet gdy has_balcony=false)
    if (data.has_balcony !== null && data.has_balcony !== undefined) {
      if (data.number_balcony_doors === null || data.number_balcony_doors === undefined) {
        missingFields.push('number_balcony_doors (always required by API)');
      }
    }

    if (
      data.building_shape === 'irregular' &&
      (!data.floor_perimeter || data.floor_perimeter <= 0)
    ) {
      missingFields.push('floor_perimeter (required when building_shape=irregular)');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // P0.2: STRICT MODE - blokująca walidacja
    // ═══════════════════════════════════════════════════════════════════════════
    // W trybie strict: jeśli są brakujące pola, zwróć błąd zamiast kontynuować
    if (strict && missingFields.length > 0) {
      const errorMessage = `Brakujące wymagane pola: ${missingFields.join(', ')}`;
      console.error('[buildJsonData] ❌ STRICT MODE: Walidacja nie powiodła się', missingFields);
      throw new Error(errorMessage);
    }

    // Walidacja krytycznych pól przed wysłaniem do API
    const criticalFields = [
      'building_type',
      'construction_year',
      'latitude',
      'longitude',
      'heating_type',
      'source_type',
    ];
    const missingCritical = criticalFields.filter(field => !data[field] && data[field] !== 0);

    // W trybie strict: również sprawdź krytyczne pola
    if (strict && missingCritical.length > 0) {
      const errorMessage = `Brakujące krytyczne pola: ${missingCritical.join(', ')}`;
      console.error('[buildJsonData] ❌ STRICT MODE: Brak krytycznych pól', missingCritical);
      throw new Error(errorMessage);
    }

    // Logowanie wyników - tylko w trybie debug (jeśli nie strict)
    if (!strict && missingFields.length > 0 && window.DEBUG_MISSING_FIELDS) {
      console.debug('⚠️ Brakujące pola (będą użyte domyślne):', missingFields);
    }

    if (!strict && missingCritical.length > 0 && window.DEBUG_MISSING_CRITICAL_FIELDS) {
      console.debug('🔍 [DEBUG] Brak krytycznych pól wymaganych przez API:', missingCritical);
      // Nie rzucaj błędu - API zwróci błędy walidacji, które obsłużymy
    }

    // Finalne podsumowanie z debug info

    // Podsumowanie z kolorami
    const collectedCount = debugInfo.userValues.length;

      console.log(
      `%c✅ Pola zebrane: ${collectedCount}`,
      'color: #d4a574; font-weight: bold; font-size: 13px;'
    );

    // Zawsze loguj payload (dla debugowania)
      console.log(
      '%c[buildJsonData] Aktualny payload:',
      'color: #1d4ed8; font-weight: bold; padding:3px;',
      JSON.stringify(data, null, 2)
    );

    // Loguj również jako obiekt (łatwiejsze do przeglądania w konsoli)
      console.log(
      '%c[buildJsonData] Payload jako obiekt:',
      'color: #1d4ed8; font-weight: bold;',
      data
    );

    return data;
  };

  /**
   * Czyści wizualne oznaczenia błędów w formularzu
   */
  window.clearValidationErrors = function () {
    const form =
      hpById('heatCalcFormFull') ||
      hpById('top-instal-calc') ||
      hpQs("form[data-calc='top-instal']") ||
      document.body;

    if (form) {
      const fields = form.querySelectorAll('input, select, textarea');
      fields.forEach(field => {
        field.style.border = '';
        field.style.backgroundColor = '';
      });
    }
  };

  // Global exports
  window.buildJsonData = buildJsonData;

})();
