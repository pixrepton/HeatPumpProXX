(function (window) {
  "use strict";

  const MotionSystem = {
    initialized: false,
    reduceMotion: false,
    reduceMedia: null,
    observer: null, // MutationObserver reference for cleanup
    reduceMediaHandler: null, // Media query listener reference for cleanup

    init() {
      if (this.initialized) return;
      this.reduceMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.reduceMotion = this.reduceMedia.matches;

      // Store handler reference for cleanup
      this.reduceMediaHandler = (e) => {
        this.reduceMotion = e.matches;
      };

      if (this.reduceMedia.addEventListener) {
        this.reduceMedia.addEventListener("change", this.reduceMediaHandler);
      } else if (this.reduceMedia.addListener) {
        this.reduceMedia.addListener(this.reduceMediaHandler);
      }

      this.setupSteps();
      this.setupProgressBar();

      // Setup observers and options (called after DOM is ready)
      // This will be called from initMotion after DOM is ready
      if (document.readyState === "loading") {
        // Wait for DOM - will be handled by bootApp
        document.addEventListener(
          "DOMContentLoaded",
          () => {
            this.observeOptionMutations();
            this.setupOptions(document);
          },
          { once: true }
        );
      } else {
        // DOM already loaded - use requestIdleCallback for better performance
        if (window.requestIdleCallback) {
          requestIdleCallback(
            () => {
              this.observeOptionMutations();
              this.setupOptions(document);
            },
            { timeout: 1000 }
          );
        } else {
          setTimeout(() => {
            this.observeOptionMutations();
            this.setupOptions(document);
          }, 100);
        }
      }

      this.initialized = true;
    },

    dispose() {
      // Cleanup: remove event listeners
      if (this.reduceMedia && this.reduceMediaHandler) {
        if (this.reduceMedia.removeEventListener) {
          this.reduceMedia.removeEventListener(
            "change",
            this.reduceMediaHandler
          );
        } else if (this.reduceMedia.removeListener) {
          this.reduceMedia.removeListener(this.reduceMediaHandler);
        }
        this.reduceMediaHandler = null;
      }

      // Disconnect MutationObserver
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }

      this.initialized = false;
    },

    getVar(el, name, fallback) {
      const scope = el || document.documentElement;
      const raw = window.getComputedStyle(scope).getPropertyValue(name).trim();
      if (!raw) return fallback;
      if (raw.endsWith("ms")) return parseFloat(raw);
      if (raw.endsWith("s")) return parseFloat(raw) * 1000;
      const numeric = parseFloat(raw);
      return Number.isNaN(numeric) ? fallback : numeric;
    },

    getEasing(el, name, fallback) {
      const scope = el || document.documentElement;
      const raw = window.getComputedStyle(scope).getPropertyValue(name).trim();
      return raw || fallback;
    },

    cancelAnimations(el) {
      if (!el || !el.getAnimations) return;
      el.getAnimations().forEach((anim) => anim.cancel());
    },

    animate(el, keyframes, options) {
      if (!el || !el.animate) return null;
      const duration = this.reduceMotion ? 0 : options.duration;
      this.cancelAnimations(el);
      el.style.willChange = "transform, opacity";
      const anim = el.animate(keyframes, { ...options, duration });
      if (anim) {
        const reset = () => {
          el.style.willChange = "auto";
        };
        anim.onfinish = reset;
        anim.oncancel = reset;
      }
      return anim;
    },

    animatePress(el, isDown) {
      const duration = this.getVar(
        el,
        isDown ? "--m-press" : "--m-release",
        80
      );
      const easing = this.getEasing(
        el,
        "--e-standard",
        "cubic-bezier(0.2, 0.8, 0.2, 1)"
      );
      const from = isDown ? "translateY(0px)" : "translateY(1px)";
      const to = isDown ? "translateY(1px)" : "translateY(0px)";
      return this.animate(el, [{ transform: from }, { transform: to }], {
        duration,
        easing,
        fill: "both",
      });
    },

    animateSelect(el) {
      if (!el) return;
      const check = el.querySelector(".ui-option__check");
      if (!check) return;
      const duration = this.getVar(el, "--m-snap", 160);
      const easing = this.getEasing(
        el,
        "--e-snap",
        "cubic-bezier(0.2, 0.9, 0.2, 1)"
      );
      this.animate(
        check,
        [
          { opacity: 0, transform: "translateY(-50%) scale(0.92)" },
          { opacity: 1, transform: "translateY(-50%) scale(1)" },
        ],
        { duration, easing, fill: "both" }
      );
    },

    animateScanline(el) {
      if (!el || el.classList.contains("has-scanline")) return;
      const scan = el.querySelector(".ui-option__scan");
      if (!scan) return;
      const duration = this.getVar(el, "--m-scan", 280);
      const easing = this.getEasing(
        el,
        "--e-standard",
        "cubic-bezier(0.2, 0.8, 0.2, 1)"
      );
      this.cancelAnimations(scan);
      scan.style.opacity = "0";
      scan.style.transform = "translate(-100%, -50%)";
      const anim = this.animate(
        scan,
        [
          { opacity: 0, transform: "translate(-100%, -50%)" },
          { opacity: 0.55, transform: "translate(0%, -50%)" },
        ],
        { duration, easing, fill: "both" }
      );
      if (anim) {
        anim.onfinish = () => {
          scan.style.opacity = "0.2";
          scan.style.transform = "translate(0%, -50%)";
          el.classList.add("has-scanline");
        };
      } else {
        el.classList.add("has-scanline");
      }
    },

    animateStep(outEl, inEl, direction = 1) {
      if (!outEl || !inEl) return Promise.resolve();
      const distance = direction >= 0 ? 14 : -14;
      const duration = this.getVar(inEl, "--m-step", 240);
      const easing = this.getEasing(
        inEl,
        "--e-standard",
        "cubic-bezier(0.2, 0.8, 0.2, 1)"
      );

      const outAnim = this.animate(
        outEl,
        [
          { opacity: 1, transform: "translateX(0px)" },
          { opacity: 0, transform: `translateX(${-distance}px)` },
        ],
        { duration, easing, fill: "both" }
      );

      const inAnim = this.animate(
        inEl,
        [
          { opacity: 0, transform: `translateX(${distance}px)` },
          { opacity: 1, transform: "translateX(0px)" },
        ],
        { duration, easing, fill: "both" }
      );

      return Promise.all(
        [outAnim, inAnim]
          .filter(Boolean)
          .map((anim) => anim.finished.catch(() => null))
      );
    },

    animateReveal(el) {
      if (!el) return;
      const duration = this.getVar(el, "--m-reveal", 260);
      const easing = this.getEasing(
        el,
        "--e-standard",
        "cubic-bezier(0.2, 0.8, 0.2, 1)"
      );
      this.animate(
        el,
        [
          { opacity: 0, transform: "translateY(8px)" },
          { opacity: 1, transform: "translateY(0px)" },
        ],
        { duration, easing, fill: "both" }
      );
    },

    animateCrossfade(el) {
      if (!el) return;
      const duration = this.reduceMotion ? 0 : 200;
      const easing = this.getEasing(
        el,
        "--e-soft",
        "cubic-bezier(0.25, 0.1, 0.25, 1)"
      );
      this.animate(
        el,
        [
          { opacity: 0, transform: "translateY(6px)" },
          { opacity: 1, transform: "translateY(0px)" },
        ],
        { duration, easing, fill: "both" }
      );
    },

    animateAttach(el) {
      if (!el) return;
      const duration = this.reduceMotion ? 0 : 180;
      const easing = this.getEasing(
        el,
        "--e-standard",
        "cubic-bezier(0.2, 0.8, 0.2, 1)"
      );
      this.animate(
        el,
        [
          { opacity: 0, transform: "translateX(10px)" },
          { opacity: 1, transform: "translateX(0px)" },
        ],
        { duration, easing, fill: "both" }
      );
      el.classList.add("is-attaching");
      window.setTimeout(() => el.classList.remove("is-attaching"), 300);
    },

    animatePrice(el) {
      if (!el) return;
      const duration = this.reduceMotion ? 0 : 200;
      const easing = this.getEasing(
        el,
        "--e-soft",
        "cubic-bezier(0.25, 0.1, 0.25, 1)"
      );
      this.animate(
        el,
        [
          { opacity: 0, transform: "translateY(4px)" },
          { opacity: 1, transform: "translateY(0px)" },
        ],
        { duration, easing, fill: "both" }
      );
    },

    animateProgress(fillEl, progressValue) {
      if (!fillEl) return;
      const duration = this.getVar(fillEl, "--m-step", 240);
      const easing = this.getEasing(
        fillEl,
        "--e-standard",
        "cubic-bezier(0.2, 0.8, 0.2, 1)"
      );
      const target = Math.max(0, Math.min(1, progressValue));
      this.animate(
        fillEl,
        [
          { transform: fillEl.style.transform || "scaleX(0)" },
          { transform: `scaleX(${target})` },
        ],
        { duration, easing, fill: "both" }
      );
      fillEl.style.transform = `scaleX(${target})`;
    },

    setupSteps() {
      const form = hpById("heatCalcFormFull");
      if (form) {
        form.classList.add("ui-stepper");
        form
          .querySelectorAll(".section")
          .forEach((section) => section.classList.add("ui-step"));
      }
    },

    setupProgressBar() {
      const fill = hpById("top-progress-fill");
      if (fill && !fill.style.transform) {
        fill.style.transform = "scaleX(0.12)";
      }
    },

    isSelected(el) {
      return (
        el.classList.contains("option-card--selected") ||
        el.classList.contains("selected") ||
        el.classList.contains("yes-no-card--selected")
      );
    },

    isDisabled(el) {
      return (
        el.classList.contains("option-card--disabled") ||
        el.classList.contains("yes-no-card--disabled") ||
        el.classList.contains("disabled")
      );
    },

    ensureOptionDecorations(el) {
      const isProductCard = el.classList.contains("product-card");
      if (!isProductCard && !el.querySelector(".ui-option__check")) {
        const check = document.createElement("span");
        check.className = "ui-option__check";
        check.setAttribute("aria-hidden", "true");
        check.textContent = "\u2713";
        el.appendChild(check);
      }
      if (!el.querySelector(".ui-option__scan")) {
        const scan = document.createElement("span");
        scan.className = "ui-option__scan";
        scan.setAttribute("aria-hidden", "true");
        el.appendChild(scan);
      }
    },

    syncOptionAria(el) {
      if (!el) return;
      const group = el.closest('[role="radiogroup"]');
      if (group) {
        this.syncGroupAria(group);
      } else {
        el.setAttribute("aria-pressed", this.isSelected(el) ? "true" : "false");
      }
    },

    syncGroupAria(group) {
      if (!group) return;
      const options = group.querySelectorAll(".ui-option");
      options.forEach((option) => {
        const selected = this.isSelected(option);
        option.setAttribute("role", "radio");
        option.setAttribute("aria-checked", selected ? "true" : "false");
      });
    },

    enhanceOption(el) {
      if (!el) return;
      if (!el.classList.contains("ui-option")) {
        el.classList.add("ui-option");
      }
      if (el.dataset.motionBound === "1") return;
      el.dataset.motionBound = "1";
      if (el.tagName === "BUTTON" && !el.type) {
        el.type = "button";
      }
      this.ensureOptionDecorations(el);
      el.classList.toggle("is-selected", this.isSelected(el));
      el.classList.toggle("is-disabled", this.isDisabled(el));
      this.syncOptionAria(el);

      const pressDown = () => {
        if (this.isDisabled(el)) return;
        el.classList.add("is-pressing");
        this.animatePress(el, true);
      };
      const pressUp = () => {
        el.classList.remove("is-pressing");
        this.animatePress(el, false);
      };

      el.addEventListener("pointerdown", pressDown);
      el.addEventListener("pointerup", pressUp);
      el.addEventListener("pointercancel", pressUp);
      el.addEventListener("pointerleave", pressUp);
    },

    setupOptions(root) {
      const scope = root || document;
      const options = scope.querySelectorAll(
        "button.option-card, button.yes-no-card, button.product-card"
      );
      options.forEach((el) => this.enhanceOption(el));

      scope
        .querySelectorAll(
          ".option-cards, .options-grid, .cwu-cards, .yes-no-cards"
        )
        .forEach((group) => {
          if (!group.hasAttribute("role")) {
            group.setAttribute("role", "radiogroup");
          }
          this.syncGroupAria(group);
        });
    },

    observeOptionMutations() {
      // OPTIMIZATION: Połączone obserwatory + debounce dla lepszej wydajności
      let mutationTimeout = null;
      const pendingMutations = new Set();

      const observer = new MutationObserver((mutations) => {
        // Debounce: zbierz wszystkie mutacje i przetwórz razem
        mutations.forEach((mutation) => {
          if (
            mutation.type === "attributes" &&
            mutation.attributeName === "class" &&
            mutation.target
          ) {
            const el = mutation.target;
            if (el.classList && el.classList.contains("ui-option")) {
              pendingMutations.add(el);
            }
          } else if (mutation.type === "childList") {
            // Obsługa nowych elementów
            mutation.addedNodes.forEach((node) => {
              if (!(node instanceof Element)) return;
              if (
                node.matches &&
                node.matches(
                  "button.option-card, button.yes-no-card, button.product-card"
                )
              ) {
                pendingMutations.add(node);
              } else if (node.querySelectorAll) {
                const newOptions = node.querySelectorAll(
                  "button.option-card, button.yes-no-card, button.product-card"
                );
                newOptions.forEach((opt) => pendingMutations.add(opt));
              }
            });
          }
        });

        // Debounce: przetwórz mutacje w jednej ramce animacji
        if (mutationTimeout) cancelAnimationFrame(mutationTimeout);
        mutationTimeout = requestAnimationFrame(() => {
          pendingMutations.forEach((el) => {
            if (!el.isConnected) {
              pendingMutations.delete(el);
              return;
            }

            // Obsługa zmian klas (stary kod)
            if (el.classList && el.classList.contains("ui-option")) {
              const wasSelected = this.isSelected(el);
              el.classList.toggle("is-selected", wasSelected);
              el.classList.toggle("is-disabled", this.isDisabled(el));
              this.syncOptionAria(el);
            }

            // Obsługa nowych elementów
            if (
              el.matches &&
              el.matches(
                "button.option-card, button.yes-no-card, button.product-card"
              )
            ) {
              if (!el.classList.contains("ui-option")) {
                this.enhanceOption(el);
              }
            }
          });

          // Obsługa animacji tylko dla zmian selected
          pendingMutations.forEach((el) => {
            if (!el.classList || !el.classList.contains("ui-option")) return;
            const isSelectedNow = this.isSelected(el);
            const wasSelected = el.dataset._wasSelected === "true";

            if (isSelectedNow && !wasSelected) {
              this.animateSelect(el);
              this.animateScanline(el);
              const content = el.querySelector(
                ".product-content, .specs-list, .option-content"
              );
              if (content) {
                this.animateCrossfade(content);
              }
            } else if (!isSelectedNow && wasSelected) {
              el.classList.remove("has-scanline");
              const scan = el.querySelector(".ui-option__scan");
              if (scan) {
                scan.style.opacity = "0";
              }
            }

            el.dataset._wasSelected = isSelectedNow ? "true" : "false";
          });

          pendingMutations.clear();
        });
      });

      const targets = [];
      const calcRoot = hpById("heatCalcFormFull");
      const configRoot = hpById("configurator-app");
      if (calcRoot) targets.push(calcRoot);
      if (configRoot) targets.push(configRoot);
      if (!targets.length) targets.push(document.body);

      // Store observer reference for cleanup
      this.observer = observer;

      // OPTIMIZATION: Jeden observer zamiast dwóch
      targets.forEach((target) =>
        observer.observe(target, {
          subtree: true,
          attributes: true,
          attributeFilter: ["class"],
          childList: true, // Dodane: obsługa nowych elementów
        })
      );
    },

    observeNewOptions() {
      // OPTIMIZATION: Usunięte - teraz obsługiwane przez observeOptionMutations()
      // Zachowane dla kompatybilności wstecznej
    },
  };

  /**
   * Symuluje animację AI podczas przejść między zakładkami
   *
   * @param {number} tabIndex - Indeks aktualnej zakładki
   * @param {Array} steps - Tablica kroków animacji [{ text: string, delay: number }]
   * @param {Function} callback - Funkcja wywoływana po zakończeniu animacji
   */
  function simulateAIAnalysis(tabIndex, steps, callback) {
    console.log(
      `[MotionSystem] 🤖 Rozpoczęcie analizy AI dla zakładki ${tabIndex}`
    );

    let currentStep = 0;
    const progressElement = document.createElement("div");
    progressElement.className = "ai-analysis-overlay";
    progressElement.innerHTML = `
      <div class="ai-analysis-content">
        <div class="ai-spinner"></div>
        <h3 style="font-size: 12px;">TOP-AI ANALIZUJE DANE</h3>
        <p id="ai-step-text">${steps[0]?.text || "Przygotowuję analizę..."}</p>
        <div class="progress-bar">
          <div class="progress-fill" style="width: 0%"></div>
        </div>
      </div>
    `;

    // Dodaj style CSS jeśli nie istnieją
    if (!document.querySelector("#ai-analysis-styles")) {
      const style = document.createElement("style");
      style.id = "ai-analysis-styles";
      style.textContent = `
        .ai-analysis-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          /* UJEDNOLICONE: Używamy koloru tła aplikacji (#faf9f9) zamiast czarnego tła */
          background: rgba(250, 249, 249, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          backdrop-filter: blur(5px);
        }
        .ai-analysis-content {
          background: white;
          /* UJEDNOLICONE: border-radius z CSS (--radius-md: 4px zamiast 16px) */
          border-radius: 4px;
          padding: 40px;
          text-align: center;
          max-width: 500px;
          width: 90%;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        }
        .ai-spinner {
          width: 60px;
          height: 60px;
          /* UJEDNOLICONE: Używamy złotego koloru (#d4a574) zamiast zielonego */
          border: 4px solid rgba(212, 165, 116, 0.2);
          border-top: 4px solid #d4a574;
          border-radius: 50%;
          animation: spin 2s linear infinite;
          margin: 0 auto 20px;
        }
        .progress-bar {
          width: 100%;
          height: 8px;
          /* UJEDNOLICONE: Używamy złotego koloru (#d4a574) zamiast zielonego */
          background: rgba(212, 165, 116, 0.1);
          border-radius: 4px;
          overflow: hidden;
          margin-top: 20px;
        }
        .progress-fill {
          height: 100%;
          /* UJEDNOLICONE: Używamy złotego gradientu (#d4a574, #b8976a) zamiast zielonego */
          background: linear-gradient(90deg, #d4a574, #b8976a);
          border-radius: 4px;
          transition: width 0.5s ease-in-out;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(progressElement);

    function nextStep() {
      if (currentStep < steps.length) {
        const step = steps[currentStep];
        const stepText = document.getElementById("ai-step-text");
        const progressFill = progressElement.querySelector(".progress-fill");

        if (stepText) stepText.textContent = step.text;
        if (progressFill) {
          const progress = ((currentStep + 1) / steps.length) * 100;
          progressFill.style.width = `${progress}%`;
        }

        currentStep++;
        // Skrócony czas: 33% oryginalnego (3x szybsze)
        setTimeout(nextStep, Math.round((step.delay || 1000) / 3));
      } else {
        // Skrócony czas zakończenia: 33% oryginalnego
        setTimeout(() => {
          progressElement.remove();
          if (callback) callback();
        }, Math.round(500 / 3));
      }
    }

    nextStep();
  }

  // Eksportuj funkcję
  window.simulateAIAnalysis = simulateAIAnalysis;

  window.MotionSystem = MotionSystem;

  // Export init function for bootApp (no auto-init)
  // Auto-init removed - must be called from bootApp

  // Export init function
  if (typeof window !== "undefined") {
    window.__initMotion = function initMotion(ctx) {
      MotionSystem.init();
      return function disposeMotion() {
        if (
          MotionSystem.dispose &&
          typeof MotionSystem.dispose === "function"
        ) {
          MotionSystem.dispose();
        }
      };
    };
  }
})(window);
