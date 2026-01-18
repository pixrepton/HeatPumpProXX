<?php
/**
 * Template Name: Heat Pump Calculator
 * Shortcode: [heatpump_calc]
 *
 * WordPress integration for Heat Pump Calculator
 * Converts calculator.html to PHP with dynamic URL generation
 */

// Zabezpieczenie przed bezpośrednim dostępem
if (!defined('ABSPATH')) {
    exit;
}

// Pobierz bazowy URL do zasobów
// Jeśli zmienne nie zostały przekazane z głównego pliku wtyczki, oblicz je lokalnie (fallback)
if (!isset($kalkulator_url) || !isset($konfigurator_url) || !isset($img_url) || !isset($libraries_url)) {
    // Fallback: oblicz URL-e lokalnie (dla kompatybilności)
    // Jesteśmy już w main/, więc plugin_url wskazuje na main/
    $plugin_url = plugins_url('', dirname(__FILE__)); // Przejdź do katalogu main (głównego katalogu wtyczki)
    $base_url = $plugin_url;
    $kalkulator_url = $base_url . '/kalkulator';
    $konfigurator_url = $base_url . '/konfigurator';
    $img_url = $base_url . '/img';
    $libraries_url = $base_url . '/libraries';
    $instance_id = (function_exists('wp_generate_uuid4') ? wp_generate_uuid4() : uniqid('hp_', true));
}

// URL do zasobów "pictures" (historycznie trzymane w root strony). Unikamy hardcoded domeny produkcyjnej.
// Preferuj realną domenę WordPress, fallback: jeśli ktoś poda $pictures_url z zewnątrz.
if (!isset($pictures_url)) {
    $pictures_url = rtrim(get_site_url(), '/') . '/pictures';
}
?>
<!-- TOP-INSTAL Heat Pump Calculator - Shortcode Content -->
<!--
    Zgodnie z architekturą WordPress/Elementor:
    - calculator.php renderuje tylko HTML (bez inline CSS/JS)
    - CSS jest w osobnych plikach (wordpress-integration.css)
    - JS jest idempotentny i sprawdza czy kontener istnieje
-->
<div class="heatpump-calculator-wrapper heatpump-calculator" data-hp-instance="<?php echo esc_attr( $instance_id ); ?>">
    <!-- Konfiguracja standalone (zastępuje wp_localize_script) -->
    <!-- Konfiguracja przeniesiona do calculatorUI.js -->

    <!-- Option Cards JavaScript -->
    <!-- Option Cards przeniesione do calculatorUI.js -->

    <!-- HERO BANNER -->
    <section class="hero hero-hetzner" aria-label="Top-Instal - konfigurator">
      <!-- Obraz banera -->
      <div class="hero-media">
        <img src="<?php echo esc_url($img_url . '/header-image.png'); ?>" alt="Panasonic" loading="eager" />
      </div>

      <!-- Treść -->
      <div class="container hero-inner">
        <span class="hero-pill">TOP-INSTAL</span>
        <h1>KALKULATOR MOCY POMPY CIEPŁA</h1>
        <p class="hero-lead">
          Dobór mocy pompy ciepła jest kluczowy dla jej efektywnej pracy. Nowoczesne pompy
          automatycznie dostosowują wydajność do warunków zewnętrznych, obniżając moc nawet do 20%.
          Zbyt duża jednostka powoduje taktowanie, skraca żywotność i zwiększa rachunki. Aby
          urządzenie działało ekonomicznie, moc musi być dobrana precyzyjnie. Kalkulator
          wykorzystuje dane, które podasz — wprowadź je zgodnie z rzeczywistością.
        </p>
      </div>
    </section>

    <div id="top-instal-calc" class="wrapper">
      <!-- Progress Bar Container (wspólny dla wszystkich zakładek) -->
      <div class="progress-bar-container" id="progress-bar-container">
        <div class="form-progress hp-progress" id="global-progress-bar">
          <div class="form-progress-fill" id="top-progress-fill" style="width: 12%"></div>
        </div>
          <div class="progress-info-row hp-progress-info" id="global-progress-info">
          <div class="form-progress-percentage" id="progress-percentage">12%</div>
          <div class="form-progress-label" id="progress-label">Start / Wprowadzenie</div>
        </div>
      </div>
      <div class="progress-sticky-placeholder" id="progress-placeholder"></div>

      <!-- Formularz -->
      <form id="heatCalcFormFull" novalidate>
        <div class="section active" data-tab="0">
          <!-- Instrukcja + Dane -->
          <div class="formularz-z-mapa">
            <div class="formularz">
              <h3>INFORMACJE O BUDYNKU:</h3>
              <!-- Typ budynku -->
              <div class="form-row-mosaic form-card">
                <div class="form-field">
                  <div class="form-field-item">
                    <label for="building_type" class="form-label">Jaki to rodzaj budynku?</label>
                    <input
                      type="hidden"
                      id="building_type"
                      name="building_type"
                      value=""
                      required
                    />
                    <!-- Karty z ikonami - przechowują wartość building_type -->
                    <div class="building-type-cards">
                      <button
                        type="button"
                        class="building-type-card building-type-card--first"
                        data-value="single_house"
                        aria-label="Dom wolnostojący"
                        tabindex="0"
                      >
                        <div class="building-type-card__icon">
                          <img src="<?php echo esc_url($img_url . '/dom.png'); ?>" alt="Dom wolnostojący" width="80" height="80" />
                        </div>
                        <div class="building-type-card__label">Dom<br />wolnostojący</div>
                      </button>
                      <button
                        type="button"
                        class="building-type-card"
                        data-value="double_house"
                        aria-label="Bliźniak"
                        tabindex="0"
                      >
                        <div class="building-type-card__icon">
                          <img src="<?php echo esc_url($img_url . '/blizniak.png'); ?>" alt="Bliźniak" width="80" height="80" />
                        </div>
                        <div class="building-type-card__label">Bliźniak</div>
                      </button>
                      <button
                        type="button"
                        class="building-type-card"
                        data-value="row_house"
                        aria-label="Szeregowiec"
                        tabindex="0"
                      >
                        <div class="building-type-card__icon">
                          <img
                            src="<?php echo esc_url($img_url . '/szeregowiec.png'); ?>"
                            alt="Szeregowiec"
                            width="80"
                            height="80"
                          />
                        </div>
                        <div class="building-type-card__label">Szeregowiec</div>
                      </button>
                      <button
                        type="button"
                        class="building-type-card"
                        data-value="apartment"
                        aria-label="Mieszkanie"
                        tabindex="0"
                      >
                        <div class="building-type-card__icon">
                          <img
                            src="<?php echo esc_url($img_url . '/mieszkanie.png'); ?>"
                            alt="Mieszkanie"
                            width="80"
                            height="80"
                          />
                        </div>
                        <div class="building-type-card__label">Mieszkanie</div>
                      </button>
                    </div>
                  </div>

                  <div class="form-field-item form-field-item--subsequent">
                    <label for="construction_year" class="form-label">Rok budowy budynku</label>
                    <div class="construction-year-wrapper">
                      <select
                        id="construction_year"
                        name="construction_year"
                        required
                        class="form-select"
                        aria-describedby="construction-year-help"
                      >
                        <option value="">-- Wybierz --</option>
                        <option value="2025">2025 (nowy / w budowie)</option>
                        <option value="2021">2021–2024</option>
                        <option value="2011">2011–2020</option>
                        <option value="2000">2000–2010</option>
                        <option value="1990">1991–2000</option>
                        <option value="1980">1981–1990</option>
                        <option value="1970">1971–1980</option>
                        <option value="1960">1961–1970</option>
                        <option value="1950">1950–1960</option>
                        <option value="1940">1940–1949</option>
                        <option value="1939">przed 1939 (przed II wojną)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <!-- Help box -->
                <div class="help-box help-box--tip" id="building-type-help">
                  <h4><i class="ph ph-info"></i>Jak to działa?</h4>
                  <p>
                    W kilka minut poznasz zapotrzebowanie budynku na ciepło i odpowiednią moc pompy.
                  </p>
                  <p>
                    Wypełnij formularz krok po kroku – dokładniejsze dane to dokładniejszy wynik.
                  </p>
                  <p>Na końcu pobierzesz gotowy raport PDF z wynikami i rekomendacjami.</p>
                  <p><strong>Korzystasz swobodnie - bez rejestracji.</strong></p>
                </div>
              </div>

              <!-- Pola specjalne dla SZEREGOWCA (row_house) -->
              <div id="rowHouseFields" class="hidden">
                <h3>OTOCZENIE SZEREGOWCA:</h3>
                <div class="form-row-mosaic form-card">
                  <div class="form-field">
                    <div class="form-field-item">
                      <label class="form-label"
                        >Czy Twoje mieszkanie jest segmentem narożnym?</label
                      >
                      <p class="micro-note" style="margin: 4px 0 16px">
                        Segment narożny ma więcej przegród zewnętrznych, co wpływa na straty ciepła.
                      </p>
                      <input type="hidden" id="on_corner" name="on_corner" value="" />
                      <div class="yes-no-cards">
                        <button
                          type="button"
                          class="yes-no-card"
                          data-field="on_corner"
                          data-value="yes"
                          aria-label="Tak, segment narożny"
                          tabindex="0"
                        >
                          <span class="yes-no-card__label">Tak</span>
                        </button>
                        <button
                          type="button"
                          class="yes-no-card"
                          data-field="on_corner"
                          data-value="no"
                          aria-label="Nie, segment środkowy"
                          tabindex="0"
                        >
                          <span class="yes-no-card__label">Nie</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div class="help-box help-box--tip">
                    <h4><i class="ph ph-lightbulb"></i> Dlaczego to pytanie?</h4>
                    <p>
                      Segment narożny ma dodatkowe ściany zewnętrzne oraz większą powierzchnię
                      dachu. To zwiększa zapotrzebowanie na moc pompy ciepła, dlatego musimy
                      uwzględnić ten parametr.
                    </p>
                  </div>
                </div>
              </div>

              <!-- Pola specjalne dla MIESZKANIA (apartment) -->
              <div id="apartmentFields" class="hidden">
                <h3>OTOCZENIE MIESZKANIA</h3>
                <div class="form-row-mosaic form-card">
                  <div class="help-box help-box--tip help-box--full-width">
                    <h4><i class="ph ph-lightbulb"></i> Określanie otoczenia mieszkania</h4>
                    <p>
                      Dla mieszkań musimy wiedzieć, co znajduje się wokół mieszkania, aby prawidłowo
                      obliczyć straty ciepła przez przegrody.
                    </p>
                    <p>
                      <strong>Ogrzewany lokal</strong> - inne mieszkanie lub pomieszczenie ogrzewane
                    </p>
                    <p>
                      <strong>Nieogrzewany lokal</strong> - korytarz, klatka schodowa, piwnica
                      nieogrzewana
                    </p>
                    <p><strong>Świat zewnętrzny</strong> - ściana zewnętrzna budynku, dach</p>
                  </div>

                  <div class="form-field">
                    <label for="whats_over" class="form-label"
                      >Co znajduje się powyżej mieszkania?</label
                    >
                    <select id="whats_over" name="whats_over" class="form-select">
                      <option value="">-- Wybierz --</option>
                      <option value="heated_room">Ogrzewany lokal</option>
                      <option value="unheated_room">Nieogrzewany lokal / korytarz / klatka</option>
                      <option value="outdoor">Świat zewnętrzny / dach</option>
                    </select>
                  </div>

                  <div class="form-field">
                    <label for="whats_under" class="form-label"
                      >Co znajduje się poniżej mieszkania?</label
                    >
                    <select id="whats_under" name="whats_under" class="form-select">
                      <option value="">-- Wybierz --</option>
                      <option value="heated_room">Ogrzewany lokal</option>
                      <option value="unheated_room">Nieogrzewany lokal / korytarz / klatka</option>
                      <option value="outdoor">Świat zewnętrzny</option>
                      <option value="ground">Grunt / podłoga na gruncie</option>
                    </select>
                  </div>

                  <div class="form-field">
                    <label for="whats_north" class="form-label"
                      >Co znajduje się na północ od mieszkania?</label
                    >
                    <select id="whats_north" name="whats_north" class="form-select">
                      <option value="">-- Wybierz --</option>
                      <option value="heated_room">Ogrzewany lokal</option>
                      <option value="unheated_room">Nieogrzewany lokal / korytarz</option>
                      <option value="outdoor">Świat zewnętrzny (ściana zewnętrzna)</option>
                    </select>
                  </div>

                  <div class="form-field">
                    <label for="whats_south" class="form-label"
                      >Co znajduje się na południe od mieszkania?</label
                    >
                    <select id="whats_south" name="whats_south" class="form-select">
                      <option value="">-- Wybierz --</option>
                      <option value="heated_room">Ogrzewany lokal</option>
                      <option value="unheated_room">Nieogrzewany lokal / korytarz</option>
                      <option value="outdoor">Świat zewnętrzny (ściana zewnętrzna)</option>
                    </select>
                  </div>

                  <div class="form-field">
                    <label for="whats_east" class="form-label"
                      >Co znajduje się na wschód od mieszkania?</label
                    >
                    <select id="whats_east" name="whats_east" class="form-select">
                      <option value="">-- Wybierz --</option>
                      <option value="heated_room">Ogrzewany lokal</option>
                      <option value="unheated_room">Nieogrzewany lokal / korytarz</option>
                      <option value="outdoor">Świat zewnętrzny (ściana zewnętrzna)</option>
                    </select>
                  </div>

                  <div class="form-field">
                    <label for="whats_west" class="form-label"
                      >Co znajduje się na zachód od mieszkania?</label
                    >
                    <select id="whats_west" name="whats_west" class="form-select">
                      <option value="">-- Wybierz --</option>
                      <option value="heated_room">Ogrzewany lokal</option>
                      <option value="unheated_room">Nieogrzewany lokal / korytarz</option>
                      <option value="outdoor">Świat zewnętrzny (ściana zewnętrzna)</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Strefa klimatyczna - Mosaic Layout -->
              <h3>STREFA TEMPERATUROWA:</h3>
              <div class="form-row-mosaic form-card">
                <div class="form-field">
                  <label class="form-label"> Wybierz strefę klimatyczną budynku </label>

                  <div class="form-field__radio-group">
                    <label class="form-field__radio-label">
                      <input type="radio" name="location_id" value="PL_GDANSK" required />
                      <span>Strefa I (-16°C)</span>
                    </label>

                    <label class="form-field__radio-label">
                      <input
                        type="radio"
                        name="location_id"
                        value="PL_KUJAWSKOPOMORSKIE_BYDGOSZCZ"
                        required
                      />
                      <span>Strefa II (-18°C)</span>
                    </label>

                    <label class="form-field__radio-label">
                      <input
                        type="radio"
                        name="location_id"
                        value="PL_DOLNOSLASKIE_WROCLAW"
                        checked
                        required
                      />
                      <span>Strefa III (-20°C)</span>
                    </label>

                    <label class="form-field__radio-label">
                      <input type="radio" name="location_id" value="PL_STREFA_IV" required />
                      <span>Strefa IV (-22°C)</span>
                    </label>

                    <label class="form-field__radio-label">
                      <input type="radio" name="location_id" value="PL_ZAKOPANE" required />
                      <span>Strefa V (-24°C)</span>
                    </label>
                  </div>
                </div>

                <div class="help-box help-box--tip">
                  <h4><i class="ph ph-lightbulb"></i> Strefy klimatyczne</h4>
                  <p>Strefa określa temperaturę projektową dla Twojego regionu</p>
                  <img
                    src="<?php echo esc_url($img_url . '/mapka.png'); ?>"
                    alt="Mapa stref klimatycznych w Polsce - oznaczenia temperatur projektowych dla poszczególnych regionów kraju"
                    class="zone-map"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </div>
          <!-- Przyciski nawigacyjne -->
          <div
            class="btn-row"
            style="display: flex; justify-content: center; width: 100%; grid-column: 1 / -1"
          >
            <button
              id="quick-scenario-trigger"
              type="button"
              class="quick-scenario-btn"
              aria-label="Szybka symulacja na przykładowych danych (pomiń ręczne wypełnianie formularza)"
            >
              ⚡
            </button>
            <button class="btn-next1" type="button">→ Dalej →</button>
          </div>
        </div>

        <!-- Zakładka 1: Kształt -->
        <div class="section" data-tab="1">
          <h3>WYMIARY BUDYNKU:</h3>
          <div class="form-row-mosaic form-card">
            <div class="form-field">
              <div class="form-field-item">
                <label class="form-label"> Jaki jest obrys budynku? </label>

                <div class="form-field__radio-group">
                  <label class="form-field__radio-label">
                    <input type="radio" name="building_shape" value="regular" required />
                    <span>Regularny (prostokątny)</span>
                  </label>

                  <label class="form-field__radio-label">
                    <input type="radio" name="building_shape" value="irregular" required />
                    <span>Nieregularny (z wykuszami, wnękami itp.)</span>
                  </label>
                </div>
              </div>

              <div id="regularFields" class="hidden">
                <div class="form-field-item form-field-item--subsequent">
                  <label class="form-label">Wybierz sposób podania wymiarów:</label>
                  <div class="form-field__radio-group">
                    <label class="form-field__radio-label">
                      <input type="radio" name="regular_method" value="dimensions" required />
                      <span>Podam długość i szerokość budynku</span>
                    </label>
                    <label class="form-field__radio-label">
                      <input type="radio" name="regular_method" value="area" required />
                      <span>Podam powierzchnię zabudowy w m²</span>
                    </label>
                  </div>
                </div>
              </div>

              <div id="dimensionsFields" class="hidden">
                <div class="form-field-item form-field-item--subsequent">
                  <label for="building_length">Długość</label>
                  <div class="quantity-input-wrapper">
                    <fieldset class="quantity-input" data-quantity="">
                      <legend class="sr-only">Zmień długość</legend>
                      <button
                        type="button"
                        title="Zmniejsz"
                        class="quantity-btn quantity-btn--sub"
                        aria-label="Zmniejsz długość"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        id="building_length"
                        name="building_length"
                        step="0.5"
                        min="0"
                        value="10"
                        pattern="[0-9]+"
                      />
                      <button
                        type="button"
                        title="Zwiększ"
                        class="quantity-btn quantity-btn--add"
                        aria-label="Zwiększ długość"
                      >
                        +
                      </button>
                    </fieldset>
                    <span class="quantity-unit">m</span>
                  </div>
                </div>
                <div class="form-field-item form-field-item--subsequent">
                  <label for="building_width">Szerokość</label>
                  <div class="quantity-input-wrapper">
                    <fieldset class="quantity-input" data-quantity="">
                      <legend class="sr-only">Zmień szerokość</legend>
                      <button
                        type="button"
                        title="Zmniejsz"
                        class="quantity-btn quantity-btn--sub"
                        aria-label="Zmniejsz szerokość"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        id="building_width"
                        name="building_width"
                        step="0.5"
                        min="0"
                        value="5"
                        pattern="[0-9]+"
                      />
                      <button
                        type="button"
                        title="Zwiększ"
                        class="quantity-btn quantity-btn--add"
                        aria-label="Zwiększ szerokość"
                      >
                        +
                      </button>
                    </fieldset>
                    <span class="quantity-unit">m</span>
                  </div>
                </div>
                <div class="form-field-item form-field-item--subsequent">
                  <button
                    type="button"
                    class="building-type-card slider-confirm-card"
                    id="dimensions-confirm-btn"
                    data-dimensions-confirmed="false"
                    aria-label="Potwierdź wymiary"
                  >
                    <div class="slider-confirm-card__icon">
                      <i class="ph ph-check"></i>
                    </div>
                    <div class="slider-confirm-card__hint">Potwierdź wymiary</div>
                  </button>
                </div>
              </div>

              <div id="areaField" class="hidden">
                <div class="form-field-item form-field-item--subsequent">
                  <label for="floor_area">Powierzchnia zabudowy (m²)</label>
                  <input id="floor_area" name="floor_area" step="1" type="number" />
                </div>
              </div>

              <div id="irregularFields" class="hidden">
                <div class="form-field-item form-field-item--subsequent">
                  <label for="floor_area_irregular">Powierzchnia zabudowy (m²)</label>
                  <input
                    id="floor_area_irregular"
                    name="floor_area_irregular"
                    step="1"
                    type="number"
                  />
                </div>
                <div class="form-field-item form-field-item--subsequent">
                  <label for="floor_perimeter">Obwód budynku (m)</label>
                  <input id="floor_perimeter" name="floor_perimeter" step="0.5" type="number" />
                </div>
              </div>
            </div>

            <div>
              <div class="help-box help-box--tip">
                <h4><i class="ph ph-lightbulb"></i> Rodzaje obrysu budynku</h4>
                <img
                  src="<?php echo esc_url($pictures_url . '/obrys.png'); ?>"
                  alt="Ilustracja przedstawiająca różnice między budynkiem regularnym (prostokątnym) a nieregularnym (z wykuszami i wnękami)"
                  loading="lazy"
                />
              </div>

              <div id="regularAreaHelpBox" class="help-box help-box--tip hidden">
                <h4><i class="ph ph-lightbulb"></i> Co to jest powierzchnia zabudowy?</h4>
                <p>
                  Podajesz kluczowy parametr. Powierzchnia zabudowy to powierzchnia zajmowana przez
                  budynek - określamy ją poprzez zewnętrzne krawędzie ścian i ich rzut na
                  powierzchnię gruntu.
                </p>
                <img
                  src="<?php echo esc_url($pictures_url . '/zabudowa.png'); ?>"
                  class="obrys-img"
                  alt="Ilustracja powierzchni zabudowy budynku - rzut z góry pokazujący zewnętrzne krawędzie ścian"
                  loading="lazy"
                />
              </div>

              <div id="irregularAreaHelpBox" class="help-box help-box--tip hidden">
                <h4><i class="ph ph-lightbulb"></i> Co to jest powierzchnia zabudowy?</h4>
                <p>
                  Podajesz kluczowy parametr. Powierzchnia zabudowy to powierzchnia zajmowana przez
                  budynek - określamy ją poprzez zewnętrzne krawędzie ścian i ich rzut na
                  powierzchnię gruntu.
                </p>
                <img
                  src="<?php echo esc_url($pictures_url . '/zabudowa.png'); ?>"
                  class="obrys-img"
                  alt="Ilustracja powierzchni zabudowy budynku - rzut z góry pokazujący zewnętrzne krawędzie ścian"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
          <h3>BRYŁA BUDYNKU:</h3>
          <div class="form-row-mosaic form-card">
            <div class="form-field">
              <div class="form-field-item">
                <label class="form-label">Czy w budynku jest piwnica lub podpiwniczenie?</label>
                <!-- Ukryty input dla kompatybilności z JavaScript -->
                <input type="hidden" id="has_basement" name="has_basement" value="" />
                <!-- Karty Tak/Nie -->
                <div class="yes-no-cards">
                  <button
                    type="button"
                    class="yes-no-card"
                    data-field="has_basement"
                    data-value="yes"
                    aria-label="Tak"
                    tabindex="0"
                  >
                    <span class="yes-no-card__label">Tak</span>
                  </button>
                  <button
                    type="button"
                    class="yes-no-card"
                    data-field="has_basement"
                    data-value="no"
                    aria-label="Nie"
                    tabindex="0"
                  >
                    <span class="yes-no-card__label">Nie</span>
                  </button>
                </div>
              </div>

              <div class="form-field-item form-field-item--subsequent">
                <label class="form-label">Czy w budynku są balkony?</label>
                <!-- Ukryty input dla kompatybilności z JavaScript -->
                <input type="hidden" id="has_balcony" name="has_balcony" value="" required />
                <!-- Karty Tak/Nie -->
                <div class="yes-no-cards">
                  <button
                    type="button"
                    class="yes-no-card"
                    data-field="has_balcony"
                    data-value="yes"
                    aria-label="Tak"
                    tabindex="0"
                  >
                    <span class="yes-no-card__label">Tak</span>
                  </button>
                  <button
                    type="button"
                    class="yes-no-card"
                    data-field="has_balcony"
                    data-value="no"
                    aria-label="Nie"
                    tabindex="0"
                  >
                    <span class="yes-no-card__label">Nie</span>
                  </button>
                </div>
              </div>

              <!-- Liczba balkonów - ODDZIELNY kontener -->
              <div class="form-field-item form-field-item--subsequent" id="balconyFields">
                <label class="form-label">Ilość balkonów:</label>

                <div class="custom-slider-container custom-slider-small">
                  <!-- Ukryty input dla formularza -->
                  <input
                    type="hidden"
                    id="number_balcony_doors"
                    name="number_balcony_doors"
                    value="1"
                    data-requires-confirm="true"
                    data-slider-confirmed="false"
                  />

                  <!-- Bąbelek z wartością -->
                  <div class="custom-bubble" id="customBalconyBubble">1</div>

                  <!-- Track slidera -->
                  <div class="custom-slider-track" id="customSliderTrack">
                    <!-- Thumb (kuleczka) -->
                    <div class="custom-slider-thumb" id="customSliderThumb"></div>
                  </div>

                  <!-- Znaczniki (ticki) -->
                  <div class="custom-slider-ticks">
                    <span class="tick" data-value="1">1</span>
                    <span class="tick" data-value="2">2</span>
                    <span class="tick" data-value="3">3</span>
                    <span class="tick" data-value="4">4</span>
                    <span class="tick" data-value="5">5</span>
                    <span class="tick" data-value="6">6</span>
                  </div>

                  <button
                    type="button"
                    class="building-type-card slider-confirm-card"
                    data-slider-target="number_balcony_doors"
                  >
                    <div class="building-type-card__label">Potwierdź</div>
                    <div class="slider-confirm-card__hint">Przechodzę dalej</div>
                  </button>
                </div>
              </div>
            </div>

            <div class="help-box help-box--tip">
              <h4><i class="ph ph-lightbulb"></i> Balkon = mostek cieplny</h4>
              <p>
                Uwzględniamy tak samo balkony wiszące, jak w formie wnęki (tzw. loggia). Balkon ze
                względu na swoją konstrukcję stanowi mostek cieplny - mamy tutaj do czynienia z
                utratą ciepła.
              </p>
            </div>
          </div>

          <h3>KONDYGNACJE BUDYNKU:</h3>
          <div class="form-row-mosaic form-card">
            <div class="form-field">
              <div class="form-field-item">
                <label for="building_floors">Ile kondygnacji ma budynek? <b>bez poddasza</b></label>
                <select id="building_floors" name="building_floors" required class="form-select">
                  <option value="">-- Wybierz --</option>
                  <option value="1">Parter</option>
                  <option value="2">Parter + 1 piętro</option>
                  <option value="3">Parter + 2 piętra</option>
                  <option value="4">Parter + 3 piętra</option>
                </select>
              </div>

              <div class="form-field-item form-field-item--subsequent">
                <label class="form-label">Jaki typ dachu ma budynek?</label>
                <input type="hidden" id="building_roof" name="building_roof" value="" required />
                <div class="option-cards">
                  <button
                    type="button"
                    class="option-card"
                    data-field="building_roof"
                    data-value="flat"
                    aria-label="Dach płaski"
                    tabindex="0"
                  >
                    <span class="option-card__title">Płaski</span>
                    <span class="option-card__subtitle">Dach płaski</span>
                  </button>
                  <button
                    type="button"
                    class="option-card"
                    data-field="building_roof"
                    data-value="steep"
                    aria-label="Dach skośny z poddaszem"
                    tabindex="0"
                  >
                    <span class="option-card__title">Skośny</span>
                    <span class="option-card__subtitle">Z poddaszem</span>
                  </button>
                  <button
                    type="button"
                    class="option-card"
                    data-field="building_roof"
                    data-value="oblique"
                    aria-label="Dach skośny bez poddasza"
                    tabindex="0"
                  >
                    <span class="option-card__title">Skośny niski</span>
                    <span class="option-card__subtitle">Bez poddasza</span>
                  </button>
                </div>
              </div>

              <div id="heatedFloorsSection" class="form-field-item form-field-item--subsequent">
                <label class="form-label">Które kondygnacje są ogrzewane?</label>
                <div id="heatedFloorsContainer">
                  <!-- Checkboxy będą generowane dynamicznie przez floorRenderer.js -->
                </div>
              </div>

              <!-- Pytanie o dostępność poddasza (dla steep z nieogrzewanym poddaszem) -->
              <div id="atticAccessFields" class="hidden">
                <div class="form-field-item form-field-item--subsequent">
                  <label class="form-label">Jakie warunki panują na poddaszu?</label>
                  <div class="form-field__radio-group">
                    <label class="form-field__radio-label">
                      <input type="radio" name="attic_access" value="accessible" required />
                      <span>Jest użytkowe, z izolacją</span>
                    </label>
                    <label class="form-field__radio-label">
                      <input type="radio" name="attic_access" value="inaccessible" required />
                      <span>Kiepsko z izolacją - hula tam wiatr</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div class="help-box help-box--tip">
                <h4><i class="ph ph-lightbulb"></i> Dlaczego bez poddasza?</h4>
                <p>
                  Na tym etapie liczy się tylko ile pełnych, ogrzewanych pięter ma budynek. Poddasze
                  zostanie uwzględnione osobno w kolejnym kroku.
                </p>
                <p>
                  <strong>Przykład:</strong> Parter + piętro + poddasze użytkowe → wybierz "Parter +
                  1 piętro".
                </p>
              </div>

              <div class="help-box help-box--tip">
                <h4><i class="ph ph-lightbulb"></i> Poddasze i typ dachu — co wybrać?</h4>
                <p>
                  <strong>Poddasze to nie ciasny strych!</strong> Liczy się to, czy przestrzeń pod dachem jest ogrzewana i jak jest oddzielona od ciepłych pomieszczeń.
                </p>
                <p>
                  Poddasze to przestrzeń pod dachem, ze skosami, o wielkości prawie pełnej kondygnacji. Wybierz "z poddaszem" jeśli takowa przestrzeń istnieje. Nie zaznaczaj poddasza, jeśli masz tylko niski strych — bardzo niewielkich rozmiarów.
                </p>
                <p>
                  <strong>Dach skośny</strong> nie oznacza automatycznie ogrzewanego poddasza. Może to być zarówno poddasze użytkowe, jak i zimny strych. <strong>Dach płaski</strong> również wymaga uwzględnienia — straty ciepła przez dach płaski są tak samo istotne jak przez dach skośny.
                </p>
              </div>

              <div id="atticAccessHelpBox" class="help-box help-box--tip hidden">
                <h4><i class="ph ph-lightbulb"></i>Warunki na poddaszu</h4>
                <p>
                  Chodzi o to, czy przestrzeń pod dachem jest dobrze oddzielona od ogrzewanych
                  pomieszczeń i jak jest tam z izolacją.
                </p>
                <p>
                  <strong>Jest użytkowe, z izolacją:</strong> To przestrzeń, która ma dobrą izolację
                  dachu lub stropu nad ostatnim ogrzewanym pomieszczeniem. Działa jak ciepła
                  poduszka - chroni dom przed stratami ciepła.
                </p>
                <p>
                  <strong>Kiepsko z izolacją:</strong> To zimna przestrzeń nad domem, gdzie ucieka
                  ciepło. Może to być strych bez izolacji lub poddasze z nieszczelnym dachem -
                  miejsce, gdzie ucieka ciepło.
                </p>
              </div>
            </div>
          </div>

          <h3>KUBATURA:</h3>
          <div class="form-row-mosaic form-card">
            <div class="form-field">
              <div class="form-field-item">
                <label class="form-label">Wysokość pomieszczeń:</label>
                <input type="hidden" id="floor_height" name="floor_height" value="" required />
                <div class="option-cards option-cards--compact">
                  <button
                    type="button"
                    class="option-card"
                    data-field="floor_height"
                    data-value="2.3"
                    aria-label="Niskie pomieszczenia"
                    tabindex="0"
                  >
                    <span class="option-card__title">2,3 m</span>
                    <span class="option-card__subtitle">Nisko</span>
                  </button>
                  <button
                    type="button"
                    class="option-card"
                    data-field="floor_height"
                    data-value="2.6"
                    aria-label="Standardowa wysokość"
                    tabindex="0"
                  >
                    <span class="option-card__title">2,6 m</span>
                    <span class="option-card__subtitle">Standard</span>
                  </button>
                  <button
                    type="button"
                    class="option-card"
                    data-field="floor_height"
                    data-value="3.1"
                    aria-label="Wysokie pomieszczenia"
                    tabindex="0"
                  >
                    <span class="option-card__title">3,1 m</span>
                    <span class="option-card__subtitle">Wysoko</span>
                  </button>
                  <button
                    type="button"
                    class="option-card"
                    data-field="floor_height"
                    data-value="4.1"
                    aria-label="Bardzo wysokie pomieszczenia"
                    tabindex="0"
                  >
                    <span class="option-card__title">4,1 m</span>
                    <span class="option-card__subtitle">Bardzo wysoko</span>
                  </button>
                </div>
              </div>

              <div class="form-field-item form-field-item--subsequent">
                <label class="form-label">Czy budynek ma garaż w swojej bryle?</label>
                <div class="form-field__radio-group">
                  <label class="form-field__radio-label">
                    <input type="radio" name="garage_type" value="none" required />
                    <span>Brak garażu w bryle budynku</span>
                  </label>
                  <label class="form-field__radio-label">
                    <input type="radio" name="garage_type" value="single_unheated" required />
                    <span>Jednostanowiskowy - nieogrzewany</span>
                  </label>
                  <label class="form-field__radio-label">
                    <input type="radio" name="garage_type" value="single_heated" required />
                    <span>Jednostanowiskowy - ogrzewany</span>
                  </label>
                  <label class="form-field__radio-label">
                    <input type="radio" name="garage_type" value="double_unheated" required />
                    <span>Dwustanowiskowy - nieogrzewany</span>
                  </label>
                  <label class="form-field__radio-label">
                    <input type="radio" name="garage_type" value="double_heated" required />
                    <span>Dwustanowiskowy - ogrzewany</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
          <!-- Przyciski nawigacyjne -->
          <div
            class="btn-row"
            style="
              display: flex;
              justify-content: center;
              width: 100%;
              gap: 16px;
              grid-column: 1 / -1;
            "
          >
            <button class="btn-next2" type="button" disabled>→ Dalej →</button>
            <button class="btn-prev" type="button">← Cofnij</button>
          </div>
        </div>

        <!-- Zakładka 2: Konstrukcja -->
        <div class="section" data-tab="2">
          <h3>KONSTRUKCJA I ŚCIANY ZEWNĘTRZNE:</h3>

          <div class="form-row-mosaic form-card">
            <div class="form-field">
              <div class="form-field-item">
                <label class="form-label">Wybierz typ konstrukcji budynku:</label>
                <div class="form-field__radio-group">
                  <label class="form-field__radio-label">
                    <input type="radio" name="construction_type" value="traditional" required />
                    <span>Tradycyjna (murowana lub drewniana)</span>
                  </label>
                  <label class="form-field__radio-label">
                    <input type="radio" name="construction_type" value="canadian" required />
                    <span>Szkieletowa (dom kanadyjski)</span>
                  </label>
                </div>
              </div>

              <div id="traditionalOptions">
                <div class="form-field-item form-field-item--subsequent">
                  <label for="primary_wall_material_select"
                    >Z czego wykonane są ściany zewnętrzne?</label
                  >
                  <select
                    id="primary_wall_material_select"
                    name="primary_wall_material"
                    class="form-select"
                  >
                    <option value="">-- Wybierz --</option>
                    <option value="84">Porotherm</option>
                    <option value="54">Beton komórkowy (Ytong, H+H, Termalica)</option>
                    <option value="63">Pustaki ceramiczne</option>
                    <option value="57">Cegła pełna</option>
                    <option value="60">Cegła silikatowa</option>
                    <option value="51">Beton</option>
                    <option value="52">Żelbet</option>
                    <option value="56">Drewno iglaste</option>
                    <option value="55">Drewno liściaste</option>
                    <option value="53">Pustak żużlobetonowy</option>
                    <option value="standard">
                      Nie wiem - standardowe (pustak ceramiczny 25 cm)
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <div class="help-box help-box--tip">
              <h4><i class="ph ph-lightbulb"></i> Wybór materiału</h4>
              <p>
                Jeśli nie masz pewności co do materiału, wybierz najbardziej zbliżony do
                rzeczywistego.
              </p>
              <p>Dokładność tego wyboru wpływa na precyzję obliczeń zapotrzebowania na ciepło.</p>
            </div>

            <!-- Slider grubości ścian - przeniesiony poza form-field, aby help-box miał odpowiednią szerokość -->
            <div class="form-field-item form-field-item--subsequent" style="grid-column: 1 / -1; margin-top: var(--spacing-xl, 24px);">
              <label for="wall_size" class="form-label"
                >Grubość zewnętrznych ścian (łącznie z ociepleniem):</label
              >

              <div class="custom-slider-container custom-slider-large">
                <input
                  type="hidden"
                  id="wall_size"
                  name="wall_size"
                  value="50"
                  data-requires-confirm="true"
                  data-slider-confirmed="false"
                />

                <div class="custom-bubble" id="customWallSizeBubble">50</div>

                <div class="custom-slider-track" id="customWallSizeTrack">
                  <div class="custom-slider-thumb" id="customWallSizeThumb"></div>
                </div>

                <div class="custom-slider-ticks">
                  <span class="tick" data-value="20">20</span>
                  <span class="tick" data-value="25">25</span>
                  <span class="tick" data-value="30">30</span>
                  <span class="tick" data-value="35">35</span>
                  <span class="tick" data-value="40">40</span>
                  <span class="tick" data-value="45">45</span>
                  <span class="tick" data-value="50">50</span>
                  <span class="tick" data-value="55">55</span>
                  <span class="tick" data-value="60">60</span>
                  <span class="tick" data-value="65">65</span>
                  <span class="tick" data-value="70">70</span>
                  <span class="tick" data-value="75">75</span>
                  <span class="tick" data-value="80">80</span>
                </div>

                <button
                  type="button"
                  class="building-type-card slider-confirm-card"
                  data-slider-target="wall_size"
                >
                  <div class="slider-confirm-card__icon">
                    <i class="ph ph-check"></i>
                  </div>
                  <div class="building-type-card__label">Potwierdź</div>
                  <div class="slider-confirm-card__hint">Zatwierdź szerokość</div>
                </button>
              </div>
            </div>
          </div>

          <h3>DOCIEPLENIE ŚCIAN:</h3>
          <div class="form-row-mosaic form-card">
            <div class="form-field">
              <div id="canadianOptions" class="hidden">
                <div class="form-field-item">
                  <label for="internal_wall_isolation_material"
                    >Jakim materiałem ocieplono ściany od wewnątrz?</label
                  >
                  <select
                    id="internal_wall_isolation_material"
                    name="internal_wall_isolation[material]"
                    required
                    class="form-select"
                  >
                    <option value="">-- Wybierz --</option>
                    <option value="68">Wełna mineralna</option>
                    <option value="70">Styropian (EPS)</option>
                    <option value="88">Styropian grafitowy</option>
                    <option value="71">Styropian XPS (styrodur)</option>
                    <option value="94">Wełna drzewna</option>
                    <option value="95">PIR</option>
                    <option value="86">PUR natryskowy</option>
                    <option value="101">Multipor / inne mineralne</option>
                    <option value="82">Puste powietrze</option>
                  </select>
                </div>
                <div class="form-field-item form-field-item--subsequent">
                  <label for="internal_wall_isolation_size" class="form-label"
                    >Grubość izolacji wewnętrznej (cm) - wymagane</label
                  >

                  <div class="custom-slider-container custom-slider-small">
                    <input
                      type="hidden"
                      id="internal_wall_isolation_size"
                      name="internal_wall_isolation[size]"
                      value="5"
                      required
                      data-requires-confirm="true"
                      data-slider-confirmed="false"
                    />

                    <div class="custom-bubble" id="customInternalInsulationBubble">5</div>

                    <div class="custom-slider-track" id="customInternalInsulationTrack">
                      <div class="custom-slider-thumb" id="customInternalInsulationThumb"></div>
                    </div>

                    <div class="custom-slider-ticks">
                      <span class="tick" data-value="5">5</span>
                      <span class="tick" data-value="10">10</span>
                      <span class="tick" data-value="15">15</span>
                      <span class="tick" data-value="20">20</span>
                      <span class="tick" data-value="25">25</span>
                      <span class="tick" data-value="30">30</span>
                    </div>

                    <button
                      type="button"
                      class="building-type-card slider-confirm-card"
                      data-slider-target="internal_wall_isolation_size"
                    >
                      <div class="slider-confirm-card__icon">
                        <i class="ph ph-check"></i>
                      </div>
                      <div class="building-type-card__label">Potwierdź</div>
                      <div class="slider-confirm-card__hint">Zapisz grubość</div>
                    </button>
                  </div>
                </div>
              </div>

              <div class="form-field-item form-field-item--subsequent">
                <label class="form-label"
                  >Czy ściany są zbudowane z jakiegoś dodatkowego materiału?</label
                >
                <!-- Ukryty input dla kompatybilności z JavaScript -->
                <input
                  type="hidden"
                  id="has_secondary_wall_material"
                  name="has_secondary_wall_material"
                  value=""
                />
                <!-- Karty Tak/Nie -->
                <div class="yes-no-cards">
                  <button
                    type="button"
                    class="yes-no-card"
                    data-field="has_secondary_wall_material"
                    data-value="yes"
                    aria-label="Tak"
                    tabindex="0"
                  >
                    <span class="yes-no-card__label">Tak</span>
                  </button>
                  <button
                    type="button"
                    class="yes-no-card"
                    data-field="has_secondary_wall_material"
                    data-value="no"
                    aria-label="Nie"
                    tabindex="0"
                  >
                    <span class="yes-no-card__label">Nie</span>
                  </button>
                </div>
              </div>

              <div
                class="hidden form-field-item form-field-item--subsequent"
                id="secondaryWallFields"
              >
                <label for="secondary_wall_material_select"
                  >Dodatkowy materiał ścian zewnętrznych:</label
                >
                <select
                  id="secondary_wall_material_select"
                  name="secondary_wall_material"
                  class="form-select"
                >
                  <option value="">-- Wybierz --</option>
                  <option value="84">Porotherm</option>
                  <option value="54">Beton komórkowy (Ytong, H+H, Termalica)</option>
                  <option value="63">Pustaki ceramiczne</option>
                  <option value="57">Cegła pełna</option>
                  <option value="60">Cegła silikatowa</option>
                  <option value="51">Beton</option>
                  <option value="52">Żelbet</option>
                  <option value="56">Drewno iglaste</option>
                  <option value="55">Drewno liściaste</option>
                  <option value="53">Pustak żużlobetonowy</option>
                </select>
              </div>
            </div>

            <div class="hidden">
              <!-- Pusta kolumna dla zachowania układu 2-kolumnowego -->
            </div>
          </div>

          <!-- Przyciski nawigacyjne -->
          <div
            class="btn-row"
            style="display: flex; justify-content: center; width: 100%; gap: 16px"
          >
            <button class="btn-next3" type="button" disabled>→ Dalej →</button>
            <button class="btn-prev" type="button">← Cofnij</button>
          </div>
        </div>

        <!-- Zakładka 3: Okna i drzwi -->
        <div class="section" data-tab="3">
          <h3>OKNA I DRZWI:</h3>
          <div class="form-row-mosaic form-card">
            <div class="form-field">
              <div class="form-field-item">
                <label for="windows_type">Jakie okna są w budynku?</label>
                <select
                  id="windows_type"
                  name="windows_type"
                  required
                  class="form-select"
                  aria-label="Typ okien w budynku"
                >
                  <option value="">-- Wybierz --</option>
                  <option value="2021_triple_glass">Nowoczesne (od 2021), - 3-szybowe</option>
                  <option value="2021_double_glass">Nowoczesne (od 2021) - 2-szybowe</option>
                  <option value="new_triple_glass">Współczesne - 3-szybowe</option>
                  <option value="new_double_glass">Współczesne - 2-szybowe</option>
                  <option value="semi_new_double_glass">
                    Starsze zespolone (typowe z lat 90.)
                  </option>
                  <option value="old_double_glass">Stare okna 2-szybowe</option>
                  <option value="old_single_glass">Stare okna 1-szybowe</option>
                </select>
              </div>

              <div class="form-field-item form-field-item--subsequent">
                <label for="number_windows" class="form-label"
                  >Ile okien znajduje się w budynku?</label
                >

                <div class="custom-slider-container custom-slider-large">
                  <!-- Ukryty input dla formularza -->
                  <input
                    type="hidden"
                    id="number_windows"
                    name="number_windows"
                    value="14"
                    data-requires-confirm="true"
                    data-slider-confirmed="false"
                  />

                  <!-- Bąbelek z wartością -->
                  <div class="custom-bubble" id="customWindowsBubble">14</div>

                  <!-- Track slidera -->
                  <div class="custom-slider-track" id="customWindowsTrack">
                    <!-- Thumb (kuleczka) -->
                    <div class="custom-slider-thumb" id="customWindowsThumb"></div>
                  </div>

                  <!-- Znaczniki (ticki) -->
                  <div class="custom-slider-ticks">
                    <span class="tick" data-value="4">4</span>
                    <span class="tick" data-value="8">8</span>
                    <span class="tick" data-value="12">12</span>
                    <span class="tick" data-value="16">16</span>
                    <span class="tick" data-value="20">20</span>
                    <span class="tick" data-value="24">24</span>
                  </div>

                  <button
                    type="button"
                    class="building-type-card slider-confirm-card"
                    data-slider-target="number_windows"
                  >
                    <div class="slider-confirm-card__icon">
                      <i class="ph ph-check"></i>
                    </div>
                    <div class="building-type-card__label">Potwierdź</div>
                    <div class="slider-confirm-card__hint">Zapisz liczbę</div>
                  </button>
                </div>
              </div>

              <div class="form-field-item form-field-item--subsequent">
                <label for="number_huge_windows" class="form-label"
                  >Podaj ilość, jeśli budynku są duże przeszklenia (np. okna tarasowe, HS):</label
                >

                <div class="custom-slider-container custom-slider-small">
                  <!-- Ukryty input dla formularza -->
                  <input
                    type="hidden"
                    id="number_huge_windows"
                    name="number_huge_windows"
                    value="0"
                    data-requires-confirm="true"
                    data-slider-confirmed="false"
                  />

                  <!-- Bąbelek z wartością -->
                  <div class="custom-bubble" id="customHugeWindowsBubble">0</div>

                  <!-- Track slidera -->
                  <div class="custom-slider-track" id="customHugeWindowsTrack">
                    <!-- Thumb (kuleczka) -->
                    <div class="custom-slider-thumb" id="customHugeWindowsThumb"></div>
                  </div>

                  <!-- Znaczniki (ticki) -->
                  <div class="custom-slider-ticks">
                    <span class="tick" data-value="0">0</span>
                    <span class="tick" data-value="1">1</span>
                    <span class="tick" data-value="2">2</span>
                    <span class="tick" data-value="3">3</span>
                    <span class="tick" data-value="4">4</span>
                    <span class="tick" data-value="5">5</span>
                  </div>

                  <button
                    type="button"
                    class="building-type-card slider-confirm-card"
                    data-slider-target="number_huge_windows"
                  >
                    <div class="slider-confirm-card__icon">
                      <i class="ph ph-check"></i>
                    </div>
                    <div class="building-type-card__label">Potwierdź</div>
                    <div class="slider-confirm-card__hint">Zapisz liczbę</div>
                  </button>
                </div>
              </div>

              <div class="form-field-item form-field-item--subsequent">
                <label for="doors_type">Jakie są drzwi zewnętrzne?</label>
                <select
                  id="doors_type"
                  name="doors_type"
                  class="form-select"
                  aria-label="Typ drzwi zewnętrznych w budynku"
                >
                  <option value="">-- Wybierz --</option>
                  <option value="new_pvc">Nowe PVC</option>
                  <option value="new_wooden">Nowe drewniane</option>
                  <option value="new_metal">Nowe metalowe</option>
                  <option value="old_wooden">Stare drewniane</option>
                  <option value="old_metal">Stare metalowe</option>
                </select>
              </div>

              <div class="form-field-item form-field-item--subsequent">
                <label for="number_doors" class="form-label"
                  >Ile drzwi zewnętrznych (wyjść) znajduje się w budynku?</label
                >

                <div class="custom-slider-container custom-slider-small">
                  <!-- Ukryty input dla formularza -->
                  <input
                    type="hidden"
                    id="number_doors"
                    name="number_doors"
                    value="1"
                    data-requires-confirm="true"
                    data-slider-confirmed="false"
                  />

                  <!-- Bąbelek z wartością -->
                  <div class="custom-bubble" id="customDoorsBubble">1</div>

                  <!-- Track slidera -->
                  <div class="custom-slider-track" id="customDoorsTrack">
                    <!-- Thumb (kuleczka) -->
                    <div class="custom-slider-thumb" id="customDoorsThumb"></div>
                  </div>

                  <!-- Znaczniki (ticki) -->
                  <div class="custom-slider-ticks">
                    <span class="tick" data-value="1">1</span>
                    <span class="tick" data-value="2">2</span>
                    <span class="tick" data-value="3">3</span>
                    <span class="tick" data-value="4">4</span>
                  </div>

                  <button
                    type="button"
                    class="building-type-card slider-confirm-card"
                    data-slider-target="number_doors"
                  >
                    <div class="slider-confirm-card__icon">
                      <i class="ph ph-check"></i>
                    </div>
                    <div class="building-type-card__label">Potwierdź</div>
                    <div class="slider-confirm-card__hint">Zapisz liczbę</div>
                  </button>
                </div>
              </div>
            </div>

            <div class="help-box help-box--tip">
              <h4><i class="ph ph-lightbulb"></i> Jak liczyć okna?</h4>
              <p>
                Mniejsze okna należy liczyć jako pół, okna dachowe jako 1, a małe dachowe jako pół.
              </p>
            </div>
          </div>

          <!-- Przyciski nawigacyjne -->
          <div
            class="btn-row"
            style="display: flex; justify-content: center; width: 100%; gap: 16px"
          >
            <button class="btn-next4" type="button" disabled>→ Dalej →</button>
            <button class="btn-prev" type="button">← Cofnij</button>
          </div>
        </div>

        <!-- Zakładka 4: Izolacje -->
        <div class="section" data-tab="4">
          <!-- NOWA STRUKTURA: Per-field tryb uproszczony/szczegółowy -->
          <h3>OCIEPLENIE BUDYNKU:</h3>
          <div class="form-row-mosaic form-card">
            <!-- SEKCJA 1: ŚCIANY -->
            <div class="form-field">
              <!-- Uproszczone pole - widoczne domyślnie -->
              <div id="walls-simplified-field" class="form-field-item">
                <label class="form-label">Jak są ocieplone ściany budynku?</label>
                <input
                  type="hidden"
                  id="walls_insulation_level"
                  name="walls_insulation_level"
                  value=""
                />
                <div class="option-cards option-cards--wide">
                  <button
                    type="button"
                    class="option-card"
                    data-field="walls_insulation_level"
                    data-value="poor"
                    aria-label="Brak / bardzo słabe"
                    tabindex="0"
                    title="Brak ocieplenia lub bardzo cienka warstwa (poniżej 10 cm). Wysokie straty ciepła."
                  >
                    <span class="option-card__title">Słabo ocieplone</span>
                    <small style="display: block; margin-top: 4px; font-size: 0.85em; opacity: 0.7"
                      >&lt; 10 cm</small
                    >
                  </button>
                  <button
                    type="button"
                    class="option-card"
                    data-field="walls_insulation_level"
                    data-value="average"
                    aria-label="Przeciętnie ocieplone"
                    tabindex="0"
                    title="Standardowa izolacja (10-15 cm). Przeciętne straty ciepła."
                  >
                    <span class="option-card__title">Przeciętnie ocieplone</span>
                    <small style="display: block; margin-top: 4px; font-size: 0.85em; opacity: 0.7"
                      >10-15 cm</small
                    >
                  </button>
                  <button
                    type="button"
                    class="option-card"
                    data-field="walls_insulation_level"
                    data-value="good"
                    aria-label="Dobrze ocieplone"
                    tabindex="0"
                    title="Dobra izolacja (15-20 cm). Niskie straty ciepła."
                  >
                    <span class="option-card__title">Dobrze ocieplone</span>
                    <small style="display: block; margin-top: 4px; font-size: 0.85em; opacity: 0.7"
                      >15-20 cm</small
                    >
                  </button>
                  <button
                    type="button"
                    class="option-card"
                    data-field="walls_insulation_level"
                    data-value="very_good"
                    aria-label="Bardzo dobrze ocieplone"
                    tabindex="0"
                    title="Bardzo dobra izolacja (powyżej 20 cm). Minimalne straty ciepła."
                  >
                    <span class="option-card__title">Bardzo dobrze ocieplone</span>
                    <small style="display: block; margin-top: 4px; font-size: 0.85em; opacity: 0.7"
                      >&gt; 20 cm</small
                    >
                  </button>
                </div>

              </div>

              <!-- Toggle trybu szczegółowego – musi być POZA walls-simplified-field,
                   żeby nie znikał po przełączeniu na widok szczegółowy -->
              <label class="detailed-mode-toggle">
                <input
                  type="checkbox"
                  id="walls_insulation_detailed_mode"
                  name="walls_insulation_detailed_mode"
                  class="detailed-mode-checkbox"
                />
                <span class="detailed-mode-label">
                  <strong>Szczegółowe parametry</strong>
                  <small>(materiał i grubość izolacji)</small>
                </span>
              </label>

              <!-- Szczegółowe pole - ukryte domyślnie -->
              <div id="walls-detailed-field" class="form-field-item hidden">
                <div class="form-field-item">
                  <label class="form-label"
                    >Czy ściany zewnętrzne są ocieplone?
                    <span class="required-indicator" style="color: #d4a574">*</span></label
                  >
                  <input
                    type="hidden"
                    id="has_external_isolation"
                    name="has_external_isolation"
                    value=""
                  />
                  <div class="yes-no-cards">
                    <button
                      type="button"
                      class="yes-no-card"
                      data-field="has_external_isolation"
                      data-value="yes"
                      aria-label="Tak"
                      tabindex="0"
                    >
                      <span class="yes-no-card__label">Tak</span>
                    </button>
                    <button
                      type="button"
                      class="yes-no-card"
                      data-field="has_external_isolation"
                      data-value="no"
                      aria-label="Nie"
                      tabindex="0"
                    >
                      <span class="yes-no-card__label">Nie</span>
                    </button>
                  </div>
                </div>

                <div id="externalIsolationFields" class="hidden">
                  <div class="form-field-item form-field-item--subsequent">
                    <label
                      for="external_wall_isolation_material"
                      id="externalIsolationMaterialLabel"
                      >Jakim materiałem ocieplono ściany zewnętrzne?
                      <span class="required-indicator" style="color: #d4a574">*</span></label
                    >
                    <select
                      id="external_wall_isolation_material"
                      name="external_wall_isolation[material]"
                      class="form-select"
                      aria-label="Materiał izolacji ścian zewnętrznych"
                    >
                      <option value="">-- Wybierz --</option>
                      <option value="70">Styropian (EPS)</option>
                      <option value="88">Styropian grafitowy</option>
                      <option value="71">Styropian XPS (styrodur)</option>
                      <option value="68">Wełna mineralna</option>
                      <option value="94">Wełna drzewna</option>
                      <option value="95">PIR</option>
                      <option value="86">PUR natryskowy</option>
                      <option value="101">Multipor / inne mineralne</option>
                      <option value="82">Puste powietrze</option>
                      <option value="standard">Nie wiem - standardowe (styropian 15 cm)</option>
                    </select>
                  </div>

                  <div class="form-field-item form-field-item--subsequent">
                    <label
                      for="external_wall_isolation_size"
                      class="form-label"
                      id="externalIsolationSizeLabel"
                      >Grubość warstwy ocieplenia (cm):
                      <span class="required-indicator" style="color: #d4a574">*</span>
                      <small
                        style="display: block; margin-top: 4px; color: #666; font-weight: normal"
                        >Ustaw wartość suwakiem i kliknij "Potwierdź"</small
                      ></label
                    >

                    <div class="custom-slider-container custom-slider-small">
                      <input
                        type="hidden"
                        id="external_wall_isolation_size"
                        name="external_wall_isolation[size]"
                        value="15"
                        data-requires-confirm="true"
                        data-slider-confirmed="false"
                      />

                      <div class="custom-bubble" id="customWallInsulationBubble">15</div>

                      <div class="custom-slider-track" id="customWallInsulationTrack">
                        <div class="custom-slider-thumb" id="customWallInsulationThumb"></div>
                      </div>

                      <div class="custom-slider-ticks">
                        <span class="tick" data-value="5">5</span>
                        <span class="tick" data-value="10">10</span>
                        <span class="tick" data-value="15">15</span>
                        <span class="tick" data-value="20">20</span>
                        <span class="tick" data-value="25">25</span>
                        <span class="tick" data-value="30">30</span>
                        <span class="tick" data-value="35">35</span>
                      </div>

                      <button
                        type="button"
                        class="building-type-card slider-confirm-card"
                        data-slider-target="external_wall_isolation_size"
                      >
                        <div class="slider-confirm-card__icon">
                          <i class="ph ph-check"></i>
                        </div>
                        <div class="building-type-card__label">Potwierdź</div>
                        <div class="slider-confirm-card__hint">Zapisz grubość</div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Prawa kolumna: Help-box dla ścian -->
            <div class="help-box help-box--tip">
              <h4><i class="ph ph-lightbulb"></i> Izolacja ścian zewnętrznych</h4>
              <p>
                Docieplenie ścian zewnętrznych ma kluczowe znaczenie dla efektywności energetycznej
                budynku. Dobra izolacja ścian znacząco redukuje straty ciepła.
              </p>
            </div>
          </div>

          <!-- Separator -->
          <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e5e5" />

          <!-- SEKCJA 2: DACH -->
          <div class="form-row-mosaic form-card">
            <div class="form-field">
              <!-- Uproszczone pole - widoczne domyślnie -->
              <div id="roof-simplified-field" class="form-field-item">
                <label class="form-label"
                  >Jak ocieplony jest dach lub strop nad ostatnią ogrzewaną kondygnacją?</label
                >
                <input
                  type="hidden"
                  id="roof_insulation_level"
                  name="roof_insulation_level"
                  value=""
                />
                <div class="option-cards option-cards--wide">
                  <button
                    type="button"
                    class="option-card"
                    data-field="roof_insulation_level"
                    data-value="poor"
                    aria-label="Brak / bardzo słabe"
                    tabindex="0"
                    title="Brak ocieplenia dachu lub bardzo cienka warstwa (poniżej 10 cm). Wysokie straty ciepła przez dach."
                  >
                    <span class="option-card__title">Słabo ocieplone</span>
                    <small style="display: block; margin-top: 4px; font-size: 0.85em; opacity: 0.7"
                      >&lt; 10 cm</small
                    >
                  </button>
                  <button
                    type="button"
                    class="option-card"
                    data-field="roof_insulation_level"
                    data-value="average"
                    aria-label="Przeciętnie ocieplone"
                    tabindex="0"
                    title="Standardowa izolacja dachu (10-15 cm). Przeciętne straty ciepła."
                  >
                    <span class="option-card__title">Przeciętnie ocieplone</span>
                    <small style="display: block; margin-top: 4px; font-size: 0.85em; opacity: 0.7"
                      >10-15 cm</small
                    >
                  </button>
                  <button
                    type="button"
                    class="option-card"
                    data-field="roof_insulation_level"
                    data-value="good"
                    aria-label="Dobrze ocieplone"
                    tabindex="0"
                    title="Dobra izolacja dachu (15-20 cm). Niskie straty ciepła."
                  >
                    <span class="option-card__title">Dobrze ocieplone</span>
                    <small style="display: block; margin-top: 4px; font-size: 0.85em; opacity: 0.7"
                      >15-20 cm</small
                    >
                  </button>
                  <button
                    type="button"
                    class="option-card"
                    data-field="roof_insulation_level"
                    data-value="very_good"
                    aria-label="Bardzo dobrze ocieplone"
                    tabindex="0"
                    title="Bardzo dobra izolacja dachu (powyżej 20 cm). Minimalne straty ciepła."
                  >
                    <span class="option-card__title">Bardzo dobrze ocieplone</span>
                    <small style="display: block; margin-top: 4px; font-size: 0.85em; opacity: 0.7"
                      >&gt; 20 cm</small
                    >
                  </button>
                </div>

              </div>

              <!-- Toggle trybu szczegółowego – poza roof-simplified-field (żeby nie znikał po przełączeniu) -->
              <label class="detailed-mode-toggle">
                <input
                  type="checkbox"
                  id="roof_insulation_detailed_mode"
                  name="roof_insulation_detailed_mode"
                  class="detailed-mode-checkbox"
                />
                <span class="detailed-mode-label">
                  <strong>Szczegółowe parametry</strong>
                  <small>(materiał i grubość izolacji)</small>
                </span>
              </label>

              <!-- Szczegółowe pole - ukryte domyślnie -->
              <div id="roof-detailed-field" class="form-field-item hidden">
                <div class="form-field-item">
                  <label class="form-label" id="topIsolationLabel"
                    >Czy dach jest ocieplony?
                    <span class="required-indicator" style="color: #d4a574">*</span></label
                  >
                  <input type="hidden" id="top_isolation" name="top_isolation" value="" />
                  <div class="yes-no-cards">
                    <button
                      type="button"
                      class="yes-no-card"
                      data-field="top_isolation"
                      data-value="yes"
                      aria-label="Tak"
                      tabindex="0"
                    >
                      <span class="yes-no-card__label">Tak</span>
                    </button>
                    <button
                      type="button"
                      class="yes-no-card"
                      data-field="top_isolation"
                      data-value="no"
                      aria-label="Nie"
                      tabindex="0"
                    >
                      <span class="yes-no-card__label">Nie</span>
                    </button>
                  </div>
                </div>

                <div id="topIsolationFields" class="hidden">
                  <div class="form-field-item form-field-item--subsequent">
                    <label for="top_isolation_material" id="topIsolationMaterialLabel"
                      >Jakim materiałem ocieplono dach?
                      <span class="required-indicator" style="color: #d4a574">*</span></label
                    >
                    <select
                      id="top_isolation_material"
                      name="top_isolation[material]"
                      class="form-select"
                      aria-label="Materiał izolacji dachu"
                    >
                      <option value="">-- Wybierz --</option>
                      <option value="68">Wełna mineralna</option>
                      <option value="70">Styropian (EPS)</option>
                      <option value="71">Styropian XPS (styrodur)</option>
                      <option value="88">Styropian grafitowy</option>
                      <option value="95">PIR</option>
                      <option value="86">PUR natryskowy</option>
                      <option value="94">Wełna drzewna</option>
                      <option value="101">Multipor / inne mineralne</option>
                      <option value="82">Puste powietrze</option>
                      <option value="standard">Nie wiem - standardowe (wełna 20 cm)</option>
                    </select>
                  </div>

                  <div class="form-field-item form-field-item--subsequent">
                    <label for="top_isolation_size" class="form-label" id="topIsolationSizeLabel"
                      >Grubość izolacji dachu (cm):
                      <span class="required-indicator" style="color: #d4a574">*</span>
                      <small
                        style="display: block; margin-top: 4px; color: #666; font-weight: normal"
                        >Ustaw wartość suwakiem i kliknij "Potwierdź"</small
                      ></label
                    >

                    <div class="custom-slider-container custom-slider-small">
                      <input
                        type="hidden"
                        id="top_isolation_size"
                        name="top_isolation[size]"
                        value="30"
                        data-requires-confirm="true"
                        data-slider-confirmed="false"
                      />

                      <div class="custom-bubble" id="customRoofInsulationBubble">30</div>

                      <div class="custom-slider-track" id="customRoofInsulationTrack">
                        <div class="custom-slider-thumb" id="customRoofInsulationThumb"></div>
                      </div>

                      <div class="custom-slider-ticks">
                        <span class="tick" data-value="10">10</span>
                        <span class="tick" data-value="15">15</span>
                        <span class="tick" data-value="20">20</span>
                        <span class="tick" data-value="25">25</span>
                        <span class="tick" data-value="30">30</span>
                        <span class="tick" data-value="35">35</span>
                        <span class="tick" data-value="40">40</span>
                        <span class="tick" data-value="45">45</span>
                      </div>

                      <button
                        type="button"
                        class="building-type-card slider-confirm-card"
                        data-slider-target="top_isolation_size"
                      >
                        <div class="slider-confirm-card__icon">
                          <i class="ph ph-check"></i>
                        </div>
                        <div class="building-type-card__label">Potwierdź</div>
                        <div class="slider-confirm-card__hint">Zapisz grubość</div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Prawa kolumna: Help-box dla dachu -->
            <div class="help-box help-box--tip">
              <h4><i class="ph ph-lightbulb"></i>Izolacja od góry</h4>
              <p id="topIsolationDescription">
                Docieplenie przestrzeni ogrzewanej od góry - może to być strop nad ostatnim
                ogrzewanym pomieszczeniem lub dach.
              </p>
              <p>
                Brak izolacji lub jej niewystarczająca grubość zwiększa straty ciepła przez dach, co
                podnosi zapotrzebowanie na moc pompy i koszty eksploatacji.
              </p>
            </div>
          </div>

          <!-- Separator -->
          <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e5e5" />

          <!-- SEKCJA 3: PODŁOGA -->
          <div class="form-row-mosaic form-card">
            <div class="form-field">
              <!-- Uproszczone pole - widoczne domyślnie -->
              <div id="floor-simplified-field" class="form-field-item">
                <label class="form-label"
                  >Jak ocieplona jest podłoga (na gruncie / nad piwnicą)?</label
                >
                <input
                  type="hidden"
                  id="floor_insulation_level"
                  name="floor_insulation_level"
                  value=""
                />
                <div class="option-cards option-cards--wide">
                  <button
                    type="button"
                    class="option-card"
                    data-field="floor_insulation_level"
                    data-value="poor"
                    aria-label="Brak / bardzo słabe"
                    tabindex="0"
                    title="Brak ocieplenia podłogi lub bardzo cienka warstwa (poniżej 5 cm). Wysokie straty ciepła przez podłogę."
                  >
                    <span class="option-card__title">Słabo ocieplone</span>
                    <small style="display: block; margin-top: 4px; font-size: 0.85em; opacity: 0.7"
                      >&lt; 5 cm</small
                    >
                  </button>
                  <button
                    type="button"
                    class="option-card"
                    data-field="floor_insulation_level"
                    data-value="average"
                    aria-label="Przeciętnie ocieplone"
                    tabindex="0"
                    title="Standardowa izolacja podłogi (5-10 cm). Przeciętne straty ciepła."
                  >
                    <span class="option-card__title">Przeciętnie ocieplone</span>
                    <small style="display: block; margin-top: 4px; font-size: 0.85em; opacity: 0.7"
                      >5-10 cm</small
                    >
                  </button>
                  <button
                    type="button"
                    class="option-card"
                    data-field="floor_insulation_level"
                    data-value="good"
                    aria-label="Dobrze ocieplone"
                    tabindex="0"
                    title="Dobra izolacja podłogi (10-15 cm). Niskie straty ciepła."
                  >
                    <span class="option-card__title">Dobrze ocieplone</span>
                    <small style="display: block; margin-top: 4px; font-size: 0.85em; opacity: 0.7"
                      >10-15 cm</small
                    >
                  </button>
                  <button
                    type="button"
                    class="option-card"
                    data-field="floor_insulation_level"
                    data-value="very_good"
                    aria-label="Bardzo dobrze ocieplone"
                    tabindex="0"
                    title="Bardzo dobra izolacja podłogi (powyżej 15 cm). Minimalne straty ciepła."
                  >
                    <span class="option-card__title">Bardzo dobrze ocieplone</span>
                    <small style="display: block; margin-top: 4px; font-size: 0.85em; opacity: 0.7"
                      >&gt; 15 cm</small
                    >
                  </button>
                </div>

              </div>

              <!-- Toggle trybu szczegółowego – poza floor-simplified-field (żeby nie znikał po przełączeniu) -->
              <label class="detailed-mode-toggle">
                <input
                  type="checkbox"
                  id="floor_insulation_detailed_mode"
                  name="floor_insulation_detailed_mode"
                  class="detailed-mode-checkbox"
                />
                <span class="detailed-mode-label">
                  <strong>Szczegółowe parametry</strong>
                  <small>(materiał i grubość izolacji)</small>
                </span>
              </label>

              <!-- Szczegółowe pole - ukryte domyślnie -->
              <div id="floor-detailed-field" class="form-field-item hidden">
                <div class="form-field-item">
                  <label class="form-label"
                    >Czy podłoga jest ocieplona?
                    <span class="required-indicator" style="color: #d4a574">*</span></label
                  >
                  <input type="hidden" id="bottom_isolation" name="bottom_isolation" value="" />
                  <div class="yes-no-cards">
                    <button
                      type="button"
                      class="yes-no-card"
                      data-field="bottom_isolation"
                      data-value="yes"
                      aria-label="Tak"
                      tabindex="0"
                    >
                      <span class="yes-no-card__label">Tak</span>
                    </button>
                    <button
                      type="button"
                      class="yes-no-card"
                      data-field="bottom_isolation"
                      data-value="no"
                      aria-label="Nie"
                      tabindex="0"
                    >
                      <span class="yes-no-card__label">Nie</span>
                    </button>
                  </div>
                </div>

                <div id="bottomIsolationFields" class="hidden">
                  <div class="form-field-item form-field-item--subsequent">
                    <label for="bottom_isolation_material"
                      >Jakim materiałem ocieplono podłogę?
                      <span class="required-indicator" style="color: #d4a574">*</span></label
                    >
                    <select
                      id="bottom_isolation_material"
                      name="bottom_isolation[material]"
                      class="form-select"
                      aria-label="Materiał izolacji podłogi"
                    >
                      <option value="">-- Wybierz --</option>
                      <option value="70">Styropian (EPS)</option>
                      <option value="88">Styropian grafitowy</option>
                      <option value="71">Styropian XPS (styrodur)</option>
                      <option value="68">Wełna mineralna</option>
                      <option value="95">PIR</option>
                      <option value="86">PUR natryskowy</option>
                      <option value="101">Multipor / inne mineralne</option>
                      <option value="82">Puste powietrze</option>
                      <option value="standard">Nie wiem - standardowe (styropian 15 cm)</option>
                    </select>
                  </div>

                  <div class="form-field-item form-field-item--subsequent">
                    <label for="bottom_isolation_size" class="form-label"
                      >Grubość ocieplenia podłogi (cm):
                      <span class="required-indicator" style="color: #d4a574">*</span>
                      <small
                        style="display: block; margin-top: 4px; color: #666; font-weight: normal"
                        >Ustaw wartość suwakiem i kliknij "Potwierdź"</small
                      ></label
                    >

                    <div class="custom-slider-container custom-slider-small">
                      <input
                        type="hidden"
                        id="bottom_isolation_size"
                        name="bottom_isolation[size]"
                        value="15"
                        data-requires-confirm="true"
                        data-slider-confirmed="false"
                      />

                      <div class="custom-bubble" id="customFloorInsulationBubble">15</div>

                      <div class="custom-slider-track" id="customFloorInsulationTrack">
                        <div class="custom-slider-thumb" id="customFloorInsulationThumb"></div>
                      </div>

                      <div class="custom-slider-ticks">
                        <span class="tick" data-value="5">5</span>
                        <span class="tick" data-value="10">10</span>
                        <span class="tick" data-value="15">15</span>
                        <span class="tick" data-value="20">20</span>
                        <span class="tick" data-value="25">25</span>
                        <span class="tick" data-value="30">30</span>
                      </div>

                      <button
                        type="button"
                        class="building-type-card slider-confirm-card"
                        data-slider-target="bottom_isolation_size"
                      >
                        <div class="slider-confirm-card__icon">
                          <i class="ph ph-check"></i>
                        </div>
                        <div class="building-type-card__label">Potwierdź</div>
                        <div class="slider-confirm-card__hint">Zapisz grubość</div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Prawa kolumna: Help-box dla podłogi -->
            <div class="help-box help-box--tip">
              <h4><i class="ph ph-lightbulb"></i> Ocieplenie podłogi</h4>
              <p>
                Ocieplenie podłogi na gruncie lub stropu nad nieogrzewaną piwnicą wpływa na
                zmniejszenie strat ciepła przez podłogę.
              </p>
              <p>
                Brak odpowiedniego ocieplenia podłogi zwiększa straty ciepła, co podnosi
                zapotrzebowanie na moc pompy i koszty eksploatacji.
              </p>
            </div>
          </div>

          <!-- Przyciski nawigacyjne -->
          <div
            class="btn-row"
            style="display: flex; justify-content: center; width: 100%; gap: 16px"
          >
            <button class="btn-next5" type="button" disabled>→ Dalej →</button>
            <button class="btn-prev" type="button">← Cofnij</button>
          </div>
        </div>

        <!-- Zakładka 5: Ogrzewanie i CWU -->
        <div class="section" data-tab="5">
          <h3>OGRZEWANIE:</h3>
          <div class="form-row-mosaic form-card">
            <div class="form-field">
              <div class="form-field-item">
                <label for="source_type">Główne źródło ogrzewania</label>
                <select id="source_type" name="source_type" required class="form-select">
                  <option value="">-- Wybierz --</option>
                  <option value="air_to_water_hp">Pompa ciepła powietrze-woda</option>
                  <option value="gas">Gaz</option>
                  <option value="oil">Olej</option>
                  <option value="biomass">Biomasa</option>
                  <option value="district_heating">Ciepło sieciowe</option>
                </select>
              </div>

              <div class="form-field-item form-field-item--subsequent">
                <label for="indoor_temperature" class="form-label"
                  >Jaka jest Twoja komfortowa temperatura?</label
                >

                <div class="custom-slider-container custom-slider-small">
                  <input
                    type="hidden"
                    id="indoor_temperature"
                    name="indoor_temperature"
                    value="21"
                    data-requires-confirm="true"
                    data-slider-confirmed="false"
                  />

                  <div class="custom-bubble" id="customTemperatureBubble">21</div>

                  <div class="custom-slider-track" id="customTemperatureTrack">
                    <div class="custom-slider-thumb" id="customTemperatureThumb"></div>
                  </div>

                  <div class="custom-slider-ticks">
                    <span class="tick" data-value="17">17</span>
                    <span class="tick" data-value="18">18</span>
                    <span class="tick" data-value="19">19</span>
                    <span class="tick" data-value="20">20</span>
                    <span class="tick" data-value="21">21</span>
                    <span class="tick" data-value="22">22</span>
                    <span class="tick" data-value="23">23</span>
                    <span class="tick" data-value="24">24</span>
                    <span class="tick" data-value="25">25</span>
                  </div>

                  <button
                    type="button"
                    class="building-type-card slider-confirm-card"
                    data-slider-target="indoor_temperature"
                  >
                    <div class="slider-confirm-card__icon">
                      <i class="ph ph-check"></i>
                    </div>
                    <div class="building-type-card__label">Potwierdź</div>
                    <div class="slider-confirm-card__hint">Zapisz komfort</div>
                  </button>
                </div>
              </div>

              <div class="form-field-item form-field-item--subsequent">
                <label class="form-label">Typ wentylacji:</label>
                <input
                  type="hidden"
                  id="ventilation_type"
                  name="ventilation_type"
                  value=""
                  required
                />
                <div class="option-cards option-cards--wide">
                  <button
                    type="button"
                    class="option-card"
                    data-field="ventilation_type"
                    data-value="natural"
                    aria-label="Wentylacja naturalna"
                    tabindex="0"
                  >
                    <span class="option-card__title">Naturalna</span>
                    <span class="option-card__subtitle">Grawitacyjna</span>
                  </button>
                  <button
                    type="button"
                    class="option-card"
                    data-field="ventilation_type"
                    data-value="mechanical"
                    aria-label="Wentylacja mechaniczna"
                    tabindex="0"
                  >
                    <span class="option-card__title">Mechaniczna</span>
                    <span class="option-card__subtitle">Bez rekuperacji</span>
                  </button>
                  <button
                    type="button"
                    class="option-card"
                    data-field="ventilation_type"
                    data-value="mechanical_recovery"
                    aria-label="Wentylacja z rekuperacją"
                    tabindex="0"
                  >
                    <span class="option-card__title">Rekuperacja</span>
                    <span class="option-card__subtitle">Mechaniczna z odzyskiem</span>
                  </button>
                </div>
              </div>

              <div class="form-field-item form-field-item--subsequent">
                <label class="form-label">Rodzaj ogrzewania w budynku:</label>
                <input type="hidden" id="heating_type" name="heating_type" value="" required />
                <div class="option-cards option-cards--wide">
                  <button
                    type="button"
                    class="option-card"
                    data-field="heating_type"
                    data-value="underfloor"
                    aria-label="Ogrzewanie podłogowe"
                    tabindex="0"
                  >
                    <span class="option-card__title">Podłogowe</span>
                    <span class="option-card__subtitle">Jedna strefa</span>
                  </button>
                  <button
                    type="button"
                    class="option-card"
                    data-field="heating_type"
                    data-value="radiators"
                    aria-label="Ogrzewanie grzejnikowe"
                    tabindex="0"
                  >
                    <span class="option-card__title">Grzejniki</span>
                    <span class="option-card__subtitle">Kaloryfery</span>
                  </button>
                  <button
                    type="button"
                    class="option-card"
                    data-field="heating_type"
                    data-value="mixed"
                    aria-label="Ogrzewanie mieszane"
                    tabindex="0"
                  >
                    <span class="option-card__title">Mieszane</span>
                    <span class="option-card__subtitle">Podłoga + grzejniki</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="help-box help-box--tip">
              <h4><i class="ph ph-lightbulb"></i> Kiedy wybrać "mieszane"?</h4>
              <p>
                Jeżeli masz podłogówkę i np. dodatkowe 2 grzejniki łazienkowe - w dalszym ciągu
                wybierasz ogrzewanie podłogowe. Układ mieszany wybierasz, gdy faktycznie masz 2
                strefy z różnymi odbiornikami ciepła.
              </p>
              <p>
                Rodzaj instalacji grzewczej wpływa na temperaturę zasilania. Niższa temperatura
                (ogrzewanie podłogowe) oznacza wyższą sprawność pompy, cichszą i stabilniejszą
                pracę.
              </p>
              <p>
                Układy mieszane wymagają starannego doboru i regulacji, aby zachować wysoką
                sprawność pompy.
              </p>
            </div>
          </div>
          <h3>CIEPŁA WODA::</h3>
          <div class="form-row-mosaic form-card">
            <div class="form-field">
              <div class="form-field-item">
                <label class="form-label">Czy pompa ma też podgrzewać wodę użytkową (CWU)?</label>
                <!-- Ukryty input dla kompatybilności z JavaScript -->
                <input type="hidden" id="include_hot_water" name="include_hot_water" value="yes" />
                <!-- Karty Tak/Nie -->
                <div class="yes-no-cards">
                  <button
                    type="button"
                    class="yes-no-card yes-no-card--selected"
                    data-field="include_hot_water"
                    data-value="yes"
                    aria-label="Tak"
                    tabindex="0"
                  >
                    <span class="yes-no-card__label">Tak</span>
                  </button>
                  <button
                    type="button"
                    class="yes-no-card"
                    data-field="include_hot_water"
                    data-value="no"
                    aria-label="Nie"
                    tabindex="0"
                  >
                    <span class="yes-no-card__label">Nie</span>
                  </button>
                </div>
              </div>

              <div class="form-field-item form-field-item--subsequent">
                <label class="form-label">Ile osób mieszka w budynku?</label>

                <div class="custom-slider-container custom-slider-small">
                  <input
                    type="hidden"
                    id="hot_water_persons"
                    name="hot_water_persons"
                    value="4"
                    data-requires-confirm="true"
                    data-slider-confirmed="false"
                  />
                  <div class="custom-bubble" id="customPersonsBubble">4</div>
                  <div class="custom-slider-track" id="customPersonsTrack">
                    <div class="custom-slider-thumb" id="customPersonsThumb"></div>
                  </div>
                  <div class="custom-slider-ticks">
                    <span class="tick" data-value="2" data-label="1-2">1-2</span>
                    <span class="tick" data-value="3" data-label="3">3</span>
                    <span class="tick" data-value="4" data-label="4">4</span>
                    <span class="tick" data-value="6" data-label="5-6">5-6</span>
                    <span class="tick" data-value="8" data-label="7+">7+</span>
                  </div>

                  <button
                    type="button"
                    class="building-type-card slider-confirm-card"
                    data-slider-target="hot_water_persons"
                  >
                    <div class="slider-confirm-card__icon">
                      <i class="ph ph-check"></i>
                    </div>
                    <div class="building-type-card__label">Potwierdź</div>
                    <div class="slider-confirm-card__hint">Zapisz liczbę</div>
                  </button>
                </div>
              </div>

              <div id="hotWaterOptions" class="form-field-item form-field-item--subsequent">
                <label class="form-label">Jakie jest zużycie ciepłej wody?</label>
                <input
                  type="hidden"
                  id="hot_water_usage"
                  name="hot_water_usage"
                  value="shower_bath"
                  required
                />
                <div class="option-cards option-cards--wide">
                  <button
                    type="button"
                    class="option-card"
                    data-field="hot_water_usage"
                    data-value="shower"
                    aria-label="Małe zużycie CWU"
                    tabindex="0"
                  >
                    <span class="option-card__title">Małe</span>
                    <span class="option-card__subtitle">Głównie prysznice</span>
                  </button>
                  <button
                    type="button"
                    class="option-card"
                    data-field="hot_water_usage"
                    data-value="shower_bath"
                    aria-label="Średnie zużycie CWU"
                    tabindex="0"
                  >
                    <span class="option-card__title">Średnie</span>
                    <span class="option-card__subtitle">Prysznice i wanna</span>
                  </button>
                  <button
                    type="button"
                    class="option-card"
                    data-field="hot_water_usage"
                    data-value="bath"
                    aria-label="Duże zużycie CWU"
                    tabindex="0"
                  >
                    <span class="option-card__title">Duże</span>
                    <span class="option-card__subtitle">Głównie wanna</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="help-box help-box--tip">
              <h4><i class="ph ph-lightbulb"></i>Ogrzewanie + ciepła woda</h4>
              <p>
                Rekomendujemy grzanie ciepłej wody z pompy ciepła. Dopasujemy dla Ciebie zbiornik
                odpowiedniej pojemności.
              </p>
            </div>
          </div>

          <!-- Przyciski nawigacyjne -->
          <div
            class="btn-row"
            style="display: flex; justify-content: center; width: 100%; gap: 16px"
          >
            <button class="btn-finish" type="button" disabled>→ SPRAWDŹ WYNIK →</button>
            <button class="btn-prev" type="button">← Cofnij</button>
          </div>
        </div>

      </form>

        <!-- ZORDON 3.0 - Sekcja Wyników Ultra Premium -->
        <div class="hp-results hidden" data-view="results">
          <!-- 🔥 STICKY SWITCHER - Przełącznik zakładek -->
          <div data-role="results-switcher" class="results-switcher glass-box">
            <button
              type="button"
              class="results-switch-btn active"
              data-target="configurator-view"
              aria-pressed="true"
            >
              <i class="fas fa-cogs"></i>
              <span>Twoja Maszynownia</span>
            </button>
            <button
              type="button"
              class="results-switch-btn"
              data-target="energy-profile-view"
              aria-pressed="false"
            >
              <i class="fas fa-chart-line"></i>
              <span>Profil Energetyczny</span>
            </button>
          </div>

          <!-- 📦 WIDOK 1: KONFIGURATOR MASZYNOWNI (ładowany z konfigurator.html) -->
          <div id="configurator-view" class="results-view visible" data-view="configurator">
      <!-- KONFIGURATOR MASZYNOWNI – modułowy, montowany w wynikach -->
      <section id="section-configurator" class="machine-room-configurator-section glass-box">
        <div data-role="configurator-root" class="configurator-mount" data-config-source="results">
          <!-- Konfigurator - struktura zgodna z configurator-unified.js -->
          <div id="configurator-app" class="configurator-container">
            <!-- Placeholder dla sticky selections bar (zapobiega skokowi treści) -->
            <div class="selections-sticky-placeholder" id="selections-sticky-placeholder" style="display: none;"></div>

            <!-- STICKY PASEK Z WYBRANYMI KOMPONENTAMI -->
            <div class="configurator-selections-bar" id="configurator-selections-bar">
              <div class="selections-inner">
                <div class="selection-item" data-type="pompa">
                  <span class="selection-label">Pompa ciepła:</span>
                  <span class="selection-value">—</span>
                </div>
                <div class="selection-item" data-type="cwu">
                  <span class="selection-label">Zasobnik CWU:</span>
                  <span class="selection-value">—</span>
                </div>
                <div class="selection-item" data-type="bufor">
                  <span class="selection-label">Bufor CO:</span>
                  <span class="selection-value">—</span>
                </div>
                <div class="selection-item" data-type="cyrkulacja">
                  <span class="selection-label">Cyrkulacja CWU:</span>
                  <span class="selection-value">—</span>
                </div>
                <div class="selection-item" data-type="service">
                  <span class="selection-label">Service Cloud:</span>
                  <span class="selection-value">—</span>
                </div>
                <div class="selection-item" data-type="posadowienie">
                  <span class="selection-label">Posadowienie:</span>
                  <span class="selection-value">—</span>
                </div>
                <div class="selection-item" data-type="reduktor">
                  <span class="selection-label">Reduktor:</span>
                  <span class="selection-value">—</span>
                </div>
                <div class="selection-item" data-type="uzdatnianie">
                  <span class="selection-label">Uzdatnianie:</span>
                  <span class="selection-value">—</span>
                </div>
              </div>
            </div>

            <!-- Kontener z krokami -->
            <div id="configurator-steps">
              <!-- KROK 1: POMPA CIEPŁA -->
              <section class="config-step section-container" data-step-key="pompa">
                <div class="section-header">
                  <div class="section-header-content">
                    <div class="section-icon">⚡</div>
                    <div>
                      <div class="section-step">KROK 1/10</div>
                      <h2 class="section-title">Pompa ciepła</h2>
                      <p class="section-description">
                        Na podstawie obliczeń rekomendujemy pompę o odpowiedniej mocy. Wybierz
                        preferowany model.
                      </p>
                    </div>
                  </div>
                </div>
                <div class="options-grid">
                  <!-- Karty będą renderowane dynamicznie przez configurator-unified.js -->
                </div>
              </section>

              <!-- KROK 2: ZASOBNIK CWU -->
              <section class="config-step section-container" data-step-key="cwu">
                <div class="section-header">
                  <div class="section-header-content">
                    <div class="section-icon">💧</div>
                    <div>
                      <div class="section-step">KROK 2/10</div>
                      <h2 class="section-title">Zasobnik CWU</h2>
                      <p class="section-description">
                        Wybierz rodzaj wykończenia wewnętrznego zasobnika.
                      </p>
                    </div>
                  </div>
                </div>
                <div class="options-grid">
                  <!-- Karty będą renderowane dynamicznie przez configurator-unified.js -->
                </div>
              </section>

              <!-- KROK 3: PYTANIA INSTALACYJNE (Hydraulika CO) -->
              <section class="config-step section-container" data-step-key="hydraulics_inputs">
                <div class="section-header">
                  <div class="section-header-content">
                    <div class="section-icon">🧩</div>
                    <div>
                      <div class="section-step">KROK 3/10</div>
                      <h2 class="section-title">Pytania instalacyjne</h2>
                      <p class="section-description">
                        Te 3 krótkie odpowiedzi pozwalają silnikowi dobrać: bufor magazynowy,
                        sprzęgło (separator) lub ochronę przepływu.<br>Twoje odpowiedzi pomogą dobrać odpowiednie komponenty w następnym kroku.
                      </p>
                    </div>
                  </div>
                </div>

                <div class="options-grid" id="hydraulics-inputs-grid">
                  <!-- Renderowane dynamicznie przez configurator-unified.js -->
                </div>
              </section>

              <!-- KROK 3: BUFOR CO -->
              <section class="config-step section-container" data-step-key="bufor">
                <div class="section-header">
                  <div class="section-header-content">
                    <div class="section-icon">📦</div>
                    <div>
                      <div class="section-step">KROK 4/10</div>
                      <h2 class="section-title">Bufor / sprzęgło / ochrona przepływu</h2>
                      <p class="section-description">
                        Ta sekcja pokazuje wynik silnika: czy potrzebujesz bufora (magazyn energii),
                        sprzęgła (separacja), ochrony przepływu, czy niczego.
                      </p>
                    </div>
                  </div>
                </div>
                <div class="options-grid">
                  <!-- Karty będą renderowane dynamicznie przez configurator-unified.js -->
                </div>
              </section>

              <!-- KROK 4: CYRKULACJA CWU -->
              <section class="config-step section-container" data-step-key="cyrkulacja">
                <div class="section-header">
                  <div class="section-header-content">
                    <div class="section-icon">🔄</div>
                    <div>
                      <div class="section-step">KROK 5/10</div>
                      <h2 class="section-title">Cyrkulacja CWU</h2>
                      <p class="section-description">
                        System cyrkulacji zapewnia natychmiastowy dostęp do ciepłej wody.
                      </p>
                    </div>
                  </div>
                </div>
                <div class="options-grid">
                  <!-- Karty będą renderowane dynamicznie przez configurator-unified.js -->
                </div>
              </section>

              <!-- KROK 5: SERVICE CLOUD -->
              <section class="config-step section-container" data-step-key="service">
                <div class="section-header">
                  <div class="section-header-content">
                    <div class="section-icon">☁️</div>
                    <div>
                      <div class="section-step">KROK 6/10</div>
                      <h2 class="section-title">Service Cloud</h2>
                      <p class="section-description">
                        Zdalne monitorowanie i serwis instalacji przez profesjonalistów.
                      </p>
                    </div>
                  </div>
                </div>
                <div class="options-grid">
                  <!-- Karta będzie renderowana dynamicznie przez configurator-unified.js -->
                </div>
              </section>

              <!-- KROK 6: POSADOWIENIE -->
              <section class="config-step section-container" data-step-key="posadowienie">
                <div class="section-header">
                  <div class="section-header-content">
                    <div class="section-icon">🏗️</div>
                    <div>
                      <div class="section-step">KROK 7/10</div>
                      <h2 class="section-title">Posadowienie jednostki zewnętrznej</h2>
                      <p class="section-description">
                        Sposób montażu jednostki zewnętrznej pompy ciepła.
                      </p>
                    </div>
                  </div>
                </div>
                <div class="options-grid">
                  <!-- Karty będą renderowane dynamicznie przez configurator-unified.js -->
                </div>
              </section>

              <!-- KROK 7: REDUKTOR -->
              <section class="config-step section-container" data-step-key="reduktor">
                <div class="section-header">
                  <div class="section-header-content">
                    <div class="section-icon">🔧</div>
                    <div>
                      <div class="section-step">KROK 8/10</div>
                      <h2 class="section-title">Reduktor ciśnienia</h2>
                      <p class="section-description">
                        Reduktor chroni instalację przed zbyt wysokim ciśnieniem wody.
                      </p>
                    </div>
                  </div>
                </div>
                <div class="options-grid">
                  <!-- Karta będzie renderowana dynamicznie przez configurator-unified.js -->
                </div>
              </section>

              <!-- KROK 8: UZDATNIANIE WODY -->
              <section class="config-step section-container" data-step-key="woda">
                <div class="section-header">
                  <div class="section-header-content">
                    <div class="section-icon">💧</div>
                    <div>
                      <div class="section-step">KROK 9/10</div>
                      <h2 class="section-title">Stacja uzdatniania wody</h2>
                      <p class="section-description">
                        Ochrona instalacji przed kamieniem i korozją.
                      </p>
                    </div>
                  </div>
                </div>
                <div class="options-grid">
                  <!-- Karty będą renderowane dynamicznie przez configurator-unified.js -->
                </div>
              </section>

              <!-- KROK 10: PODSUMOWANIE -->
              <section class="config-step" data-step-key="summary">
                <div class="summary-header">
                  <div class="section-step">KROK 10/10</div>
                  <h1>Podsumowanie konfiguracji</h1>
                  <p>Sprawdź wybrane komponenty przed złożeniem zamówienia</p>
                  <div class="summary-badge">Kompletna konfiguracja maszynowni</div>
                </div>
                <table class="summary-table">
                  <tbody id="summary-rows">
                    <!-- Wypełniane przez configurator-unified.js -->
                  </tbody>
                </table>
                <div class="summary-actions">
                  <button class="btn btn-primary" data-action="download-pdf">
                    Pobierz raport PDF
                  </button>
                  <button class="btn" data-action="send-email">Wyślij na email</button>
                  <button class="btn" data-action="print">Drukuj</button>
                  <button class="btn" data-action="back-to-config">Wróć do konfiguracji</button>
                </div>
              </section>
            </div>

            <!-- Nawigacja -->
            <div class="step-nav">
              <button type="button" class="btn-step" id="nav-prev" disabled>← Wstecz</button>
              <button type="button" class="btn-step btn-next" id="nav-next">Dalej →</button>
            </div>
          </div>
        </div>
      </div>

      <!-- PRZYCISKI FUNKCJONALNE (dla konfiguratora) -->
      <!-- UJEDNOLICONE: Dodana klasa rozróżniająca results-actions--configurator dla precyzyjnego stylowania/ukrywania -->
      <div class="results-actions results-actions--configurator glass-box">
        <div class="action-row primary-actions">
          <button type="button" data-action="download-pdf">Pobierz raport PDF</button>
        </div>

        <!-- FORMULARZ KONTAKTOWY DLA PDF (ukryty domyślnie) -->
        <div id="pdf-contact-form" class="pdf-contact-form hidden">
          <div class="contact-form-content">
            <div class="form-header">
              <h4><i class="fas fa-envelope"></i> Otrzymaj pełny raport energetyczny</h4>
              <p>Pełny raport energetyczny z doborem mocy pompy otrzymasz drogą mailową</p>
            </div>

            <div class="form-fields">
              <div class="form-field">
                <label for="customer-email">Email <span class="required">*</span></label>
                <input
                  type="email"
                  id="customer-email"
                  class="contact-input"
                  placeholder="twoj@email.pl"
                  required
                />
              </div>

              <div class="form-field">
                <label for="customer-postal-code"
                  >Kod pocztowy <span class="required">*</span></label
                >
                <input
                  type="text"
                  id="customer-postal-code"
                  class="contact-input"
                  placeholder="00-000"
                  maxlength="6"
                  required
                />
                <small class="field-note">Dla celów statystycznych</small>
              </div>
            </div>

            <div class="form-actions">
              <button class="action-btn primary full-width" data-action="collect-customer-data">
                <i class="fas fa-paper-plane"></i> Odbierz raport cieplny PDF
              </button>
              <button class="action-btn cancel-btn" data-action="hide-pdf-form">
                <i class="fas fa-times"></i> Anuluj
              </button>
            </div>
          </div>
        </div>

        <div class="action-row secondary-actions">
          <button class="action-btn secondary" data-action="go-back">
            <i class="fas fa-arrow-left"></i> Wróć do formularza
          </button>
          <button class="action-btn tertiary" data-action="start-new">
            <i class="fas fa-calculator"></i> Nowe obliczenie
          </button>
        </div>
      </div>

          <!-- 📊 WIDOK 2: PROFIL ENERGETYCZNY (domyślnie ukryty) -->
          <div id="energy-profile-view" class="results-view hidden" data-view="energy-profile">
            <!-- PROFIL ENERGETYCZNY - WYNIKI OBLICZEŃ -->
            <div class="energy-profile-section glass-box accordion-section">
              <h2 class="result-title">Twój profil energetyczny:</h2>
              <p class="result-subtitle">
                Kompleksowa analiza zapotrzebowania na ciepło dla Twojego budynku
              </p>

              <div class="result-grid">
                <div class="result-item">
                  <span class="icon-squares">Powierzchnia całkowita</span>
                  <strong id="r-total-area">...</strong>
                </div>
                <div class="result-item">
                  <span class="icon-flame">Powierzchnia ogrzewana</span>
                  <strong id="r-heated-area">...</strong>
                </div>
                <div class="result-item">
                  <span class="icon-power">Moc maksymalna (c.o.)</span>
                  <strong id="r-max-power">...</strong>
                </div>
                <div class="result-item">
                  <span class="icon-drop">Moc CWU</span> <strong id="r-cwu">...</strong>
                </div>
                <div class="result-item">
                  <span class="icon-chart">Zużycie roczne</span> <strong id="r-energy">...</strong>
                </div>
                <div class="result-item">
                  <span class="icon-thermometer">Temperatura projektowa</span>
                  <strong id="r-temp">...</strong>
                </div>
                <div class="result-item">
                  <span class="icon-target">Punkt biwalentny</span>
                  <strong id="r-bi-power">...</strong>
                </div>
                <div class="result-item">
                  <span class="icon-globe">Temperatura średnioroczna</span>
                  <strong id="r-temp-avg">...</strong>
                </div>
                <div class="result-item">
                  <span class="icon-power">Moc średnia</span> <strong id="r-avg-power">...</strong>
                </div>
                <div class="result-item">
                  <span class="icon-calendar">Zużycie dzienne</span>
                  <strong id="r-avg-daily-energy">...</strong>
                </div>
              </div>
            </div>

            <!-- Komentarz systemowy po profilu energetycznym -->
            <div class="data-comment" id="system-comment">
              <i class="fas fa-info-circle"></i>
              <span id="system-comment-text"
                >Parametry budynku są spójne i pozwalają na bezpieczną pracę pompy ciepła. System
                nie wykrył ryzyk przewymiarowania ani niedoboru mocy.</span
              >
            </div>

            <!-- DANE ROZSZERZONE (ukryte domyślnie) -->
            <div id="extended-results-sections">
              <!-- STRATY CIEPŁA -->
              <div class="extended-section accordion-section collapsed">
                <h3 class="section-title"><i class="fas fa-chart-pie"></i> Analiza strat ciepła</h3>
                <div class="accordion-content">
                  <p class="section-subtitle">Rozkład strat energii w Twoim budynku</p>
                  <div id="energy-losses-container"></div>
                  <p class="summary-line">
                    Wyniki pokazują, że budynek ma bardzo dobre parametry izolacji – pompa ciepła
                    będzie pracować stabilnie i z niskimi kosztami eksploatacji.
                  </p>
                </div>
              </div>

              <!-- PROPOZYCJE MODERNIZACJI -->
              <div class="extended-section accordion-section collapsed">
                <h3 class="section-title">
                  <i class="fas fa-lightbulb"></i> Rekomendowane modernizacje
                </h3>
                <div class="accordion-content">
                  <p class="section-subtitle">Najbardziej opłacalne usprawnienia energetyczne</p>
                  <div id="improvements-container"></div>
                </div>
              </div>

              <!-- KOSZTY OGRZEWANIA -->
              <div class="extended-section accordion-section">
                <h3 class="section-title">
                  <i class="fas fa-coins"></i> Porównanie kosztów ogrzewania
                </h3>
                <div class="accordion-content">
                  <p class="section-subtitle">Roczne koszty dla różnych źródeł ciepła</p>
                  <div id="heating-costs-container"></div>
                </div>
              </div>

              <!-- PUNKTY BIWALENTNE -->
              <div class="extended-section accordion-section collapsed">
                <h3 class="section-title">
                  <i class="fas fa-thermometer-three-quarters"></i> Punkty biwalentne
                </h3>
                <div class="accordion-content">
                  <p class="section-subtitle">Wydajność pompy ciepła przy różnych temperaturach</p>
                  <div id="bivalent-points-container"></div>
                  <p class="comfort-line">
                    Pompa utrzymuje pełną moc nawet przy -7°C — to oznacza stabilne ciepło bez
                    dogrzewania elektrycznego.
                  </p>
                </div>
              </div>
            </div>

            <!-- PRZYCISKI FUNKCJONALNE (dla profilu) -->
            <div class="results-actions glass-box hidden">
              <div class="action-row primary-actions">
                <button type="button" data-action="download-pdf" class="action-btn primary">
                  <i class="fas fa-file-pdf"></i> Pobierz raport PDF
                </button>
              </div>

              <div class="action-row secondary-actions">
                <button class="action-btn secondary" data-action="go-back">
                  <i class="fas fa-arrow-left"></i> Wróć do formularza
                </button>
                <button class="action-btn tertiary" data-action="start-new">
                  <i class="fas fa-calculator"></i> Nowe obliczenie
                </button>
              </div>
            </div>
          </div>

          <!-- Ekspercka stopka -->
          <div class="expert-footer">
            <i class="fas fa-user-hard-hat"></i> Analiza opracowana przez system
            <strong>TOP-INSTAL</strong>
            <span>Inteligentny algorytm obliczeniowy<br />zgodność z PN-B 02025 i PN-EN 832</span>
          </div>

      <!-- FINAL PREMIUM AI-COACH DOCK -->
      <div data-role="ai-coach-dock" aria-live="polite">
        <div class="ai-coach-dock__content">
          <span data-role="ai-coach-icon" class="ai-coach-dock__icon" aria-label="Pomoc doradcy">
            <svg data-role="ai-icon-svg" viewBox="0 0 20 20" fill="none" width="22" height="22">
              <circle cx="10" cy="10" r="9" stroke="#d4a574" stroke-width="2" />
              <path d="M10 13v.01" stroke="#d4a574" stroke-width="2" stroke-linecap="round" />
              <path
                d="M10 7a2 2 0 0 1 2 2c0 .828-.895 1.464-1.435 1.947C10.166 11.256 10 12 10 12"
                stroke="#4a5662"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
            <span data-role="ai-coach-loader" class="ai-coach-dock__loader" hidden>
              <svg viewBox="0 0 40 40" width="22" height="22">
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  stroke="#d4a574"
                  stroke-width="3"
                  fill="none"
                  opacity="0.17"
                />
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  stroke="#d4a574"
                  stroke-width="3"
                  fill="none"
                  stroke-dasharray="100"
                  stroke-dashoffset="75"
                  stroke-linecap="round"
                >
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    values="0 20 20;360 20 20"
                    dur="1s"
                    repeatCount="indefinite"
                  />
                </circle>
              </svg>
            </span>
          </span>
          <span data-role="ai-coach-dock-text" class="ai-coach-dock__text"
            >Masz wątpliwości? Zapytaj doradcę</span
          >
          <button
            data-role="ai-coach-pause"
            class="ai-coach-dock__btn"
            aria-label="Wstrzymaj pomoc"
            title="Wstrzymaj pomoc"
          >
            ⏸️
          </button>
          <button
            data-role="ai-coach-resume"
            class="ai-coach-dock__btn"
            aria-label="Wznów pomoc"
            title="Wznów pomoc"
            hidden
          >
            ▶️
          </button>
        </div>
      </div>

      <div data-role="ai-coach-panel" class="ai-coach-panel" hidden>
        <div class="ai-coach-panel__header">
          <strong>Decyzja techniczna</strong>
          <button type="button" class="ai-coach-panel__close" aria-label="Zamknij">×</button>
        </div>
        <p data-role="ai-coach-panel-context" class="ai-coach-panel__context"></p>

        <!-- Zawartość panelu - centrum decyzji technicznej -->
        <div class="ai-coach-panel__content">
          <div data-role="ai-coach-suggestions-list" class="ai-coach-suggestions">
            <!-- Zawartość renderowana dynamicznie przez renderPanelContent() -->
          </div>
        </div>
      </div>
    </div>
    </div>

    <div class="brand-content">
      <img
        src="<?php echo esc_url($pictures_url . '/www-mobile.png'); ?>"
        alt="TOP-INSTAL"
        class="brand-logo"
        loading="lazy"
      />
      <div class="brand-text">
        <p><strong>Autoryzowany partner Panasonic i Mitsubishi Electric</strong></p>
        <p>Dobieramy technologie tak, byś miał spokój i komfort przez wiele lat.</p>
      </div>
    </div>

    <!-- Building Type Cards JavaScript przeniesione do calculatorUI.js -->

    <!-- Construction Year Checkmark JavaScript przeniesione do calculatorUI.js -->

    <!-- Universal Select Checkmarks JavaScript przeniesione do calculatorUI.js -->
    <!-- Universal Number Input Checkmarks JavaScript przeniesione do calculatorUI.js -->
    <!-- Yes/No Cards JavaScript przeniesione do calculatorUI.js -->
    <!-- Hot Water Usage Help Box JavaScript przeniesione do calculatorUI.js -->
    <!-- Progress Label Animation JavaScript przeniesione do calculatorUI.js -->
    <!-- unlockFields JavaScript przeniesione do calculatorUI.js -->
    <!-- Wszystkie Custom Slidery JavaScript przeniesione do calculatorUI.js -->
    <!-- Quantity Input JavaScript przeniesione do calculatorUI.js -->
    <!-- Slider Confirm Buttons JavaScript przeniesione do calculatorUI.js -->
    <!-- Force Balcony Visibility JavaScript przeniesione do calculatorUI.js -->
    <!-- Simplified Insulation Mode JavaScript przeniesione do calculatorUI.js -->
    <!-- Progress Steps Updater JavaScript przeniesione do calculatorUI.js -->
    <!-- Accordion JavaScript przeniesione do calculatorUI.js -->
    <!-- Wszystkie pozostałe inline scripty przeniesione do calculatorUI.js -->
    <!-- Szybka symulacja z gotowymi danymi (Quick Scenario dla zakładki 0) -->
    <div id="quick-scenario-modal" class="quick-scenario-modal" aria-hidden="true">
      <div class="quick-scenario-backdrop"></div>
      <div
        class="quick-scenario-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-scenario-title"
      >
        <h3 id="quick-scenario-title">Szybka symulacja na przykładowych danych</h3>
        <p class="quick-scenario-subtitle">
          Te wartości symulują w pełni wypełniony formularz. Możesz je szybko skorygować przyciskami
          „− / +”, a następnie uruchomić obliczenia bez przechodzenia wszystkich kroków.
        </p>
        <div id="quick-scenario-fields" class="quick-scenario-fields"></div>
        <div class="quick-scenario-actions">
          <button type="button" class="quick-scenario-cancel">Anuluj</button>
          <button type="button" class="quick-scenario-ok">OK – oblicz</button>
        </div>
      </div>
    </div>
</div>
</div>
<!-- End TOP-INSTAL Heat Pump Calculator -->
