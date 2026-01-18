// === FILE: tooltipSystem.js ===
// 🧠 Obsługuje: System tooltipów dla ikon informacyjnych w interfejsie

(function() {
    'use strict';

    // Przechowywanie event listenerów dla tooltipów
    let tooltipEventListeners = new Map();
    let globalClickListener = null;
    let debounceTimer = null;

    /**
     * Czyszczenie starych event listenerów tooltipów
     */
    function cleanupTooltipEvents() {
        tooltipEventListeners.forEach((listeners, element) => {
            listeners.forEach(({ event, handler }) => {
                if (element && element.removeEventListener) {
                    element.removeEventListener(event, handler);
                }
            });
        });
        tooltipEventListeners.clear();

        // Usuń globalny listener
        if (globalClickListener) {
            document.removeEventListener('click', globalClickListener);
            globalClickListener = null;
        }

        // Wyczyść timer
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }
    }

    /**
     * Dodaje tooltip event listener z śledzeniem
     */
    function addTooltipEventListener(element, event, handler) {
        if (!element) return;
        
        element.removeEventListener(event, handler);
        element.addEventListener(event, handler);
        
        if (!tooltipEventListeners.has(element)) {
            tooltipEventListeners.set(element, []);
        }
        tooltipEventListeners.get(element).push({ event, handler });
    }

    /**
     * Debounced tooltip activation
     */
    function debounceTooltip(callback, delay = 100) {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(callback, delay);
    }

    /**
     * Pozycjonuje tooltip w zależności od pozycji ikony na ekranie - ZAWSZE WYŚRODKOWANY
     */
    function positionTooltip(icon, tooltip) {
        const iconRect = icon.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Reset positioning classes
        tooltip.classList.remove('tooltip-top', 'tooltip-bottom', 'tooltip-left', 'tooltip-right');
        
        // Określ pozycję pionową (górę czy dół)
        const showAbove = iconRect.bottom > viewportHeight * 0.5;
        
        // ZAWSZE WYŚRODKUJ TOOLTIP
        tooltip.classList.add('tooltip-center');
        
        // Zastosuj klasy pozycjonowania
        if (showAbove) {
            tooltip.classList.add('tooltip-top');
        } else {
            tooltip.classList.add('tooltip-bottom');
        }
        
        // Ustaw maksymalną szerokość - bezpieczna dla wszystkich ekranów
        const maxWidth = Math.min(320, viewportWidth - 40);
        tooltip.style.maxWidth = maxWidth + 'px';
        
        // Dla kwadratowego kształtu - ustaw min-height proporcjonalnie
        tooltip.style.minHeight = Math.max(80, maxWidth * 0.4) + 'px';
    }

    /**
     * Aktywuje system tooltipów dla ikon informacyjnych
     * Obsługuje zarówno desktop (hover) jak i mobile (click) z a11y
     */
    function activateTooltips() {
        try {
            // Najpierw wyczyść stare listenery
            cleanupTooltipEvents();

            const tooltipIcons = hpQsa('.tooltip-icon-wrapper');
            
            if (!tooltipIcons.length) {
                return;
            }

            tooltipIcons.forEach(icon => {
                const tooltip = icon.querySelector('.tooltip-content');
                if (!tooltip) return;

                // Ustaw atrybuty a11y
                icon.setAttribute('role', 'button');
                icon.setAttribute('tabindex', '0');
                icon.setAttribute('aria-describedby', tooltip.id || `tooltip-${Math.random().toString(36).substr(2, 9)}`);
                
                if (!tooltip.id) {
                    tooltip.id = icon.getAttribute('aria-describedby');
                }
                tooltip.setAttribute('role', 'tooltip');

                // Desktop - hover events z debounce
                const mouseenterHandler = function() {
                    debounceTooltip(() => {
                        if (tooltip) {
                            positionTooltip(icon, tooltip);
                            tooltip.classList.add('active');
                        }
                    });
                };

                const mouseleaveHandler = function() {
                    debounceTooltip(() => {
                        if (tooltip) tooltip.classList.remove('active');
                    });
                };

                addTooltipEventListener(icon, 'mouseenter', mouseenterHandler);
                addTooltipEventListener(icon, 'mouseleave', mouseleaveHandler);

                // Mobile/Click events
                const clickHandler = function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    
                    // Zamknij inne tooltips
                    hpQsa('.tooltip-content.active').forEach(t => {
                        if (t !== tooltip && t.classList.contains('active')) {
                            t.classList.remove('active');
                        }
                    });
                    
                    if (!tooltip.classList.contains('active')) {
                        positionTooltip(icon, tooltip);
                    }
                    tooltip.classList.toggle('active');
                };

                addTooltipEventListener(icon, 'click', clickHandler);

                // Keyboard support (a11y)
                const keydownHandler = function(e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        clickHandler(e);
                    } else if (e.key === 'Escape') {
                        tooltip.classList.remove('active');
                    }
                };

                addTooltipEventListener(icon, 'keydown', keydownHandler);

                // Focus events dla accessibility
                const focusableElement = icon.querySelector('button, input, select, textarea, a, [tabindex]') || icon;
                
                const focusHandler = function() {
                    debounceTooltip(() => {
                        if (tooltip) {
                            positionTooltip(icon, tooltip);
                            tooltip.classList.add('active');
                        }
                    });
                };

                const blurHandler = function() {
                    debounceTooltip(() => {
                        if (tooltip) tooltip.classList.remove('active');
                    }, 200); // Dłuższe opóźnienie dla blur
                };

                addTooltipEventListener(focusableElement, 'focus', focusHandler);
                addTooltipEventListener(focusableElement, 'blur', blurHandler);
            });

            // Global click listener - zamknij tooltips przy kliknięciu poza nimi
            globalClickListener = function(e) {
                const clickedTooltip = e.target.closest('.tooltip-icon-wrapper');
                if (!clickedTooltip) {
                    hpQsa('.tooltip-content.active').forEach(tooltip => {
                        tooltip.classList.remove('active');
                    });
                }
            };

            document.addEventListener('click', globalClickListener);


            // Window resize handler - reposition active tooltips
            const resizeHandler = function() {
                debounceTooltip(() => {
                    hpQsa('.tooltip-content.active').forEach(activeTooltip => {
                        const parentIcon = activeTooltip.closest('.tooltip-icon-wrapper');
                        if (parentIcon) {
                            positionTooltip(parentIcon, activeTooltip);
                        }
                    });
                }, 150);
            };

            addTooltipEventListener(window, 'resize', resizeHandler);

        } catch (error) {
            console.error('❌ Błąd aktywacji tooltipów:', error);
        }
    }

    /**
     * Ukrywa wszystkie aktywne tooltips
     */
    function hideAllTooltips() {
        hpQsa('.tooltip-content.active').forEach(tooltip => {
            tooltip.classList.remove('active');
        });
    }

    /**
     * Reset systemu tooltipów
     */
    function resetTooltipSystem() {
        cleanupTooltipEvents();
        hideAllTooltips();
    }

    // Global exports
    window.activateTooltips = activateTooltips;
    window.cleanupTooltipEvents = cleanupTooltipEvents;
    window.hideAllTooltips = hideAllTooltips;
    window.resetTooltipSystem = resetTooltipSystem;


})();