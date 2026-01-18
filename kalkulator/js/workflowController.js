(function (window) {
  "use strict";

  function init(ctx) {
    const { root, dom, state } = ctx;
    const doc = root.ownerDocument;
    const view = doc.defaultView || window;
    const docEl = doc.documentElement;
    const motion = state?.motion || null;
    const getAppState = state?.getAppState;
    const updateAppState = state?.updateAppState;

    let initialized = false;
    let scrollHandler = null;
    let resizeHandler = null;
    let typewriterTimeout = null;
    let observer = null;

    const steps = [
      { progress: 12, label: "Start / Wprowadzenie" },
      { progress: 24, label: "Krok 2 / Wymiary" },
      { progress: 42, label: "Krok 3 / Konstrukcja" },
      { progress: 58, label: "Krok 4 / Okna & Drzwi" },
      { progress: 75, label: "Krok 5 / Izolacje" },
      { progress: 91, label: "Krok 6 / Finalizacja" },
      { progress: 100, label: "Wyniki" },
    ];

    const progressBarContainer = dom.byId("progress-bar-container");
    const progressBar = dom.byId("global-progress-bar");
    const progressFill = dom.byId("top-progress-fill");
    const progressPercentage = dom.byId("progress-percentage");
    const progressLabel = dom.byId("progress-label");
    const progressInfo = dom.byId("global-progress-info");
    const progressPlaceholder = dom.byId("progress-placeholder");
    const form = dom.byId("heatCalcFormFull");
    const header = dom.qs(".top-preview-header");

    let triggerOffset = 0;
    let stickyDisabled = false;
    let typewriterActive = false;
    let typewriterCompleted = false;

    const isMobile = () => view.matchMedia("(max-width: 767px)").matches;

    function updateProgress(tabIndex) {
      if (tabIndex < 0 || tabIndex >= steps.length) return;
      const step = steps[tabIndex];

      if (progressFill) {
        const progressValue = step.progress / 100;
        progressFill.dataset.progress = String(step.progress);
        if (motion && typeof motion.animateProgress === "function") {
          motion.animateProgress(progressFill, progressValue);
        } else {
          progressFill.style.transform = `scaleX(${progressValue})`;
        }
      }

      if (progressPercentage) {
        progressPercentage.textContent = `${step.progress}%`;
        progressPercentage.style.display = tabIndex === 0 ? "none" : "";
      }

      // Zawsze używaj oryginalnej treści z desktop (bez lowercase dla mobile)
      if (progressLabel) {
        progressLabel.textContent = step.label;
      }

      if (tabIndex === 6) {
        stickyDisabled = true;
        if (!isMobile() && progressBarContainer) {
          progressBarContainer.classList.remove("sticky");
          if (progressPlaceholder) {
            progressPlaceholder.style.display = "none";
          }
        }

        const appState =
          typeof getAppState === "function" ? getAppState() : null;
        const animationAlreadyShown =
          appState?.completionAnimationShown === true;

        if (
          !typewriterActive &&
          !typewriterCompleted &&
          !animationAlreadyShown
        ) {
          startCompletion();
        } else if (animationAlreadyShown) {
          typewriterCompleted = true;
        }
      } else if (tabIndex === 0) {
        if (typewriterActive) {
          typewriterActive = false;
          const completionContainer = dom.qs(".workflow-completion");
          if (completionContainer) {
            completionContainer.style.display = "none";
          }
          if (typewriterTimeout) {
            clearTimeout(typewriterTimeout);
            typewriterTimeout = null;
          }
        }
        stickyDisabled = false;
      } else {
        stickyDisabled = false;
      }
    }

    function handleResize() {
      const activeTab = dom.qs(".section.active");
      if (activeTab) {
        const tabIndex = parseInt(activeTab.getAttribute("data-tab")) || 0;
        updateProgress(tabIndex);
      }
      if (isMobile() && progressBarContainer) {
        progressBarContainer.classList.remove("sticky");
        progressBarContainer.classList.remove("hidden");
        if (progressPlaceholder) {
          progressPlaceholder.style.display = "none";
          progressPlaceholder.classList.remove("active");
        }
      }
    }

    function updateTriggerOffset() {
      if (isMobile()) return;
      if (progressBarContainer) {
        const progressBarRect = progressBarContainer.getBoundingClientRect();
        const scrollTop = view.pageYOffset || docEl.scrollTop;
        const progressBarTop = progressBarRect.top + scrollTop;
        let headerHeight = 80;
        if (header) {
          const headerRect = header.getBoundingClientRect();
          headerHeight = headerRect.height || header.offsetHeight || 80;
        }
        headerHeight += 15;
        triggerOffset = progressBarTop - headerHeight;
        if (isMobile()) {
          triggerOffset = Math.max(0, triggerOffset - 10);
        }
        docEl.style.setProperty("--header-height", `${headerHeight}px`);
      } else if (form) {
        const formRect = form.getBoundingClientRect();
        const scrollTop = view.pageYOffset || docEl.scrollTop;
        triggerOffset = Math.max(0, formRect.top + scrollTop - 60);
      }
    }

    function setupStickyProgress() {
      if (isMobile()) return;
      let ticking = false;

      const handleScroll = () => {
        if (ticking) return;
        view.requestAnimationFrame(() => {
          if (stickyDisabled) {
            if (
              progressBarContainer &&
              progressBarContainer.classList.contains("sticky")
            ) {
              progressBarContainer.classList.remove("sticky");
              if (progressPlaceholder) {
                progressPlaceholder.style.display = "none";
                progressPlaceholder.classList.remove("active");
              }
            }
            ticking = false;
            return;
          }

          const scrollTop = view.pageYOffset || docEl.scrollTop || view.scrollY;
          if (progressBarContainer) {
            const shouldBeSticky = scrollTop > triggerOffset;
            if (
              shouldBeSticky &&
              !progressBarContainer.classList.contains("sticky")
            ) {
              progressBarContainer.classList.add("sticky");
              if (progressPlaceholder) {
                progressPlaceholder.style.display = "block";
                progressPlaceholder.classList.add("active");
              }
            } else if (
              !shouldBeSticky &&
              progressBarContainer.classList.contains("sticky")
            ) {
              progressBarContainer.classList.remove("sticky");
              if (progressPlaceholder) {
                progressPlaceholder.style.display = "none";
                progressPlaceholder.classList.remove("active");
              }
            }
          }

          ticking = false;
        });
        ticking = true;
      };

      scrollHandler = handleScroll;
      resizeHandler = () => {
        updateTriggerOffset();
        handleResize();
      };

      view.addEventListener("scroll", scrollHandler);
      view.addEventListener("resize", resizeHandler);
    }

    function watchTabs() {
      const initial = dom.qs(".section.active");
      if (initial) {
        const idx = parseInt(initial.getAttribute("data-tab")) || 0;
        updateProgress(idx);
      }

      observer = new MutationObserver(() => {
        const active = dom.qs(".section.active");
        if (!active) return;
        const idx = parseInt(active.getAttribute("data-tab")) || 0;
        updateProgress(idx);
      });

      observer.observe(root, {
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    function startCompletion(result) {
      console.log("🎬 [WORKFLOW] startCompletion() called");
      console.log("📊 [WORKFLOW] Result:", result);

      typewriterActive = true;
      typewriterCompleted = true;

      if (typeof updateAppState === "function") {
        updateAppState({ completionAnimationShown: true });
      }

      // WORKFLOW COMPLETION (screen 0) w normalnym layoucie:
      // - NIE zasłaniamy hero
      // - zostawiamy progress bar (100%)
      // - ukrywamy tylko formularz i wyniki w tle
      console.log(
        "🔄 [WORKFLOW] Hiding form sections (keeping hero + progress)..."
      );

      // Ukryj wszystkie sekcje formularza
      const allSections = dom.qsa(".section[data-tab]");
      allSections.forEach((section) => {
        section.classList.remove("active");
        section.style.display = "none";
      });

      // Progress bar ma być widoczny i ustawiony na 100%
      if (progressBarContainer) {
        progressBarContainer.style.display = "";
        progressBarContainer.classList.remove("hidden");
      }
      if (progressFill) {
        progressFill.dataset.progress = "100";
        if (motion && typeof motion.animateProgress === "function") {
          motion.animateProgress(progressFill, 1);
        } else {
          progressFill.style.transform = "scaleX(1)";
        }
      }
      if (progressPercentage) {
        progressPercentage.textContent = "100%";
        progressPercentage.style.display = "";
      }
      if (progressLabel) {
        progressLabel.textContent = "Wyniki";
      }

      // Ukryj results container (będzie pokazany po kliknięciu CTA)
      const resultsContainer = dom.qs(".hp-results");
      if (resultsContainer) {
        resultsContainer.style.display = "none";
      }

      console.log("✅ [WORKFLOW] Form hidden, progress kept");

      // Stwórz lub znajdź workflow completion container
      let completionContainer = dom.qs(".workflow-completion");
      if (!completionContainer) {
        console.log("🔧 [WORKFLOW] Creating workflow completion container...");
        completionContainer = root.ownerDocument.createElement("div");
        completionContainer.className = "workflow-completion";
        // Wstaw pod progress barem (pod placeholderem) i nad formularzem
        const anchor = progressPlaceholder || progressBarContainer || root;
        if (anchor && anchor.parentNode) {
          anchor.parentNode.insertBefore(
            completionContainer,
            anchor.nextSibling
          );
        } else {
          root.appendChild(completionContainer);
        }
        console.log("✅ [WORKFLOW] Container created");
      }

      // Pokaż workflow completion (normal flow, stylowane przez CSS)
      completionContainer.style.display = "block";
      completionContainer.style.position = "";
      completionContainer.style.top = "";
      completionContainer.style.left = "";
      completionContainer.style.width = "";
      completionContainer.style.height = "";
      completionContainer.style.zIndex = "";
      completionContainer.style.background = "";
      completionContainer.style.alignItems = "";
      completionContainer.style.justifyContent = "";

      // Upewnij się, że użytkownik widzi ekran 0 (nie na stopce po zwinięciu treści)
      try {
        const scrollTarget = progressBarContainer || completionContainer;
        if (scrollTarget && typeof scrollTarget.scrollIntoView === "function") {
          scrollTarget.scrollIntoView({ behavior: "smooth", block: "start" });
          // skoryguj o wysokość nagłówka (jeśli ustawiona)
          setTimeout(() => {
            const headerHeight =
              parseFloat(
                getComputedStyle(docEl).getPropertyValue("--header-height")
              ) ||
              (header ? header.offsetHeight : 0) ||
              0;
            if (headerHeight) {
              view.scrollTo({
                top: Math.max(
                  0,
                  (view.pageYOffset || docEl.scrollTop) - headerHeight - 12
                ),
                behavior: "smooth",
              });
            }
          }, 50);
        }
      } catch (e) {
        /* ignore */
      }

      console.log("✅ [WORKFLOW] Workflow completion shown (in flow)");

      // Ukryj konfigurator (będzie pokazany po kliknięciu CTA)
      const configView = dom.byId("configurator-view");
      const switcher = dom.qs('[data-role="results-switcher"]');

      if (configView) {
        configView.classList.remove("visible");
        configView.classList.add("hidden");
        configView.style.display = "none";
      }
      if (switcher) {
        switcher.style.display = "none";
      }

      const messages = [
        "Gratulacje! Zakończyłeś obliczenia związane z OZC Twojego budynku.",
        "Twoja pompa została dopasowana pod budynek. Teraz możesz dostosować maszynownię i osprzęt.",
      ];

      completionContainer.innerHTML =
        '<div class="typewriter-container"></div>';
      const typewriterContainer = completionContainer.querySelector(
        ".typewriter-container"
      );

      const typeMessage = (message, container, duration) =>
        new Promise((resolve) => {
          const textElement = root.ownerDocument.createElement("div");
          textElement.className = "typewriter-text typing";
          container.appendChild(textElement);

          const chars = message.split("");
          const charDelay = duration / chars.length;
          let currentIndex = 0;

          const typeChar = () => {
            if (currentIndex < chars.length) {
              textElement.textContent += chars[currentIndex];
              currentIndex++;
              setTimeout(typeChar, charDelay);
            } else {
              textElement.classList.remove("typing");
              setTimeout(resolve, 600);
            }
          };

          typeChar();
        });

      (async function run() {
        for (let i = 0; i < messages.length; i++) {
          await typeMessage(
            messages[i],
            typewriterContainer,
            i === 0 ? 1500 : 1200
          );
        }

        const ctaHTML = `
          <div class="workflow-cta">
            <button type="button" class="workflow-cta-button" data-action="start-config">
              Rozpocznij personalizację
              <i class="ph ph-arrow-right"></i>
            </button>
          </div>
        `;
        completionContainer.insertAdjacentHTML("beforeend", ctaHTML);

        setTimeout(() => {
          const cta = completionContainer.querySelector(".workflow-cta");
          if (cta) cta.classList.add("visible");
        }, 400);
      })();
    }

    function startConfigurator(event) {
      if (event && event.preventDefault) {
        event.preventDefault();
        event.stopPropagation();
      }

      console.log(
        "🚀 [WORKFLOW] startConfigurator() called - showing configurator"
      );
      try {
        console.debug(
          "[HP_DIAG] startConfigurator called for root",
          root.getAttribute("data-hp-instance")
        );
      } catch (e) {}

      // Ukryj workflow completion (fullscreen overlay)
      const completionContainer = dom.qs(".workflow-completion");
      if (completionContainer) {
        console.log("🔄 [WORKFLOW] Hiding workflow completion...");
        completionContainer.style.display = "none";
        console.log("✅ [WORKFLOW] Workflow completion hidden");
      }

      // Ukryj progress bar (na stałe - nie potrzebny w konfiguratorze)
      if (progressBarContainer) {
        progressBarContainer.style.display = "none";
        progressBarContainer.classList.add("hidden");
        if (progressPlaceholder) {
          progressPlaceholder.style.display = "none";
          progressPlaceholder.classList.remove("active");
        }
      }

      // Pokaż results container (z konfiguratorem)
      console.log("🔄 [WORKFLOW] Showing results container...");
      const resultsContainer = dom.qs(".hp-results");
      if (resultsContainer) {
        // IMPORTANT: .hidden uses display:none !important (main.css),
        // so we must remove the class to make results visible.
        resultsContainer.classList.remove("hidden");
        resultsContainer.style.display = "block";
        console.log("✅ [WORKFLOW] Results container shown");
      }

      // Pokaż results wrapper
      const resultsWrapper = dom.qs(".results-wrapper.section");
      if (resultsWrapper) {
        resultsWrapper.classList.add("active");
        resultsWrapper.style.display = "block";
      }

      // Pokaż konfigurator
      console.log("🔄 [WORKFLOW] Showing configurator view...");
      const configView = dom.byId("configurator-view");
      const switcher = dom.qs('[data-role="results-switcher"]');

      if (configView) {
        configView.classList.remove("hidden");
        configView.classList.add("visible");
        configView.style.display = "block";
        console.log("✅ [WORKFLOW] Configurator view shown");
      } else {
        console.error("❌ [WORKFLOW] Configurator view not found!");
      }

      if (switcher) {
        // Keep switcher visible on configurator view
        switcher.style.display = "flex";
      }

      // Safety: mark root as configurator view so global CSS can keep configurator hidden unless explicitly opened
      try {
        root.setAttribute("data-view", "configurator");
      } catch (e) {
        /* ignore */
      }

      // Initialize configurator module lazily when entering configurator view
      console.log("🔧 [WORKFLOW] Initializing configurator module...");
      try {
        if (
          window.__HP_MODULES__ &&
          window.__HP_MODULES__.configurator &&
          typeof window.__HP_MODULES__.configurator.init === "function"
        ) {
          window.__HP_MODULES__.configurator.init({ root, dom, state });
          console.log("✅ [WORKFLOW] Configurator module initialized");
        } else {
          console.warn("⚠️ [WORKFLOW] Configurator module not available");
        }
      } catch (err) {
        console.error("❌ [WORKFLOW] Init configurator failed:", err);
      }

      // Scroll do konfiguratora
      console.log("🔄 [WORKFLOW] Scrolling to configurator...");
      setTimeout(() => {
        const resultsSection = dom.qs('.section[data-tab="6"]');
        if (resultsSection) {
          const headerHeight = header ? header.offsetHeight : 60;
          const buffer = 20;
          const targetY = resultsSection.offsetTop - headerHeight - buffer;
          view.scrollTo({ top: targetY, behavior: "smooth" });
          console.log("✅ [WORKFLOW] Scrolled to configurator");
        }
      }, 100);
    }

    function bindCta() {
      // ⚠️ FIX P0.2: Guard przeciwko duplikacji listenerów (kliknięcia nie mogą odpalać 2×)
      if (root.dataset.ctaListenerBound === "true") {
        return () => {}; // Już zbindowane - zwróć pusty disposer
      }

      const handler = (event) => {
        const action = event.target?.dataset?.action;
        if (action === "start-config") {
          startConfigurator(event);
        }
      };
      root.addEventListener("click", handler);
      try {
        root.dataset.ctaListenerBound = "true"; // Oznacz jako zbindowane
        root.dataset.startConfigListener = "true"; // Zachowaj dla kompatybilności
      } catch (e) {}

      return () => {
        root.removeEventListener("click", handler);
        try {
          delete root.dataset.ctaListenerBound;
          delete root.dataset.startConfigListener;
        } catch (e) {}
      };
    }

    // Event listener dla showWorkflowCompletion (wywołane z apiCaller)
    function bindShowWorkflowCompletion() {
      const handler = (event) => {
        console.log(
          "🎬 [WORKFLOW] Event 'heatpump:showWorkflowCompletion' received"
        );
        const result = event.detail?.result;
        if (result) {
          startCompletion(result);
        } else {
          console.warn("⚠️ [WORKFLOW] No result in event detail");
        }
      };
      root.addEventListener("heatpump:showWorkflowCompletion", handler);
      return () =>
        root.removeEventListener("heatpump:showWorkflowCompletion", handler);
    }

    function reset() {
      typewriterActive = false;
      typewriterCompleted = false;
      stickyDisabled = false;

      if (typewriterTimeout) {
        clearTimeout(typewriterTimeout);
        typewriterTimeout = null;
      }

      const completionContainer = dom.qs(".workflow-completion");
      if (completionContainer) {
        completionContainer.style.display = "none";
      }

      if (progressBarContainer) {
        progressBarContainer.style.display = "";
        progressBarContainer.classList.remove("hidden");
      }
      if (progressPlaceholder) {
        progressPlaceholder.style.display = "none";
        progressPlaceholder.classList.remove("active");
      }

      // Remove configurator view marker when resetting workflow
      try {
        root.removeAttribute("data-view");
      } catch (e) {
        /* ignore */
      }
    }

    if (initialized) return () => {};
    initialized = true;

    if (!progressBar || !form) {
      return () => {};
    }

    updateTriggerOffset();
    setupStickyProgress();
    watchTabs();

    const disposeCta = bindCta();
    const disposeShowWorkflow = bindShowWorkflowCompletion();

    if (state) {
      state.workflowController = { reset };
    }

    return function disposer() {
      if (scrollHandler) view.removeEventListener("scroll", scrollHandler);
      if (resizeHandler) view.removeEventListener("resize", resizeHandler);
      if (observer) observer.disconnect();
      if (disposeCta) disposeCta();
      if (disposeShowWorkflow) disposeShowWorkflow();
      reset();
      if (
        state &&
        state.workflowController &&
        state.workflowController.reset === reset
      ) {
        delete state.workflowController;
      }
    };
  }

  // Eksportuj funkcję showWorkflowCompletion dla apiCaller
  window.showWorkflowCompletion = function (result) {
    console.log("🎬 [WORKFLOW-GLOBAL] showWorkflowCompletion() called");
    console.log("📊 [WORKFLOW-GLOBAL] Result:", result);

    // Znajdź aktywny root
    const activeRoot = document.querySelector(".heatpump-calculator");
    if (!activeRoot) {
      console.error("❌ [WORKFLOW-GLOBAL] No active root found!");
      return;
    }

    // Wywołaj startCompletion bezpośrednio przez re-init modułu
    // (to jest workaround, bo startCompletion jest w closure)
    const event = new CustomEvent("heatpump:showWorkflowCompletion", {
      detail: { result },
      bubbles: true,
    });
    activeRoot.dispatchEvent(event);
    console.log("✅ [WORKFLOW-GLOBAL] Event dispatched");
  };

  window.__HP_MODULES__ = window.__HP_MODULES__ || {};
  window.__HP_MODULES__.workflowController = { init };
})(window);
