// === FILE: dynamicFields.js ===
// 🧠 Obsługuje: Dynamiczne pokazywanie/ukrywanie pól w zależności od wyboru użytkownika

(function() {
    'use strict';

    /**
     * Funkcja pomocnicza do zarządzania widocznością elementów
     */
    function toggleDisplay(elem, condition) {
    if (elem) {
        elem.classList.toggle("hidden", !condition);
        elem.style.display = condition ? "block" : "none";
    }
}

/**
 * Główna funkcja inicjalizująca wszystkie dynamiczne pola
 * 
 * @param {HTMLElement} root - Root element instancji kalkulatora (dla WordPress multi-instance safety)
 */
function setupDynamicFields(root) {
    // ✅ FIX Problem #5: WordPress multi-instance safety
    // Jeśli root nie podany, użyj active root (fallback dla legacy code)
    if (!root) {
        root = document.querySelector('.heatpump-calculator');
        if (!root) {
            console.warn('[dynamicFields] No root provided and no .heatpump-calculator found');
            return;
        }
    }

    // Helper funkcje dla scoped DOM access (analogicznie do scopedDom.js)
    const hpQs = (selector) => root.querySelector(selector);
    const hpById = (id) => root.querySelector('#' + id);

    /**
     * Przełącza opcje CWU (ciepłej wody użytkowej)
     * (przeniesione do środka setupDynamicFields dla dostępu do root)
     */
    function toggleHotWaterOptions() {
        const hotWaterCheckbox = hpById("includeHotWater");
        const hotWaterOptions = hpById("hotWaterOptions");

        if (hotWaterCheckbox && hotWaterOptions) {
            toggleDisplay(hotWaterOptions, hotWaterCheckbox.checked);
        }
    }
    // === 1. KSZTAŁT BUDYNKU ===
    const buildingShapeSelect = hpById('buildingShape');
    const regularFields = hpById('regularFields');
    const irregularFields = hpById('irregularFields');

    if (buildingShapeSelect) {
        buildingShapeSelect.addEventListener('change', function() {
            if (this.value === 'regular') {
                toggleDisplay(regularFields, true);
                toggleDisplay(irregularFields, false);
            } else if (this.value === 'irregular') {
                toggleDisplay(regularFields, false);
                toggleDisplay(irregularFields, true);
            }
        });
    }

    // === 2. METODA WPROWADZANIA WYMIARÓW (dla regularnych) ===
    const regularMethodSelect = hpById('regularMethod');
    const dimensionsFields = hpById('dimensionsFields');
    const areaField = hpById('areaField');

    if (regularMethodSelect) {
        regularMethodSelect.addEventListener('change', function() {
            if (this.value === 'dimensions') {
                toggleDisplay(dimensionsFields, true);
                toggleDisplay(areaField, false);
            } else if (this.value === 'area') {
                toggleDisplay(dimensionsFields, false);
                toggleDisplay(areaField, true);
            }
        });
    }

    // === 3. BALKONY ===
    const hasBalconyCheckbox = hpQs('input[name="has_balcony"]');
    const balconyFields = hpById('balconyFields');

    if (hasBalconyCheckbox) {
        hasBalconyCheckbox.addEventListener('change', function() {
            toggleDisplay(balconyFields, this.checked);
        });
    }

    // === 4. GARAŻ ===
    const garageTypeSelect = hpQs('select[name="garage_type"]');
    const garageFields = hpById('garageFields');

    if (garageTypeSelect) {
        garageTypeSelect.addEventListener('change', function() {
            toggleDisplay(garageFields, this.value !== 'none');
        });
    }

    // === 4.5. KONSTRUKCJA KANADYJSKA ===
    const constructionTypeSelect = hpById('constructionType');
    const traditionalOptions = hpById('traditionalOptions');
    const canadianOptions = hpById('canadianOptions');

    if (constructionTypeSelect) {
        constructionTypeSelect.addEventListener('change', function() {
            if (this.value === 'traditional') {
                toggleDisplay(traditionalOptions, true);
                toggleDisplay(canadianOptions, false);
            } else if (this.value === 'canadian') {
                toggleDisplay(traditionalOptions, false);
                toggleDisplay(canadianOptions, true);
            }
        });
    }

    // === 4.6. IZOLACJA WEWNĘTRZNA (dla kanadyjskiej) ===
    const hasInternalIsolationCheckbox = hpById('hasInternalIsolation');
    const internalIsolationFields = hpById('internalIsolationFields');

    if (hasInternalIsolationCheckbox) {
        hasInternalIsolationCheckbox.addEventListener('change', function() {
            toggleDisplay(internalIsolationFields, this.checked);
        });
    }

    // === 5. MATERIAŁ DODATKOWY ŚCIAN ===
    const hasSecondaryWallCheckbox = hpById('hasSecondaryWallMaterial');
    const secondaryWallFields = hpById('secondaryWallFields');

    if (hasSecondaryWallCheckbox) {
        hasSecondaryWallCheckbox.addEventListener('change', function() {
            toggleDisplay(secondaryWallFields, this.checked);
        });
    }

    // === 6. IZOLACJA ZEWNĘTRZNA ===
    const hasExternalIsolationCheckbox = hpById('hasExternalIsolation');
    const externalIsolationFields = hpById('externalIsolationFields');

    if (hasExternalIsolationCheckbox) {
        hasExternalIsolationCheckbox.addEventListener('change', function() {
            toggleDisplay(externalIsolationFields, this.checked);
        });
    }

    // === 7. IZOLACJA DACHU ===
    const topIsolationSelect = hpById('hasTopIsolation');
    const topIsolationFields = hpById('topIsolationFields');

    if (topIsolationSelect) {
        topIsolationSelect.addEventListener('change', function() {
            toggleDisplay(topIsolationFields, this.value === 'yes');
        });
    }

    // === 8. IZOLACJA PODŁOGI ===
    const bottomIsolationSelect = hpById('hasBottomIsolation');
    const bottomIsolationFields = hpById('bottomIsolationFields');

    if (bottomIsolationSelect) {
        bottomIsolationSelect.addEventListener('change', function() {
            toggleDisplay(bottomIsolationFields, this.value === 'yes');
        });
    }

    // === 9. CIEPŁA WODA UŻYTKOWA ===
    const hotWaterCheckbox = hpById("includeHotWater");
    if (hotWaterCheckbox) {
        hotWaterCheckbox.addEventListener('change', toggleHotWaterOptions);
        // Inicjalizuj stan na starcie
        toggleHotWaterOptions();
    }

    // === 10. RENDEROWANIE PIĘTER BUDYNKU ===
    // Uwaga: Event listenery dla renderowania pięter są obsługiwane w floorRenderer.js
    // poprzez initFloorRenderingListeners() - nie duplikujemy logiki tutaj

    function triggerFloorRendering() {
        // Ta funkcja jest zachowana dla kompatybilności wstecznej
        if (typeof window.renderHeatedFloors === 'function') {
            setTimeout(() => {
                window.renderHeatedFloors();
            }, 100);
        } else {
            console.warn('Funkcja renderHeatedFloors nie jest zdefiniowana.');
        }
    }


    // === 10. INICJALIZACJA STANÓW DOMYŚLNYCH ===
    // Ustaw domyślne stany na podstawie aktualnych wartości

    // Kształt budynku
    if (buildingShapeSelect && regularFields && irregularFields) {
        if (buildingShapeSelect.value === 'regular') {
            toggleDisplay(regularFields, true);
            toggleDisplay(irregularFields, false);
        } else if (buildingShapeSelect.value === 'irregular') {
            toggleDisplay(regularFields, false);
            toggleDisplay(irregularFields, true);
        }
    }

    // Konstrukcja budynku
    if (constructionTypeSelect) {
        if (constructionTypeSelect.value === 'traditional') {
            toggleDisplay(traditionalOptions, true);
            toggleDisplay(canadianOptions, false);
        } else if (constructionTypeSelect.value === 'canadian') {
            toggleDisplay(traditionalOptions, false);
            toggleDisplay(canadianOptions, true);
        }
    }

    // Izolacja wewnętrzna
    if (hasInternalIsolationCheckbox) {
        toggleDisplay(internalIsolationFields, hasInternalIsolationCheckbox.checked);
    }

    // Metoda wymiarów dla regularnych
    if (regularMethodSelect && dimensionsFields && areaField) {
        if (regularMethodSelect.value === 'dimensions') {
            toggleDisplay(dimensionsFields, true);
            toggleDisplay(areaField, false);
        } else if (regularMethodSelect.value === 'area') {
            toggleDisplay(dimensionsFields, false);
            toggleDisplay(areaField, true);
        }
    }

    // Balkony
    if (hasBalconyCheckbox) {
        toggleDisplay(balconyFields, hasBalconyCheckbox.checked);
    }

    // Garaż
    if (garageTypeSelect) {
        toggleDisplay(garageFields, garageTypeSelect.value !== 'none');
    }

    // Materiał dodatkowy ścian
    if (hasSecondaryWallCheckbox) {
        toggleDisplay(secondaryWallFields, hasSecondaryWallCheckbox.checked);
    }

    // Izolacja zewnętrzna
    if (hasExternalIsolationCheckbox) {
        toggleDisplay(externalIsolationFields, hasExternalIsolationCheckbox.checked);
    }

    // Izolacja dachu
    if (topIsolationSelect && topIsolationFields) {
        toggleDisplay(topIsolationFields, topIsolationSelect.value === 'yes');
    }

    // Izolacja podłogi
    if (bottomIsolationSelect && bottomIsolationFields) {
        toggleDisplay(bottomIsolationFields, bottomIsolationSelect.value === 'yes');
    }

    // CWU - inicjalizacja stanu
    if (hotWaterCheckbox) {
        toggleHotWaterOptions();
    }


    }

    // Global exports
    window.setupDynamicFields = setupDynamicFields;
    window.toggleDisplay = toggleDisplay;

})();
