/**
 * AI COACH DOCK v2.0 - Explainable Decision Support Layer
 *
 * ARCHITECTURAL PRINCIPLES:
 * - Dock NIE wprowadza nowej logiki biznesowej
 * - Dock NIE zgaduje / nie losuje podpowiedzi
 * - Dock NIE jest aktywny bez powodu
 * - Dock jest cienką warstwą interpretacyjną nad Rules Engine
 * - Dock reaguje WYŁĄCZNIE na realne ryzyko lub niepewność decyzji
 * - Dock wzmacnia pewność systemu, nie "rozmowność AI"
 */

(function () {
  'use strict';

  function init(ctx = {}) {
    const disposers = [];
    const root = ctx.root || window.__HP_ACTIVE_ROOT__ || null;
    if (!root) return () => {};

    if (typeof window.__HP_SET_ACTIVE_ROOT__ === 'function') {
      window.__HP_SET_ACTIVE_ROOT__(root);
    }

    const dom =
      ctx.dom ||
      (root && typeof window.createScopedDom === 'function' ? window.createScopedDom(root) : null);
    const qs = dom ? dom.qs.bind(dom) : selector => root.querySelector(selector);
    const configuratorApi = ctx.state?.configuratorApi || null;

    const dock = qs('[data-role="ai-coach-dock"]');
    const aiIcon = qs('[data-role="ai-coach-icon"]');
    const aiSvg = qs('[data-role="ai-icon-svg"]');
    const dockText = qs('[data-role="ai-coach-dock-text"]');
    const btnPause = qs('[data-role="ai-coach-pause"]');
    const btnResume = qs('[data-role="ai-coach-resume"]');
    const panel = qs('[data-role="ai-coach-panel"]');
    const panelContext = qs('[data-role="ai-coach-panel-context"]');
    const panelClose = panel ? panel.querySelector('.ai-coach-panel__close') : null;
    const suggestionsList = qs('[data-role="ai-coach-suggestions-list"]');
    const doc = (dock && dock.ownerDocument) || root.ownerDocument || window.document;
    const view = doc.defaultView || window;

    if (!dock) {
      console.warn('AI Coach Dock: Element [data-role="ai-coach-dock"] nie został znaleziony');
      return () => {};
    }

    const trackEvent = (element, event, handler, options) => {
      if (!element || !event || typeof handler !== 'function') return;
      element.addEventListener(event, handler, options);
      disposers.push(() => {
        try {
          element.removeEventListener(event, handler, options);
        } catch (e) {}
      });
    };

    const trackObserver = observer => {
      if (observer && typeof observer.disconnect === 'function') {
        disposers.push(() => observer.disconnect());
      }
      return observer;
    };

    let aiCoachState = {
      mode: 'silent', // 'silent' | 'suggest' | 'warn'
      severity: null, // 'INFO' | 'RECOMMENDED' | 'MANDATORY' | null
      context: {
        sectionKey: null,
        sectionLabel: null,
      },
      reasonCode: null,
      explanation: null,
      lastUserInteraction: Date.now(),
    };

    let stateSnapshotBeforeApply = null;
    let paused = localStorage.getItem('ai_coach_pause') === '1';

    const reasonCodeExplanations = {
      ANTI_CYCLING_REQUIRED:
        'Bufor jest wymagany, ponieważ minimalna modulacja pompy jest wyższa niż chwilowe zapotrzebowanie budynku. Bez bufora pompa będzie często włączać i wyłączać się (taktowanie), co skraca jej żywotność.',
      HYDRAULIC_SEPARATION_REQUIRED:
        'Sprzęgło hydrauliczne jest wymagane dla separacji obiegów. Zapewnia niezależną pracę pompy i instalacji, eliminując wzajemne oddziaływanie.',
      BIVALENT_SOURCE_REQUIRED:
        'Bufor jest wymagany ze względu na obecność drugiego źródła ciepła (kocioł, kominek). Bufor umożliwia współpracę obu źródeł bez konfliktów.',
      SYSTEM_VOLUME_INSUFFICIENT:
        'Zład własny instalacji jest niewystarczający. Bufor zwiększa pojemność wodną systemu, zapewniając stabilną pracę pompy.',
      FLOW_PROTECTION_REQUIRED:
        'Ochrona przepływu jest wymagana. Minimalny przepływ pompy przekracza możliwości instalacji bez dodatkowego elementu.',
      CWU_CAPACITY_TOO_SMALL:
        'Zasobnik CWU o większej pojemności zapewni komfortowe zaopatrzenie w ciepłą wodę przy obecnej liczbie osób i sposobie użytkowania.',
      CWU_CAPACITY_OPTIMAL: 'Pojemność zasobnika CWU jest optymalna dla Twoich potrzeb.',
      STANDARD_CALCULATION: 'Standardowa kalkulacja na podstawie podanych parametrów.',
    };

    function detectCurrentConfiguratorContext() {
      const configRoot = qs('[data-role="configurator-root"]');
      if (!configRoot) return null;
      const rect = configRoot.getBoundingClientRect();
      const midY = rect.top + rect.height / 3;
      const el = doc.elementFromPoint(
        view.innerWidth / 2,
        Math.min(view.innerHeight - 100, midY)
      );
      const section = el && (el.closest('.config-step') || el.closest('.configurator-section'));
      if (!section || !configRoot.contains(section)) return null;
      const key =
        section.getAttribute('data-step-key') || section.getAttribute('data-section-id') || null;
      const titleEl = section.querySelector('.section-title, h2.section-title, h3, h4');
      const label = titleEl ? titleEl.textContent.trim() : 'Twoja maszynownia';
      return { key, label, section };
    }

    function getRulesEngineData() {
      if (!configuratorApi || typeof configuratorApi.evaluateRules !== 'function') return null;

      const state =
        (typeof configuratorApi.getState === 'function' && configuratorApi.getState()) ||
        ctx.state?.configuratorState ||
        null;
      const evaluated = configuratorApi.evaluateRules();
      const context = detectCurrentConfiguratorContext();

      if (!context || !evaluated || !state) return null;

      const sectionDataMap = {
        bufor: evaluated.hydraulicsRecommendation || evaluated.bufferRules,
        cwu: evaluated.cwuRules,
        pompa: evaluated.summary?.pumpRecommendation,
      };

      const sectionData = sectionDataMap[context.key];

      return {
        context,
        evaluated,
        sectionData,
        severity: sectionData?.severity || null,
        reasonCodes: sectionData?.reason_codes || [],
        explanation: sectionData?.explanation || null,
      };
    }

    function generateExplanationFromReasonCodes(reasonCodes, defaultExplanation) {
      if (!reasonCodes || reasonCodes.length === 0) {
        return defaultExplanation || 'Brak dodatkowych informacji.';
      }

      const explanations = reasonCodes.map(code => reasonCodeExplanations[code]).filter(Boolean);

      if (explanations.length > 0) {
        return explanations.join(' ');
      }

      return defaultExplanation || `Kod: ${reasonCodes.join(', ')}`;
    }

    function determineDockMode(severity) {
      if (!severity || severity === 'INFO') return 'silent';
      if (severity === 'MANDATORY') return 'warn';
      if (severity === 'RECOMMENDED') return 'suggest';
      return 'silent';
    }

    function updateDockState() {
      if (paused || !dock) return;

      const rulesData = getRulesEngineData();
      if (!rulesData) {
        setSilentMode();
        return;
      }

      const { context, severity, reasonCodes, explanation } = rulesData;

      aiCoachState = {
        mode: determineDockMode(severity),
        severity,
        context: {
          sectionKey: context.key,
          sectionLabel: context.label,
        },
        reasonCode: reasonCodes[0] || null,
        explanation: generateExplanationFromReasonCodes(
          reasonCodes,
          explanation?.short || explanation?.long
        ),
        lastUserInteraction: Date.now(),
      };

      switch (aiCoachState.mode) {
        case 'warn':
          setWarnMode();
          break;
        case 'suggest':
          setSuggestMode();
          break;
        default:
          setSilentMode();
      }
    }

    function setSilentMode() {
      if (!dock || !dockText || !aiSvg) return;
      aiCoachState.mode = 'silent';
      aiSvg.style.display = '';
      dockText.textContent = 'System działa poprawnie';
      dock.classList.remove('ai-coach-warn', 'ai-coach-suggest');
      dock.classList.add('ai-coach-silent');
    }

    function setSuggestMode() {
      if (!dock || !dockText || !aiSvg) return;
      aiCoachState.mode = 'suggest';
      aiSvg.style.display = '';
      const shortText = aiCoachState.explanation
        ? aiCoachState.explanation.split('.')[0] + '.'
        : 'Rekomendacja dostępna';
      dockText.textContent = shortText.length > 50 ? shortText.substring(0, 47) + '...' : shortText;
      dock.classList.remove('ai-coach-silent', 'ai-coach-warn');
      dock.classList.add('ai-coach-suggest');
    }

    function setWarnMode() {
      if (!dock || !dockText || !aiSvg) return;
      aiCoachState.mode = 'warn';
      aiSvg.style.display = '';
      dockText.textContent = 'Wymagana decyzja techniczna';
      dock.classList.remove('ai-coach-silent', 'ai-coach-suggest');
      dock.classList.add('ai-coach-warn');
    }

    function setPausedMode() {
      if (!dock || !dockText || !aiSvg) return;
      aiSvg.style.display = '';
      dockText.textContent = 'Asystent wyłączony';
      if (btnPause) btnPause.hidden = true;
      if (btnResume) btnResume.hidden = false;
      dock.classList.add('ai-coach-paused');
    }

    function openPanel() {
      if (!panel || paused) return;

      const rulesData = getRulesEngineData();
      if (!rulesData) {
        closePanel();
        return;
      }

      const { context, sectionData, severity, reasonCodes, explanation } = rulesData;

      if (panelContext) {
        panelContext.textContent = context.label;
      }

      renderPanelContent({
        context,
        sectionData,
        severity,
        reasonCodes,
        explanation: generateExplanationFromReasonCodes(reasonCodes, explanation?.short),
        longExplanation: explanation?.long || null,
      });

      panel.hidden = false;
    }

    function closePanel() {
      if (!panel) return;
      panel.hidden = true;
    }

    function renderPanelContent({
      context,
      sectionData,
      severity,
      reasonCodes,
      explanation,
      longExplanation,
    }) {
      if (!suggestionsList) return;

      suggestionsList.innerHTML = '';

      const severityBadge = doc.createElement('div');
      severityBadge.className = `ai-coach-severity-badge ai-coach-severity-badge--${
        severity?.toLowerCase() || 'info'
      }`;
      severityBadge.textContent = severity || 'INFO';
      suggestionsList.appendChild(severityBadge);

      const explanationEl = doc.createElement('div');
      explanationEl.className = 'ai-coach-explanation';
      explanationEl.innerHTML = `
        <div class="ai-coach-explanation__title">Wyjaśnienie decyzji systemu</div>
        <div class="ai-coach-explanation__text">${explanation}</div>
        ${longExplanation ? `<div class="ai-coach-explanation__long">${longExplanation}</div>` : ''}
      `;
      suggestionsList.appendChild(explanationEl);

      if (reasonCodes && reasonCodes.length > 0) {
        const consequencesEl = doc.createElement('div');
        consequencesEl.className = 'ai-coach-consequences';
        consequencesEl.innerHTML = `
          <div class="ai-coach-consequences__title">Konsekwencje techniczne</div>
          <ul class="ai-coach-consequences__list">
            ${reasonCodes
              .map(code => {
                const explanationText = reasonCodeExplanations[code];
                return `<li>${explanationText || code}</li>`;
              })
              .join('')}
          </ul>
        `;
        suggestionsList.appendChild(consequencesEl);
      }

      if (severity === 'RECOMMENDED' || severity === 'MANDATORY') {
        const actionsEl = doc.createElement('div');
        actionsEl.className = 'ai-coach-actions';
        actionsEl.innerHTML = `
          <button type="button" id="ai-coach-apply-recommendation" class="action-btn primary">
            Zastosuj rekomendację
          </button>
          ${
            stateSnapshotBeforeApply
              ? `
            <button type="button" id="ai-coach-undo-recommendation" class="action-btn secondary">
              Cofnij
            </button>
          `
              : ''
          }
        `;

        const applyBtn = actionsEl.querySelector('#ai-coach-apply-recommendation');
        if (applyBtn) applyBtn.addEventListener('click', applyRecommendation);

        const undoBtn = actionsEl.querySelector('#ai-coach-undo-recommendation');
        if (undoBtn) undoBtn.addEventListener('click', undoRecommendation);

        suggestionsList.appendChild(actionsEl);
      }
    }

    function applyRecommendation() {
      const apiState =
        (configuratorApi && typeof configuratorApi.getState === 'function'
          ? configuratorApi.getState()
          : null) || ctx.state?.configuratorState;

      if (!apiState) {
        closePanel();
        return;
      }

      stateSnapshotBeforeApply = JSON.parse(JSON.stringify(apiState.selections || {}));

      const rulesData = getRulesEngineData();
      if (!rulesData || !rulesData.context?.key) {
        closePanel();
        return;
      }

      const evaluated = rulesData.evaluated;
      const key = rulesData.context.key;

      if (key === 'cwu') {
        const recommendedCapacity = evaluated?.cwuRules?.recommendedCapacity;
        if (
          recommendedCapacity &&
          configuratorApi &&
          typeof configuratorApi.selectOptionById === 'function'
        ) {
          const optionId = `cwu-emalia-${recommendedCapacity}`;
          if (!configuratorApi.selectOptionById(optionId)) {
            configuratorApi.selectRecommended?.('cwu');
          }
        } else {
          configuratorApi?.selectRecommended?.('cwu');
        }
      }

      if (key === 'buffer' || key === 'bufor') {
        const capacities = apiState.data?.bufferConfig?.capacities || [];
        const target =
          apiState.data?.bufferConfig?.recommendedCapacity ||
          evaluated?.bufferRules?.recommendedMin ||
          evaluated?.hydraulicsRecommendation?.buffer_liters ||
          capacities[0];

        if (configuratorApi && typeof configuratorApi.selectBufferCapacity === 'function' && target) {
          const closest = capacities.reduce((best, candidate) => {
            if (best === null) return candidate;
            return Math.abs(candidate - target) < Math.abs(best - target) ? candidate : best;
          }, null);
          if (closest !== null) {
            configuratorApi.selectBufferCapacity(closest);
          } else {
            configuratorApi.selectRecommended?.('bufor');
          }
        } else {
          configuratorApi?.selectRecommended?.('bufor');
        }
      }

      if (key === 'pompa') {
        configuratorApi?.selectRecommended?.('pompa');
      }

      setTimeout(() => {
        updateDockState();
        if (panel && !panel.hidden) {
          openPanel();
        }
      }, 100);
    }

    function undoRecommendation() {
      const apiState =
        (configuratorApi && typeof configuratorApi.getState === 'function'
          ? configuratorApi.getState()
          : null) || ctx.state?.configuratorState;
      if (!stateSnapshotBeforeApply || !apiState) return;

      apiState.selections = JSON.parse(JSON.stringify(stateSnapshotBeforeApply));
      stateSnapshotBeforeApply = null;

      if (configuratorApi && typeof configuratorApi.recompute === 'function') {
        configuratorApi.recompute();
      }

      setTimeout(() => {
        updateDockState();
        if (panel && !panel.hidden) {
          openPanel();
        }
      }, 100);
    }

    function pauseAI() {
      paused = true;
      localStorage.setItem('ai_coach_pause', '1');
      setPausedMode();
    }

    function resumeAI() {
      paused = false;
      localStorage.setItem('ai_coach_pause', '0');
      updateDockState();
    }

    function initialize() {
      if (btnPause) trackEvent(btnPause, 'click', pauseAI);
      if (btnResume) trackEvent(btnResume, 'click', resumeAI);

      if (aiIcon) {
        trackEvent(aiIcon, 'click', function () {
          if (paused) return;
          openPanel();
        });
      }

      if (panelClose) {
        trackEvent(panelClose, 'click', closePanel);
      }

      const configuratorRoot = qs('[data-role="configurator-root"]');
      if (configuratorRoot && view.MutationObserver) {
        const observer = new view.MutationObserver(() => {
          if (!paused) {
            updateDockState();
          }
        });
        observer.observe(configuratorRoot, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class', 'data-step-key'],
        });
        trackObserver(observer);
      }

      if (configuratorApi && typeof configuratorApi.recompute === 'function') {
        if (!configuratorApi.__dockWrapped) {
          const originalRecompute = configuratorApi.recompute.bind(configuratorApi);
          configuratorApi.__dockWrapped = true;
          configuratorApi.__dockOriginalRecompute = originalRecompute;
          configuratorApi.recompute = function () {
            originalRecompute();
            if (!paused) {
              setTimeout(updateDockState, 50);
            }
          };
          disposers.push(() => {
            if (
              configuratorApi.__dockWrapped &&
              configuratorApi.__dockOriginalRecompute === originalRecompute
            ) {
              configuratorApi.recompute = originalRecompute;
              configuratorApi.__dockWrapped = false;
              delete configuratorApi.__dockOriginalRecompute;
            }
          });
        }
      }

      if (paused) {
        setPausedMode();
      } else {
        updateDockState();
      }
    }

    window.aiCoachDockShow = function () {
      if (!paused) openPanel();
    };
    window.aiCoachDockPause = pauseAI;
    window.aiCoachDockResume = resumeAI;
    window.aiCoachDockUpdate = updateDockState;

    window.__initAICoach = function(ctx = {}) {
      return init(ctx);
    };

    return function disposeAiCoachDock() {
      disposers.forEach(fn => {
        try {
          fn();
        } catch (e) {}
      });
    };
  }

  window.__HP_MODULES__ = window.__HP_MODULES__ || {};
  window.__HP_MODULES__.aiCoachDock = { init };
})();
