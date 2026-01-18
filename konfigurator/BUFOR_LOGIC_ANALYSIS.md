# ANALIZA LOGIKI DOBORU BUFORA CO
## Wpływ wyborów w mini-formularzu na obliczenia

**Wersja:** 1.0
**Data:** 2025-01-XX
**Przeznaczenie:** Dokumentacja techniczna dla inżynierów HVAC
**Autor:** Analiza systemu HeatPump Pro XX

---

## SPIS TREŚCI

1. [Wprowadzenie](#wprowadzenie)
2. [Struktura mini-formularza](#struktura-mini-formularza)
3. [Komponenty obliczeniowe bufora](#komponenty-obliczeniowe-bufora)
4. [Szczegółowa analiza opcji](#szczegółowa-analiza-opcji)
5. [Wzory matematyczne](#wzory-matematyczne)
6. [Flow decyzyjny](#flow-decyzyjny)
7. [Parametry i wartości](#parametry-i-wartości)
8. [Przykłady obliczeń](#przykłady-obliczeń)
9. [Pytania do ekspertów HVAC](#pytania-do-ekspertów-hvac)
10. [Propozycje ulepszeń](#propozycje-ulepszeń)

---

## 1. WPROWADZENIE

### 1.1. Cel dokumentu

Dokument opisuje kompleksowo logikę doboru bufora CO w systemie HeatPump Pro XX, ze szczególnym uwzględnieniem wpływu wyborów użytkownika w mini-formularzu hydrauliki na końcowe obliczenia.

### 1.2. Architektura systemu

System doboru bufora opiera się na **trzech osiach decyzyjnych**:

- **OŚ A: FLOW_PROTECTION** — Ochrona minimalnego przepływu
- **OŚ B: HYDRAULIC_SEPARATION** — Separacja hydrauliczna
- **OŚ C: ENERGY_STORAGE** — Magazyn energii (anti-cycling)

### 1.3. Trzy typy rekomendacji

1. **NONE** — Brak bufora
2. **BUFOR_SZEREGOWO** — Bufor szeregowo z zaworem różnicowym (by-pass)
3. **BUFOR_RÓWNOLEGLE** — Bufor równolegle jako sprzęgło hydrauliczne

---

## 2. STRUKTURA MINI-FORMULARZA

### 2.1. Opcje w formularzu

Mini-formularz hydrauliki (`renderHydraulicsInputsGrid()`) zawiera **3 główne opcje**:

#### A. Siłowniki / sterowanie strefowe podłogówki
- **Pole:** `hydraulics-has-underfloor-actuators` (checkbox)
- **Widoczne gdy:** `heating_type === 'underfloor'` lub `'mixed'`
- **Domyślnie:** `false` (niezaznaczone)

#### B. Grzejniki wysokotemperaturowe (HT)
- **Pole:** `hydraulics-radiators-is-ht` (checkbox)
- **Widoczne gdy:** `heating_type === 'radiators'` lub `'mixed'`
- **Domyślnie:** `false` (niezaznaczone)

#### C. Biwalencja (drugie źródło ciepła)
- **Pole główne:** `hydraulics-bivalent-enabled` (checkbox)
- **Pole zależne:** `hydraulics-bivalent-source-type` (select)
  - Opcje: `"gas"`, `"solid_fuel"`, `"fireplace_water_jacket"`
- **Widoczne:** Zawsze
- **Domyślnie:** `false` (niezaznaczone)

---

## 3. KOMPONENTY OBLICZENIOWE BUFORA

### 3.1. Trzy komponenty objętości

System oblicza **trzy niezależne komponenty** objętości bufora:

#### V_antiCycling (V_anti)
**Cel:** Ochrona przed taktowaniem pompy (short-cycling)

**Wzór:**
```
V_anti = (P_min × t_min) / (c_w × ΔT)
```

Gdzie:
- `P_min` = minimalna moc pompy [kW] = `pumpPower × 0.35` (35% mocy nominalnej)
- `t_min` = minimalny czas pracy pompy [min] = **12 minut** (zakres: 10-15)
- `c_w` = ciepło właściwe wody [kWh/(m³·K)] = **1.16**
- `ΔT` = różnica temperatur [K] = zależna od typu emitera (patrz sekcja 7)

**Uwagi:**
- Dla `underfloor`: ΔT = 5 K
- Dla `radiators_lt`: ΔT = 7 K
- Dla `radiators_ht`: ΔT = 7 K
- Dla `mixed`: ΔT = 5 K

#### V_bivalent (V_biv)
**Cel:** Magazyn ciepła dla drugiego źródła ciepła

**Wzory w zależności od typu:**

**Kocioł stałopalny:**
```
V_biv = secondaryPower × litersPerKw
```
- `secondaryPower` = moc kotła [kW] (domyślnie **20 kW** jeśli nie podano)
- `litersPerKw` = **60 l/kW** (zakres: 40-80 l/kW)

**Kominek z płaszczem wodnym:**
```
V_biv = max(minimum, secondaryPower × litersPerKw)
```
- `minimum` = **500 l**
- `secondaryPower` = moc kominka [kW] (domyślnie **15 kW** jeśli nie podano)
- `litersPerKw` = **50 l/kW**

**Kocioł gazowy:**
```
V_biv = 0 l
```
- Gaz może modulować, nie wymaga magazynu ciepła

#### V_hydraulic (V_hyd)
**Cel:** Uzupełnienie deficytu zładu instalacji

**Wzór:**
```
V_hyd = max(0, V_required - V_estimated)
```

Gdzie:
- `V_required` = wymagany zład [l] = `pumpPower × capacityPerKw[emitterType]`
- `V_estimated` = szacowany zład [l] = `heatedArea × systemVolumePerM2[emitterType]`

**Parametry `capacityPerKw`:**
- `underfloor`: 10 l/kW
- `radiators_lt`: 20 l/kW
- `radiators_ht`: 25 l/kW
- `radiators`: 20 l/kW
- `mixed`: 15 l/kW

**Parametry `systemVolumePerM2`:**
- `underfloor`: 0.95 l/m²
- `radiators_lt`: 0.6 l/m²
- `radiators_ht`: 0.9 l/m²
- `radiators`: 0.6 l/m²
- `mixed`: 0.9 l/m² (średnia ważona 50/50)

### 3.2. Objętość końcowa

**Wzór końcowy:**
```
V_recommended = max(V_anti, V_biv, V_hyd)
```

**Zaokrąglenie:**
Objętość jest zaokrąglana do najbliższej dostępnej pojemności rynkowej:
`[50, 80, 100, 120, 150, 200, 300, 400, 500, 800, 1000]` litrów

---

## 4. SZCZEGÓŁOWA ANALIZA OPCJI

### 4.1. OPCJA A: Siłowniki / sterowanie strefowe podłogówki

#### 4.1.1. Wpływ na logikę

**Gdy zaznaczone (`has_underfloor_actuators = true`):**
- `flow_protection = 'REQUIRED'`
- Dodaje `reason_code: 'FLOW_RISK_UNDERFLOOR_ACTUATORS'`

**Gdy niezaznaczone:**
- `flow_protection = 'NONE'`

#### 4.1.2. Uzasadnienie

Gdy wszystkie pętle podłogówki są zamknięte (np. wszystkie termostaty pokojowe wyłączone), pompa może pracować bez przepływu, co prowadzi do:
- Przegrzania pompy
- Uszkodzenia sprężarki
- Skrócenia żywotności

#### 4.1.3. Wpływ na rekomendację

**Bezpośredni wpływ:**
- **NIE wymusza** bezpośrednio bufora
- Wymaga **ochrony przepływu** (może być separator lub bufor)

**Pośredni wpływ:**
- Jeśli `heating_type = 'mixed'` → `hydraulic_separation = 'REQUIRED'` → bufor równoległy
- Jeśli `heating_type = 'underfloor'` → może wymagać bufora jako zabezpieczenia przepływu (minimum 50 l)

#### 4.1.4. Przykład

**Scenariusz:**
- `heating_type = 'underfloor'`
- `has_underfloor_actuators = true`
- `pumpPower = 10 kW`
- `heatedArea = 150 m²`
- `designHeatLoss = 8 kW`

**Obliczenia:**
- `flow_protection = 'REQUIRED'`
- `V_anti = (10 × 0.35 × 12) / (1.16 × 5) = 42 / 5.8 = 7.24 l` → **50 l** (zaokrąglone)
- `V_hyd = max(0, (10 × 10) - (150 × 0.95)) = max(0, 100 - 142.5) = 0 l`
- `V_biv = 0 l` (brak drugiego źródła)

**Wynik:**
- `V_recommended = max(50, 0, 0) = 50 l`
- `recommendation = 'BUFOR_SZEREGOWO'` (zawór różnicowy)

---

### 4.2. OPCJA B: Grzejniki wysokotemperaturowe (HT)

#### 4.2.1. Wpływ na logikę

**Gdy zaznaczone (`radiators_is_ht = true`):**
- `energy_storage = 'MANDATORY'` (zawsze wymagany bufor)
- Dodaje `reason_code: 'LOW_LOAD_HT_RADIATORS_KILLER'`

**Gdy niezaznaczone:**
- `radiators_is_ht = false`
- Brak wymuszenia bufora (tylko jeśli inne warunki nie wymuszają)

#### 4.2.2. Uzasadnienie

Grzejniki wysokotemperaturowe (stalowe/żeliwne) wymagają wyższych temperatur zasilania, co prowadzi do:
- Wyższego ryzyka taktowania pompy
- Większych wymagań hydraulicznych
- Potrzeby stabilizacji pracy systemu

#### 4.2.3. Killer Case

**Warunki killer case:**
```
isLowLoad = (pump_min_modulation_kw > designHeatLoss_kW)
isKillerCase = (radiators_is_ht && isLowLoad)
```

**Gdy killer case:**
- `energy_storage = 'MANDATORY'`
- Minimum **150 l** (z `killerCase.minimumCapacity`)

#### 4.2.4. Wpływ na obliczenia

**Parametry zmienione:**
- `emitterType` zmienia się z `'radiators_lt'` na `'radiators_ht'`
- `capacityPerKw` zmienia się z **20 l/kW** na **25 l/kW**
- `systemVolumePerM2` zmienia się z **0.6 l/m²** na **0.9 l/m²**
- `deltaT` pozostaje **7 K** (bez zmian)

#### 4.2.5. Przykład

**Scenariusz:**
- `heating_type = 'radiators'`
- `radiators_is_ht = true`
- `pumpPower = 12 kW`
- `pump_min_modulation = 12 × 0.35 = 4.2 kW`
- `designHeatLoss = 3.5 kW` (niskie obciążenie!)
- `heatedArea = 120 m²`

**Obliczenia:**
- `isLowLoad = (4.2 > 3.5) = true` → **KILLER CASE**
- `energy_storage = 'MANDATORY'`
- `V_anti = (12 × 0.35 × 12) / (1.16 × 7) = 50.4 / 8.12 = 6.2 l` → **50 l**
- `V_required = 12 × 25 = 300 l`
- `V_estimated = 120 × 0.9 = 108 l`
- `V_hyd = max(0, 300 - 108) = 192 l`
- `V_biv = 0 l`

**Wynik:**
- `V_recommended = max(50, 0, 192) = 192 l`
- Minimum killer case: **150 l** → `V_final = max(192, 150) = 192 l` → **200 l** (zaokrąglone)
- `recommendation = 'BUFOR_RÓWNOLEGLE'` (sprzęgło hydrauliczne)

---

### 4.3. OPCJA C: Biwalencja (drugie źródło ciepła)

#### 4.3.1. Typy źródeł

**A. Kocioł gazowy (`gas`)**

**Wpływ:**
- `V_biv = 0 l` (gaz może modulować)
- `hydraulic_separation = 'REQUIRED'`
- `energy_storage = 'MANDATORY'` (bufor wymagany dla stabilności)

**Uzasadnienie:**
- Gaz może pracować równolegle z pompą
- Bufor zapewnia separację hydrauliczną i stabilność pracy
- Objętość bufora obliczana z `V_anti` i `V_hyd` (nie z `V_biv`)

**Przykład:**
- `pumpPower = 10 kW`
- `designHeatLoss = 8 kW`
- `heatedArea = 150 m²`
- `heating_type = 'radiators'`

**Obliczenia:**
- `V_biv = 0 l`
- `V_anti = (10 × 0.35 × 12) / (1.16 × 7) = 42 / 8.12 = 5.2 l` → **50 l**
- `V_hyd = max(0, (10 × 20) - (150 × 0.6)) = max(0, 200 - 90) = 110 l`

**Wynik:**
- `V_recommended = max(50, 0, 110) = 110 l` → **120 l** (zaokrąglone)
- `recommendation = 'BUFOR_RÓWNOLEGLE'` (sprzęgło hydrauliczne)

---

**B. Kocioł stałopalny (`solid_fuel`)**

**Wpływ:**
- `V_biv = secondaryPower × 60 l/kW`
- `hydraulic_separation = 'REQUIRED'`
- `energy_storage = 'MANDATORY'`
- Dodaje `reason_code: 'BIVALENT_SOLID_FUEL'`

**Uzasadnienie:**
- Kocioł stałopalny nie może modulować
- Wymaga magazynu ciepła (40-80 l/kW, średnio 60 l/kW)
- Wymagana separacja hydrauliczna (bezpieczeństwo)

**Problem:**
- **Brak pola do wprowadzenia mocy kotła!**
- Domyślnie używa **20 kW** → `V_biv = 20 × 60 = 1200 l` → **1000 l** (zaokrąglone)

**Przykład (z domyślną mocą):**
- `secondaryPower = 20 kW` (domyślnie)
- `V_biv = 20 × 60 = 1200 l` → **1000 l**

**Przykład (z rzeczywistą mocą 8 kW):**
- `secondaryPower = 8 kW`
- `V_biv = 8 × 60 = 480 l` → **500 l**

---

**C. Kominek z płaszczem wodnym (`fireplace_water_jacket`)**

**Wpływ:**
- `V_biv = max(500, secondaryPower × 50 l/kW)`
- `hydraulic_separation = 'REQUIRED'`
- `energy_storage = 'MANDATORY'`
- Dodaje `reason_code: 'BIVALENT_FIREPLACE_WATER_JACKET'`

**Uzasadnienie:**
- Kominek wymaga minimum 500 l magazynu
- Dodatkowo skalowanie z mocą (50 l/kW)

**Problem:**
- **Brak pola do wprowadzenia mocy kominka!**
- Domyślnie używa **15 kW** → `V_biv = max(500, 15 × 50) = max(500, 750) = 750 l` → **800 l**

**Przykład (z domyślną mocą):**
- `secondaryPower = 15 kW` (domyślnie)
- `V_biv = max(500, 15 × 50) = max(500, 750) = 750 l` → **800 l**

**Przykład (z rzeczywistą mocą 10 kW):**
- `secondaryPower = 10 kW`
- `V_biv = max(500, 10 × 50) = max(500, 500) = 500 l` → **500 l**

---

## 5. WZORY MATEMATYCZNE

### 5.1. V_antiCycling (ochrona przed taktowaniem)

```
V_anti = (P_min × t_min) / (c_w × ΔT)
```

**Parametry:**
- `P_min = pumpPower × minModulationPercent` [kW]
- `t_min = 12` [min] (zakres: 10-15)
- `c_w = 1.16` [kWh/(m³·K)]
- `ΔT` [K] - zależne od typu emitera

**Konwersja jednostek:**
```
V_anti [l] = (P_min [kW] × t_min [min] × 60 [s/min]) / (c_w [kWh/(m³·K)] × 1000 [l/m³] × ΔT [K] × 3600 [s/h])
```

**Uproszczony wzór:**
```
V_anti [l] = (P_min [kW] × t_min [min]) / (1.16 × ΔT [K]) × 1000
```

### 5.2. V_bivalent (magazyn dla drugiego źródła)

**Kocioł stałopalny:**
```
V_biv [l] = secondaryPower [kW] × 60 [l/kW]
```

**Kominek:**
```
V_biv [l] = max(500 [l], secondaryPower [kW] × 50 [l/kW])
```

**Gaz:**
```
V_biv [l] = 0
```

### 5.3. V_hydraulic (deficyt zładu)

```
V_required [l] = pumpPower [kW] × capacityPerKw [l/kW]
V_estimated [l] = heatedArea [m²] × systemVolumePerM2 [l/m²]
V_hyd [l] = max(0, V_required - V_estimated)
```

### 5.4. V_recommended (końcowa rekomendacja)

```
V_recommended [l] = max(V_anti, V_biv, V_hyd)
V_final [l] = roundToMarketSize(V_recommended)
```

**Zaokrąglenie:**
```
roundToMarketSize(V) = argmin_{s ∈ availableSizes} |s - V|
```

Gdzie `availableSizes = [50, 80, 100, 120, 150, 200, 300, 400, 500, 800, 1000]`

---

## 6. FLOW DECYZYJNY

### 6.1. Diagram decyzyjny (3 osie)

```
                    ┌─────────────────────────────────┐
                    │   MINI-FORMULARZ HYDRAULIKI    │
                    └─────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
   OŚ A: FLOW          OŚ B: SEPARATION      OŚ C: STORAGE
   PROTECTION          HYDRAULIC            ENERGY
        │                     │                     │
        │                     │                     │
   ┌────┴────┐          ┌────┴────┐          ┌────┴────┐
   │  NONE   │          │  NONE   │          │  NONE   │
   │ REQUIRED│          │REQUIRED  │          │OPTIONAL │
   │         │          │          │          │MANDATORY│
   └────┬────┘          └────┬────┘          └────┬────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  SYNTEZA → 3    │
                    │   TYPY BUFORA   │
                    └─────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
    NONE              BUFOR_SZEREGOWO      BUFOR_RÓWNOLEGLE
    (brak)            (z by-passem)        (sprzęgło)
```

### 6.2. Logika syntezy

**Krok 1: Określenie wymagań**

```javascript
if (energy_storage === 'MANDATORY') {
  if (hydraulic_separation === 'REQUIRED') {
    recommendation = 'BUFOR_RÓWNOLEGLE';
  } else {
    recommendation = 'BUFOR_SZEREGOWO';
  }
} else if (hydraulic_separation === 'REQUIRED' && energy_storage === 'NONE') {
  recommendation = 'SEPARATOR_ONLY'; // Tylko separator, bez bufora
} else if (flow_protection !== 'NONE' && hydraulic_separation === 'NONE' && energy_storage === 'NONE') {
  recommendation = 'FLOW_PROTECTION_DEVICE'; // Minimum 50L z zaworem różnicowym
} else if (energy_storage === 'OPTIONAL') {
  recommendation = hydraulic_separation === 'REQUIRED' ? 'SEPARATOR_ONLY' : 'NONE';
} else {
  recommendation = 'NONE';
}
```

**Krok 2: Obliczenie pojemności**

```javascript
if (recommendation !== 'NONE') {
  V_recommended = max(V_anti, V_biv, V_hyd);

  // Minimum dla równoległego
  if (recommendation === 'BUFOR_RÓWNOLEGLE') {
    V_recommended = max(V_recommended, 100);
  }

  // Minimum dla szeregowego
  if (recommendation === 'BUFOR_SZEREGOWO') {
    V_recommended = max(V_recommended, 50);
  }

  V_final = roundToMarketSize(V_recommended);
}
```

### 6.3. Tabela decyzyjna

| flow_protection | hydraulic_separation | energy_storage | recommendation | min_volume |
|-----------------|---------------------|----------------|----------------|------------|
| NONE | NONE | NONE | NONE | 0 |
| NONE | NONE | OPTIONAL | NONE | 0 |
| NONE | NONE | MANDATORY | BUFOR_SZEREGOWO | 50 |
| NONE | REQUIRED | NONE | SEPARATOR_ONLY | 0 |
| NONE | REQUIRED | OPTIONAL | SEPARATOR_ONLY | 0 |
| NONE | REQUIRED | MANDATORY | BUFOR_RÓWNOLEGLE | 100 |
| REQUIRED | NONE | NONE | FLOW_PROTECTION_DEVICE | 50 |
| REQUIRED | NONE | OPTIONAL | FLOW_PROTECTION_DEVICE | 50 |
| REQUIRED | NONE | MANDATORY | BUFOR_SZEREGOWO | 50 |
| REQUIRED | REQUIRED | NONE | BUFOR_RÓWNOLEGLE | 100 |
| REQUIRED | REQUIRED | OPTIONAL | BUFOR_RÓWNOLEGLE | 100 |
| REQUIRED | REQUIRED | MANDATORY | BUFOR_RÓWNOLEGLE | 100 |

---

## 7. PARAMETRY I WARTOŚCI

### 7.1. Parametry z `buffer-rules.json`

#### capacityPerKw [l/kW]
Minimalny wymagany zład wody instalacji dla każdego typu emitera:

| Typ emitera | Wartość [l/kW] | Uwagi |
|-------------|----------------|-------|
| `underfloor` | 10 | Podłogówka |
| `radiators_lt` | 20 | Grzejniki niskotemperaturowe |
| `radiators_ht` | 25 | Grzejniki wysokotemperaturowe |
| `radiators` | 20 | Domyślne (bez rozróżnienia) |
| `mixed` | 15 | Średnia ważona |

#### systemVolumePerM2 [l/m²]
Szacowany zład wody instalacji na m²:

| Typ emitera | Wartość [l/m²] | Uwagi |
|-------------|----------------|-------|
| `underfloor` | 0.95 | Podłogówka |
| `radiators_lt` | 0.6 | Grzejniki niskotemperaturowe (alu/płytowe) |
| `radiators_ht` | 0.9 | Grzejniki wysokotemperaturowe (stalowe/żeliwne) |
| `radiators` | 0.6 | Domyślne |
| `mixed` | 0.9 | Średnia ważona 50/50 |

#### bivalentStorage
Reguły doboru pojemności bufora dla systemów bivalent:

| Typ źródła | Parametr | Wartość | Uwagi |
|------------|-----------|---------|-------|
| `solid_fuel_boiler` | `litersPerKw` | 60 [l/kW] | Zakres: 40-80 l/kW |
| `fireplace_back_boiler` | `minimum` | 500 [l] | Minimum bezwzględne |
| `fireplace_back_boiler` | `litersPerKw` | 50 [l/kW] | Skalowanie z mocą |
| `gas_boiler` | `litersPerKw` | 0 | Gaz nie wymaga magazynu |

#### antiCyclingDefaults
Domyślne parametry dla obliczania objętości anti-cycling:

| Parametr | Wartość | Zakres | Uwagi |
|----------|---------|--------|-------|
| `t_min_minutes` | 12 [min] | 10-15 | Minimalny czas pracy pompy |
| `deltaT_K` | 7 [K] | 5-10 | Domyślna różnica temperatur |
| `minModulationPercent` | 0.35 | - | 35% mocy nominalnej |
| `waterSpecificHeat` | 1.16 [kWh/(m³·K)] | - | Ciepło właściwe wody |

#### deltaT_by_type [K]
Różnica temperatur w zależności od typu emitera:

| Typ emitera | Wartość [K] | Uwagi |
|-------------|-------------|-------|
| `underfloor` | 5 | Podłogówka (niższa temperatura) |
| `radiators_lt` | 7 | Grzejniki niskotemperaturowe |
| `radiators_ht` | 7 | Grzejniki wysokotemperaturowe |
| `radiators` | 7 | Domyślne |
| `mixed` | 5 | Średnia ważona |

### 7.2. Parametry hardcoded (nie w JSON)

| Parametr | Wartość | Lokalizacja | Uwagi |
|----------|---------|-------------|-------|
| `secondaryPower` (domyślnie dla solid_fuel) | 20 [kW] | `buffer-engine.js:796` | **PROBLEM: brak pola w UI** |
| `secondaryPower` (domyślnie dla fireplace) | 15 [kW] | `buffer-engine.js:796` | **PROBLEM: brak pola w UI** |
| `minSeriesBuffer` | 50 [l] | `buffer-engine.js:410` | Minimum dla bufora szeregowego |
| `minParallelBuffer` | 100 [l] | `buffer-engine.js:455` | Minimum dla bufora równoległego |
| `killerCase.minimumCapacity` | 150 [l] | `buffer-rules.json:103` | Minimum dla killer case |

### 7.3. Dostępne pojemności rynkowe

```
[50, 80, 100, 120, 150, 200, 300, 400, 500, 800, 1000] [l]
```

---

## 8. PRZYKŁADY OBLICZEŃ

### 8.1. Przykład 1: Podłogówka bez dodatkowych opcji

**Dane wejściowe:**
- `heating_type = 'underfloor'`
- `pumpPower = 10 kW`
- `designHeatLoss = 8 kW`
- `heatedArea = 150 m²`
- `has_underfloor_actuators = false`
- `radiators_is_ht = false` (nie dotyczy)
- `bivalent_enabled = false`

**Obliczenia:**
1. `flow_protection = 'NONE'`
2. `hydraulic_separation = 'NONE'`
3. `energy_storage = 'NONE'` (brak wymuszeń)
4. `P_min = 10 × 0.35 = 3.5 kW`
5. `V_anti = (3.5 × 12) / (1.16 × 5) = 42 / 5.8 = 7.24 l` → **50 l**
6. `V_required = 10 × 10 = 100 l`
7. `V_estimated = 150 × 0.95 = 142.5 l`
8. `V_hyd = max(0, 100 - 142.5) = 0 l`
9. `V_biv = 0 l`
10. `V_recommended = max(50, 0, 0) = 50 l`

**Wynik:**
- `recommendation = 'NONE'` (zład wystarczający, brak wymuszeń)
- `buffer_liters = null`

---

### 8.2. Przykład 2: Grzejniki HT + niskie obciążenie (killer case)

**Dane wejściowe:**
- `heating_type = 'radiators'`
- `pumpPower = 12 kW`
- `pump_min_modulation = 12 × 0.35 = 4.2 kW`
- `designHeatLoss = 3.5 kW` (niskie obciążenie!)
- `heatedArea = 120 m²`
- `radiators_is_ht = true` ← **KILLER CASE**
- `bivalent_enabled = false`

**Obliczenia:**
1. `isLowLoad = (4.2 > 3.5) = true`
2. `isKillerCase = (radiators_is_ht && isLowLoad) = true`
3. `energy_storage = 'MANDATORY'`
4. `hydraulic_separation = 'NONE'`
5. `emitterType = 'radiators_ht'`
6. `V_anti = (4.2 × 12) / (1.16 × 7) = 50.4 / 8.12 = 6.2 l` → **50 l**
7. `V_required = 12 × 25 = 300 l`
8. `V_estimated = 120 × 0.9 = 108 l`
9. `V_hyd = max(0, 300 - 108) = 192 l`
10. `V_biv = 0 l`
11. `V_recommended = max(50, 0, 192) = 192 l`
12. Minimum killer case: **150 l** → `V_final = max(192, 150) = 192 l` → **200 l**

**Wynik:**
- `recommendation = 'BUFOR_SZEREGOWO'`
- `buffer_liters = 200 l`
- `reason_codes = ['LOW_LOAD_HT_RADIATORS_KILLER']`

---

### 8.3. Przykład 3: Kocioł stałopalny (z domyślną mocą)

**Dane wejściowe:**
- `heating_type = 'radiators'`
- `pumpPower = 10 kW`
- `designHeatLoss = 8 kW`
- `heatedArea = 150 m²`
- `bivalent_enabled = true`
- `bivalent_source_type = 'solid_fuel'`
- `secondaryPower = 20 kW` ← **DOMYŚLNIE (brak pola w UI!)**

**Obliczenia:**
1. `hydraulic_separation = 'REQUIRED'`
2. `energy_storage = 'MANDATORY'`
3. `V_biv = 20 × 60 = 1200 l` ← **ZA DUŻO!**
4. `V_anti = (10 × 0.35 × 12) / (1.16 × 7) = 42 / 8.12 = 5.2 l` → **50 l**
5. `V_hyd = max(0, (10 × 20) - (150 × 0.6)) = max(0, 200 - 90) = 110 l`
6. `V_recommended = max(50, 1200, 110) = 1200 l` → **1000 l**

**Wynik:**
- `recommendation = 'BUFOR_RÓWNOLEGLE'`
- `buffer_liters = 1000 l` ← **NIERACJONALNIE DUŻO!**

**Problem:**
- Brak pola do wprowadzenia rzeczywistej mocy kotła
- Domyślna wartość 20 kW jest za duża dla większości przypadków

---

### 8.4. Przykład 4: Kominek z płaszczem (z domyślną mocą)

**Dane wejściowe:**
- `heating_type = 'radiators'`
- `pumpPower = 10 kW`
- `bivalent_enabled = true`
- `bivalent_source_type = 'fireplace_water_jacket'`
- `secondaryPower = 15 kW` ← **DOMYŚLNIE (brak pola w UI!)**

**Obliczenia:**
1. `V_biv = max(500, 15 × 50) = max(500, 750) = 750 l` → **800 l**

**Wynik:**
- `buffer_liters = 800 l`

**Problem:**
- Brak pola do wprowadzenia rzeczywistej mocy kominka
- Domyślna wartość 15 kW może być za duża

---

### 8.5. Przykład 5: Gaz jako drugie źródło

**Dane wejściowe:**
- `heating_type = 'radiators'`
- `pumpPower = 10 kW`
- `designHeatLoss = 8 kW`
- `heatedArea = 150 m²`
- `bivalent_enabled = true`
- `bivalent_source_type = 'gas'`

**Obliczenia:**
1. `hydraulic_separation = 'REQUIRED'`
2. `energy_storage = 'MANDATORY'`
3. `V_biv = 0 l` (gaz nie wymaga magazynu)
4. `V_anti = (10 × 0.35 × 12) / (1.16 × 7) = 5.2 l` → **50 l**
5. `V_hyd = max(0, (10 × 20) - (150 × 0.6)) = 110 l`
6. `V_recommended = max(50, 0, 110) = 110 l` → **120 l**

**Wynik:**
- `recommendation = 'BUFOR_RÓWNOLEGLE'`
- `buffer_liters = 120 l`
- Bufor wymagany dla stabilności i separacji (nie dla magazynu)

---

## 9. PYTANIA DO EKSPERTÓW HVAC

### 9.1. Parametry anti-cycling

**Pytanie 1:** Czy minimalny czas pracy pompy `t_min = 12 minut` jest odpowiedni dla wszystkich modeli pomp?
- **Aktualna wartość:** 12 min (zakres: 10-15)
- **Prośba:** Weryfikacja dla różnych modeli/seri pomp

**Pytanie 2:** Czy różnica temperatur `ΔT` jest poprawnie dobrana dla każdego typu emitera?
- **Aktualne wartości:**
  - `underfloor`: 5 K
  - `radiators_lt/ht`: 7 K
  - `mixed`: 5 K
- **Prośba:** Weryfikacja i ewentualne korekty

**Pytanie 3:** Czy minimalna modulacja `35%` mocy nominalnej jest odpowiednia?
- **Aktualna wartość:** 0.35 (35%)
- **Prośba:** Weryfikacja dla różnych modeli pomp (może być różna per model?)

---

### 9.2. Parametry bivalent storage

**Pytanie 4:** Czy współczynnik `60 l/kW` dla kotła stałopalnego jest odpowiedni?
- **Aktualna wartość:** 60 l/kW (zakres: 40-80 l/kW)
- **Prośba:** Weryfikacja zakresu i wartości średniej

**Pytanie 5:** Czy minimum `500 l` dla kominka z płaszczem jest odpowiednie?
- **Aktualna wartość:** 500 l
- **Prośba:** Weryfikacja minimum bezwzględnego

**Pytanie 6:** Czy współczynnik `50 l/kW` dla kominka jest odpowiedni?
- **Aktualna wartość:** 50 l/kW
- **Prośba:** Weryfikacja i ewentualne korekty

**Pytanie 7:** Jak powinna być określana moc drugiego źródła?
- **Aktualny problem:** Brak pola w UI, używa domyślnych wartości (20 kW dla kotła, 15 kW dla kominka)
- **Prośba:**
  - Czy dodać pole do wprowadzenia mocy?
  - Czy użyć procentu mocy pompy jako referencji?
  - Czy są inne metody określenia mocy?

---

### 9.3. Parametry hydraulic volume

**Pytanie 8:** Czy wartości `capacityPerKw` są odpowiednie?
- **Aktualne wartości:**
  - `underfloor`: 10 l/kW
  - `radiators_lt`: 20 l/kW
  - `radiators_ht`: 25 l/kW
  - `mixed`: 15 l/kW
- **Prośba:** Weryfikacja i ewentualne korekty

**Pytanie 9:** Czy wartości `systemVolumePerM2` są odpowiednie?
- **Aktualne wartości:**
  - `underfloor`: 0.95 l/m²
  - `radiators_lt`: 0.6 l/m²
  - `radiators_ht`: 0.9 l/m²
  - `mixed`: 0.9 l/m²
- **Prośba:** Weryfikacja i ewentualne korekty

---

### 9.4. Logika decyzyjna

**Pytanie 10:** Czy logika dla gazu jako drugiego źródła jest poprawna?
- **Aktualna logika:** `V_biv = 0`, ale `energy_storage = 'MANDATORY'` (bufor wymagany dla stabilności)
- **Prośba:** Weryfikacja czy bufor jest zawsze wymagany, czy tylko w określonych warunkach

**Pytanie 11:** Czy killer case (niskie obciążenie + HT radiators) jest poprawnie zdefiniowany?
- **Aktualne warunki:**
  - `isLowLoad = (pump_min_modulation > designHeatLoss)`
  - `isKillerCase = (radiators_is_ht && isLowLoad)`
  - Minimum: 150 l
- **Prośba:** Weryfikacja warunków i minimum

**Pytanie 12:** Czy minimum dla bufora szeregowego (50 l) i równoległego (100 l) są odpowiednie?
- **Aktualne wartości:**
  - Szeregowy: 50 l
  - Równoległy: 100 l
- **Prośba:** Weryfikacja minimum

---

### 9.5. Siłowniki podłogówki

**Pytanie 13:** Czy logika dla siłowników podłogówki jest poprawna?
- **Aktualna logika:** `flow_protection = 'REQUIRED'`, ale nie wymusza bezpośrednio bufora
- **Prośba:**
  - Czy zawsze wymaga bufora jako zabezpieczenia?
  - Czy separator hydrauliczny wystarczy?
  - Jaka powinna być minimalna pojemność?

---

### 9.6. Grzejniki wysokotemperaturowe

**Pytanie 14:** Czy grzejniki HT zawsze wymagają bufora?
- **Aktualna logika:** `energy_storage = 'MANDATORY'` (zawsze wymagany)
- **Prośba:** Weryfikacja czy zawsze, czy tylko w określonych warunkach

**Pytanie 15:** Czy różnica w parametrach między `radiators_lt` a `radiators_ht` jest odpowiednia?
- **Różnice:**
  - `capacityPerKw`: 20 vs 25 l/kW
  - `systemVolumePerM2`: 0.6 vs 0.9 l/m²
  - `deltaT`: 7 K (bez zmian)
- **Prośba:** Weryfikacja różnic

---

## 10. PROPOZYCJE ULEPSZEŃ

### 10.1. Dodanie pola do wprowadzenia mocy drugiego źródła

**Problem:**
- Brak pola w UI do wprowadzenia mocy kotła/kominka
- Używa domyślnych wartości (20 kW dla kotła, 15 kW dla kominka)
- Prowadzi do nieracjonalnie dużych pojemności (1000 l, 800 l)

**Propozycja:**
1. Dodać pole numeryczne `secondary_source_power_kw` w mini-formularzu
2. Pole widoczne tylko gdy `bivalent_enabled = true` i typ to `solid_fuel` lub `fireplace_water_jacket`
3. Domyślna wartość: użyć procentu mocy pompy (np. 80% dla kotła, 60% dla kominka)

**Alternatywa:**
- Użyć mocy pompy jako referencji: `secondaryPower = pumpPower × factor`
- `factor` = 0.8 dla kotła, 0.6 dla kominka

---

### 10.2. Parametryzacja wartości domyślnych

**Problem:**
- Wartości domyślne są hardcoded w kodzie
- Trudne do zmiany bez modyfikacji kodu

**Propozycja:**
1. Przenieść wartości domyślne do `buffer-rules.json`:
   ```json
   "bivalentStorage": {
     "solid_fuel_boiler": {
       "litersPerKw": 60,
       "defaultPower_kw": 20,
       "defaultPowerFactor": 0.8
     },
     "fireplace_back_boiler": {
       "minimum": 500,
       "litersPerKw": 50,
       "defaultPower_kw": 15,
       "defaultPowerFactor": 0.6
     }
   }
   ```

---

### 10.3. Ulepszenie logiki dla gazu

**Problem:**
- Gaz zawsze wymusza bufor (MANDATORY)
- Może być zbyt konserwatywne

**Propozycja:**
1. Sprawdzić czy bufor jest rzeczywiście zawsze wymagany
2. Może tylko w określonych warunkach (np. równoległa praca, niestabilność)
3. Dodać warunki do `buffer-rules.json`

---

### 10.4. Ulepszenie killer case

**Problem:**
- Warunki killer case mogą być zbyt restrykcyjne lub zbyt liberalne
- Minimum 150 l może być nieodpowiednie

**Propozycja:**
1. Weryfikacja warunków z ekspertami HVAC
2. Możliwość parametryzacji w `buffer-rules.json`:
   ```json
   "killerCase": {
     "conditions": {
       "emitterType": "radiators_ht",
       "designHeatLoss_kW_max": 5,
       "loadRatio_min": 0.8
     },
     "minimumCapacity": 150
   }
   ```

---

### 10.5. Ulepszenie logiki dla siłowników

**Problem:**
- Siłowniki wymagają ochrony przepływu, ale nie jest jasne czy zawsze wymagają bufora

**Propozycja:**
1. Określić czy separator wystarczy, czy zawsze potrzebny bufor
2. Dodać do `buffer-rules.json`:
   ```json
   "flowProtection": {
     "underfloorActuators": {
       "requiresBuffer": true,
       "minimumCapacity": 50
     }
   }
   ```

---

### 10.6. Weryfikacja parametrów per model pompy

**Problem:**
- Wszystkie pompy używają tych samych parametrów (35% modulacji, 12 min czas pracy)
- Różne modele mogą mieć różne parametry

**Propozycja:**
1. Dodać parametry per model do `pumpMatchingTable.js`:
   ```javascript
   {
     "KIT-WC09K3E5": {
       "minModulationPercent": 0.30,
       "minRuntimeMinutes": 10,
       // ...
     }
   }
   ```

2. Używać parametrów z tabeli, fallback do domyślnych z `buffer-rules.json`

---

## 11. PODSUMOWANIE

### 11.1. Główne problemy

1. **Brak pola do wprowadzenia mocy drugiego źródła** → prowadzi do nieracjonalnie dużych pojemności
2. **Hardcoded wartości domyślne** → trudne do zmiany bez modyfikacji kodu
3. **Brak weryfikacji parametrów** → wartości mogą być nieodpowiednie dla wszystkich przypadków
4. **Jednolite parametry dla wszystkich pomp** → różne modele mogą wymagać różnych parametrów

### 11.2. Priorytety ulepszeń

**P0 (Krytyczne):**
- Dodanie pola do wprowadzenia mocy drugiego źródła
- Weryfikacja parametrów bivalent storage z ekspertami HVAC

**P1 (Wysokie):**
- Parametryzacja wartości domyślnych w JSON
- Weryfikacja parametrów anti-cycling
- Weryfikacja logiki dla gazu

**P2 (Średnie):**
- Ulepszenie killer case
- Weryfikacja logiki dla siłowników
- Parametry per model pompy

---

## 12. ZAŁĄCZNIKI

### 12.1. Lokalizacja plików

- **Logika obliczeń:** `main/konfigurator/buffer-engine.js`
- **Reguły (JSON):** `main/konfigurator/rules/buffer-rules.json`
- **UI formularza:** `main/konfigurator/configurator-unified.js` (funkcja `renderHydraulicsInputsGrid()`)

### 12.2. Kluczowe funkcje

- `calculateBufferSizeComponents()` — oblicza V_anti, V_biv, V_hyd
- `calculateFinalBufferRecommendation()` — synteza końcowej rekomendacji
- `computeHydraulicsRecommendation()` — główna funkcja decyzyjna (3 osie)

### 12.3. Słownik pojęć

- **V_anti** — objętość anti-cycling (ochrona przed taktowaniem)
- **V_biv** — objętość bivalent storage (magazyn dla drugiego źródła)
- **V_hyd** — objętość hydraulic (deficyt zładu instalacji)
- **FLOW_PROTECTION** — ochrona minimalnego przepływu
- **HYDRAULIC_SEPARATION** — separacja hydrauliczna
- **ENERGY_STORAGE** — magazyn energii (anti-cycling)
- **BUFOR_SZEREGOWO** — bufor szeregowo z zaworem różnicowym (by-pass)
- **BUFOR_RÓWNOLEGLE** — bufor równolegle jako sprzęgło hydrauliczne

---

**Koniec dokumentu**
