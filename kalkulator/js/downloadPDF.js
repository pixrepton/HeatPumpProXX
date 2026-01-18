//* downloadPDF.js/

function getElementValue(id) {
  const el = hpById(id);
  return el ? el.textContent.trim() : '';
}

function bindOnce(element, event, handler, key) {
  if (!element) return () => {};
  const k = key || `hpBound__${event}`;
  if (element.dataset && element.dataset[k] === '1') return () => {};
  if (element.dataset) element.dataset[k] = '1';
  element.addEventListener(event, handler);
  return () => {
    try {
      element.removeEventListener(event, handler);
    } catch (e) {}
    try {
      if (element.dataset) delete element.dataset[k];
    } catch (e) {}
  };
}

/**
 * ✅ KONSOLIDACJA: Wykorzystuje formEngine.readFieldValue zamiast duplikacji kodu
 * Dodatkowa logika: sprawdza widoczność i filtruje puste wartości dla PDF
 */
function getFormValue(name) {
  // Użyj uniwersalnej funkcji z formEngine
  if (window.formEngine && typeof window.formEngine.readFieldValue === 'function') {
    const value = window.formEngine.readFieldValue(name);

    // Dodatkowa walidacja dla PDF - pomiń puste wartości
    if (value === '' || value === null || value === undefined) return null;
    if (Array.isArray(value) && value.length === 0) return null;
    if (value === 'no') return null; // Pomiń wartości "no" dla pól yes/no

    return value;
  }

  // Fallback - jeśli formEngine nie jest dostępny
  console.warn('[downloadPDF] formEngine.readFieldValue nie jest dostępny - używam fallback');
  const form = hpById('heatCalcFormFull');
  if (!form) return null;
  const el = form.querySelector(`[name="${name}"]`);
  if (!el) return null;

  const style = window.getComputedStyle(el);
  const isVisible = !(style.display === 'none' || style.visibility === 'hidden');
  const isInVisibleContainer = el.offsetParent !== null;

  if (!isVisible || !isInVisibleContainer) return null;

  if (el.type === 'checkbox') return el.checked ? true : null;
  if (el.type === 'radio') {
    const checked = form.querySelector(`[name="${name}"]:checked`);
    return checked ? checked.value : null;
  }

  const value = el.value?.trim();
  return value === '' ? null : value;
}

// OPTIMIZATION: Lazy load PDF libraries on-demand (dynamic import)
// Helper – ładuje biblioteki PDF dynamicznie tylko gdy potrzebne
async function loadPdfLibraries() {
  // Sprawdź czy już załadowane
  if (typeof html2pdf !== 'undefined' && typeof jsPDF !== 'undefined') {
    return Promise.resolve();
  }

  try {
    // OPTIMIZATION: Dynamic import zamiast synchronicznego ładowania
    const librariesUrl = window.HEATPUMP_CONFIG?.librariesUrl || '../libraries';

    // Ładuj biblioteki równolegle
    await Promise.all([
      new Promise((resolve, reject) => {
        if (typeof html2pdf !== 'undefined') {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = `${librariesUrl}/html2pdf.bundle.min.js`;
        script.async = true;
        script.onload = () => {
          // Poczekaj aż html2pdf będzie dostępne
          const check = setInterval(() => {
            if (typeof html2pdf !== 'undefined') {
              clearInterval(check);
              resolve();
            }
          }, 50);
          setTimeout(() => {
            clearInterval(check);
            if (typeof html2pdf === 'undefined') {
              reject(new Error('html2pdf nie załadowane'));
            }
          }, 5000);
        };
        script.onerror = () => reject(new Error('Błąd ładowania html2pdf'));
        document.head.appendChild(script);
      }),
      new Promise((resolve, reject) => {
        if (typeof html2canvas !== 'undefined') {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = `${librariesUrl}/html2canvas.min.js`;
        script.async = true;
        script.onload = () => {
          const check = setInterval(() => {
            if (typeof html2canvas !== 'undefined') {
              clearInterval(check);
              resolve();
            }
          }, 50);
          setTimeout(() => {
            clearInterval(check);
            if (typeof html2canvas === 'undefined') {
              reject(new Error('html2canvas nie załadowane'));
            }
          }, 5000);
        };
        script.onerror = () => reject(new Error('Błąd ładowania html2canvas'));
        document.head.appendChild(script);
      }),
      new Promise((resolve, reject) => {
        if (typeof jsPDF !== 'undefined') {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = `${librariesUrl}/jspdf.umd.min.js`;
        script.async = true;
        script.onload = () => {
          const check = setInterval(() => {
            if (typeof jsPDF !== 'undefined') {
              clearInterval(check);
              resolve();
            }
          }, 50);
          setTimeout(() => {
            clearInterval(check);
            if (typeof jsPDF === 'undefined') {
              reject(new Error('jsPDF nie załadowane'));
            }
          }, 5000);
        };
        script.onerror = () => reject(new Error('Błąd ładowania jsPDF'));
        document.head.appendChild(script);
      })
    ]);

  } catch (error) {
    console.error('❌ Błąd ładowania bibliotek PDF:', error);
    throw new Error('Nie udało się załadować bibliotek PDF. Sprawdź połączenie internetowe.');
  }
}

// ======================
// 🔥 Główna funkcja
// ======================

async function downloadPDF(ctx = {}) {
  try {
    const root = ctx.root || (ctx.dom && ctx.dom.root) || window.__HP_ACTIVE_ROOT__ || null;
    const dom =
      ctx.dom ||
      (root && typeof window.createScopedDom === 'function' ? window.createScopedDom(root) : null);
    const configuratorApi = ctx.state?.configuratorApi || null;

    if (!root || !dom) {
      console.error('[PDF] Brak kontekstu root/dom');
      return;
    }

    if (typeof window.__HP_SET_ACTIVE_ROOT__ === 'function') {
      window.__HP_SET_ACTIVE_ROOT__(root);
    }

    // OPTIMIZATION: Lazy load PDF libraries on-demand
    await loadPdfLibraries();

    // ═══════════════════════════════════════════════════════════════════════════
    // UPEWNIJ SIĘ, ŻE DANE Z KONFIGURATORA SĄ ZAKTUALIZOWANE
    // ═══════════════════════════════════════════════════════════════════════════
    if (configuratorApi && typeof configuratorApi.recompute === 'function') {
      configuratorApi.recompute();
    } else if (typeof window.configuratorRecompute === 'function') {
      window.configuratorRecompute();
    }

    if (typeof generateOfferPDF === 'undefined') {
      throw new Error('Brak funkcji generateOfferPDF — sprawdź czy pdfGenerator.js jest załadowany.');
    }

    // =============================================
    // 1️⃣ PROFIL ENERGETYCZNY
    // =============================================
    const profileItems = Array.from(hpQsa('.energy-profile-section .result-item'));
    const energyProfileRows = profileItems.map(el => {
      let label = el.querySelector('span')?.textContent.trim() || '';
      const value = el.querySelector('strong')?.textContent.trim() || '';
      // Skróty w etykietach profilu energetycznego
      label = label.replace(/Powierzchnia/g, 'Pow.').replace(/Temperatura/g, 'Temp.').replace(/maksymalna/gi, 'maks.');
      return label && value ? { label, value } : null;
    }).filter(Boolean);

    // =============================================
    // 2️⃣ POMPY CIEPŁA
    // =============================================
    // Pobierz moc z wyników obliczeń (canonical source)
    const appState =
      (ctx.state && typeof ctx.state.getAppState === 'function' && ctx.state.getAppState()) ||
      (typeof window.getAppState === 'function' ? window.getAppState() : null);
    const lastResult = appState?.lastCalculationResult || window.lastCalculationResult || null;

    const recommendedPowerKw =
      lastResult?.recommended_power_kw || lastResult?.max_heating_power || null;

    const pumpTitle = hpById('pump-power-title')?.textContent.trim() || null;
    const pumps = Array.from(hpQsa('#pump-recommendation-zone .heat-pump-card')).map(el => ({
      title: el.querySelector('.pump-model-name')?.textContent.trim() || '',
      type: el.querySelector('.pump-specs')?.innerText.trim().split('\n')[1]?.replace('Typ: ', '').trim() || '',
      kit: el.querySelector('.pump-specs')?.innerText.trim().split('\n')[0]?.replace('Model: ', '').trim() || '',
      power_kw: el.querySelector('.pump-specs')?.innerText.match(/Moc:\s*([\d.]+)/)?.[1] || ''
    }));

    // =============================================
    // 3️⃣ STRATY CIEPŁA
    // =============================================
    const energyLosses = Array.from(hpQsa('#energy-losses-container .loss-item')).map(el => ({
      name: el.querySelector('.loss-label')?.textContent.trim() || '',
      percent: parseFloat(el.querySelector('.loss-percent')?.textContent.replace('%', '').trim() || '0')
    })).filter(l => l.name);

    // =============================================
    // 4️⃣ MODERNIZACJE
    // =============================================
    const improvements = Array.from(hpQsa('#improvements-container .improvement-item')).map(el => ({
      title: el.querySelector('.improvement-label')?.textContent.trim() || '',
      saving: parseFloat(el.querySelector('.improvement-savings strong')?.textContent.replace('%', '').trim() || '0')
    })).filter(i => i.title);

    // =============================================
    // 5️⃣ KOSZTY OGRZEWANIA
    // =============================================
    const costs = Array.from(hpQsa('#heating-costs-container .cost-row')).map(el => ({
      variant: el.querySelector('.cost-label')?.textContent.trim() || '',
      efficiency: el.querySelector('.cost-efficiency')?.textContent.trim().replace('%', '') || '',
      annual_cost_pln: parseFloat(el.querySelector('.cost-amount')?.textContent.replace(/[^\d,.-]/g, '').replace(',', '.') || '0')
    })).filter(c => c.variant);

    // =============================================
    // 6️⃣ PUNKTY BIWALENTNE
    // =============================================
    const bivalent_points = Array.from(hpQsa('#bivalent-points-container .bivalent-point-card')).map(el => ({
      temp: parseFloat(el.querySelector('.bp-temp')?.textContent.replace('°C', '').trim() || '0'),
      power_kw: parseFloat(el.querySelector('.bp-power')?.textContent.replace('kW', '').trim() || '0')
    })).filter(b => !isNaN(b.temp));

    // =============================================
    // 7️⃣ DANE Z FORMULARZA (Informacje o budynku)
    // Używamy buildJsonData() - tej samej funkcji co dla API cieplo.app
    // =============================================

    if (typeof window.buildJsonData !== 'function') {
      throw new Error('Brak funkcji buildJsonData — sprawdź czy formDataProcessor.js jest załadowany.');
    }

    const apiData = window.buildJsonData();

    // Mapowania wartości na polskie nazwy (jak w formularzu)
    const buildingTypeMap = {
      'single_house': 'Dom jednorodzinny',
      'double_house': 'Bliźniak',
      'row_house': 'Szeregowiec',
      'apartment': 'Mieszkanie',
      'multifamily': 'Budynek wielorodzinny'
    };

    const windowsMap = {
      '2021_triple_glass': 'Trójszybowe 2021+',
      '2021_double_glass': 'Nowoczesne (2021+), dwuszybowe',
      'new_triple_glass': 'Trójszybowe',
      'new_double_glass': 'Dwuszybowe nowe',
      'semi_new_double_glass': 'Dwuszybowe',
      'old_double_glass': 'Dwuszybowe stare',
      'old_single_glass': 'Jednoszybowe'
    };

    // Przekształć dane z API na format dla PDF (tylko te pola, które są w apiData)
    const buildingInfo = {
      building_type: apiData.building_type ? buildingTypeMap[apiData.building_type] || apiData.building_type : '',
      construction_year: apiData.construction_year ? String(apiData.construction_year) : '',
      construction_type: apiData.construction_type === 'traditional' ? 'Tradycyjna' : (apiData.construction_type === 'canadian' ? 'Szkieletowy' : ''),
      building_length: apiData.building_length ? String(apiData.building_length) : '',
      building_width: apiData.building_width ? String(apiData.building_width) : '',
      floor_area: apiData.floor_area ? String(apiData.floor_area) : '',
      floor_perimeter: apiData.floor_perimeter ? String(apiData.floor_perimeter) : '',
      building_floors: apiData.building_floors ? String(apiData.building_floors) : '',
      floor_height: apiData.floor_height ? String(apiData.floor_height) : '',
      building_roof: apiData.building_roof || '',
      has_basement: apiData.has_basement !== undefined ? (apiData.has_basement ? 'Tak' : 'Nie') : '',
      has_balcony: apiData.has_balcony !== undefined ? (apiData.has_balcony ? 'Tak' : 'Nie') : '',
      has_garage: apiData.has_garage !== undefined ? (apiData.has_garage ? 'Tak' : 'Nie') : '',
      garage_type: apiData.garage_type || '',
      wall_size: apiData.wall_size ? String(apiData.wall_size) : '',
      external_wall_isolation_size: apiData.external_wall_isolation?.size ? String(apiData.external_wall_isolation.size) : '',
      external_wall_isolation_material: apiData.external_wall_isolation?.material ? String(apiData.external_wall_isolation.material) : '',
      top_isolation_material: apiData.top_isolation?.material ? String(apiData.top_isolation.material) : '',
      top_isolation_size: apiData.top_isolation?.size ? String(apiData.top_isolation.size) : '',
      bottom_isolation_material: apiData.bottom_isolation?.material ? String(apiData.bottom_isolation.material) : '',
      bottom_isolation_size: apiData.bottom_isolation?.size ? String(apiData.bottom_isolation.size) : '',
      internal_wall_isolation_material: apiData.internal_wall_isolation?.material ? String(apiData.internal_wall_isolation.material) : '',
      internal_wall_isolation_size: apiData.internal_wall_isolation?.size ? String(apiData.internal_wall_isolation.size) : '',
      primary_wall_material: apiData.primary_wall_material ? String(apiData.primary_wall_material) : '',
      secondary_wall_material: apiData.secondary_wall_material ? String(apiData.secondary_wall_material) : '',
      doors_type: apiData.doors_type || '',
      number_doors: apiData.number_doors ? String(apiData.number_doors) : '',
      windows: apiData.windows_type ? (windowsMap[apiData.windows_type] || apiData.windows_type) : '',
      number_windows: apiData.number_windows ? String(apiData.number_windows) : '',
      indoor_temperature: apiData.indoor_temperature ? String(apiData.indoor_temperature) : '',
      ventilation_type: apiData.ventilation_type || '',
      include_hot_water: apiData.include_hot_water !== undefined ? (apiData.include_hot_water ? 'Tak' : 'Nie') : '',
      hot_water_persons: apiData.hot_water_persons ? String(apiData.hot_water_persons) : '',
      hot_water_usage: apiData.hot_water_usage || '',
      on_corner: apiData.on_corner !== undefined ? (apiData.on_corner ? 'Tak' : 'Nie') : '',
      whats_over: apiData.whats_over || '',
      whats_under: apiData.whats_under || '',
      whats_north: apiData.whats_north || '',
      whats_south: apiData.whats_south || '',
      whats_east: apiData.whats_east || '',
      whats_west: apiData.whats_west || '',
    };

    // =============================================
    // 8️⃣ DANE Z KONFIGURATORA MASZYNOWNI
    // =============================================
    const configuratorData =
      (configuratorApi && typeof configuratorApi.getSelection === 'function'
        ? configuratorApi.getSelection()
        : null) ||
      appState?.configuratorSelection ||
      lastResult?.configurator ||
      window.configuratorSelection ||
      null;
    const machineRoomItems = configuratorData?.pricing?.items || [];
    const machineRoomTotal = configuratorData?.pricing?.total_netto_pln || 0;
    const machineRoomTotalBrutto = configuratorData?.pricing?.total_brutto_pln || 0;

    // =============================================
    // 9️⃣ KONSTRUKCJA OBIEKTU DLA PDF
    // =============================================
    const configData = {
      energy_profile_rows: energyProfileRows,
      recommended_power_kw: recommendedPowerKw || (pumpTitle ? parseFloat(pumpTitle.match(/([\d.]+)/)?.[1] || '0') : null),
      recommended_models: pumps,
      energy_losses: energyLosses,
      improvements: improvements,
      costs_comparison: costs,
      bivalent_points: bivalent_points,
      ...buildingInfo,
      models_intro: 'Wybrane modele gwarantują stabilną, cichą i ekonomiczną pracę przez cały sezon grzewczy.',
      models_outro: 'Zestaw obejmuje pełny pakiet komponentów dopasowanych do Twojego budynku.',
      // Dane maszynowni
      machine_room: {
        items: machineRoomItems,
        total_netto_pln: machineRoomTotal,
        total_brutto_pln: machineRoomTotalBrutto,
        selections: configuratorData?.selections || {},
        products: configuratorData?.products || {},
        recommendations: configuratorData?.recommendations || {},
      },
    };

    // ⚠️ FIX P0.3: Walidacja minimalna przed PDF (bez danych po obliczeniach nie generujemy PDF)
    if (!configData || !configData.recommended_power_kw) {
      const errorMsg = 'Brak danych do wygenerowania PDF. Wypełnij formularz i wykonaj obliczenia.';
      console.error('[PDF]', errorMsg);
      if (typeof ErrorHandler !== 'undefined' && ErrorHandler.showToast) {
        ErrorHandler.showToast(errorMsg, 'error', 5000);
      } else {
        alert(errorMsg);
      }
      return;
    }

    // ⚠️ FIX P0.3: Ostrzeżenie jeśli brak danych maszynowni (ale nie blokujemy PDF)
    if (!configData.machine_room || !configData.machine_room.items || configData.machine_room.items.length === 0) {
      if (window.__HP_DEBUG__) {
        console.warn('[PDF] PDF będzie generowany bez danych maszynowni (konfigurator nie został wypełniony)');
      }
    }

    // =============================================
    // 9️⃣ Wygeneruj PDF
    // =============================================
    await generateOfferPDF(configData);

  } catch (err) {
    console.error('❌ Błąd podczas generowania PDF:', err);
    ErrorHandler.showToast('Nie udało się wygenerować raportu PDF: ' + err.message, 'error', 5000);
  }
}

// ======================
// Obsługa przycisku
// ======================

function setupPDFButtonListener(ctx) {
  if (!ctx || !ctx.dom || !ctx.root) {
    console.warn('[PDF] Brak kontekstu root/dom dla bindów PDF');
    return () => {};
  }
  const root = ctx.root;
  const dom = ctx.dom;
  const state = ctx.state;
  const buttons = dom.qsa('[data-action="download-pdf"]');

  if (!buttons.length) {
    console.warn('?? Nie znaleziono przycisk?w PDF');
    return () => {};
  }

  const disposers = [];

  buttons.forEach(btn => {
    const handler = e => {
      e.preventDefault();
      downloadPDF({ root, dom, state });
    };
    disposers.push(bindOnce(btn, 'click', handler, 'hpBoundDownloadPdf'));
  });

  return function disposePdfButtons() {
    disposers.forEach(fn => {
      try {
        fn();
      } catch (_) {}
    });
  };
}

// Eksport globalny

// Eksport globalny
window.downloadPDF = downloadPDF;
// OPTIMIZATION: Export loadPdfLibraries for use in other modules
window.loadPdfLibraries = loadPdfLibraries;

// Export init function for bootApp (no auto-init)
// Auto-init removed - must be called from bootApp
if (typeof window !== 'undefined') {
  window.__initDownloadPDF = function initDownloadPDF(ctx = {}) {
    const root = ctx.root || window.__HP_ACTIVE_ROOT__ || null;
    const dom =
      ctx.dom ||
      (root && typeof window.createScopedDom === 'function' ? window.createScopedDom(root) : null);
    if (!root || !dom) {
      console.warn('[PDF] Brak kontekstu root/dom dla inicjalizacji');
      return () => {};
    }
    const disposeButtons = setupPDFButtonListener({ root, dom, state: ctx.state });

    // Return disposer (minimal - listeners are on buttons that will be removed with DOM)
    return function disposeDownloadPDF() {
      if (typeof disposeButtons === 'function') {
        disposeButtons();
      }
    };
  };
}
// Keep waitForHtml2Pdf for backward compatibility (deprecated)
window.waitForHtml2Pdf = function() {
  console.warn('waitForHtml2Pdf is deprecated, use loadPdfLibraries() instead');
  return loadPdfLibraries();
};
