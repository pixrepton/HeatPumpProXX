/**
 * ERROR HANDLER SYSTEM
 * Zastępuje alert() profesjonalnymi inline error messages
 */

const ErrorHandler = {
  /**
   * Pokazuje błąd przy konkretnym polu
   */
  showFieldError(fieldElement, message, suggestion = '') {
    if (!fieldElement) return;
    
    this.clearFieldError(fieldElement);
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.innerHTML = `
      <i class="ph ph-warning-circle"></i>
      <span>${message}${suggestion ? `. ${suggestion}` : ''}</span>
    `;
    
    fieldElement.classList.add('field-invalid');
    const fieldItem = fieldElement.closest('.form-field-item');
    if (fieldItem) fieldItem.classList.add('has-error');
    
    // Dodaj error po elemencie lub po jego parent node
    if (fieldElement.parentNode) {
      fieldElement.parentNode.appendChild(errorDiv);
    }
    
    // Scroll do błędu (delikatnie)
    setTimeout(() => {
      fieldElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
      });
    }, 100);
  },
  
  /**
   * Czyści błąd przy polu
   */
  clearFieldError(fieldElement) {
    if (!fieldElement) return;
    
    fieldElement.classList.remove('field-invalid');
    const fieldItem = fieldElement.closest('.form-field-item');
    if (fieldItem) fieldItem.classList.remove('has-error');
    
    // Usuń wszystkie error messages w parent node
    if (fieldElement.parentNode) {
      const errors = fieldElement.parentNode.querySelectorAll('.field-error');
      errors.forEach(err => err.remove());
    }
  },
  
  /**
   * Czyści wszystkie błędy w formularzu
   */
  clearAllErrors() {
    hpQsa('.field-invalid').forEach(field => {
      this.clearFieldError(field);
    });
    
    hpQsa('.form-notification').forEach(notif => {
      notif.remove();
    });
  },
  
  /**
   * Notyfikacja na poziomie formularza (dla wielu błędów)
   */
  showFormNotification(title, message, errors = [], type = 'error') {
    // Usuń poprzednie notyfikacje
    const existing = hpQs('.form-notification');
    if (existing) existing.remove();
    
    // Generuj listę błędów
    const errorsList = errors.length ? `
      <ul>
        ${errors.map(err => `
          <li>
            <a href="#${err.field}" class="error-link">${err.label}</a> 
            ${err.message}
          </li>
        `).join('')}
      </ul>
    ` : '';
    
    // Wybierz ikonę
    const icon = type === 'error' ? 'warning-circle' : 
                 type === 'success' ? 'check-circle' : 
                 'info';
    
    const notification = document.createElement('div');
    notification.className = `form-notification ${type}`;
    notification.innerHTML = `
      <div class="notification-icon">
        <i class="ph ph-${icon}"></i>
      </div>
      <div class="notification-content">
        <h4>${title}</h4>
        <p>${message}</p>
        ${errorsList}
      </div>
      <button class="notification-close" aria-label="Zamknij">
        <i class="ph ph-x"></i>
      </button>
    `;
    
    // Znajdź formularz lub section
    const form = hpById('heatCalcFormFull') || 
                 hpQs('.section.active') ||
                 hpQs('form');
    
    if (form) {
      form.insertBefore(notification, form.firstChild);
      
      // Zamykanie
      const closeBtn = notification.querySelector('.notification-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          notification.style.animation = 'fadeOut 0.3s ease';
          setTimeout(() => notification.remove(), 300);
        });
      }
      
      // Scroll do błędnych pól
      notification.querySelectorAll('.error-link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const fieldId = link.getAttribute('href').substring(1);
          const field = hpById(fieldId);
          if (field) {
            field.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
            setTimeout(() => field.focus(), 500);
          }
        });
      });
      
      // Auto-scroll do notyfikacji
      notification.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  },
  
  /**
   * Toast dla success/info (krótkie komunikaty)
   */
  showToast(message, type = 'success', duration = 3000) {
    let container = hpQs('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'error' ? 'warning-circle' : 
                 'info';
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="ph ph-${icon}"></i>
      <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },
  
  /**
   * Walidacja API errors (z cieplo.app)
   */
  handleAPIErrors(errors, formData = {}) {
    if (!errors || typeof errors !== 'object') return;
    
    const errorList = [];
    const fieldLabels = {
      'building_type': 'Typ budynku',
      'construction_year': 'Rok budowy',
      'heated_area': 'Powierzchnia ogrzewana',
      'total_area': 'Powierzchnia całkowita',
      'latitude': 'Lokalizacja',
      'longitude': 'Lokalizacja',
      'heating_type': 'Typ ogrzewania',
      'source_type': 'Źródło ciepła'
    };
    
    // Przetwórz błędy
    Object.entries(errors).forEach(([field, message]) => {
      let messageText;
      if (Array.isArray(message)) {
        messageText = message.join(', ');
      } else if (typeof message === 'object' && message !== null) {
        messageText = JSON.stringify(message);
      } else {
        messageText = String(message);
      }
      
      const fieldElement = hpById(field) || 
                           hpQs(`[name="${field}"]`);
      
      if (fieldElement) {
        this.showFieldError(fieldElement, messageText);
      }
      
      errorList.push({
        field: field,
        label: fieldLabels[field] || field,
        message: messageText
      });
    });
    
    // Pokaż notyfikację z listą błędów
    if (errorList.length > 0) {
      this.showFormNotification(
        'Popraw błędy w formularzu',
        `Znaleziono ${errorList.length} ${errorList.length === 1 ? 'błąd' : 'błędy'} w wprowadzonych danych:`,
        errorList,
        'error'
      );
    }
  }
};

// Keyframe dla fadeOut (do CSS)
if (!hpQs('#error-handler-keyframes')) {
  const style = document.createElement('style');
  style.id = 'error-handler-keyframes';
  style.textContent = `
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// Export do window
window.ErrorHandler = ErrorHandler;