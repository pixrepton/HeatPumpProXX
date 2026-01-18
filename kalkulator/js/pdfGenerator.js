/**
 * pdfGenerator.js – Minimalistyczny raport cieplny budynku
 * Generuje techniczny dokument PDF z danymi z formularza i wyników obliczeń
 */

async function generateOfferPDF(configData) {
  try {
    // Walidacja danych wejściowych
    if (!configData || typeof configData !== "object") {
      throw new Error(
        "generateOfferPDF: configData is required and must be an object"
      );
    }

    // Sprawdź kluczowe pola
    if (!configData.buildingData && !configData.results) {
      console.warn(
        "generateOfferPDF: configData missing buildingData or results"
      );
    }

    // OPTIMIZATION: Lazy load PDF libraries on-demand
    if (
      typeof window !== "undefined" &&
      typeof window.loadPdfLibraries === "function"
    ) {
      try {
        await window.loadPdfLibraries();
      } catch (err) {
        throw new Error(
          "Nie udało się załadować bibliotek PDF: " + err.message
        );
      }
    } else if (typeof html2pdf === "undefined") {
      // Fallback: spróbuj załadować ręcznie
      throw new Error(
        "Biblioteka html2pdf nie jest załadowana. Użyj loadPdfLibraries() z downloadPDF.js."
      );
    }

    const htmlContent = createPDFContent(configData);

    if (!htmlContent || htmlContent.trim().length === 0) {
      throw new Error("Nie udało się wygenerować zawartości HTML dla PDF");
    }

    const tempContainer = document.createElement("div");
    tempContainer.innerHTML = htmlContent;
    // Renderuj poza ekranem, ale nie ukrywaj przez visibility/opacity (html2canvas wymaga realnego layoutu)
    tempContainer.style.position = "absolute";
    tempContainer.style.left = "-10000px";
    tempContainer.style.top = "0";
    // Użyj stałych pikseli odpowiadających A4 przy ~96dpi (210x297mm ≈ 794x1123px)
    tempContainer.style.width = "794px";
    tempContainer.style.minHeight = "1123px";
    tempContainer.style.background = "#fff";
    tempContainer.style.fontFamily = "Arial, Helvetica, sans-serif";
    tempContainer.style.margin = "0";
    tempContainer.style.padding = "0";
    tempContainer.style.border = "0";
    document.body.appendChild(tempContainer);

    // ⏱️ Daj przeglądarce czas na layout + 1 frame
    await new Promise((resolve) =>
      requestAnimationFrame(() => setTimeout(resolve, 400))
    );

    // Dodatkowe sprawdzenie - poczekaj aż kontener będzie miał rzeczywistą wysokość
    let attempts = 0;
    while (attempts < 10 && tempContainer.offsetHeight < 100) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    // Diagnostyka - sprawdź czy kontener ma zawartość
    console.log("[PDF] tempContainer diagnostics", {
      height: tempContainer.offsetHeight,
      scrollHeight: tempContainer.scrollHeight,
      width: tempContainer.offsetWidth,
      scrollWidth: tempContainer.scrollWidth,
      innerHTML: tempContainer.innerHTML.substring(0, 200) + "...",
    });

    const options = {
      margin: 0,
      filename: `Raport_Cieplny_Budynku_${
        new Date().toISOString().split("T")[0]
      }.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 1.5,
        useCORS: false,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait",
        compress: false,
      },
    };

    if (typeof html2canvas === "undefined") {
      throw new Error(
        "html2canvas nie jest załadowane (sprawdź skrypt libraries/html2canvas.min.js)"
      );
    }
    // ⚠️ FIX P1.4: Obsługa błędów html2canvas z user-friendly komunikatem
    const canvas = await html2canvas(tempContainer, {
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
    }).catch((error) => {
      // ⚠️ FIX P1.4: Obsługa błędów html2canvas
      throw new Error(`Błąd konwersji HTML do Canvas: ${error.message}`);
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.98);
    const jsPDFCtor =
      window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : window.jsPDF;
    if (!jsPDFCtor)
      throw new Error("Brak konstruktora jsPDF w globalnym scope");

    const pdf = new jsPDFCtor("p", "mm", "a4");
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pdfW / canvas.width, pdfH / canvas.height);
    const imgW = canvas.width * ratio;
    const imgH = canvas.height * ratio;
    const posX = (pdfW - imgW) / 2;
    const posY = (pdfH - imgH) / 2;

    pdf.addImage(imgData, "JPEG", posX, posY, imgW, imgH, undefined, "FAST");
    pdf.save(
      `Raport_Cieplny_Budynku_${new Date().toISOString().split("T")[0]}.pdf`
    );
  } catch (err) {
    // ⚠️ FIX P1.4: User-friendly komunikat błędu (żeby user widział komunikat zamiast ciszy)
    console.error("❌ Błąd podczas generowania PDF:", err);
    console.error("Szczegóły błędu:", err.stack);

    if (typeof ErrorHandler !== "undefined" && ErrorHandler.showToast) {
      const userMessage =
        err.message || "Nie udało się wygenerować raportu PDF";
      ErrorHandler.showToast(userMessage, "error", 5000);
    } else {
      alert(
        "Nie udało się wygenerować raportu PDF: " +
          (err.message || "Nieznany błąd")
      );
    }

    throw err; // Rzuć dalej dla downloadPDF.js
  } finally {
    // ⚠️ FIX P1.4: Cleanup tempContainer w finally (zawsze się wykona, nawet przy błędzie)
    if (tempContainer && document.body.contains(tempContainer)) {
      try {
        document.body.removeChild(tempContainer);
      } catch (cleanupError) {
        console.warn(
          "[PDF] Błąd podczas usuwania tempContainer:",
          cleanupError
        );
      }
    }
  }
}

function createPDFContent(data) {
  const date = new Date().toLocaleDateString("pl-PL");
  const gold = "#d4a574";
  const grayBorder = "#E5E7EB";
  const grayText = "#1A202C";
  const muted = "#6B7280";
  const tableHeaderBg = "#F9FAFB";

  const formatValue = (v, unit = "") => (v ? `${v}${unit}` : "");
  const formatPercent = (v) => (v ? `${parseFloat(v)}%` : "");
  const formatCurrency = (v) =>
    v ? `${parseFloat(v).toLocaleString("pl-PL")} zł` : "";

  const safe = (arr) => (Array.isArray(arr) ? arr : []);

  // === ZUNIFIKOWANE STYLE ===
  const fontSize = {
    large: "13px", // Nagłówki główne
    medium: "12px", // Treść podstawowa, tabele
    small: "10px", // Drobny tekst, stopka
  };

  // === Tabele pomocnicze ===
  const createRow = (label, value, unit = "") =>
    value
      ? `
  <tr>
    <td style="
      padding:4px;
      border-bottom:1px solid ${grayBorder};
      font-weight:400;
      width:40%;
      font-size:${fontSize.medium};
      color:${muted};
      text-transform:uppercase;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    ">
      ${label}
    </td>
    <td style="
      padding:4px;
      border-bottom:1px solid ${grayBorder};
      text-align:right;
      color:${grayText};
      font-size:${fontSize.medium};
      text-transform:uppercase;
      word-wrap:break-word;
      overflow-wrap:break-word;
    ">
      ${formatValue(value, unit)}
    </td>
  </tr>`
      : "";

  // === Mapowania materiałów ===
  const materialMap = {
    // Materiały izolacyjne
    64: "Korek",
    65: "Słoma",
    66: "Trzcina",
    68: "Wełna mineralna",
    69: "Wełna mineralna granulowana",
    70: "Styropian",
    71: "Styropian twardy (XPS)",
    81: "Padzierz lniany",
    82: "Pustka powietrzna",
    83: "Wiórobeton",
    86: "PUR",
    87: "Ekofiber",
    88: "Styropian grafitowy",
    94: "Wełna drzewna",
    95: "PIR",
    98: "Celuloza",
    101: "Multipor",
    // Materiały ścian
    51: "Beton",
    52: "Żelbet",
    53: "Pustak żużlobetonowy",
    54: "Beton komórkowy",
    55: "Drewno liściaste",
    56: "Drewno iglaste",
    57: "Cegła pełna",
    58: "Cegła dziurawka",
    59: "Cegła kratówka",
    60: "Cegła silikatowa pełna",
    61: "Cegła silikatowa dziurawka",
    62: "Cegła klinkierowa",
    63: "Pustaki ceramiczne",
    76: "Kamień polny",
    77: "Granit",
    78: "Marmur",
    79: "Piaskowiec",
    80: "Wapień",
    84: "Porotherm",
    85: "Pustak keramzytowy",
    89: "Ytong",
    90: "Termalica 300/400",
    91: "Termalica 600/650",
    92: "Thermomur",
    93: "Glina",
    96: "Bloczek silikatowy",
    97: "Keramzytobeton",
    99: "Ytong Ultra+",
    100: "Ytong PP5",
  };

  const garageTypeMap = {
    none: "Brak",
    single_unheated: "1-stanowisko, nieogrzewany",
    single_heated: "1-stanowisko, ogrzewany",
    double_unheated: "2-stanowiskowy, nieogrzewany",
    double_heated: "2-stanowiskowy, ogrzewany",
  };

  const hotWaterUsageMap = {
    shower: "Małe",
    shower_bath: "Średnie",
    bath: "Duże",
  };

  const ventilationTypeMap = {
    natural: "Grawitacyjna, naturalna",
    mechanical: "Mechaniczna",
    mechanical_recovery: "Mechaniczna z rekuperacją",
  };

  const roofTypeMap = {
    flat: "Płaski",
    steep: "Skośny - z przestrzenią poddasza",
    oblique: "Skośny bez przestrzeni poddasza",
  };

  const doorsTypeMap = {
    new_pvc: "Nowe PVC",
    new_wooden: "Nowe drewniane",
    new_metal: "Nowe metalowe",
    old_wooden: "Stare drewniane",
    old_metal: "Stare metalowe",
  };

  const surroundingsMap = {
    heated_room: "Ogrzewany lokal",
    unheated_room: "Nieogrzewany lokal",
    outdoor: "Świat zewnętrzny",
    ground: "Grunt",
  };

  // === Funkcje pomocnicze do formatowania ===
  const formatIsolation = (materialId, size) => {
    if (!materialId && !size) return null;
    const material = materialMap[materialId] || "";
    const sizeStr = size ? `${size}cm` : "";
    if (material && sizeStr) return `${material}, ${sizeStr}`;
    if (material) return material;
    if (sizeStr) return sizeStr;
    return null;
  };

  const formatCoordinates = (lat, lon) => {
    if (lat && lon) return `${lat}, ${lon}`;
    if (lat) return `Szer.: ${lat}`;
    if (lon) return `Dł.: ${lon}`;
    return null;
  };

  const formatDimensions = (length, width) => {
    if (length && width) return `${length}m × ${width}m`;
    if (length) return `Długość: ${length}m`;
    if (width) return `Szerokość: ${width}m`;
    return null;
  };

  const formatGarage = (hasGarage, garageType) => {
    if (hasGarage === "Nie" || !hasGarage) return null;
    if (garageType && garageType !== "none") {
      return `${hasGarage} - ${garageTypeMap[garageType] || garageType}`;
    }
    return hasGarage;
  };

  const formatHotWater = (include, persons, usage) => {
    if (include === "Nie" || !include) return null;
    const parts = [include];
    if (persons) {
      const personsNum = parseInt(persons);
      if (personsNum === 1) {
        parts.push("1 osoba");
      } else if (personsNum > 1) {
        parts.push(`${personsNum} os.`);
      } else {
        parts.push(persons);
      }
    }
    if (usage) parts.push(`zużycie: ${hotWaterUsageMap[usage] || usage}`);
    return parts.join(", ");
  };

  const formatWindows = (windows, number) => {
    if (!windows && !number) return null;
    if (windows && number)
      return `${windows}, ${number} ${number === "1" ? "szt." : "szt."}`;
    if (windows) return windows;
    if (number) return `${number} ${number === "1" ? "szt." : "szt."}`;
    return null;
  };

  const formatDoors = (doorsType, number, isSimplifiedSingleHouse = false) => {
    // Dla single_house w trybie uproszczonym: nie wyświetlaj typu drzwi (używana stała U_door = 1.8)
    if (isSimplifiedSingleHouse) {
      if (number)
        return `${number} ${
          number === "1" ? "szt." : "szt."
        } (typ: standardowy)`;
      return null;
    }
    if (!doorsType && !number) return null;
    const type = doorsTypeMap[doorsType] || doorsType;
    if (type && number)
      return `${type}, ${number} ${number === "1" ? "szt." : "szt."}`;
    if (type) return type;
    if (number) return `${number} ${number === "1" ? "szt." : "szt."}`;
    return null;
  };

  const formatWall = (size, primary, secondary) => {
    const parts = [];
    if (size) parts.push(`${size}cm`);
    if (primary) parts.push(materialMap[primary] || primary);
    if (secondary) parts.push(`+ ${materialMap[secondary] || secondary}`);
    return parts.length > 0 ? parts.join(", ") : null;
  };

  // === Dane budynku - inteligentne grupowanie ===
  const buildingRows = [];

  // Mapowanie wartości construction_year na etykiety
  const constructionYearLabels = {
    2025: "2025",
    2021: "2021–2024",
    2011: "2011–2020",
    2000: "2000–2010",
    1990: "1991–2000",
    1980: "1981–1990",
    1970: "1971–1980",
    1960: "1961–1970",
    1950: "1950–1960",
    1940: "1940–1949",
    1939: "przed 1939",
  };

  // Podstawowe informacje
  if (data.building_type)
    buildingRows.push(createRow("Typ budynku", data.building_type));
  if (data.construction_year) {
    const yearLabel =
      constructionYearLabels[String(data.construction_year)] ||
      data.construction_year;
    buildingRows.push(createRow("Lata budowy", yearLabel));
  }
  if (data.construction_type)
    buildingRows.push(createRow("Rodzaj konstrukcji", data.construction_type));

  // Wymiary budynku (razem)
  const dimensions = formatDimensions(
    data.building_length,
    data.building_width
  );
  if (dimensions)
    buildingRows.push(createRow("Wymiary zewnętrzne", dimensions));

  // Powierzchnia i obwód
  if (data.floor_area)
    buildingRows.push(createRow("Pow. zabudowy (m²)", data.floor_area));
  if (data.floor_perimeter)
    buildingRows.push(createRow("Obwód podłogi [m]", data.floor_perimeter));

  // Kondygnacje
  if (data.building_floors)
    buildingRows.push(createRow("Liczba kondygnacji", data.building_floors));
  if (data.floor_height)
    buildingRows.push(createRow("Wysokość kondygnacji [m]", data.floor_height));
  if (data.building_roof) {
    const roofType = roofTypeMap[data.building_roof] || data.building_roof;
    buildingRows.push(createRow("Rodzaj dachu", roofType));
  }

  // Piwnica i balkony
  if (data.has_basement)
    buildingRows.push(createRow("Piwnica", data.has_basement));
  if (data.has_balcony)
    buildingRows.push(createRow("Balkony", data.has_balcony));

  // Garaż (razem)
  const garage = formatGarage(data.has_garage, data.garage_type);
  if (garage) buildingRows.push(createRow("Garaż", garage));

  // Ściany (materiał + grubość)
  const wall = formatWall(
    data.wall_size,
    data.primary_wall_material,
    data.secondary_wall_material
  );
  if (wall) buildingRows.push(createRow("Ściany zewnętrzne", wall));

  // Izolacje (materiał + grubość)
  // Sprawdź czy jest w trybie uproszczonym dla single_house
  const isSimplifiedSingleHouse =
    data.building_type === "single_house" &&
    data.detailed_insulation_mode !== true;

  if (isSimplifiedSingleHouse) {
    // TRYB UPROSZCZONY: wyświetl poziomy izolacji
    const insulationLevelMap = {
      poor: "Słabo ocieplone",
      average: "Przeciętnie ocieplone",
      good: "Dobrze ocieplone",
      very_good: "Bardzo dobrze ocieplone",
    };

    if (data.walls_insulation_level) {
      buildingRows.push(
        createRow(
          "Izolacja ścian",
          insulationLevelMap[data.walls_insulation_level] ||
            data.walls_insulation_level
        )
      );
    }
    if (data.roof_insulation_level) {
      buildingRows.push(
        createRow(
          "Izolacja dachu",
          insulationLevelMap[data.roof_insulation_level] ||
            data.roof_insulation_level
        )
      );
    }
    if (data.floor_insulation_level) {
      buildingRows.push(
        createRow(
          "Izolacja podłogi",
          insulationLevelMap[data.floor_insulation_level] ||
            data.floor_insulation_level
        )
      );
    }
  } else {
    // TRYB SZCZEGÓŁOWY: wyświetl szczegółowe dane (materiał + grubość)
    const topIsolation = formatIsolation(
      data.top_isolation_material,
      data.top_isolation_size
    );
    if (topIsolation)
      buildingRows.push(createRow("Izolacja dachu", topIsolation));

    const bottomIsolation = formatIsolation(
      data.bottom_isolation_material,
      data.bottom_isolation_size
    );
    if (bottomIsolation)
      buildingRows.push(createRow("Izolacja podłogi", bottomIsolation));

    const externalIsolation = formatIsolation(
      data.external_wall_isolation_material,
      data.external_wall_isolation_size
    );
    if (externalIsolation)
      buildingRows.push(
        createRow("Izolacja zewnętrzna ścian", externalIsolation)
      );
  }

  const internalIsolation = formatIsolation(
    data.internal_wall_isolation_material,
    data.internal_wall_isolation_size
  );
  if (internalIsolation)
    buildingRows.push(
      createRow("Izolacja wewnętrzna ścian", internalIsolation)
    );

  // Okna (razem)
  const windows = formatWindows(data.windows, data.number_windows);
  if (windows) buildingRows.push(createRow("Okna", windows));

  // Drzwi (razem) - dla single_house w trybie uproszczonym: nie wyświetlaj typu
  const doors = formatDoors(
    data.doors_type,
    data.number_doors,
    isSimplifiedSingleHouse
  );
  if (doors) buildingRows.push(createRow("Drzwi zewnętrzne", doors));

  // Temperatura i wentylacja
  if (data.indoor_temperature)
    buildingRows.push(
      createRow("Temp. wewnętrzna [°C]", data.indoor_temperature)
    );
  if (data.ventilation_type) {
    const ventilation =
      ventilationTypeMap[data.ventilation_type] || data.ventilation_type;
    buildingRows.push(createRow("Wentylacja", ventilation));
  }

  // CWU (razem)
  const hotWater = formatHotWater(
    data.include_hot_water,
    data.hot_water_persons,
    data.hot_water_usage
  );
  if (hotWater) buildingRows.push(createRow("Podgrzewanie CWU", hotWater));

  // Budynek narożny
  if (data.on_corner)
    buildingRows.push(createRow("Budynek narożny", data.on_corner));

  // Otoczenie mieszkania (jeśli są wypełnione)
  const surroundings = [];
  if (data.whats_over)
    surroundings.push(
      `Nad: ${surroundingsMap[data.whats_over] || data.whats_over}`
    );
  if (data.whats_under)
    surroundings.push(
      `Pod: ${surroundingsMap[data.whats_under] || data.whats_under}`
    );
  if (data.whats_north)
    surroundings.push(
      `Północ: ${surroundingsMap[data.whats_north] || data.whats_north}`
    );
  if (data.whats_south)
    surroundings.push(
      `Południe: ${surroundingsMap[data.whats_south] || data.whats_south}`
    );
  if (data.whats_east)
    surroundings.push(
      `Wschód: ${surroundingsMap[data.whats_east] || data.whats_east}`
    );
  if (data.whats_west)
    surroundings.push(
      `Zachód: ${surroundingsMap[data.whats_west] || data.whats_west}`
    );

  if (surroundings.length > 0) {
    buildingRows.push(
      createRow("Otoczenie mieszkania", surroundings.join("; "))
    );
  }

  // === Profil energetyczny ===
  const profileRows = safe(data.energy_profile_rows)
    .map(
      (r) => `
    <tr>
      <td style="padding:5px 6px;border-bottom:1px solid ${grayBorder};font-weight:400;width:45%;font-size:12px;text-transform:uppercase;">${r.label}</td>
      <td style="padding:5px 6px;border-bottom:1px solid ${grayBorder};text-align:right;font-size:12px;text-transform:uppercase;">${r.value}</td>
    </tr>`
    )
    .join("");

  // Przygotuj profil energetyczny w 2 kolumnach (jeśli będzie potrzeba)
  const profileRowsHalf = Math.ceil(safe(data.energy_profile_rows).length / 2);
  const profileRowsCol1 = safe(data.energy_profile_rows)
    .slice(0, profileRowsHalf)
    .map(
      (r) => `
    <tr>
      <td style="padding:4px;border-bottom:1px solid ${grayBorder};font-weight:400;width:40%;font-size:${fontSize.medium};text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.label}</td>
      <td style="padding:4px;border-bottom:1px solid ${grayBorder};text-align:right;font-size:${fontSize.medium};text-transform:uppercase;word-wrap:break-word;">${r.value}</td>
    </tr>`
    )
    .join("");
  const profileRowsCol2 = safe(data.energy_profile_rows)
    .slice(profileRowsHalf)
    .map(
      (r) => `
    <tr>
      <td style="padding:4px;border-bottom:1px solid ${grayBorder};font-weight:400;width:40%;font-size:${fontSize.medium};text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.label}</td>
      <td style="padding:4px;border-bottom:1px solid ${grayBorder};text-align:right;font-size:${fontSize.medium};text-transform:uppercase;word-wrap:break-word;">${r.value}</td>
    </tr>`
    )
    .join("");

  // === Rekomendacje pomp ===
  const models = safe(data.recommended_models)
    .map(
      (m) => `
    <div style="border:1px solid ${grayBorder};border-radius:8px;padding:4px;margin:10px 0 0 0;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <div style="font-weight:400;color:${grayText};font-size:${
        fontSize.medium
      };text-transform:uppercase;">
        ${m.title} <span style="color:${gold};font-weight:400;">${
        m.power_kw
      } kW</span>
      </div>
      ${
        m.type
          ? `<div style="font-size:${
              fontSize.small
            };color:${muted};margin-top:2px;text-transform:uppercase;">${
              m.type
            }${m.kit ? " • " + m.kit : ""}</div>`
          : ""
      }
    </div>`
    )
    .join("");

  const recSection = `
    <div style="margin-bottom:28px;">
      <h2 style="font-size:14px;font-weight:500;color:${grayText};margin:0 0 8px 0;padding:6px 0;border-bottom:2px solid ${gold};text-transform:uppercase;">
        Rekomendowana moc: ${data.recommended_power_kw || "?"} kW
      </h2>
      <p style="margin:0 0 8px 0;color:${muted};font-size:11px;">Wybrane modele gwarantują stabilną, cichą i ekonomiczną pracę przez cały sezon grzewczy.</p>
      ${models}
      <p style="margin:10px 0 0 0;color:${muted};font-size:10.5px;">Zestaw obejmuje pełny pakiet komponentów dopasowanych do Twojego budynku.</p>
    </div>`;

  // === Straty ciepła ===
  const lossesRows = safe(data.energy_losses)
    .map(
      (l) => `
    <tr>
      <td style="padding:4px;border-bottom:1px solid ${grayBorder};font-size:${
        fontSize.medium
      };text-transform:uppercase;">${l.name}</td>
      <td style="padding:4px;border-bottom:1px solid ${grayBorder};text-align:right;font-size:${
        fontSize.medium
      };text-transform:uppercase;">${formatPercent(l.percent)}</td>
    </tr>`
    )
    .join("");
  const lossesSection = `
    <div>
      <h2 style="font-size:${fontSize.large};font-weight:500;color:${grayText};margin:0 0 10px 0;padding:4px 0;border-bottom:2px solid ${gold};text-transform:uppercase;">Analiza strat ciepła</h2>
      <table style="width:100%;border-collapse:collapse;font-size:${fontSize.medium};">
        <thead style="background:${tableHeaderBg};">
          <tr>
            <th style="text-align:left;padding:4px;border-bottom:1px solid ${grayBorder};">Element obudowy</th>
            <th style="text-align:right;padding:4px;border-bottom:1px solid ${grayBorder};">Udział strat</th>
          </tr>
        </thead>
        <tbody>${lossesRows}</tbody>
      </table>
    </div>`;

  // === Punkty biwalentne ===
  const bivRows = safe(data.bivalent_points)
    .filter((b) => [-5, -7, -9, -11].includes(b.temp))
    .map(
      (b) => `
    <tr>
      <td style="padding:4px;border-bottom:1px solid ${grayBorder};font-size:${fontSize.medium};text-transform:uppercase;">${b.temp}°C</td>
      <td style="padding:4px;border-bottom:1px solid ${grayBorder};text-align:right;font-size:${fontSize.medium};text-transform:uppercase;">${b.power_kw} kW</td>
    </tr>`
    )
    .join("");
  const bivSection = `
    <div>
      <h2 style="font-size:${fontSize.large};font-weight:500;color:${grayText};margin:0 0 10px 0;padding:4px 0;border-bottom:2px solid ${gold};text-transform:uppercase;">Punkty biwalentne</h2>
      <table style="width:100%;border-collapse:collapse;font-size:${fontSize.medium};">
        <thead style="background:${tableHeaderBg};">
          <tr>
            <th style="text-align:left;padding:4px;border-bottom:1px solid ${grayBorder};">Temp.</th>
            <th style="text-align:right;padding:4px;border-bottom:1px solid ${grayBorder};">Moc</th>
          </tr>
        </thead>
        <tbody>${bivRows}</tbody>
      </table>
    </div>`;

  // === Modernizacje ===
  const improvements = safe(data.improvements)
    .map(
      (i, idx) => `
    <li style="margin:4px 0;color:${grayText};font-size:${
        fontSize.medium
      };text-transform:uppercase;">${idx + 1}. ${
        i.title
      } <span style="color:${gold};font-weight:400;">${
        i.saving ? "— OSZCZĘDNOŚĆ " + formatPercent(i.saving) : ""
      }</span></li>
  `
    )
    .join("");
  const improvementsSection = `
    <div style="margin:10px 0 0 0;">
      <h2 style="font-size:${fontSize.large};font-weight:500;color:${grayText};margin:0 0 10px 0;padding:4px 0;border-bottom:2px solid ${gold};text-transform:uppercase;">Rekomendowane modernizacje</h2>
      <ul style="margin:0;padding-left:14px;font-size:${fontSize.medium};">${improvements}</ul>
    </div>`;

  // === Koszty ===
  const costRows = safe(data.costs_comparison)
    .map(
      (c) => `
    <tr>
      <td style="padding:4px;border-bottom:1px solid ${grayBorder};font-size:${
        fontSize.medium
      };text-transform:uppercase;">${c.variant}</td>
      <td style="padding:4px;border-bottom:1px solid ${grayBorder};text-align:right;font-size:${
        fontSize.medium
      };text-transform:uppercase;">${formatPercent(c.efficiency)}</td>
      <td style="padding:4px;border-bottom:1px solid ${grayBorder};text-align:right;font-size:${
        fontSize.medium
      };text-transform:uppercase;">${formatCurrency(c.annual_cost_pln)}</td>
    </tr>`
    )
    .join("");
  const costsSection = `
    <div style="margin:10px 0;">
      <h2 style="font-size:${fontSize.large};font-weight:500;color:${grayText};margin:0 0 10px 0;padding:4px 0;border-bottom:2px solid ${gold};text-transform:uppercase;">Porównanie kosztów ogrzewania</h2>
      <table style="width:100%;border-collapse:collapse;font-size:${fontSize.medium};">
        <thead style="background:${tableHeaderBg};">
          <tr>
            <th style="text-align:left;padding:4px;border-bottom:1px solid ${grayBorder};font-size:${fontSize.medium};text-transform:uppercase;font-weight:500;">Wariant ogrzewania</th>
            <th style="text-align:right;padding:4px;border-bottom:1px solid ${grayBorder};font-size:${fontSize.medium};text-transform:uppercase;font-weight:500;">Sprawność</th>
            <th style="text-align:right;padding:4px;border-bottom:1px solid ${grayBorder};font-size:${fontSize.medium};text-transform:uppercase;font-weight:500;">Roczny koszt</th>
          </tr>
        </thead>
        <tbody>${costRows}</tbody>
      </table>
    </div>`;

  // === Maszynownia - Sekcja z cenami ===
  const machineRoom = safe(data.machine_room?.items || []);
  const machineRoomTotal = data.machine_room?.total_netto_pln || 0;
  const machineRoomTotalBrutto = data.machine_room?.total_brutto_pln || 0;

  // === Hydraulika CO (Single Source of Truth z konfiguratora) ===
  const hydraulicsRec = data.machine_room?.recommendations?.hydraulics || null;
  const hydraulicsRecSection = hydraulicsRec
    ? `
    <div style="margin:20px 0;page-break-inside:avoid;">
      <h2 style="font-size:${
        fontSize.large
      };font-weight:600;color:${grayText};margin:0 0 12px 0;padding:6px 0;border-bottom:3px solid ${gold};text-transform:uppercase;">
        Hydraulika CO — rekomendacja silnika
      </h2>
      <div style="border:1px solid ${grayBorder};border-radius:10px;padding:12px;">
        <div style="font-size:${fontSize.medium};margin-bottom:6px;">
          <strong>Rekomendacja:</strong> ${hydraulicsRec.recommendation || "—"}
          ${
            hydraulicsRec.buffer_liters
              ? ` | <strong>Bufor:</strong> ${hydraulicsRec.buffer_liters} L`
              : ""
          }
          ${
            hydraulicsRec.severity
              ? ` | <strong>Waga:</strong> ${hydraulicsRec.severity}`
              : ""
          }
        </div>
        <div style="font-size:${
          fontSize.medium
        };color:${muted};margin-bottom:8px;">
          ${hydraulicsRec.explanation?.short || ""}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:${
          fontSize.medium
        };">
          <tbody>
            <tr>
              <td style="padding:4px;border-bottom:1px solid ${grayBorder};color:${muted};text-transform:uppercase;">Oś przepływu</td>
              <td style="padding:4px;border-bottom:1px solid ${grayBorder};text-align:right;">${
        hydraulicsRec.axes?.flow_protection || "—"
      }</td>
            </tr>
            <tr>
              <td style="padding:4px;border-bottom:1px solid ${grayBorder};color:${muted};text-transform:uppercase;">Oś separacji</td>
              <td style="padding:4px;border-bottom:1px solid ${grayBorder};text-align:right;">${
        hydraulicsRec.axes?.hydraulic_separation || "—"
      }</td>
            </tr>
            <tr>
              <td style="padding:4px;border-bottom:1px solid ${grayBorder};color:${muted};text-transform:uppercase;">Oś magazynowania</td>
              <td style="padding:4px;border-bottom:1px solid ${grayBorder};text-align:right;">${
        hydraulicsRec.axes?.energy_storage || "—"
      }</td>
            </tr>
          </tbody>
        </table>
        ${
          Array.isArray(hydraulicsRec.reason_codes) &&
          hydraulicsRec.reason_codes.length
            ? `<div style="margin-top:8px;font-size:${
                fontSize.small
              };color:${muted};">
                <strong>Powody (kody):</strong> ${hydraulicsRec.reason_codes.join(
                  ", "
                )}
              </div>`
            : ""
        }
      </div>
    </div>
  `
    : "";

  const machineRoomRows = machineRoom
    .map(
      (item) => `
    <tr>
      <td style="padding:6px;border-bottom:1px solid ${grayBorder};font-size:${
        fontSize.medium
      };">
        ${item.name || "Komponent"}
        ${item.quantity > 1 ? ` × ${item.quantity}` : ""}
      </td>
      <td style="padding:6px;border-bottom:1px solid ${grayBorder};text-align:right;font-size:${
        fontSize.medium
      };">
        ${formatCurrency(item.unit_price_pln || 0)}
      </td>
      <td style="padding:6px;border-bottom:1px solid ${grayBorder};text-align:right;font-size:${
        fontSize.medium
      };font-weight:600;">
        ${formatCurrency(item.total_pln || 0)}
      </td>
    </tr>
  `
    )
    .join("");

  const machineRoomSection =
    machineRoom.length > 0
      ? `
    <div style="margin:20px 0;page-break-inside:avoid;">
      <h2 style="font-size:${
        fontSize.large
      };font-weight:600;color:${grayText};margin:0 0 12px 0;padding:6px 0;border-bottom:3px solid ${gold};text-transform:uppercase;">
        Maszynownia - Komponenty i ceny
      </h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <thead style="background:${tableHeaderBg};">
          <tr>
            <th style="text-align:left;padding:6px;border-bottom:2px solid ${grayBorder};font-size:${
          fontSize.medium
        };text-transform:uppercase;font-weight:600;">Komponent</th>
            <th style="text-align:right;padding:6px;border-bottom:2px solid ${grayBorder};font-size:${
          fontSize.medium
        };text-transform:uppercase;font-weight:600;">Cena jednostkowa</th>
            <th style="text-align:right;padding:6px;border-bottom:2px solid ${grayBorder};font-size:${
          fontSize.medium
        };text-transform:uppercase;font-weight:600;">Wartość</th>
          </tr>
        </thead>
        <tbody>
          ${machineRoomRows}
          <tr style="background:${tableHeaderBg};">
            <td colspan="2" style="padding:8px;border-top:2px solid ${grayBorder};font-size:${
          fontSize.medium
        };font-weight:600;text-align:right;">
              SUMA NETTO:
            </td>
            <td style="padding:8px;border-top:2px solid ${grayBorder};font-size:${
          fontSize.medium
        };font-weight:700;text-align:right;color:${gold};">
              ${formatCurrency(machineRoomTotal)}
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding:6px;font-size:${
              fontSize.medium
            };font-weight:600;text-align:right;">
              VAT 23%:
            </td>
            <td style="padding:6px;font-size:${
              fontSize.medium
            };font-weight:600;text-align:right;">
              ${formatCurrency(machineRoomTotalBrutto - machineRoomTotal)}
            </td>
          </tr>
          <tr style="background:${tableHeaderBg};">
            <td colspan="2" style="padding:8px;border-top:2px solid ${gold};font-size:${
          fontSize.large
        };font-weight:700;text-align:right;color:${gold};">
              SUMA BRUTTO:
            </td>
            <td style="padding:8px;border-top:2px solid ${gold};font-size:${
          fontSize.large
        };font-weight:700;text-align:right;color:${gold};">
              ${formatCurrency(machineRoomTotalBrutto)}
            </td>
          </tr>
        </tbody>
      </table>
      <p style="font-size:${
        fontSize.small
      };color:${muted};margin:8px 0 0 0;font-style:italic;">
        * Ceny netto. Elementy oznaczone jako "W CENIE" wliczone w cenę pompy ciepła.
      </p>
    </div>
  `
      : "";

  // === Skład całości ===
  // Podziel buildingRows na 2 kolumny dla "Informacje o budynku"
  const buildingRowsHalf = Math.ceil(buildingRows.length / 2);
  const buildingRowsCol1 = buildingRows.slice(0, buildingRowsHalf);
  const buildingRowsCol2 = buildingRows.slice(buildingRowsHalf);

  // Decyzja: Profil energetyczny w 1 czy 2 kolumnach (jeśli więcej niż 6 wierszy, użyj 2 kolumn)
  const useTwoColumnsForProfile = safe(data.energy_profile_rows).length > 6;

  // Scal "Analiza strat ciepła" i "Rekomendowane modernizacje" w jedną sekcję
  const lossesAndImprovementsSection = `
    <div style="margin:10px 0;">
      <h2 style="font-size:${fontSize.large};font-weight:500;color:${grayText};margin:0 0 10px 0;padding:4px 0;border-bottom:2px solid ${gold};text-transform:uppercase;">Analiza strat ciepła i rekomendowane modernizacje</h2>

      <div style="margin:10px 0;">
        <h3 style="font-size:${fontSize.medium};font-weight:500;color:${grayText};margin:0 0 10px 0;padding:4px 0;border-bottom:1px solid ${grayBorder};text-transform:uppercase;">Analiza strat ciepła</h3>
        <table style="width:100%;border-collapse:collapse;font-size:${fontSize.medium};">
          <thead style="background:${tableHeaderBg};">
            <tr>
              <th style="text-align:left;padding:4px;border-bottom:1px solid ${grayBorder};font-size:${fontSize.medium};text-transform:uppercase;font-weight:500;">Element obudowy</th>
              <th style="text-align:right;padding:4px;border-bottom:1px solid ${grayBorder};font-size:${fontSize.medium};text-transform:uppercase;font-weight:500;">Udział strat</th>
            </tr>
          </thead>
          <tbody>${lossesRows}</tbody>
        </table>
      </div>

      <div>
        <h3 style="font-size:${fontSize.medium};font-weight:500;color:${grayText};margin:0 0 10px 0;padding:4px 0;border-bottom:1px solid ${grayBorder};text-transform:uppercase;">Rekomendowane modernizacje</h3>
        <ul style="margin:0;padding-left:14px;font-size:${fontSize.medium};">${improvements}</ul>
      </div>
    </div>`;

  return `
  <div style="
  font-family:'Inter','Arial',sans-serif;
  font-size:${fontSize.medium};
  color:${grayText};
  max-width:210mm;
  margin:0 auto;
  padding:3mm 5mm;
  background:#fff;
  line-height:1.4;
  letter-spacing:0.1px;
">
  <div style="
    border-top:2px solid ${gold};
    border-bottom:1px solid ${grayBorder};
    padding:4px 0;
    margin:10px 0;
    display:flex;
    justify-content:space-between;
    align-items:center;
  ">
    <div style="font-size:${
      fontSize.large
    };font-weight:500;letter-spacing:0.2px;">
      RAPORT CIEPLNY BUDYNKU | TOP-INSTAL INNOVATIONS
    </div>
    <div style="font-size:${
      fontSize.small
    };color:${muted};text-transform:none;">
      ${date}
    </div>
  </div>

    <!-- 1. PROFIL ENERGETYCZNY -->
    <div style="margin:10px 0;">
      <h3 style="font-size:${
        fontSize.large
      };font-weight:500;color:${grayText};margin:0 0 10px 0;padding:4px 0;border-bottom:2px solid ${gold};text-transform:uppercase;">Profil energetyczny budynku</h3>
      ${
        useTwoColumnsForProfile
          ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>
            <table style="width:100%;border-collapse:collapse;font-size:${fontSize.medium};table-layout:fixed;">${profileRowsCol1}</table>
          </div>
          <div>
            <table style="width:100%;border-collapse:collapse;font-size:${fontSize.medium};table-layout:fixed;">${profileRowsCol2}</table>
          </div>
        </div>
      `
          : `
        <table style="width:100%;border-collapse:collapse;font-size:${fontSize.medium};table-layout:fixed;">${profileRows}</table>
      `
      }
    </div>

    <!-- 2. INFORMACJE O BUDYNKU -->
    <div style="margin:10px 0;">
      <h3 style="font-size:${
        fontSize.large
      };font-weight:500;color:${grayText};margin:0 0 10px 0;padding:4px 0;border-bottom:2px solid ${gold};text-transform:uppercase;">Informacje o budynku</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div>
          <table style="width:100%;border-collapse:collapse;font-size:${
            fontSize.medium
          };table-layout:fixed;">${buildingRowsCol1.join("")}</table>
        </div>
        <div>
          <table style="width:100%;border-collapse:collapse;font-size:${
            fontSize.medium
          };table-layout:fixed;">${buildingRowsCol2.join("")}</table>
        </div>
      </div>
    </div>

    <!-- 3. REKOMENDOWANA MOC POMPY CIEPŁA -->
    <h2 style="font-size:${
      fontSize.large
    };font-weight:500;color:${grayText};margin:10px 0;padding:4px 0;border-bottom:2px solid ${gold};text-transform:uppercase;">
      REKOMENDOWANA MOC POMPY CIEPŁA: ${data.recommended_power_kw || "?"} KW
    </h2>

    <!-- 4. MODELE + PUNKTY BIWALENTNE -->
    <div style="display:grid;grid-template-columns:58% 42%;gap:10px;margin:10px 0;">
      <!-- Lewa kolumna: Rekomendowana moc -->
      <div>
        <p style="margin:0 0 4px 0;color:${muted};font-size:${
    fontSize.small
  };">Dopasowane modele gwarantują stabilną, cichą i ekonomiczną pracę:</p>
        ${models}
      </div>

      <!-- Prawa kolumna: Punkty biwalentne -->
      <div>
        <h2 style="font-size:${
          fontSize.medium
        };font-weight:500;color:${grayText};margin:0 0 10px 0;padding:4px 0;border-bottom:2px solid ${gold};text-transform:uppercase;">Punkty biwalentne</h2>
        <table style="width:100%;border-collapse:collapse;font-size:${
          fontSize.medium
        };">
          <thead style="background:${tableHeaderBg};">
            <tr>
              <th style="text-align:left;padding:4px;border-bottom:1px solid ${grayBorder};font-size:${
    fontSize.medium
  };text-transform:uppercase;font-weight:500;">Temp.</th>
              <th style="text-align:right;padding:4px;border-bottom:1px solid ${grayBorder};font-size:${
    fontSize.medium
  };text-transform:uppercase;font-weight:500;">Moc</th>
            </tr>
          </thead>
          <tbody>${bivRows}</tbody>
        </table>
      </div>
    </div>

    <!-- 5. PORÓWNANIE KOSZTÓW OGRZEWANIA -->
    ${costsSection}

    <!-- 6. ANALIZA STRAT CIEPŁA I REKOMENDOWANE MODERNIZACJE -->
    ${lossesAndImprovementsSection}

    <!-- 7. MASZYNOWNIA - KOMPONENTY I CENY -->
    ${hydraulicsRecSection}
    ${machineRoomSection}

    <div style="margin:10px 0 0 0;border-top:2px solid ${gold};padding:4px 0;text-align:center;font-size:${
    fontSize.small
  };color:${muted};">
      TOP-INSTAL INNOVATIONS | www.topinstal.com.pl | tel. +48 XXX XXX XXX<br>
      <span style="font-size:${
        fontSize.small
      };color:#999;">Raport wygenerowany automatycznie – dane mają charakter szacunkowy i nie stanowią oferty handlowej.</span>
    </div>

  </div>`;
}

// Eksportuj funkcje do window
window.generateOfferPDF = generateOfferPDF;
window.createPDFContent = createPDFContent;
