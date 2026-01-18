// === FILE: floorRenderer.js ===
// 🧠 Obsługuje: Dynamiczne generowanie checkboxów dla ogrzewanych kondygnacji

var goldAccentColor = (function getGoldAccentColor() {
  try {
    const rootStyles = window.getComputedStyle
      ? window.getComputedStyle(document.documentElement)
      : null;
    const value = rootStyles
      ? rootStyles.getPropertyValue("--color-gold")
      : null;
    return (value && value.trim()) || "#d4a574";
  } catch (err) {
    return "#d4a574";
  }
})();

(function () {
  "use strict";

  /**
   * Tworzy element checkbox z etykietą
   * ZORDON - JEDNOLITE STYLE DLA WSZYSTKICH CHECKBOXÓW!
   */
  function createCheckbox(name, value, labelText) {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");

    // Ustaw właściwości checkbox - IDENTYCZNE JAK .form-field__checkbox-inline
    checkbox.type = "checkbox";
    checkbox.name = name;
    checkbox.value = value;

    // Responsive sizing: 24px na mobile (≤768px), 20px na desktop
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const checkboxSize = isMobile ? "24px" : "20px";
    const labelPadding = isMobile ? "12px 16px" : "8px 12px";
    const labelGap = isMobile ? "16px" : "12px";
    const fontSize = isMobile ? "16px" : "15px";

    checkbox.style.width = checkboxSize;
    checkbox.style.height = checkboxSize;
    checkbox.style.marginRight = isMobile ? "16px" : "16px";
    checkbox.style.accentColor = goldAccentColor; // ZŁOTY – zgodny z innymi checkmarkami
    checkbox.style.flexShrink = "0";
    checkbox.style.cursor = "pointer";

    // Ustaw style dla label - responsive
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = labelGap;
    label.style.fontFamily =
      "'Titillium Web', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    label.style.fontWeight = "normal";
    label.style.padding = labelPadding;
    label.style.borderRadius = "6px";
    label.style.transition = "all 0.2s ease";
    label.style.cursor = "pointer";
    label.style.marginBottom = isMobile ? "12px" : "8px";

    // Hover effect - UJEDNOLICONE: Używamy złotego koloru (#d4a574) zamiast zielonego
    label.addEventListener("mouseenter", () => {
      // Ujednolicone z głównym stylem CSS (--color-accent-light: rgba(212, 165, 116, 0.1))
      label.style.backgroundColor = "rgba(212, 165, 116, 0.1)";
      label.style.transform = "scale(1.01)";
      label.style.paddingLeft = "4px";
    });

    label.addEventListener("mouseleave", () => {
      label.style.backgroundColor = "transparent";
      label.style.transform = "scale(1)";
      label.style.paddingLeft = "12px";
    });

    // Utwórz span dla tekstu - responsive font size
    const textSpan = document.createElement("span");
    textSpan.textContent = labelText;
    textSpan.style.fontFamily =
      "'Titillium Web', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    textSpan.style.fontSize = fontSize;
    textSpan.style.fontWeight = "500";
    textSpan.style.color = "#1A202C"; // Zgodny z desktop

    label.appendChild(checkbox);
    label.appendChild(textSpan);

    return label;
  }

  // Przechowywanie poprzedniego stanu dla porównania
  let previousFloorState = null;

  /**
   * Sprawdza czy stan budynku się zmienił
   */
  function hasFloorStateChanged(floors, hasBasement, roofType) {
    const currentState = { floors, hasBasement, roofType };
    const changed =
      !previousFloorState ||
      JSON.stringify(previousFloorState) !== JSON.stringify(currentState);

    if (changed) {
      previousFloorState = currentState;
    }

    return changed;
  }

  /**
   * Zachowuje zaznaczone piętra przed re-renderem
   */
  function preserveSelectedFloors() {
    const container = hpById("heatedFloorsContainer");
    if (!container) return [];

    const checkboxes = container.querySelectorAll(
      'input[type="checkbox"]:checked'
    );
    return Array.from(checkboxes).map((cb) => cb.value);
  }

  /**
   * Przywraca zaznaczone piętra po re-renderze
   */
  function restoreSelectedFloors(selectedValues) {
    if (!selectedValues || selectedValues.length === 0) return;

    const container = hpById("heatedFloorsContainer");
    if (!container) return;

    selectedValues.forEach((value) => {
      const checkbox = container.querySelector(`input[value="${value}"]`);
      if (checkbox) {
        checkbox.checked = true;
      }
    });
  }

  /**
   * Renderuje dynamicznie checkboxy dla ogrzewanych kondygnacji
   * na podstawie konfiguracji budynku (liczba pięter, piwnica, typ dachu)
   */
  function renderHeatedFloors() {
    try {
      const floorsSelect =
        hpQs('#top-instal-calc [name="building_floors"]') ||
        hpQs('[name="building_floors"]');
      const basementInput =
        hpById("has_basement") ||
        hpQs('#top-instal-calc [name="has_basement"]') ||
        hpQs('[name="has_basement"]');
      const container = hpById("heatedFloorsContainer");

      if (!container) {
        console.warn("Nie znaleziono kontenera heatedFloorsContainer");
        return;
      }

      if (!floorsSelect) {
        console.warn("Nie znaleziono pola building_floors");
        return;
      }

      const floors = parseInt(floorsSelect.value) || 1;
      const hasBasement = (() => {
        if (!basementInput) return false;
        if (basementInput.type === "checkbox") {
          return basementInput.checked;
        }
        return basementInput.value === "yes";
      })();

      let roofType = "steep"; // domyślna wartość
      const roofHidden = hpById("building_roof");
      if (roofHidden && roofHidden.value) {
        roofType = roofHidden.value;
      } else {
        const checkedRoof = hpQs('input[name="building_roof"]:checked');
        if (checkedRoof) {
          roofType = checkedRoof.value;
        }
      }

      // Sprawdź czy stan się zmienił
      if (!hasFloorStateChanged(floors, hasBasement, roofType)) {
        return;
      }

      // Zachowaj zaznaczone piętra
      const selectedFloors = preserveSelectedFloors();

      // Wyczyść kontener
      container.innerHTML = "";

      // Dodaj piwnicy jeśli jest zaznaczona
      if (hasBasement) {
        const basementLabel = createCheckbox(
          "building_heated_floors[]",
          "0",
          "Piwnica"
        );
        container.appendChild(basementLabel);
      }

      // Parter - NIE jest domyślnie zaznaczony (tylko jeśli użytkownik wcześniej go wybrał)
      const parterCheckbox = createCheckbox(
        "building_heated_floors[]",
        "1",
        "Parter"
      );
      const parterInput = parterCheckbox.querySelector("input");
      if (parterInput) {
        // Zaznacz parter tylko jeśli użytkownik wcześniej go wybrał
        parterInput.checked = selectedFloors.includes("1");
      }
      container.appendChild(parterCheckbox);

      // Dodaj pozostałe piętra
      for (let i = 1; i < floors; i++) {
        const floorNumber = i + 1;
        const label = `${i}. piętro`;
        const floorCheckbox = createCheckbox(
          "building_heated_floors[]",
          floorNumber.toString(),
          label
        );
        container.appendChild(floorCheckbox);
      }

      // Dodaj poddasze dla dachu skośnego z przestrzenią poddasza
      if (roofType === "steep") {
        const atticValue = floors + 1;
        const atticCheckbox = createCheckbox(
          "building_heated_floors[]",
          atticValue.toString(),
          "Poddasze"
        );
        container.appendChild(atticCheckbox);
      }

      // Przywróć zaznaczone piętra
      restoreSelectedFloors(selectedFloors);

      // Zarejestruj dynamiczne pola w formEngine
      if (
        window.formEngine &&
        typeof window.formEngine.rebindField === "function"
      ) {
        window.formEngine.rebindField("building_heated_floors[]", {
          refresh: true,
        });
      } else if (
        window.formEngine &&
        typeof window.formEngine.refreshField === "function"
      ) {
        window.formEngine.refreshField("building_heated_floors[]");
      }

      console.log(
        `✅ Renderowano piętra: ${floors} kondygnacji, piwnica: ${hasBasement}, dach: ${roofType}`
      );
    } catch (error) {
      console.error("❌ Błąd renderowania pięter:", error);

      // Fallback - przynajmniej pokaż parter z prawidłowym formatowaniem (NIE zaznaczony domyślnie)
      const container = hpById("heatedFloorsContainer");
      if (container) {
        // Responsive sizing dla fallback
        const isMobile = window.matchMedia("(max-width: 768px)").matches;
        const checkboxSize = isMobile ? "24px" : "20px";
        const labelPadding = isMobile ? "12px 16px" : "8px 12px";
        const labelGap = isMobile ? "16px" : "12px";
        const fontSize = isMobile ? "16px" : "15px";

        container.innerHTML = `
                <label style="display: flex; align-items: center; gap: ${labelGap}; font-weight: normal; padding: ${labelPadding}; border-radius: 6px; cursor: pointer; margin-bottom: ${
          isMobile ? "12px" : "8px"
        };">
                    <input type="checkbox" name="building_heated_floors[]" value="1" style="width: ${checkboxSize}; height: ${checkboxSize}; margin-right: 16px; accent-color: ${goldAccentColor}; flex-shrink: 0; cursor: pointer;">
                    <span style="font-size: ${fontSize}; font-weight: 500; color: #1A202C;">Parter</span>
                </label>
            `;
      }
    }
  }

  /**
   * Reset stanu modułu
   */
  function resetFloorRenderer() {
    previousFloorState = null;
    const container = hpById("heatedFloorsContainer");
    if (container) {
      container.innerHTML = "";
    }
  }

  /**
   * Inicjalizuje event listenery dla automatycznego renderowania pięter
   */
  function initFloorRenderingListeners() {
    // ✅ Zapobiegaj wielokrotnej inicjalizacji (jeśli wywołane bezpośrednio)
    if (floorRendererInitialized) {
      return;
    }
    floorRendererInitialized = true;
    // Znajdź pola które wpływają na renderowanie pięter
    const floorsSelect =
      hpQs('#top-instal-calc [name="building_floors"]') ||
      hpQs('[name="building_floors"]');
    const basementInput =
      hpById("has_basement") ||
      hpQs('#top-instal-calc [name="has_basement"]') ||
      hpQs('[name="has_basement"]');
    const roofRadios = hpQsa('input[name="building_roof"]');
    const roofHidden = hpById("building_roof");

    // Event listener dla liczby pięter
    if (floorsSelect) {
      floorsSelect.addEventListener("change", () => {
        renderHeatedFloors();
      });
    }

    // Event listener dla piwnicy
    if (basementInput) {
      basementInput.addEventListener("change", () => {
        renderHeatedFloors();
      });
    }

    // Event listener dla typu dachu (radio buttony)
    if (roofHidden) {
      roofHidden.addEventListener("change", () => {
        renderHeatedFloors();
      });
    } else if (roofRadios.length > 0) {
      roofRadios.forEach((radio) => {
        radio.addEventListener("change", () => {
          renderHeatedFloors();
        });
      });
    } else {
      console.warn("⚠️ Nie znaleziono radio buttonów dla typu dachu");
    }

    // Sprawdź czy kontener istnieje
    const container = hpById("heatedFloorsContainer");

    // Wywołaj renderowanie przy pierwszym załadowaniu
    renderHeatedFloors();
  }

  // Global exports
  window.renderHeatedFloors = renderHeatedFloors;
  window.createCheckbox = createCheckbox;
  window.resetFloorRenderer = resetFloorRenderer;
  window.preserveSelectedFloors = preserveSelectedFloors;
  window.restoreSelectedFloors = restoreSelectedFloors;
  window.initFloorRenderingListeners = initFloorRenderingListeners;

  // ✅ Flaga zapobiegająca wielokrotnej inicjalizacji
  let floorRendererInitialized = false;

  // Automatyczna inicjalizacja po załadowaniu DOM
  // UWAGA: initFloorRenderingListeners jest również wywoływane w calculatorInit.js
  // Więc tutaj tylko jako fallback
  function initFloorRenderingListenersOnce() {
    if (floorRendererInitialized) {
      return;
    }
    floorRendererInitialized = true;
    initFloorRenderingListeners();
  }

  window.__initFloorRenderer = function () {
    initFloorRenderingListenersOnce();
  };
})();
