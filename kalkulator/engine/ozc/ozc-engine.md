/**
 * ozc-engine.js
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CANONICAL OZC ENGINE — SINGLE SOURCE OF TRUTH FOR HEATING POWER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ARCHITECTURAL DECISION:
 * This JavaScript implementation is the AUTHORITATIVE runtime engine.
 * TypeScript version in /src/ is for development/testing only.
 *
 * OUTPUT CONTRACT:
 * - designHeatLoss_kW: The canonical heating power in kW (used everywhere)
 * - convertToCieploAppFormat(): Maps to max_heating_power for API compatibility
 * - All downstream systems (configurator, PDF, email) MUST use designHeatLoss_kW
 *
 * CALCULATION LOGIC:
 * - PN-EN 12831 compliant
 * - Uses ONLY payload data from cieplo.app API (no construction year guessing)
 * - Strategy A': Blended additive corrections (windows, doors, ventilation, basement)
 * - Simplified mode for single_house: insulation levels → fixed U-values
 *
 * CRITICAL VALUES:
 * - thermalBridgesMultiplier: 1.1 (10% safety margin for thermal bridges)
 * - safetyFactor: 1.1 (10% overall safety margin)
 * - Clamping: heatLossPerM2 sanity check (20-250 W/m²)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  // Dane domyślne (wbudowane, nie ładujemy z JSON)
  const DEFAULTS = {
    fallback: {
      U_wall: 0.6,
      U_roof: 0.3,
      U_floor: 0.4,
      U_window: 1.3,
      U_door: 1.8,
      window_area_per_piece_m2: 1.6,
      huge_window_area_m2: 4.0,
      door_area_m2: 2.0,
      balcony_door_area_m2: 2.2,
      roof_area_factor: {
        flat: 1.05,
        oblique: 1.15,
        steep: 1.25,
      },
    },
    corrections: {
      thermalBridgesMultiplier: 1.1,
      safetyFactor: 1.1,
    },
    // Dane klimatyczne dla stref Polski (zgodne z PN-B 02025)
    climate: {
      'PL_I': { theta_e: -16, theta_m_e: 7.5 },   // Strefa I (Gdańsk)
      'PL_II': { theta_e: -18, theta_m_e: 7.0 },   // Strefa II (Bydgoszcz)
      'PL_III': { theta_e: -20, theta_m_e: 1.9 },  // Strefa III (Wrocław) - domyślna
      'PL_IV': { theta_e: -22, theta_m_e: 6.0 },   // Strefa IV
      'PL_V': { theta_e: -24, theta_m_e: 5.0 },   // Strefa V (Zakopane)
    },
  };

  const WINDOWS = {
    old_single_glass: 2.8,
    old_double_glass: 2.5,
    semi_new_double_glass: 2.0,
    new_double_glass: 1.3,
    new_triple_glass: 0.9,
    '2021_double_glass': 1.0,
    '2021_triple_glass': 0.8,
  };

  const DOORS = {
    old_wooden: 3.0,
    old_metal: 3.5,
    new_wooden: 1.8,
    new_metal: 1.5,
    new_pvc: 1.3,
  };

  const VENTILATION = {
    natural: { ach: 0.8, eta_rec: 0.0 },
    mechanical: { ach: 0.6, eta_rec: 0.0 },
    mechanical_recovery: { ach: 0.6, eta_rec: 0.85 },
  };

  const MATERIALS = {
    57: { lambda: 0.25 },
    88: { lambda: 0.036 },
    68: { lambda: 0.04 },
  };

  const CLIMATE = {
    PL_III: { theta_e: -20, theta_m_e: 7.0 },
    PL_IV: { theta_e: -22, theta_m_e: 6.0 },
  };

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function warnPush(arr, msg) {
    if (!arr.includes(msg)) arr.push(msg);
  }

  function assumePush(arr, msg) {
    if (!arr.includes(msg)) arr.push(msg);
  }

  /**
   * Oblicza geometrię - powierzchnia netto i kubatura netto
   */
  function computeGeometry(p, warnings, assumptions) {
    // KROK A: Oblicz powierzchnię brutto (zewnętrzną)
    let A_brutto = p.floor_area ?? null;
    let length_brutto = p.building_length ?? null;
    let width_brutto = p.building_width ?? null;

    if (!A_brutto) {
      if (length_brutto && width_brutto) {
        A_brutto = length_brutto * width_brutto;
        assumePush(
          assumptions,
          'floor_area computed from building_length * building_width (brutto)'
        );
      } else {
        warnPush(warnings, 'Missing floor_area; fallback floor_area=100');
        A_brutto = 100;
        assumePush(assumptions, 'fallback floor_area=100');
      }
    } else {
      // Jeśli podano floor_area bezpośrednio, załóż że to powierzchnia zewnętrzna
      if (!length_brutto || !width_brutto) {
        // Jeśli nie mamy wymiarów, założymy że floor_area to już powierzchnia wewnętrzna
        // (nie mnożymy przez 0.85, bo to byłoby podwójne odejmowanie)
        assumePush(assumptions, 'floor_area treated as provided value');
      }
    }

    // KROK B: Oblicz wymiary wewnętrzne (netto) - odejmij grubość ścian
    let length_netto = length_brutto;
    let width_netto = width_brutto;
    let A_netto = A_brutto;

    // wall_size jest w cm, konwertuj na metry
    const wall_thickness_m = p.wall_size ? p.wall_size / 100 : 0;

    if (wall_thickness_m > 0 && length_brutto && width_brutto) {
      length_netto = length_brutto - 2 * wall_thickness_m;
      width_netto = width_brutto - 2 * wall_thickness_m;
      A_netto = length_netto * width_netto;
      assumePush(
        assumptions,
        `Powierzchnia skorygowana o grubość ścian zewnętrznych (${p.wall_size} cm)`
      );
    } else if (wall_thickness_m > 0 && A_brutto && !length_brutto) {
      // Jeśli mamy tylko floor_area, zastosuj współczynnik 0.85
      A_netto = A_brutto * 0.85;
      assumePush(
        assumptions,
        'Powierzchnia skorygowana współczynnikiem 0.85 (przybliżenie grubości ścian)'
      );
    }

    // Obwód wewnętrzny
    let P = p.floor_perimeter ?? null;
    if (!P) {
      if (length_netto && width_netto) {
        P = 2 * (length_netto + width_netto);
        assumePush(assumptions, 'floor_perimeter computed from netto length & width');
      } else if (p.building_shape === 'irregular' && p.floor_perimeter) {
        // Dla nieregularnego kształtu, jeśli podano floor_perimeter, użyj go (ale skoryguj o grubość ścian)
        const wall_thickness_m = p.wall_size ? p.wall_size / 100 : 0;
        if (wall_thickness_m > 0) {
          P = p.floor_perimeter - 8 * wall_thickness_m; // 4 ściany × 2 × grubość
          assumePush(assumptions, 'floor_perimeter skorygowany o grubość ścian (irregular shape)');
        } else {
          P = p.floor_perimeter;
          assumePush(assumptions, 'floor_perimeter z payloadu (irregular shape)');
        }
      } else {
        const ratio = 1.3;
        width_netto = Math.sqrt(A_netto / ratio);
        length_netto = A_netto / width_netto;
        P = 2 * (length_netto + width_netto);
        warnPush(warnings, 'Missing floor_perimeter; approximated rectangle');
        assumePush(assumptions, 'rectangle approximation used');
      }
    } else {
      // Jeśli podano obwód, może być zewnętrzny - skoryguj
      if (wall_thickness_m > 0) {
        P = P - 8 * wall_thickness_m; // 4 ściany × 2 × grubość
        assumePush(assumptions, 'Obwód skorygowany o grubość ścian');
      }
    }

    // KROK C: Oblicz kubaturę netto dla każdej kondygnacji
    const heatedFloorsCount =
      Array.isArray(p.building_heated_floors) && p.building_heated_floors.length > 0
        ? p.building_heated_floors.length
        : p.building_floors;

    const h = p.floor_height;
    const building_roof = p.building_roof || 'oblique';

    // Określ czy ostatnia kondygnacja to poddasze
    const maxFloor =
      Array.isArray(p.building_heated_floors) && p.building_heated_floors.length > 0
        ? Math.max(...p.building_heated_floors)
        : p.building_floors;
    const isLastFloorAttic =
      maxFloor === p.building_floors && (building_roof === 'oblique' || building_roof === 'steep');

    // Oblicz kubaturę dla każdej kondygnacji
    let totalVolume = 0;

    for (let i = 0; i < heatedFloorsCount; i++) {
      const isAttic = isLastFloorAttic && i === heatedFloorsCount - 1;
      const heightMultiplier =
        isAttic && (building_roof === 'oblique' || building_roof === 'steep') ? 0.65 : 1.0;
      const floorVolume = A_netto * h * heightMultiplier;
      totalVolume += floorVolume;

      if (isAttic) {
        assumePush(
          assumptions,
          `Poddasze: kubatura skorygowana współczynnikiem 0.65 (skosy dachu)`
        );
      }
    }

    const Bprime = A_netto / (0.5 * P);

    const rf = DEFAULTS.fallback.roof_area_factor[p.building_roof] ?? 1.15;
    const roofArea = A_netto * rf;

    return {
      floorArea: A_netto, // ZMIANA: zwracamy powierzchnię netto
      floorAreaBrutto: A_brutto, // DODAJEMY: powierzchnię brutto dla referencji
      perimeter: P,
      length: length_netto || length_brutto,
      width: width_netto || width_brutto,
      volume: totalVolume, // ZMIANA: kubatura netto z uwzględnieniem skosów
      Bprime,
      roofArea,
      wallThickness_m: wall_thickness_m, // DODAJEMY: dla referencji
    };
  }

  /**
   * Oblicza efektywną powierzchnię ścian zewnętrznych z uwzględnieniem sąsiedztwa
   * Dla apartment/row_house/double_house: zmniejsza powierzchnię ścian sąsiadujących z ogrzewanymi pomieszczeniami
   */
  function computeEffectiveWallArea(p, perimeter, floorHeight, warnings, assumptions) {
    const buildingType = p.building_type || 'single_house';
    const heatedFloorsCount =
      Array.isArray(p.building_heated_floors) && p.building_heated_floors.length > 0
        ? p.building_heated_floors.length
        : p.building_floors;

    // Oblicz całkowitą powierzchnię ścian (brutto)
    const totalWallArea = perimeter * floorHeight * heatedFloorsCount;

    // Dla single_house: wszystkie ściany są zewnętrzne
    if (buildingType === 'single_house') {
      return { external: totalWallArea, adjacent: 0 };
    }

    // Dla apartment: sprawdź sąsiedztwo z 6 stron (over, under, 4 kierunki)
    if (buildingType === 'apartment') {
      let externalArea = totalWallArea;
      let adjacentArea = 0;

      // Załóżmy, że ściany są równomiernie rozłożone na 4 kierunki (N, S, E, W)
      // oraz strop/podłoga (over/under)
      const wallAreaPerDirection = (perimeter * floorHeight * heatedFloorsCount) / 4; // Ściany pionowe
      const floorCeilingArea = p.floor_area || 100; // Przybliżenie powierzchni stropu/podłogi

      // Sprawdź każdy kierunek
      const directions = [
        { key: 'whats_north', area: wallAreaPerDirection, label: 'północ' },
        { key: 'whats_south', area: wallAreaPerDirection, label: 'południe' },
        { key: 'whats_east', area: wallAreaPerDirection, label: 'wschód' },
        { key: 'whats_west', area: wallAreaPerDirection, label: 'zachód' },
        { key: 'whats_over', area: floorCeilingArea, label: 'strop' },
        { key: 'whats_under', area: floorCeilingArea, label: 'podłoga' },
      ];

      directions.forEach(dir => {
        const neighbor = p[dir.key];
        if (neighbor === 'heated_room') {
          // Ściana sąsiadująca z ogrzewanym pomieszczeniem - znacznie mniejsze straty
          adjacentArea += dir.area;
          externalArea -= dir.area;
          assumePush(
            assumptions,
            `Ściana ${dir.label}: sąsiaduje z ogrzewanym pomieszczeniem (zmniejszone straty)`
          );
        } else if (neighbor === 'unheated_room') {
          // Ściana sąsiadująca z nieogrzewanym pomieszczeniem - średnie straty (częściowo zewnętrzna)
          adjacentArea += dir.area * 0.5; // 50% jako sąsiednia
          externalArea -= dir.area * 0.5;
          assumePush(
            assumptions,
            `Ściana ${dir.label}: sąsiaduje z nieogrzewanym pomieszczeniem (częściowo zmniejszone straty)`
          );
        }
        // outdoor/ground: pozostaje jako zewnętrzna (bez zmian)
      });

      if (adjacentArea > 0) {
        assumePush(
          assumptions,
          `Apartment: powierzchnia ścian zewnętrznych zmniejszona o ${Math.round(
            adjacentArea
          )} m² (sąsiedztwo)`
        );
      }

      return { external: Math.max(0, externalArea), adjacent: adjacentArea };
    }

    // Dla row_house: sprawdź czy segment jest na końcu (on_corner)
    if (buildingType === 'row_house') {
      const isCorner = p.on_corner === true;
      if (isCorner) {
        // Segment na końcu: 3 ściany zewnętrzne (2 boczne + 1 końcowa)
        // Segment w środku: 2 ściany zewnętrzne (tylko boczne)
        // Załóżmy że segment ma kształt prostokąta: 2 ściany długie (boczne) + 2 ściany krótkie (końcowe)
        // Segment w środku: tylko 2 ściany boczne są zewnętrzne (50% powierzchni)
        // Segment na końcu: 2 ściany boczne + 1 końcowa (75% powierzchni)
        const externalArea = isCorner ? totalWallArea * 0.75 : totalWallArea * 0.5;
        const adjacentArea = totalWallArea - externalArea;
        assumePush(
          assumptions,
          `Row house (corner=${isCorner}): powierzchnia ścian zewnętrznych = ${Math.round(
            externalArea
          )} m²`
        );
        return { external: externalArea, adjacent: adjacentArea };
      } else {
        // Segment w środku: tylko 2 ściany boczne
        const externalArea = totalWallArea * 0.5;
        const adjacentArea = totalWallArea * 0.5;
        assumePush(
          assumptions,
          `Row house (middle segment): powierzchnia ścian zewnętrznych = ${Math.round(
            externalArea
          )} m²`
        );
        return { external: externalArea, adjacent: adjacentArea };
      }
    }

    // Dla double_house: podobnie jak row_house, ale zawsze 3 ściany zewnętrzne (2 boczne + 1 wspólna)
    if (buildingType === 'double_house') {
      // Bliźniak: 3 ściany zewnętrzne (75% powierzchni)
      const externalArea = totalWallArea * 0.75;
      const adjacentArea = totalWallArea * 0.25;
      assumePush(
        assumptions,
        `Double house: powierzchnia ścian zewnętrznych = ${Math.round(
          externalArea
        )} m² (1 wspólna ściana)`
      );
      return { external: externalArea, adjacent: adjacentArea };
    }

    // Dla multifamily: podobnie jak apartment, ale bez szczegółowych danych o sąsiedztwie
    // Użyj uproszczonego modelu
    if (buildingType === 'multifamily') {
      // Załóżmy że 50% ścian sąsiaduje z innymi mieszkaniami
      const externalArea = totalWallArea * 0.5;
      const adjacentArea = totalWallArea * 0.5;
      assumePush(assumptions, `Multifamily: uproszczony model - 50% ścian zewnętrznych`);
      return { external: externalArea, adjacent: adjacentArea };
    }

    // Fallback: wszystkie ściany zewnętrzne
    return { external: totalWallArea, adjacent: 0 };
  }

  /**
   * Oblicza powierzchnie
   */
  function computeAreas(p, floorArea, roofArea, floorHeight, perimeter, warnings, assumptions) {
    let A_walls = p.wall_size;

    // Walidacja: wall_size może być powierzchnią (m²) lub grubością (cm)
    // Jeśli wartość jest < 50, prawdopodobnie to grubość w cm, nie powierzchnia
    if (A_walls && A_walls > 0 && A_walls < 50) {
      // Prawdopodobnie to grubość w cm, nie powierzchnia - oblicz z geometrii
      const wallAreas = computeEffectiveWallArea(p, perimeter, floorHeight, warnings, assumptions);
      A_walls = wallAreas.external; // Używamy tylko ścian zewnętrznych
      warnPush(
        warnings,
        `wall_size=${p.wall_size} looks like thickness (cm), not area; computed area from geometry`
      );
      assumePush(
        assumptions,
        `wall_size treated as thickness (${p.wall_size} cm), walls area computed from geometry (external only)`
      );
    } else if (!A_walls || A_walls <= 0) {
      // Oblicz z geometrii z uwzględnieniem typu budynku
      const wallAreas = computeEffectiveWallArea(p, perimeter, floorHeight, warnings, assumptions);
      A_walls = wallAreas.external;
      warnPush(warnings, 'Missing wall_size; computed from geometry');
      assumePush(assumptions, 'walls area computed from geometry (external only)');
    } else {
      // wall_size jest powierzchnią w m² - ale może być całkowita, nie tylko zewnętrzna
      // Dla apartment/row_house/double_house: zmniejsz proporcjonalnie
      const buildingType = p.building_type || 'single_house';
      if (buildingType !== 'single_house') {
        // Użyj tego samego współczynnika co w computeEffectiveWallArea
        let reductionFactor = 1.0;
        if (buildingType === 'apartment') {
          // Dla apartment: trudno oszacować bez szczegółowych danych, użyj 0.7 jako średnia
          reductionFactor = 0.7;
        } else if (buildingType === 'row_house') {
          reductionFactor = p.on_corner === true ? 0.75 : 0.5;
        } else if (buildingType === 'double_house') {
          reductionFactor = 0.75;
        } else if (buildingType === 'multifamily') {
          reductionFactor = 0.5;
        }
        A_walls = A_walls * reductionFactor;
        assumePush(
          assumptions,
          `walls area reduced by ${Math.round(
            (1 - reductionFactor) * 100
          )}% for ${buildingType} (adjacent walls)`
        );
      } else {
        assumePush(assumptions, `walls area from wall_size=${A_walls} m²`);
      }
    }

    const A_window =
      (p.number_windows || 0) * DEFAULTS.fallback.window_area_per_piece_m2 +
      (p.number_huge_windows || 0) * DEFAULTS.fallback.huge_window_area_m2;

    const A_doors =
      (p.number_doors || 0) * DEFAULTS.fallback.door_area_m2 +
      (p.number_balcony_doors || 0) * DEFAULTS.fallback.balcony_door_area_m2;

    // Korekta powierzchni ścian dla garażu w bryle budynku (garage_type)
    // Garaż zmniejsza powierzchnię ścian zewnętrznych (ściany wspólne z garażem)
    if (p.garage_type && p.garage_type !== 'none') {
      // Szacunkowa powierzchnia ścian wspólnych z garażem (w zależności od typu)
      const garageWallReduction = {
        single_unheated: 0.05, // -5% powierzchni ścian (mały garaż)
        single_heated: 0.05, // -5% (mały garaż ogrzewany)
        double_unheated: 0.1, // -10% (duży garaż)
        double_heated: 0.1, // -10% (duży garaż ogrzewany)
      };
      const reduction = garageWallReduction[p.garage_type] || 0;
      if (reduction > 0) {
        A_walls = A_walls * (1 - reduction);
        assumePush(
          assumptions,
          `Powierzchnia ścian zmniejszona o ${Math.round(reduction * 100)}% dla garażu typu ${
            p.garage_type
          }`
        );
      }
    } else if (p.has_garage === true) {
      // Fallback dla przestarzałego parametru has_garage
      A_walls = A_walls * 0.95; // -5% (uproszczenie)
      assumePush(
        assumptions,
        'Powierzchnia ścian zmniejszona o 5% dla garażu (has_garage=true, uproszczenie)'
      );
    }

    return {
      walls: A_walls,
      roof: roofArea,
      floor: floorArea,
      windows: A_window,
      doors: A_doors,
    };
  }

  /**
   * Rozwiązuje R (opór cieplny) z materiału i grubości
   */
  function resolveRFromMaterial(materialId, thicknessCm, warnings, assumptions, label) {
    if (!materialId || !thicknessCm) {
      return null;
    }

    const mat = MATERIALS[String(materialId)];
    if (!mat?.lambda) {
      return null;
    }

    const d_m = thicknessCm / 100;
    const R = d_m / mat.lambda;
    assumePush(
      assumptions,
      `${label}: R computed from material (lambda=${mat.lambda}, d=${thicknessCm}cm)`
    );
    return R;
  }

  /**
   * Rozwiązuje U z materiału i grubości (dla pojedynczej warstwy)
   */
  function resolveUFromMaterial(materialId, thicknessCm, fallbackU, warnings, assumptions, label) {
    if (!materialId || !thicknessCm) {
      warnPush(warnings, `Missing ${label} material/thickness; fallback U=${fallbackU}`);
      assumePush(assumptions, `${label}: fallback U=${fallbackU}`);
      return fallbackU;
    }

    const mat = MATERIALS[String(materialId)];
    if (!mat?.lambda) {
      warnPush(warnings, `Unknown materialId=${materialId} for ${label}; fallback U=${fallbackU}`);
      assumePush(assumptions, `${label}: fallback U=${fallbackU}`);
      return fallbackU;
    }

    const d_m = thicknessCm / 100;
    const R_ins = d_m / mat.lambda;
    const R0 = 0.2;
    const U = 1 / (R_ins + R0);
    const Uc = clamp(U, 0.08, 3.5);

    assumePush(assumptions, `${label}: U computed from lambda with simplified formula`);
    return Uc;
  }

  /**
   * Rozwiązuje U z wielu warstw (konstrukcja + izolacja)
   * Obsługuje zarówno konstrukcję tradycyjną (primary + external) jak i szkieletową (internal)
   */
  function resolveUFromLayers(
    primaryMaterialId,
    primaryThicknessCm,
    externalInsulationMaterialId,
    externalInsulationThicknessCm,
    internalInsulationMaterialId,
    internalInsulationThicknessCm,
    fallbackU,
    warnings,
    assumptions,
    label
  ) {
    const R0 = 0.2; // Opór przejmowania ciepła (standardowy)
    let R_total = R0;

    // Warstwa konstrukcyjna (primary_wall_material) - tylko dla traditional
    if (primaryMaterialId && primaryThicknessCm) {
      const R_primary = resolveRFromMaterial(
        primaryMaterialId,
        primaryThicknessCm,
        warnings,
        assumptions,
        `${label} (primary layer)`
      );
      if (R_primary !== null) {
        R_total += R_primary;
      }
    }

    // Warstwa izolacji wewnętrznej (internal_wall_isolation) - głównie dla canadian
    if (internalInsulationMaterialId && internalInsulationThicknessCm) {
      const R_internal = resolveRFromMaterial(
        internalInsulationMaterialId,
        internalInsulationThicknessCm,
        warnings,
        assumptions,
        `${label} (internal insulation)`
      );
      if (R_internal !== null) {
        R_total += R_internal;
      }
    }

    // Warstwa izolacji zewnętrznej (external_wall_isolation) - dla traditional
    if (externalInsulationMaterialId && externalInsulationThicknessCm) {
      const R_external = resolveRFromMaterial(
        externalInsulationMaterialId,
        externalInsulationThicknessCm,
        warnings,
        assumptions,
        `${label} (external insulation)`
      );
      if (R_external !== null) {
        R_total += R_external;
      }
    }

    // Jeśli nie ma żadnej warstwy, użyj fallback
    if (R_total === R0) {
      warnPush(warnings, `No valid layers for ${label}; fallback U=${fallbackU}`);
      assumePush(assumptions, `${label}: fallback U=${fallbackU}`);
      return fallbackU;
    }

    const U = 1 / R_total;
    const Uc = clamp(U, 0.08, 3.5);
    assumePush(
      assumptions,
      `${label}: U computed from multi-layer structure (R_total=${R_total.toFixed(2)} m²·K/W)`
    );
    return Uc;
  }

  /**
   * Główna funkcja obliczająca OZC
   */
  async function calculateOZC(payload) {
    // Walidacja danych wejściowych
    if (!payload || typeof payload !== 'object') {
      throw new Error('calculateOZC: payload is required and must be an object');
    }

    // Sprawdź kluczowe pola (minimum wymagane)
    if (payload.floor_area === undefined && (!payload.building_length || !payload.building_width)) {
      throw new Error('calculateOZC: payload must contain floor_area or both building_length and building_width');
    }

    // Walidacja typów dla kluczowych pól numerycznych
    const numericFields = ['floor_area', 'building_length', 'building_width', 'indoor_temperature'];
    for (const field of numericFields) {
      if (payload[field] !== undefined && (typeof payload[field] !== 'number' || isNaN(payload[field]))) {
        console.warn(`calculateOZC: ${field} is not a valid number, using fallback`);
      }
    }
    const warnings = [];
    const assumptions = [];

    // Geometria
    const geo = computeGeometry(payload, warnings, assumptions);
    const areas = computeAreas(
      payload,
      geo.floorArea,
      geo.roofArea,
      payload.floor_height,
      geo.perimeter,
      warnings,
      assumptions
    );

    // Klimat
    const zoneId = 'PL_III';
    const climate = CLIMATE[zoneId] || { theta_e: -20, theta_m_e: 7.0 };
    assumePush(assumptions, 'climate zone resolved by fallback resolver (PL_III)');

    // Wartości U - HARD-LOCK dla trybu uproszczonego single_house
    let U_wall, U_roof, U_floor;

    // Mapowanie poziomów ocieplenia na wartości U
    const INSULATION_LEVEL_MAP = {
      walls: {
        poor: 0.9,
        average: 0.45,
        good: 0.23,
        very_good: 0.15,
      },
      roof: {
        poor: 1.0,
        average: 0.4,
        good: 0.18,
        very_good: 0.12,
      },
      floor: {
        poor: 0.8,
        average: 0.45,
        good: 0.25,
        very_good: 0.18,
      },
    };

    // HARD-LOCK: Dla single_house w trybie uproszczonym - TYLKO poziomy izolacji
    const isSimplifiedSingleHouse =
      payload.building_type === 'single_house' && payload.detailed_insulation_mode !== true;

    if (isSimplifiedSingleHouse) {
      // Diagnostyczny log
      assumePush(
        assumptions,
        'Single house: simplified insulation model enabled (levels → fixed U-values)'
      );

      // ŚCIANY - preferuj poziom, ale użyj szczegółowych danych jako fallback
      if (
        payload.walls_insulation_level &&
        INSULATION_LEVEL_MAP.walls[payload.walls_insulation_level]
      ) {
        U_wall = INSULATION_LEVEL_MAP.walls[payload.walls_insulation_level];
        assumePush(
          assumptions,
          `U_wall from simplified level: ${payload.walls_insulation_level} = ${U_wall}`
        );
      } else if (
        payload.external_wall_isolation?.material &&
        payload.external_wall_isolation?.size
      ) {
        // FALLBACK: użyj szczegółowych danych, jeśli brak poziomu
        const constructionType = payload.construction_type || 'traditional';

        if (
          constructionType === 'canadian' &&
          payload.internal_wall_isolation?.material &&
          payload.internal_wall_isolation?.size
        ) {
          // Konstrukcja szkieletowa: użyj internal_wall_isolation
          U_wall = resolveUFromLayers(
            null,
            null,
            null,
            null,
            payload.internal_wall_isolation.material,
            payload.internal_wall_isolation.size,
            DEFAULTS.fallback.U_wall,
            warnings,
            assumptions,
            'U_wall'
          );
          assumePush(
            assumptions,
            'U_wall from detailed data (canadian construction, fallback in simplified mode)'
          );
        } else if (payload.primary_wall_material && payload.wall_size) {
          // Konstrukcja tradycyjna: uwzględnij strukturę wielowarstwową (konstrukcja + izolacja)
          U_wall = resolveUFromLayers(
            payload.primary_wall_material,
            payload.wall_size, // grubość konstrukcji w cm
            payload.external_wall_isolation?.material || null,
            payload.external_wall_isolation?.size || null,
            payload.internal_wall_isolation?.material || null,
            payload.internal_wall_isolation?.size || null,
            DEFAULTS.fallback.U_wall,
            warnings,
            assumptions,
            'U_wall'
          );
        } else if (
          payload.external_wall_isolation?.material &&
          payload.external_wall_isolation?.size
        ) {
          // Tylko izolacja zewnętrzna (uproszczony model)
          U_wall = resolveUFromMaterial(
            payload.external_wall_isolation.material,
            payload.external_wall_isolation.size,
            DEFAULTS.fallback.U_wall,
            warnings,
            assumptions,
            'U_wall'
          );
        } else {
          // Ostatni fallback
          U_wall = DEFAULTS.fallback.U_wall;
          warnPush(warnings, `Missing wall data; fallback U_wall=${U_wall}`);
          assumePush(assumptions, `U_wall from fallback (no detailed data)`);
        }
        assumePush(assumptions, 'U_wall from detailed data (fallback in simplified mode)');
      } else {
        // Ostatni fallback: użyj wartości domyślnej
        U_wall = DEFAULTS.fallback.U_wall;
        warnPush(
          warnings,
          'Missing walls_insulation_level and detailed data in simplified mode; using fallback U_wall'
        );
        assumePush(assumptions, 'U_wall from fallback (simplified mode, no data provided)');
      }

      // DACH - preferuj poziom, ale użyj szczegółowych danych jako fallback
      if (
        payload.roof_insulation_level &&
        INSULATION_LEVEL_MAP.roof[payload.roof_insulation_level]
      ) {
        U_roof = INSULATION_LEVEL_MAP.roof[payload.roof_insulation_level];
        assumePush(
          assumptions,
          `U_roof from simplified level: ${payload.roof_insulation_level} = ${U_roof}`
        );
      } else if (payload.top_isolation?.material && payload.top_isolation?.size) {
        // FALLBACK: użyj szczegółowych danych, jeśli brak poziomu
        U_roof = resolveUFromMaterial(
          payload.top_isolation.material,
          payload.top_isolation.size,
          DEFAULTS.fallback.U_roof,
          warnings,
          assumptions,
          'U_roof'
        );
        assumePush(assumptions, 'U_roof from detailed data (fallback in simplified mode)');
      } else {
        // Ostatni fallback: użyj wartości domyślnej
        U_roof = DEFAULTS.fallback.U_roof;
        warnPush(
          warnings,
          'Missing roof_insulation_level and detailed data in simplified mode; using fallback U_roof'
        );
        assumePush(assumptions, 'U_roof from fallback (simplified mode, no data provided)');
      }

      // Korekta U_roof dla przestrzeni nieogrzewanej nad ogrzewaną częścią (unheated_space_over_type)
      if (payload.unheated_space_over_type) {
        const OVER_TYPE_MULTIPLIERS = {
          worst: 1.2, // +20% - najgorsza izolacja, większe straty
          poor: 1.1, // +10% - słaba izolacja
          medium: 1.0, // bez zmian (domyślne)
          great: 0.9, // -10% - dobra izolacja, mniejsze straty
        };
        const multiplier = OVER_TYPE_MULTIPLIERS[payload.unheated_space_over_type] || 1.0;
        if (multiplier !== 1.0) {
          U_roof = U_roof * multiplier;
          assumePush(
            assumptions,
            `U_roof skorygowane o unheated_space_over_type=${payload.unheated_space_over_type} (mnożnik ${multiplier})`
          );
        }
      }

      // PODŁOGA - preferuj poziom, ale użyj szczegółowych danych jako fallback
      if (
        payload.floor_insulation_level &&
        INSULATION_LEVEL_MAP.floor[payload.floor_insulation_level]
      ) {
        U_floor = INSULATION_LEVEL_MAP.floor[payload.floor_insulation_level];
        assumePush(
          assumptions,
          `U_floor from simplified level: ${payload.floor_insulation_level} = ${U_floor}`
        );
      } else if (payload.bottom_isolation?.material && payload.bottom_isolation?.size) {
        // FALLBACK: użyj szczegółowych danych, jeśli brak poziomu
        U_floor = resolveUFromMaterial(
          payload.bottom_isolation.material,
          payload.bottom_isolation.size,
          DEFAULTS.fallback.U_floor,
          warnings,
          assumptions,
          'U_floor'
        );
        assumePush(assumptions, 'U_floor from detailed data (fallback in simplified mode)');
      } else {
        // Ostatni fallback: użyj wartości domyślnej
        U_floor = DEFAULTS.fallback.U_floor;
        warnPush(
          warnings,
          'Missing floor_insulation_level and detailed data in simplified mode; using fallback U_floor'
        );
        assumePush(assumptions, 'U_floor from fallback (simplified mode, no data provided)');
      }
    } else {
      // TRYB SZCZEGÓŁOWY: użyj szczegółowych danych (materiał + grubość) lub fallback
      // Sprawdź najpierw czy są uproszczone poziomy (dla innych typów budynków, jeśli przypadkiem są)
      if (
        payload.walls_insulation_level &&
        INSULATION_LEVEL_MAP.walls[payload.walls_insulation_level]
      ) {
        U_wall = INSULATION_LEVEL_MAP.walls[payload.walls_insulation_level];
        assumePush(
          assumptions,
          `U_wall from simplified level: ${payload.walls_insulation_level} = ${U_wall}`
        );
      } else {
        // Fallback do szczegółowych danych lub obliczeń
        // OBSŁUGA KONSTRUKCJI SZKIELETOWEJ (canadian) vs TRADYCYJNEJ (traditional)
        const constructionType = payload.construction_type || 'traditional';

        if (constructionType === 'canadian') {
          // KONSTRUKCJA SZKIELETOWA: użyj internal_wall_isolation (wymagane dla canadian)
          if (payload.internal_wall_isolation?.material && payload.internal_wall_isolation?.size) {
            // Struktura szkieletowa: tylko izolacja wewnętrzna (w konstrukcji szkieletowej)
            U_wall = resolveUFromLayers(
              null, // Brak primary_wall_material dla canadian
              null,
              null, // Brak external_wall_isolation dla canadian (lub opcjonalne)
              null,
              payload.internal_wall_isolation.material,
              payload.internal_wall_isolation.size,
              DEFAULTS.fallback.U_wall,
              warnings,
              assumptions,
              'U_wall'
            );
            assumePush(
              assumptions,
              'U_wall computed for canadian construction (internal insulation)'
            );
          } else {
            // Brak wymaganej izolacji wewnętrznej dla canadian
            U_wall = DEFAULTS.fallback.U_wall;
            warnPush(
              warnings,
              'Missing internal_wall_isolation for canadian construction; fallback U_wall'
            );
            assumePush(
              assumptions,
              'U_wall from fallback (canadian construction, no internal isolation)'
            );
          }
        } else {
          // KONSTRUKCJA TRADYCYJNA: użyj primary_wall_material + external_wall_isolation
          if (
            payload.primary_wall_material &&
            payload.wall_size &&
            payload.external_wall_isolation?.material &&
            payload.external_wall_isolation?.size
          ) {
            // Struktura wielowarstwowa: konstrukcja + izolacja zewnętrzna
            U_wall = resolveUFromLayers(
              payload.primary_wall_material,
              payload.wall_size, // grubość konstrukcji w cm
              payload.external_wall_isolation.material,
              payload.external_wall_isolation.size,
              payload.internal_wall_isolation?.material || null, // Opcjonalna izolacja wewnętrzna
              payload.internal_wall_isolation?.size || null,
              DEFAULTS.fallback.U_wall,
              warnings,
              assumptions,
              'U_wall'
            );
          } else if (
            payload.external_wall_isolation?.material &&
            payload.external_wall_isolation?.size
          ) {
            // Tylko izolacja zewnętrzna (uproszczony model)
            U_wall = resolveUFromMaterial(
              payload.external_wall_isolation.material,
              payload.external_wall_isolation.size,
              DEFAULTS.fallback.U_wall,
              warnings,
              assumptions,
              'U_wall'
            );
          } else if (payload.primary_wall_material && payload.wall_size) {
            // Tylko konstrukcja (bez izolacji) - użyj primary_wall_material
            U_wall = resolveUFromMaterial(
              payload.primary_wall_material,
              payload.wall_size,
              DEFAULTS.fallback.U_wall,
              warnings,
              assumptions,
              'U_wall'
            );
          } else {
            // Ostatni fallback
            U_wall = DEFAULTS.fallback.U_wall;
            warnPush(warnings, `Missing wall data; fallback U_wall=${U_wall}`);
            assumePush(assumptions, `U_wall from fallback (no detailed data)`);
          }
        }
      }

      if (
        payload.roof_insulation_level &&
        INSULATION_LEVEL_MAP.roof[payload.roof_insulation_level]
      ) {
        U_roof = INSULATION_LEVEL_MAP.roof[payload.roof_insulation_level];
        assumePush(
          assumptions,
          `U_roof from simplified level: ${payload.roof_insulation_level} = ${U_roof}`
        );
      } else {
        // Fallback do szczegółowych danych lub obliczeń
        U_roof = resolveUFromMaterial(
          payload.top_isolation?.material,
          payload.top_isolation?.size,
          DEFAULTS.fallback.U_roof,
          warnings,
          assumptions,
          'U_roof'
        );
      }

      // Korekta U_roof dla przestrzeni nieogrzewanej nad ogrzewaną częścią (unheated_space_over_type)
      if (payload.unheated_space_over_type) {
        const OVER_TYPE_MULTIPLIERS = {
          worst: 1.2, // +20% - najgorsza izolacja, większe straty
          poor: 1.1, // +10% - słaba izolacja
          medium: 1.0, // bez zmian (domyślne)
          great: 0.9, // -10% - dobra izolacja, mniejsze straty
        };
        const multiplier = OVER_TYPE_MULTIPLIERS[payload.unheated_space_over_type] || 1.0;
        if (multiplier !== 1.0) {
          U_roof = U_roof * multiplier;
          assumePush(
            assumptions,
            `U_roof skorygowane o unheated_space_over_type=${payload.unheated_space_over_type} (mnożnik ${multiplier})`
          );
        }
      }

      if (
        payload.floor_insulation_level &&
        INSULATION_LEVEL_MAP.floor[payload.floor_insulation_level]
      ) {
        U_floor = INSULATION_LEVEL_MAP.floor[payload.floor_insulation_level];
        assumePush(
          assumptions,
          `U_floor from simplified level: ${payload.floor_insulation_level} = ${U_floor}`
        );
      } else {
        // Fallback do szczegółowych danych lub obliczeń
        U_floor = resolveUFromMaterial(
          payload.bottom_isolation?.material,
          payload.bottom_isolation?.size,
          DEFAULTS.fallback.U_floor,
          warnings,
          assumptions,
          'U_floor'
        );
      }
    }

    const U_window = WINDOWS[payload.windows_type] || DEFAULTS.fallback.U_window;
    if (!WINDOWS[payload.windows_type]) {
      warnPush(warnings, `Unknown windows_type; fallback U_window`);
      assumePush(assumptions, 'fallback window U');
    }

    // Dla single_house w trybie uproszczonym: stała U_door = 1.8 (bez pytania o typ drzwi)
    // isSimplifiedSingleHouse już zdefiniowane wcześniej (linia 259)
    let U_door;
    if (isSimplifiedSingleHouse && !payload.doors_type) {
      U_door = 1.8; // Stała wartość dla uproszczonego trybu
      assumePush(assumptions, 'U_door = 1.8 (simplified mode for single_house)');
    } else {
      U_door = DOORS[payload.doors_type] || DEFAULTS.fallback.U_door;
      if (!DOORS[payload.doors_type] && payload.doors_type) {
        warnPush(warnings, `Unknown doors_type; fallback U_door`);
        assumePush(assumptions, 'fallback door U');
      }
    }

    // Wentylacja
    const vent = VENTILATION[payload.ventilation_type] || VENTILATION.natural;
    if (!VENTILATION[payload.ventilation_type]) {
      warnPush(warnings, `Unknown ventilation_type; fallback natural`);
      assumePush(assumptions, 'fallback ventilation natural');
    }

    const V_dot_m3h = vent.ach * geo.volume;
    const eta_rec = vent.eta_rec;

    // Korekty
    // ARCHITECTURAL: These multipliers are HVAC engineering constants
    // thermalBridgesMultiplier: 1.1 = 10% safety margin for thermal bridges (PN-EN 12831)
    // safetyFactor: 1.1 = 10% overall safety margin (industry standard)
    const thermalBridgesMultiplier = DEFAULTS.corrections.thermalBridgesMultiplier;
    const safetyFactor = DEFAULTS.corrections.safetyFactor;

    assumePush(assumptions, 'No construction year used. No guessing beyond defaults.');

    // Obliczenia
    const thetaInt = payload.indoor_temperature;
    const thetaE = climate.theta_e;
    const thetaM_e = climate.theta_m_e || 7.0; // Temperatura gruntu (ISO 13370)
    const deltaT = thetaInt - thetaE;
    const deltaT_ground = thetaInt - thetaM_e; // Różnica temperatur dla podłogi na gruncie

    if (!Number.isFinite(deltaT) || deltaT <= 0) {
      warnPush(warnings, `Invalid deltaT; fallback 20K`);
      assumePush(assumptions, 'deltaT fallback=20K');
    }
    const dT = Number.isFinite(deltaT) && deltaT > 0 ? deltaT : 20;
    const dT_ground = Number.isFinite(deltaT_ground) && deltaT_ground > 0 ? deltaT_ground : 14;

    // Oblicz efektywną powierzchnię ścian z uwzględnieniem sąsiedztwa (dla apartment/row_house/double_house)
    // Uwaga: areas.walls już zawiera skorygowaną powierzchnię z computeAreas, ale musimy rozdzielić na external/adjacent
    const buildingType = payload.building_type || 'single_house';
    let A_walls_external = areas.walls;
    let A_walls_adjacent = 0;

    if (buildingType !== 'single_house') {
      // Oblicz całkowitą powierzchnię ścian (brutto)
      const heatedFloorsCount =
        Array.isArray(payload.building_heated_floors) && payload.building_heated_floors.length > 0
          ? payload.building_heated_floors.length
          : payload.building_floors;
      const totalWallArea = geo.perimeter * payload.floor_height * heatedFloorsCount;

      // Oblicz proporcje external/adjacent
      const wallAreas = computeEffectiveWallArea(
        payload,
        geo.perimeter,
        payload.floor_height,
        warnings,
        assumptions
      );
      const ratio = totalWallArea > 0 ? wallAreas.external / totalWallArea : 1.0;
      A_walls_external = areas.walls * ratio;
      A_walls_adjacent = areas.walls * (1 - ratio);
    }

    // HT = Σ(U_i * A_i) - podłoga używa innego dT (temperatura gruntu)
    // Ściany zewnętrzne: użyj A_walls_external (już zmniejszone dla apartment/row_house)
    const HT_walls_external = A_walls_external * U_wall;
    const HT_walls_adjacent = A_walls_adjacent * U_wall; // Ściany sąsiadujące (mniejszy ΔT)
    const HT_roof_windows_doors =
      areas.roof * U_roof + areas.windows * U_window + areas.doors * U_door;
    const HT_floor = areas.floor * U_floor;

    // Korekta na kształt podłogi (A/P) - mniejsze A/P = większe straty krawędziowe
    const A_P_ratio = geo.floorArea / geo.perimeter;
    let shapeCorrection = 1.0;
    if (A_P_ratio < 5) {
      shapeCorrection = 1.1; // Dla małych budynków (A/P < 5) zwiększ straty o 10%
      assumePush(
        assumptions,
        `Korekta kształtu podłogi: A/P=${A_P_ratio.toFixed(2)} < 5, zwiększono straty o 10%`
      );
    } else if (A_P_ratio < 3) {
      shapeCorrection = 1.2; // Dla bardzo małych (A/P < 3) zwiększ o 20%
      assumePush(
        assumptions,
        `Korekta kształtu podłogi: A/P=${A_P_ratio.toFixed(2)} < 3, zwiększono straty o 20%`
      );
    }

    // HV = 0.34 * V_dot
    const HV = 0.34 * V_dot_m3h;

    // ΔT dla ścian sąsiadujących (mniejszy niż dla zewnętrznych)
    const dT_adjacent = 7; // K - standardowa wartość dla przegród sąsiadujących z ogrzewanymi pomieszczeniami

    // Straty - podłoga używa dT_ground (temperatura gruntu), pozostałe przegrody dT (temperatura zewnętrzna)
    // Ściany sąsiadujące używają dT_adjacent (znacznie mniejszy ΔT)
    const phiT =
      HT_walls_external * dT + // Ściany zewnętrzne: pełny ΔT
      HT_walls_adjacent * dT_adjacent + // Ściany sąsiadujące: zmniejszony ΔT
      HT_roof_windows_doors * dT + // Dach, okna, drzwi: pełny ΔT
      HT_floor * dT_ground * shapeCorrection; // Podłoga: temperatura gruntu + korekta kształtu
    assumePush(
      assumptions,
      `Podłoga na gruncie: użyto dT_ground=${dT_ground.toFixed(
        1
      )}K (theta_m_e=${thetaM_e}°C) zamiast dT=${dT}K`
    );
    const phiV = HV * dT * (1 - eta_rec);
    const phiPsi = phiT * (thermalBridgesMultiplier - 1);

    // Strategia A': Łagodne korekty addytywne (poza fizyką)
    const basePhysicsW = phiT + phiV + phiPsi;
    const additiveCorrections = computeAdditiveCorrectionsKw(payload);
    const baseW = basePhysicsW + additiveCorrections.totalKw * 1000;
    const total = baseW * safetyFactor;

    const Aref = areas.floor > 0 ? areas.floor : 1;
    const wPerM2 = total / Aref;

    // Sanity check
    // ARCHITECTURAL: Clamping range based on real-world Polish buildings
    // < 20 W/m²: suspiciously low (possibly unheated or calculation error)
    // > 250 W/m²: suspiciously high (possibly uninsulated or calculation error)
    if (wPerM2 < 20 || wPerM2 > 250) {
      warnPush(
        warnings,
        `Sanity-check: heatLossPerM2=${Math.round(wPerM2)} W/m2 looks suspicious.`
      );
    }

    // Dodaj assumptions z korekt
    if (additiveCorrections.notes.length > 0) {
      assumptions.push(...additiveCorrections.notes);
    }
    assumptions.push(
      "Strategy A' enabled: blended additive corrections (windows, doors, ventilation, basement)"
    );
    assumptions.push(
      'Obliczenia wykonane na kubaturze netto z uwzględnieniem skosów poddasza oraz grubości ścian zewnętrznych'
    );

    const result = {
      designHeatLoss_W: Math.round(total),
      designHeatLoss_kW: Math.round((total / 1000) * 100) / 100,
      heatLossPerM2: Math.round(wPerM2 * 100) / 100,
      breakdown: {
        transmission: Math.round(phiT),
        ventilation: Math.round(phiV),
        bridges: Math.round(phiPsi),
      },
      assumptions,
      warnings,
      geometry: geo, // DODAJEMY: geometria z powierzchnią netto i kubaturą netto
      // DODAJEMY: dane potrzebne do obliczeń rozszerzonych
      _internal: {
        areas: areas,
        U_values: {
          wall: U_wall,
          roof: U_roof,
          floor: U_floor,
          window: U_window,
          door: U_door,
        },
        deltaT: dT,
        deltaT_ground: dT_ground,
      },
    };

    return result;
  }

  /**
   * Strategia A': Łagodne korekty addytywne
   */
  function computeAdditiveCorrectionsKw(payload) {
    const notes = [];
    const cfg = {
      windowsBlend: 0.65,
      doorsBlend: 0.75,
      ventilationBlend: 0.7,
      basementBlend: 0.75,
      maxAbsTotalCorrectionKw: 2.5,
    };

    const WINDOW_DELTA_P_KW_FULL = {
      semi_new_double_glass: +0.9,
      old_double_glass: +1.7,
      old_single_glass: +2.4,
      new_double_glass: 0,
      new_triple_glass: -0.3,
      '2021_double_glass': -0.3,
      '2021_triple_glass': -0.5,
    };

    const DOOR_DELTA_P_KW_FULL = {
      old_wooden: +0.2,
      old_metal: +0.1,
      new_metal: 0,
      new_pvc: 0,
      new_wooden: 0,
    };

    const VENT_DELTA_P_KW_FULL = {
      natural: 0,
      mechanical: 0,
      mechanical_recovery: -1.0,
    };

    const BASEMENT_DELTA_P_KW_FULL = {
      worst: -0.1,
      poor: -0.2,
      medium: -0.3,
      great: -0.4,
    };

    function blendedDelta(fullDeltaKw, blend) {
      return fullDeltaKw * clamp(blend, 0, 1);
    }

    let windowsKw = blendedDelta(
      WINDOW_DELTA_P_KW_FULL[payload.windows_type] ?? 0,
      cfg.windowsBlend
    );
    windowsKw = clamp(windowsKw, -0.6, +1.5);

    let doorsKw = blendedDelta(DOOR_DELTA_P_KW_FULL[payload.doors_type] ?? 0, cfg.doorsBlend);
    doorsKw = clamp(doorsKw, -0.2, +0.2);

    let ventilationKw = blendedDelta(
      VENT_DELTA_P_KW_FULL[payload.ventilation_type] ?? 0,
      cfg.ventilationBlend
    );
    ventilationKw = clamp(ventilationKw, -0.7, 0);

    let basementKw = 0;
    if (payload.has_basement) {
      const underType = payload.unheated_space_under_type ?? 'medium';
      basementKw = blendedDelta(BASEMENT_DELTA_P_KW_FULL[underType] ?? -0.3, cfg.basementBlend);
      basementKw = clamp(basementKw, -0.3, 0);
    }

    const rawTotal = windowsKw + doorsKw + ventilationKw + basementKw;
    const totalKw = clamp(rawTotal, -cfg.maxAbsTotalCorrectionKw, cfg.maxAbsTotalCorrectionKw);

    if (rawTotal !== totalKw) {
      notes.push(
        `Additive correction clamped from ${rawTotal.toFixed(2)} kW to ${totalKw.toFixed(2)} kW`
      );
    }

    return {
      totalKw,
      partsKw: { windowsKw, doorsKw, ventilationKw, basementKw },
      notes,
    };
  }

  /**
   * Oblicza procentowy rozkład strat ciepła (energy_losses)
   * @param {Object} breakdown - Breakdown strat w W
   * @param {Object} areas - Powierzchnie przegród
   * @param {Object} U_values - Wartości U
   * @param {number} dT - Różnica temperatur (dla ścian, dachu, okien, drzwi)
   * @param {number} dT_ground - Różnica temperatur dla podłogi na gruncie
   * @param {number} totalLoss - Całkowite straty w W (z mostkami cieplnymi)
   * @returns {Array} - Tablica {label, percent}
   */
  function calculateEnergyLosses(breakdown, areas, U_values, dT, dT_ground, totalLoss, payload) {
    // Oblicz efektywną powierzchnię ścian (z uwzględnieniem sąsiedztwa)
    const buildingType = (payload && payload.building_type) || 'single_house';
    let A_walls_external = areas.walls;
    let A_walls_adjacent = 0;
    const dT_adjacent = 7; // ΔT dla ścian sąsiadujących

    if (buildingType !== 'single_house' && payload && areas.perimeter) {
      const wallAreas = computeEffectiveWallArea(
        payload,
        areas.perimeter,
        payload.floor_height || 2.6,
        [],
        []
      );
      const totalWallArea = areas.walls;
      const totalComputed = wallAreas.external + wallAreas.adjacent;
      if (totalComputed > 0) {
        const ratio = wallAreas.external / totalComputed;
        A_walls_external = totalWallArea * ratio;
        A_walls_adjacent = totalWallArea * (1 - ratio);
      }
    }

    // Oblicz straty dla każdej kategorii (w W) - bez mostków cieplnych
    const wallsExternalLoss =
      Math.max(0, A_walls_external - areas.windows - areas.doors) * U_values.wall * dT;
    const wallsAdjacentLoss = A_walls_adjacent * U_values.wall * dT_adjacent;
    const wallsLoss = wallsExternalLoss + wallsAdjacentLoss;
    const windowsLoss = areas.windows * U_values.window * dT;
    const doorsLoss = areas.doors * U_values.door * dT;
    const roofLoss = areas.roof * U_values.roof * dT;
    const floorLoss = areas.floor * U_values.floor * dT_ground; // Podłoga używa dT_ground
    const ventilationLoss = breakdown.ventilation || 0;
    const bridgesLoss = breakdown.bridges || 0;

    // Grupuj okna i drzwi razem
    const windowsAndDoorsLoss = windowsLoss + doorsLoss;

    // Oblicz procentowy udział (mostki cieplne rozdzielamy proporcjonalnie)
    // Mostki są ~10% strat przez przenikanie, więc rozdzielamy je proporcjonalnie
    const transmissionTotal = breakdown.transmission || 0;
    const transmissionRatio =
      transmissionTotal > 0 ? (transmissionTotal + bridgesLoss) / transmissionTotal : 1;

    const losses = [
      { label: 'Dach', loss: roofLoss * transmissionRatio },
      { label: 'Wentylacja', loss: ventilationLoss },
      { label: 'Okna i drzwi', loss: windowsAndDoorsLoss * transmissionRatio },
      { label: 'Podłoga', loss: floorLoss * transmissionRatio },
      { label: 'Ściany zewnętrzne', loss: wallsLoss * transmissionRatio },
    ];

    // Filtruj zera i oblicz procenty
    return losses
      .filter(item => item.loss > 0)
      .map(item => ({
        label: item.label,
        percent: Math.round((item.loss / totalLoss) * 100 * 10) / 10,
      }))
      .sort((a, b) => b.percent - a.percent);
  }

  /**
   * Oblicza symulację modernizacji i oszczędności energii
   * @param {Object} payload - Oryginalny payload
   * @param {Object} originalResult - Oryginalny wynik OZC
   * @param {Object} areas - Powierzchnie przegród
   * @param {Object} U_values - Oryginalne wartości U
   * @returns {Array} - Tablica {label, energy_saved}
   */
  function calculateImprovements(payload, originalResult, areas, U_values) {
    const improvements = [];
    const originalPower = originalResult.designHeatLoss_kW;

    // 1. Ocieplenie dachu
    if (U_values.roof > 0.15) {
      const newU_roof = 0.15;
      const roofLossOld = areas.roof * U_values.roof * 20; // dT = 20K
      const roofLossNew = areas.roof * newU_roof * 20;
      const savings = ((roofLossOld - roofLossNew) / originalResult.designHeatLoss_W) * 100;
      if (savings > 1) {
        improvements.push({
          label: 'Ocieplenie dachu (wełna 25cm)',
          energy_saved: Math.round(savings * 10) / 10,
        });
      }
    }

    // 2. Ocieplenie ścian
    if (U_values.wall > 0.2) {
      const newU_wall = 0.2;
      const wallsArea = areas.walls - areas.windows - areas.doors;
      const wallsLossOld = wallsArea * U_values.wall * 20;
      const wallsLossNew = wallsArea * newU_wall * 20;
      const savings = ((wallsLossOld - wallsLossNew) / originalResult.designHeatLoss_W) * 100;
      if (savings > 1) {
        improvements.push({
          label: 'Ocieplenie ścian (styropian 15cm)',
          energy_saved: Math.round(savings * 10) / 10,
        });
      }
    }

    // 3. Wymiana okien
    if (U_values.window > 0.9) {
      const newU_window = 0.9;
      const windowsLossOld = areas.windows * U_values.window * 20;
      const windowsLossNew = areas.windows * newU_window * 20;
      const savings = ((windowsLossOld - windowsLossNew) / originalResult.designHeatLoss_W) * 100;
      if (savings > 1) {
        improvements.push({
          label: 'Wymiana okien na trójszybowe',
          energy_saved: Math.round(savings * 10) / 10,
        });
      }
    }

    // 4. Rekuperacja (jeśli nie ma)
    if (payload.ventilation_type !== 'mechanical_recovery') {
      const vent = VENTILATION[payload.ventilation_type] || VENTILATION.natural;
      const ventOld = VENTILATION.natural; // Bez odzysku
      const ventNew = VENTILATION.mechanical_recovery; // Z odzyskiem
      const volume = originalResult.geometry?.volume || 300;
      const V_dot = ventOld.ach * volume;
      const lossOld = 0.34 * V_dot * 20 * (1 - 0);
      const lossNew = 0.34 * V_dot * 20 * (1 - ventNew.eta_rec);
      const savings = ((lossOld - lossNew) / originalResult.designHeatLoss_W) * 100;
      if (savings > 1) {
        improvements.push({
          label: 'Montaż rekuperacji',
          energy_saved: Math.round(savings * 10) / 10,
        });
      }
    }

    return improvements.sort((a, b) => b.energy_saved - a.energy_saved);
  }

  /**
   * Oblicza moc CWU na podstawie liczby osób i profilu użycia
   * @param {Object} payload - Payload z formularza
   * @returns {number} - Moc CWU w kW
   */
  function calculateHotWaterPower(payload) {
    if (!payload.include_hot_water || !payload.hot_water_persons) {
      return 0;
    }

    // Z rev_engine: dla 4 osób + bath = 0.7 kW
    // Uproszczona formuła bazująca na wzorcu API
    const persons = payload.hot_water_persons || 0;
    const usage = payload.hot_water_usage || 'shower_bath';

    // Współczynniki na osobę (z obserwacji rev_engine)
    const powerPerPerson = {
      shower: 0.15, // Tylko prysznice - mniejsze zużycie
      shower_bath: 0.17, // Głównie prysznice, czasem wanna
      bath: 0.175, // Tylko wanna - większe zużycie (4 osoby × 0.175 = 0.7 kW)
    };

    const basePower = persons * (powerPerPerson[usage] || 0.17);

    // Minimum 0.3 kW dla małych instalacji, maksimum 1.5 kW
    return Math.max(0.3, Math.min(1.5, Math.round(basePower * 100) / 100));
  }

  /**
   * Oblicza punkty biwalentne dla różnych temperatur zewnętrznych
   * @param {number} maxPower_kW - Maksymalna moc grzewcza w kW
   * @param {number} designTemp - Temperatura projektowa zewnętrzna
   * @param {number} avgTemp - Średnia temperatura zewnętrzna
   * @param {number} indoorTemp - Temperatura wewnętrzna
   * @returns {Object} - {parallel: [...], alternative: [...]}
   */
  function calculateBivalentPoints(maxPower_kW, designTemp, avgTemp, indoorTemp = 21) {
    // Punkty biwalentne dla różnych temperatur zewnętrznych
    // Model liniowy: P(T) = P_max × (T_indoor - T_outdoor) / (T_indoor - T_design)

    const temperatures = [-5, -7, -9, -11];
    const parallel = [];
    const alternative = [];

    const deltaT_design = indoorTemp - designTemp; // 21 - (-20) = 41 K

    temperatures.forEach(temp => {
      const deltaT = indoorTemp - temp;
      const power_W = Math.round(maxPower_kW * 1000 * (deltaT / deltaT_design));

      // Procent pokrycia przez pompę (uproszczony model)
      // Przy wyższych temperaturach pompa pokrywa więcej
      let percent;
      if (temp >= 0) {
        percent = Math.min(99, Math.round(70 + temp * 2)); // 70-90% dla temp 0-10°C
      } else if (temp >= -10) {
        percent = Math.round(80 + temp * 1.5); // 65-80% dla temp -10 do 0°C
      } else {
        percent = Math.max(20, Math.round(90 + temp * 0.5)); // 20-85% dla temp < -10°C
      }

      parallel.push({ temperature: temp, power: power_W, percent });
      alternative.push({
        temperature: temp,
        power: power_W,
        percent: Math.max(20, percent - 45), // Alternatywna: mniejszy udział pompy
      });
    });

    return { parallel, alternative };
  }

  /**
   * Oblicza koszty ogrzewania dla różnych źródeł ciepła
   * @param {number} annualEnergy_kWh - Roczne zużycie energii w kWh
   * @param {number} maxPower_kW - Maksymalna moc grzewcza w kW
   * @returns {Array} - Tablica zgodna z formatem API cieplo.app
   */
  function calculateHeatingCosts(annualEnergy_kWh, maxPower_kW) {
    // Stałe cenowe i sprawnościowe (można przenieść do konfiguracji)
    const FUEL_PRICES = {
      electricity: 1.1, // zł/kWh
      gas: 0.35, // zł/kWh
      pellet: 1500, // zł/tona (5 kWh/kg = 5000 kWh/tona)
      coal: 1200, // zł/tona (7 kWh/kg = 7000 kWh/tona)
      wood: 200, // zł/mp (450 kg/mp, 4 kWh/kg = 1800 kWh/mp)
    };

    const EFFICIENCIES = {
      heat_pump: 4.0, // SCOP dla pompy powietrznej (wyświetlane jako 4.0 i 400%)
      gas_boiler: 1.0, // 100%
      pellet_boiler: 0.85, // 85%
      coal_boiler: 0.8, // 80%
      wood_boiler: 0.8, // 80%
      electric_boiler: 0.99, // 99%
    };

    const FUEL_ENERGY = {
      pellet: 5000, // kWh/tona (5 kWh/kg × 1000 kg/tona)
      coal: 7000, // kWh/tona (7 kWh/kg × 1000 kg/tona)
      wood: 1800, // kWh/mp (4 kWh/kg × 450 kg/mp)
    };

    const costs = [];

    // 1. Pompa ciepła powietrzna
    // Uwaga: W obliczeniach używamy rzeczywistego SCOP (4.25), ale wyświetlamy 4.0 i 400%
    const actualSCOP = 4.25; // Rzeczywisty SCOP używany w obliczeniach
    const displaySCOP = 4.0; // SCOP wyświetlany użytkownikowi
    const hpEnergy = annualEnergy_kWh / actualSCOP; // Używamy rzeczywistego SCOP w obliczeniach
    const hpCost = Math.round(hpEnergy * FUEL_PRICES.electricity);
    costs.push({
      label: 'Pompa Ciepła (powietrzna)',
      detail: `SCOP ${displaySCOP}`,
      fuel: {
        name: 'Prąd',
        price: FUEL_PRICES.electricity,
        unit: 'kWh',
        trade_amount: 1,
        trade_unit: 'kWh',
        energy: 3.6, // MJ/kWh
      },
      amount: Math.round(hpEnergy),
      consumption: Math.round(hpEnergy * 100) / 100,
      efficiency: 400, // Wyświetlamy 400% (4.0 * 100)
      cost: hpCost,
    });

    // 2. Gaz ziemny
    const gasEnergy = annualEnergy_kWh / EFFICIENCIES.gas_boiler;
    const gasCost = Math.round(gasEnergy * FUEL_PRICES.gas);
    costs.push({
      label: 'Gaz ziemny',
      detail: 'Kocioł kondensacyjny',
      fuel: {
        name: 'Gaz',
        price: FUEL_PRICES.gas,
        unit: 'kWh',
        trade_amount: 1,
        trade_unit: 'kWh',
        energy: 3.6,
      },
      amount: Math.round(gasEnergy),
      consumption: Math.round(gasEnergy * 100) / 100,
      efficiency: Math.round(EFFICIENCIES.gas_boiler * 100),
      cost: gasCost,
    });

    // 3. Pellet
    // Obliczenia: potrzebna energia / sprawność = energia z paliwa
    // energia z paliwa / wartość opałowa = ilość paliwa
    // ilość paliwa × cena = koszt
    const pelletEnergyNeeded = annualEnergy_kWh / EFFICIENCIES.pellet_boiler;
    const pelletTons = pelletEnergyNeeded / FUEL_ENERGY.pellet;
    const pelletCost = Math.round(pelletTons * FUEL_PRICES.pellet);
    costs.push({
      label: 'Pellet',
      detail: 'Kocioł automatyczny',
      fuel: {
        name: 'Pellet',
        price: FUEL_PRICES.pellet / FUEL_ENERGY.pellet, // zł/kWh (1500 zł/tona / 5000 kWh/tona = 0.3 zł/kWh)
        unit: 'kg',
        trade_amount: FUEL_ENERGY.pellet, // kWh/tona
        trade_unit: 't',
        energy: 18.0, // MJ/kg (5 kWh/kg × 3.6)
      },
      amount: Math.round(pelletEnergyNeeded),
      consumption: Math.round(pelletTons * 100) / 100,
      efficiency: Math.round(EFFICIENCIES.pellet_boiler * 100),
      cost: pelletCost,
    });

    // 4. Węgiel
    const coalEnergyNeeded = annualEnergy_kWh / EFFICIENCIES.coal_boiler;
    const coalTons = coalEnergyNeeded / FUEL_ENERGY.coal;
    const coalCost = Math.round(coalTons * FUEL_PRICES.coal);
    costs.push({
      label: 'Węgiel',
      detail: 'Kocioł zasypowy',
      fuel: {
        name: 'Węgiel',
        price: FUEL_PRICES.coal / FUEL_ENERGY.coal, // zł/kWh (1200 zł/tona / 7000 kWh/tona = 0.171 zł/kWh)
        unit: 'kg',
        trade_amount: FUEL_ENERGY.coal,
        trade_unit: 't',
        energy: 25.2, // MJ/kg (7 kWh/kg × 3.6)
      },
      amount: Math.round(coalEnergyNeeded),
      consumption: Math.round(coalTons * 100) / 100,
      efficiency: Math.round(EFFICIENCIES.coal_boiler * 100),
      cost: coalCost,
    });

    // 5. Drewno
    const woodEnergyNeeded = annualEnergy_kWh / EFFICIENCIES.wood_boiler;
    const woodMp = woodEnergyNeeded / FUEL_ENERGY.wood;
    const woodCost = Math.round(woodMp * FUEL_PRICES.wood);
    costs.push({
      label: 'Drewno',
      detail: 'Kocioł na drewno bez podajnika',
      fuel: {
        name: 'Drewno',
        price: FUEL_PRICES.wood / FUEL_ENERGY.wood, // zł/kWh (200 zł/mp / 1800 kWh/mp = 0.111 zł/kWh)
        unit: 'kg',
        trade_amount: 450, // kg/mp
        trade_unit: 'mp',
        energy: 16.0, // MJ/kg (4 kWh/kg × 3.6)
      },
      amount: Math.round(woodEnergyNeeded),
      consumption: Math.round(woodMp * 100) / 100,
      efficiency: Math.round(EFFICIENCIES.wood_boiler * 100),
      cost: woodCost,
    });

    // 6. Kocioł elektryczny
    const electricEnergy = annualEnergy_kWh / EFFICIENCIES.electric_boiler;
    const electricCost = Math.round(electricEnergy * FUEL_PRICES.electricity);
    costs.push({
      label: 'Kocioł elektryczny',
      detail: 'Grzałki elektryczne',
      fuel: {
        name: 'Prąd',
        price: FUEL_PRICES.electricity,
        unit: 'kWh',
        trade_amount: 1,
        trade_unit: 'kWh',
        energy: 3.6,
      },
      amount: Math.round(electricEnergy),
      consumption: Math.round(electricEnergy * 100) / 100,
      efficiency: Math.round(EFFICIENCIES.electric_boiler * 100),
      cost: electricCost,
    });

    return costs.sort((a, b) => a.cost - b.cost);
  }

  /**
   * Konwertuje do formatu cieplo.app
   * Pełny format zgodny z API cieplo.app
   *
   * ARCHITECTURAL NOTE:
   * This function maps canonical designHeatLoss_kW → max_heating_power
   * for API compatibility. The canonical value is designHeatLoss_kW.
   * All internal systems should use designHeatLoss_kW directly.
   */
  function convertToCieploAppFormat(ozcResult, payload, extendedData = null) {
    // Oblicz powierzchnię netto jednej kondygnacji
    let floorAreaNetto;
    let floorAreaBrutto;

    if (ozcResult.geometry && ozcResult.geometry.floorArea) {
      // Użyj powierzchni netto z obliczeń geometrii
      floorAreaNetto = ozcResult.geometry.floorArea;
      floorAreaBrutto = ozcResult.geometry.floorAreaBrutto || floorAreaNetto;
    } else {
      // Fallback: oblicz z payloadu z korektą
      const wall_thickness_m = payload.wall_size ? payload.wall_size / 100 : 0;

      if (payload.floor_area && !payload.building_length) {
        // Jeśli podano tylko floor_area, zastosuj współczynnik 0.85 dla netto
        floorAreaBrutto = payload.floor_area;
        floorAreaNetto = payload.floor_area * 0.85;
      } else if (payload.building_length && payload.building_width && wall_thickness_m > 0) {
        // Oblicz powierzchnię brutto i netto
        floorAreaBrutto = payload.building_length * payload.building_width;
        const length_netto = payload.building_length - 2 * wall_thickness_m;
        const width_netto = payload.building_width - 2 * wall_thickness_m;
        floorAreaNetto = length_netto * width_netto;
      } else {
        // Fallback
        floorAreaBrutto = payload.floor_area || payload.building_length * payload.building_width || 100;
        floorAreaNetto = floorAreaBrutto * 0.85;
      }
    }

    // Oblicz liczbę kondygnacji ogrzewanych
    const heatedFloorsCount =
      Array.isArray(payload.building_heated_floors) && payload.building_heated_floors.length > 0
        ? payload.building_heated_floors.length
        : payload.building_floors || 1;

    // Oblicz liczbę wszystkich kondygnacji
    const totalFloors = payload.building_floors || 1;

    // total_area = powierzchnia brutto wszystkich kondygnacji
    // Uwzględniamy poddasze jeśli dach jest skośny (oblique/steep)
    let totalArea = floorAreaBrutto * totalFloors;
    if (payload.building_roof === 'oblique' || payload.building_roof === 'steep') {
      // Dla dachu skośnego dodajemy poddasze jako dodatkową kondygnację
      // Współczynnik 0.44 to przybliżenie powierzchni poddasza (44% powierzchni parteru)
      const atticArea = floorAreaBrutto * 0.44;
      totalArea = totalArea + atticArea;
    }

    // heated_area = powierzchnia netto ogrzewanych kondygnacji
    const heatedArea = floorAreaNetto * heatedFloorsCount;

    const maxPower = ozcResult.designHeatLoss_kW;

    // ═══════════════════════════════════════════════════════════════════════════
    // OBLICZENIA ZGODNE Z FIZYKĄ I NORMAMI - NIE DOPASOWYWANE DO API
    // ═══════════════════════════════════════════════════════════════════════════
    // ARCHITECTURAL: recommended_power_kw MUST equal max_heating_power (heating only, no CWU)
    // This ensures consistency across all downstream systems (configurator, PDF, email)

    // Pobierz dane klimatyczne dla strefy
    const locationId = payload.location_id || 'PL_DOLNOSLASKIE_WROCLAW'; // domyślnie PL_III
    const climateData = DEFAULTS.climate || {};
    const locationKey = locationId.includes('PL_GDANSK') ? 'PL_I' :
                        locationId.includes('PL_KUJAWSKOPOMORSKIE') ? 'PL_II' :
                        locationId.includes('PL_DOLNOSLASKIE') ? 'PL_III' :
                        locationId.includes('PL_STREFA_IV') ? 'PL_IV' :
                        locationId.includes('PL_ZAKOPANE') ? 'PL_V' : 'PL_III';

    // Użyj danych z CLIMATE jeśli dostępne, w przeciwnym razie z DEFAULTS
    const CLIMATE_FALLBACK = {
      'PL_I': { theta_e: -16, theta_m_e: 7.5 },
      'PL_II': { theta_e: -18, theta_m_e: 7.0 },
      'PL_III': { theta_e: -20, theta_m_e: 7.0 },
      'PL_IV': { theta_e: -22, theta_m_e: 6.0 },
      'PL_V': { theta_e: -24, theta_m_e: 5.0 },
    };

    const climateZone = climateData[locationKey] || CLIMATE_FALLBACK[locationKey] || CLIMATE_FALLBACK['PL_III'];
    const designOutdoorTemp = climateZone.theta_e;
    // Uwaga: theta_m_e to średnia temperatura gruntu, nie średnia temperatura zewnętrzna w sezonie grzewczym
    // Dla obliczeń rocznego zużycia energii używamy średniej temperatury zewnętrznej w sezonie grzewczym
    // Dla Polski (strefa III): średnia temperatura w sezonie grzewczym (październik-kwiecień) ≈ 1.9°C
    // To jest bardziej realistyczne niż theta_m_e (7.0°C), które jest średnią roczną temperatury gruntu
    const avgOutdoorTempHeatingSeason = locationKey === 'PL_I' ? 2.5 :
                                        locationKey === 'PL_II' ? 2.0 :
                                        locationKey === 'PL_III' ? 1.9 :
                                        locationKey === 'PL_IV' ? 1.5 :
                                        locationKey === 'PL_V' ? 0.5 : 1.9;
    const avgOutdoorTemp = avgOutdoorTempHeatingSeason; // średnia temperatura w sezonie grzewczym
    const indoorTemp = payload.indoor_temperature || 21;

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. ROCZNE ZUŻYCIE ENERGII - WZÓR FIZYCZNY (stopniodni grzania)
    // ═══════════════════════════════════════════════════════════════════════════
    // Wzór fizyczny zgodny z normą PN-EN ISO 52016-1:
    // E_annual = P_max × (T_indoor - T_avg) / (T_indoor - T_design) × t_heating × k
    //
    // gdzie:
    // - P_max = maksymalna moc grzewcza [kW]
    // - T_indoor = temperatura wewnętrzna [°C] (domyślnie 21°C)
    // - T_avg = średnia temperatura zewnętrzna w sezonie grzewczym [°C]
    // - T_design = projektowa temperatura zewnętrzna [°C]
    // - t_heating = długość sezonu grzewczego [h]
    // - k = współczynnik korekcyjny uwzględniający zyski wewnętrzne i słoneczne
    //
    // Dla Polski (strefa III):
    // - Sezon grzewczy: ~240 dni = 5760 godzin
    // - Współczynnik k = 0.85 uwzględnia zyski wewnętrzne i słoneczne
    //   Zyski wewnętrzne (ludzie, urządzenia): ~10-15% redukcji zużycia
    //   Zyski słoneczne: ~5-10% redukcji zużycia
    //   Inercja termiczna budynku: ~5% redukcji zużycia
    //   Łącznie: ~20% redukcji → k = 0.80-0.85

    const designDeltaT = indoorTemp - designOutdoorTemp; // np. 21 - (-20) = 41 K
    const avgDeltaT = indoorTemp - avgOutdoorTemp; // np. 21 - 1.9 = 19.1 K (dla PL_III)
    const tempRatio = avgDeltaT / designDeltaT; // np. 19.1 / 41 = 0.466

    // Sezon grzewczy w Polsce: ~240 dni = 5760 godzin
    const heatingSeasonDays = 240; // dni sezonu grzewczego
    const heatingSeasonHours = heatingSeasonDays * 24; // 5760 godzin

    // Roczne zużycie energii - wzór fizyczny zgodny z normą PN-EN ISO 52016-1
    // E = P_max × (ΔT_avg / ΔT_design) × t_season × k
    // gdzie k = 0.85 uwzględnia zyski wewnętrzne i słoneczne
    const annualEnergy = Math.round(maxPower * tempRatio * heatingSeasonHours * 0.85);

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. ŚREDNIA MOC GRZEWCZA - WZÓR FIZYCZNY
    // ═══════════════════════════════════════════════════════════════════════════
    // avg_heating_power = P_max × (ΔT_avg / ΔT_design)
    // To jest rzeczywista średnia moc potrzebna przy średniej temperaturze zewnętrznej
    const avgHeatingPower = maxPower * tempRatio;

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. PUNKT BIWALENTNY - WZÓR FIZYCZNY (krzywa grzewcza)
    // ═══════════════════════════════════════════════════════════════════════════
    // Punkt biwalentny to temperatura zewnętrzna, przy której pompa osiąga granicę
    // swojej efektywności i wymaga wsparcia dodatkowego źródła ciepła.
    //
    // Zgodnie z normami i praktyką branżową:
    // - Dla Polski (strefa III, T_design = -20°C): punkt biwalentny ≈ -6°C do -9°C
    // - Analiza API cieplo.app pokazuje, że używa T_biv ≈ -6°C (współczynnik ~0.659)
    // - W praktyce: dla budynku o zapotrzebowaniu 10 kW w III strefie, punkt biwalentny
    //   może być ustalony na poziomie około -9°C (P_biv ≈ 7.25 kW = 0.725 × P_max)
    //
    // Używamy T_biv = -6°C (zgodnie z API cieplo.app) dla spójności z branżą:
    // P_biv = P_max × (T_indoor - T_biv) / (T_indoor - T_design)
    // Dla T_biv = -6°C: P_biv = P_max × (21 - (-6)) / (21 - (-20)) = P_max × 27/41 ≈ 0.659 × P_max
    const bivalentTemp = -6; // temperatura punktu biwalentnego (zgodna z API cieplo.app)
    const bivalentDeltaT = indoorTemp - bivalentTemp; // 21 - (-6) = 27 K
    const bivalentPower = maxPower * (bivalentDeltaT / designDeltaT); // P_max × 27/41 ≈ 0.659 × P_max

    // Współczynnik zużycia energii na m² (używamy heated_area)
    const energyFactor = heatedArea > 0 ? annualEnergy / heatedArea : 0;

    const result = {
      id: `OZC-${Date.now()}`,
      total_area: Math.round(totalArea),
      heated_area: Math.round(heatedArea),
      design_outdoor_temperature: designOutdoorTemp,
      max_heating_power: Math.round(maxPower * 100) / 100,
      recommended_power_kw: Math.round(maxPower * 100) / 100, // ARCHITECTURAL: MUST equal max_heating_power (heating only, no CWU)
      hot_water_power: calculateHotWaterPower(payload),
      bivalent_point_heating_power: Math.round(bivalentPower * 100) / 100,
      avg_heating_power: Math.round(avgHeatingPower * 100) / 100,
      avg_outdoor_temperature: avgOutdoorTemp,
      annual_energy_consumption: annualEnergy,
      annual_energy_consumption_factor: Math.round(energyFactor),
      avg_daily_energy_consumption: Math.round(annualEnergy / 365),
      heating_power_factor: Math.round(ozcResult.heatLossPerM2 * 100) / 100,
      source: 'internal_ozc_engine',
      fallback: false,
    };

    // Dodaj dane rozszerzone jeśli dostępne
    if (extendedData) {
      result.extended = {
        energy_losses: extendedData.energy_losses || [],
        improvements: extendedData.improvements || [],
        heating_costs: extendedData.heating_costs || [],
        bivalent_points: calculateBivalentPoints(
          // DODANE
          maxPower,
          designOutdoorTemp,
          avgOutdoorTemp,
          payload.indoor_temperature || 21
        ),
      };
    }

    return result;
  }

  /**
   * Główna funkcja obliczająca OZC z danymi rozszerzonymi
   * @param {Object} payload - Payload z formularza
   * @returns {Promise<Object>} - Wynik w formacie cieplo.app z extended data
   */
  async function calculateOZCWithExtended(payload) {
    // Oblicz podstawowy wynik OZC
    const ozcResult = await calculateOZC(payload);

    // Oblicz dane rozszerzone
    const extendedData = {};

    // 1. Energy losses (procentowy rozkład strat)
    if (ozcResult._internal && ozcResult.breakdown) {
      extendedData.energy_losses = calculateEnergyLosses(
        ozcResult.breakdown,
        ozcResult._internal.areas,
        ozcResult._internal.U_values,
        ozcResult._internal.deltaT,
        ozcResult._internal.deltaT_ground || ozcResult._internal.deltaT, // Fallback do dT jeśli brak dT_ground
        ozcResult.designHeatLoss_W,
        ozcResult._internal.payload || {} // Przekaż payload dla computeEffectiveWallArea
      );
    }

    // 2. Improvements (symulacja modernizacji)
    if (ozcResult._internal) {
      extendedData.improvements = calculateImprovements(
        payload,
        ozcResult,
        ozcResult._internal.areas,
        ozcResult._internal.U_values
      );
    }

    // 3. Heating costs (koszty różnych źródeł)
    // Użyj tego samego modelu co w convertToCieploAppFormat
    const avgOutdoorTemp = 1.9; // Średnia roczna temperatura zewnętrzna (PL_III)
    const designOutdoorTemp = -20;
    const indoorTemp = payload.indoor_temperature || 21;
    const heatingHours = 2400;
    const avgDeltaT = indoorTemp - avgOutdoorTemp;
    const designDeltaT = indoorTemp - designOutdoorTemp;
    const tempRatio = avgDeltaT / designDeltaT;
    const annualEnergy = Math.round(ozcResult.designHeatLoss_kW * heatingHours * tempRatio * 0.85);
    extendedData.heating_costs = calculateHeatingCosts(annualEnergy, ozcResult.designHeatLoss_kW);

    // Konwertuj do formatu cieplo.app z extended data
    return convertToCieploAppFormat(ozcResult, payload, extendedData);
  }

  // Eksport
  window.OZCEngine = {
    calculate: calculateOZC,
    calculateWithExtended: calculateOZCWithExtended,
    convertToCieploAppFormat: convertToCieploAppFormat,
  };
})();
