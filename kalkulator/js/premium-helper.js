/**
 * PREMIUM HELPER - Dodatkowa logika dla premium detali
 * Obsługuje triggery dla animacji i stanów
 */

class PremiumHelper {
  constructor() {
    this.init();
  }

  init() {
    // Progress percentage update trigger
    this.observeProgressChanges();

    // Quantity input value change trigger
    this.observeQuantityChanges();

    // Typewriter container typing state
    this.observeTypewriterState();
  }

  /**
   * Obserwuj zmiany w progress bar i dodaj klasę "updated" do percentage
   */
  observeProgressChanges() {
    const progressFill = document.querySelector(".form-progress-fill");
    const progressPercentage = document.querySelector(".progress-percentage");

    if (!progressFill || !progressPercentage) return;

    // MutationObserver dla zmian w data-progress
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "data-progress"
        ) {
          progressPercentage.classList.add("updated");
          setTimeout(() => {
            progressPercentage.classList.remove("updated");
          }, 500);
        }
      });
    });

    observer.observe(progressFill, {
      attributes: true,
      attributeFilter: ["data-progress"],
    });
  }

  /**
   * Obserwuj zmiany wartości w quantity input
   */
  observeQuantityChanges() {
    const quantityInputs = document.querySelectorAll(
      '.quantity-input input[type="number"]'
    );

    quantityInputs.forEach((input) => {
      let previousValue = input.value;

      // Obserwuj zmiany wartości
      input.addEventListener("input", () => {
        const currentValue = input.value;

        if (currentValue !== previousValue) {
          // Dodaj klasę value-changed
          input.classList.add("value-changed");

          // Dodaj klasę rolling-up lub rolling-down
          if (parseInt(currentValue) > parseInt(previousValue)) {
            input.classList.add("rolling-up");
            setTimeout(() => input.classList.remove("rolling-up"), 200);
          } else {
            input.classList.add("rolling-down");
            setTimeout(() => input.classList.remove("rolling-down"), 200);
          }

          // Usuń value-changed po animacji
          setTimeout(() => {
            input.classList.remove("value-changed");
          }, 400);

          previousValue = currentValue;
        }
      });

      // Walidacja (przykład)
      input.addEventListener("blur", () => {
        const value = parseInt(input.value);
        const min = parseInt(input.min || 1);
        const max = parseInt(input.max || 999);
        const wrapper = input.closest(".quantity-input");

        if (value >= min && value <= max) {
          wrapper?.classList.add("valid");
          wrapper?.classList.remove("invalid");
        } else {
          wrapper?.classList.add("invalid");
          wrapper?.classList.remove("valid");
        }

        // Usuń klasy walidacji po 2s
        setTimeout(() => {
          wrapper?.classList.remove("valid", "invalid");
        }, 2000);
      });
    });
  }

  /**
   * Obserwuj stan typewriter (typing)
   */
  observeTypewriterState() {
    const typewriterContainer = document.querySelector(".typewriter-container");

    if (!typewriterContainer) return;

    // MutationObserver dla zmian w klasach
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class"
        ) {
          const isTyping = typewriterContainer.classList.contains("typing");

          // Możesz tutaj dodać dodatkową logikę
          if (isTyping) {
            console.log("Typewriter is typing...");
          }
        }
      });
    });

    observer.observe(typewriterContainer, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  /**
   * Trigger milestone pulse programmatically
   */
  static triggerMilestonePulse(progressFill) {
    if (!progressFill) return;

    // Usuń poprzednią animację
    progressFill.style.animation = "none";

    // Force reflow
    void progressFill.offsetWidth;

    // Dodaj animację
    progressFill.style.animation =
      "milestone-pulse 0.6s cubic-bezier(0.4, 0, 0.2, 1)";

    // Usuń po zakończeniu
    setTimeout(() => {
      progressFill.style.animation = "";
    }, 600);
  }

  /**
   * Trigger ripple effect programmatically
   */
  static triggerRipple(button, event) {
    if (!button) return;

    // Stwórz ripple element
    const ripple = document.createElement("span");
    ripple.classList.add("ripple-effect");

    // Pozycja kliknięcia
    const rect = button.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    ripple.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: rgba(212, 165, 116, 0.3);
      transform: translate(-50%, -50%);
      animation: ripple-expand 0.6s ease-out;
      pointer-events: none;
    `;

    button.style.position = "relative";
    button.style.overflow = "hidden";
    button.appendChild(ripple);

    // Usuń po animacji
    setTimeout(() => {
      ripple.remove();
    }, 600);
  }
}

// Dodaj CSS dla ripple-expand jeśli nie istnieje
if (!document.querySelector("#premium-helper-styles")) {
  const style = document.createElement("style");
  style.id = "premium-helper-styles";
  style.textContent = `
    @keyframes ripple-expand {
      from {
        width: 0;
        height: 0;
        opacity: 1;
      }
      to {
        width: 300px;
        height: 300px;
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

// Auto-initialize jeśli nie jesteśmy w demo mode
if (!document.getElementById("premiumPanel")) {
  document.addEventListener("DOMContentLoaded", () => {
    new PremiumHelper();
  });
}

// Export dla użycia w innych skryptach
if (typeof module !== "undefined" && module.exports) {
  module.exports = PremiumHelper;
}
