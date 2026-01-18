/**
 * Email Sender Module - Heat Pump Calculator Email System
 * TOP-INSTAL Email Integration with PDF Attachment
 * Works with email-proxy.php for server-side email handling
 */

(function () {
  'use strict';

  // Przechowywanie stanu wysyłek emaili
  let emailSendingInProgress = false;

  /**
   * Sends offer email with PDF attachment
   * @param {Object} configData - Configuration data from form
   * @param {string} emailAddress - Recipient email address
   * @returns {Promise} Email sending promise
   */
  async function sendOfferByEmail(configData, emailAddress) {
    // Zapobiegaj wielokrotnym wysyłkom
    if (emailSendingInProgress) {
      console.warn('Email już jest wysyłany, proszę czekać...');
      return;
    }

    try {
      emailSendingInProgress = true;

      // Walidacja danych wejściowych
      if (!configData) {
        throw new Error('Brak danych konfiguracji');
      }

      if (!emailAddress) {
        throw new Error('Podaj adres email');
      }

      if (!isValidEmail(emailAddress)) {
        throw new Error('Podaj prawidłowy adres email (np. nazwa@firma.pl)');
      }

      // Show loading indicator with timeout protection
      showEmailLoadingState();

      // Timeout dla całego procesu (30 sekund)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Przekroczono czas oczekiwania (30s)')), 30000);
      });

      // Główny proces wysyłki
      const sendProcess = async () => {
        // Generate PDF data first
        const pdfData = await generatePDFForEmail(configData);

        // Prepare email data
        const emailData = {
          to: emailAddress.trim(),
          subject: `Oferta pompy ciepła TOP-INSTAL - ${new Date().toLocaleDateString('pl-PL')}`,
          message: createEmailMessage(configData),
          pdfData: pdfData,
          clientData: {
            buildingArea: configData.area || 'Nie podano',
            buildingType: getBuildingTypeText(configData),
            heatingType: getHeatingTypeText(configData),
            recommendedPump: getRecommendedPumpModel(configData),
          },
        };

        // Send email via PHP proxy
        // WP contract: preferuj HEATPUMP_CONFIG.emailProxyUrl. Nie fallbackuj do domeny produkcyjnej.
        const cfg = window.HEATPUMP_CONFIG || {};
        const emailProxyUrl =
          cfg.emailProxyUrl ||
          (cfg.siteUrl ? String(cfg.siteUrl).replace(/\/$/, '') + '/email-proxy.php' : '');

        if (!emailProxyUrl) {
          throw new Error(
            'Brak konfiguracji emailProxyUrl (HEATPUMP_CONFIG). Skonfiguruj endpoint wysyłki email po stronie WordPress.'
          );
        }

        // Dodaj nonce jeśli dostępny (WordPress security)
        const headers = {
          'Content-Type': 'application/json',
        };

        if (window.HEATPUMP_CONFIG && window.HEATPUMP_CONFIG.nonce) {
          headers['X-WP-Nonce'] = window.HEATPUMP_CONFIG.nonce;
        }

        const response = await fetch(emailProxyUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(emailData),
        });

        if (!response.ok) {
          throw new Error(`Błąd serwera: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
          showEmailSuccessMessage(emailAddress);

          // Wyczyść pole email po sukcesie
          const emailInput = hpQs('input[type="email"]');
          if (emailInput) {
            emailInput.value = '';
          }

          return result;
        } else {
          throw new Error(result.error || 'Nieznany błąd serwera email');
        }
      };

      // Uruchom z timeoutem
      const result = await Promise.race([sendProcess(), timeoutPromise]);
      return result;
    } catch (error) {
      console.error('❌ Błąd wysyłki email:', error);

      // Kategoryzacja błędów dla lepszego UX
      let userMessage = error.message;

      if (error.message.includes('fetch')) {
        userMessage = 'Brak połączenia z serwerem. Sprawdź połączenie internetowe.';
      } else if (error.message.includes('timeout') || error.message.includes('Przekroczono czas')) {
        userMessage = 'Wysyłka trwa za długo. Spróbuj ponownie za chwilę.';
      } else if (error.message.includes('500')) {
        userMessage = 'Tymczasowy błąd serwera. Spróbuj ponownie za kilka minut.';
      }

      showEmailErrorMessage(userMessage);
      throw error;
    } finally {
      hideEmailLoadingState();
      emailSendingInProgress = false;
    }
  }

  /**
   * Generates PDF data for email attachment with error handling
   * @param {Object} configData - Configuration data
   * @returns {Promise<string>} Base64 encoded PDF data
   */
  async function generatePDFForEmail(configData) {
    return new Promise(async (resolve, reject) => {
      let tempContainer;

      try {
        // Walidacja configData
        if (!configData) {
          throw new Error('Brak danych konfiguracji do PDF');
        }

        // OPTIMIZATION: Lazy load PDF libraries on-demand
        if (typeof window.loadPdfLibraries === 'function') {
          await window.loadPdfLibraries();
        } else if (typeof html2pdf === 'undefined') {
          throw new Error('Biblioteka html2pdf nie jest załadowana. Użyj loadPdfLibraries() z downloadPDF.js.');
        }

        const pdfContent = createPDFContentForEmail(configData);

        if (!pdfContent || pdfContent.length < 100) {
          throw new Error('Wygenerowany content PDF jest pusty lub nieprawidłowy');
        }

        const options = {
          margin: [15, 15, 15, 15],
          filename: `Oferta_Pompa_Ciepla_${new Date().toISOString().split('T')[0]}.pdf`,
          image: { type: 'jpeg', quality: 0.85 }, // Zmniejszona jakość dla szybszego generowania
          html2canvas: {
            scale: 1.5, // Zmniejszone z 2 dla szybszego przetwarzania
            useCORS: true,
            letterRendering: true,
            logging: false, // Wyłącz logi html2canvas
            allowTaint: false,
          },
          jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait',
            compress: true,
          },
        };

        tempContainer = document.createElement('div');
        tempContainer.innerHTML = pdfContent;
        tempContainer.style.cssText = `
                    position: absolute;
                    left: -9999px;
                    top: -9999px;
                    width: 210mm;
                    background: white;
                    font-family: Arial, sans-serif;
                `;
        document.body.appendChild(tempContainer);

        // Timeout dla generowania PDF (20 sekund)
        const pdfTimeout = setTimeout(() => {
          if (tempContainer && document.body.contains(tempContainer)) {
            document.body.removeChild(tempContainer);
          }
          reject(new Error('Przekroczono czas generowania PDF (20s)'));
        }, 20000);

        html2pdf()
          .set(options)
          .from(tempContainer)
          .outputPdf('datauristring')
          .then(pdfData => {
            clearTimeout(pdfTimeout);

            if (tempContainer && document.body.contains(tempContainer)) {
              document.body.removeChild(tempContainer);
            }

            if (!pdfData || !pdfData.includes('data:application/pdf')) {
              throw new Error('Nieprawidłowy format wygenerowanego PDF');
            }

            // Extract base64 data from data URI
            const base64Data = pdfData.split(',')[1];

            if (!base64Data || base64Data.length < 1000) {
              throw new Error('Wygenerowany PDF jest za mały lub uszkodzony');
            }

            resolve(base64Data);
          })
          .catch(error => {
            clearTimeout(pdfTimeout);

            if (tempContainer && document.body.contains(tempContainer)) {
              document.body.removeChild(tempContainer);
            }

            console.error('Błąd html2pdf:', error);
            reject(new Error(`Błąd generowania PDF: ${error.message}`));
          });
      } catch (error) {
        if (tempContainer && document.body.contains(tempContainer)) {
          document.body.removeChild(tempContainer);
        }
        reject(new Error(`Błąd przygotowania PDF: ${error.message}`));
      }
    });
  }

  /**
   * Creates email message content
   * @param {Object} configData - Configuration data
   * @returns {string} HTML email content
   */
  function createEmailMessage(configData) {
    const currentDate = new Date().toLocaleDateString('pl-PL');

    return `
        <div style="font-family: 'Titillium Web', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a202c;">
            <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #d4a574; padding-bottom: 20px;">
                <h1 style="color: #d4a574; font-size: 28px; margin: 0;">TOP-INSTAL</h1>
                <h2 style="color: #4b5563; font-size: 18px; margin: 10px 0;">Dziękujemy za skorzystanie z kalkulatora!</h2>
            </div>

            <div style="margin-bottom: 25px;">
                <p style="font-size: 16px; line-height: 1.6;">Szanowni Państwo,</p>

                <p style="font-size: 14px; line-height: 1.6;">
                    Dziękujemy za skorzystanie z kalkulatora pomp ciepła TOP-INSTAL.
                    W załączniku znajdą Państwo szczegółową ofertę dopasowaną do Państwa budynku.
                </p>

                <div style="background: #faf9f9; padding: 20px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #d4a574;">
                    <h3 style="color: #d4a574; margin-top: 0;">Podsumowanie Państwa konfiguracji:</h3>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        <li><strong>Powierzchnia:</strong> ${
                          configData.area || 'Nie podano'
                        } m²</li>
                        <li><strong>Typ budynku:</strong> ${getBuildingTypeText(configData)}</li>
                        <li><strong>System ogrzewania:</strong> ${getHeatingTypeText(
                          configData
                        )}</li>
                        <li><strong>Rekomendowana pompa:</strong> ${getRecommendedPumpModel(
                          configData
                        )}</li>
                    </ul>
                </div>

                <p style="font-size: 14px; line-height: 1.6;">
                    Nasza oferta jest przygotowana na podstawie wprowadzonych przez Państwa danych.
                    Dla uzyskania dokładnej wyceny, zapraszamy do kontaktu z naszymi specjalistami.
                </p>
            </div>

            <div style="background: #d4a574; color: white; padding: 20px; border-radius: 4px; text-align: center; margin: 30px 0;">
                <h3 style="margin: 0 0 10px 0;">Skontaktuj się z nami</h3>
                <p style="margin: 5px 0;">📞 Tel: +48 123 456 789</p>
                <p style="margin: 5px 0;">📧 Email: biuro@top-instal.pl</p>
                <p style="margin: 5px 0;">🌐 www.top-instal.pl</p>
            </div>

            <div style="text-align: center; color: #4b5563; font-size: 12px; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
                <p>Z poważaniem,<br><strong>Zespół TOP-INSTAL</strong></p>
                <p style="margin-top: 15px;">Email wygenerowany automatycznie - ${currentDate}</p>
            </div>
        </div>`;
  }

  /**
   * Creates PDF content specifically for email (simplified version)
   * @param {Object} configData - Configuration data
   * @returns {string} HTML content for PDF
   */
  function createPDFContentForEmail(configData) {
    // Use the same PDF content as the main PDF module
    // This ensures consistency between downloaded and emailed PDFs
    if (window.createPDFContent) {
      return window.createPDFContent(configData);
    }

    // Fallback if main PDF module not available
    return createSimplifiedPDFContent(configData);
  }

  function createSimplifiedPDFContent(configData) {
    const currentDate = new Date().toLocaleDateString('pl-PL');

    return `
        <div style="font-family: 'Titillium Web', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 210mm; margin: 0 auto; padding: 20px; color: #1a202c;">
            <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #d4a574; padding-bottom: 20px;">
                <h1 style="color: #d4a574; font-size: 28px; margin: 0;">TOP-INSTAL</h1>
                <h2 style="color: #4b5563; font-size: 18px; margin: 5px 0;">Oferta - Pompa Ciepła</h2>
                <p style="color: #6b7280; font-size: 14px; margin: 0;">Data: ${currentDate}</p>
            </div>

            <div style="margin-bottom: 25px;">
                <h3 style="color: #d4a574; font-size: 16px; margin-bottom: 15px;">Dane budynku</h3>
                <p><strong>Powierzchnia:</strong> ${configData.area || 'Nie podano'} m²</p>
                <p><strong>Typ budynku:</strong> ${getBuildingTypeText(configData)}</p>
                <p><strong>System ogrzewania:</strong> ${getHeatingTypeText(configData)}</p>
            </div>

            <div style="margin-bottom: 25px;">
                <h3 style="color: #d4a574; font-size: 16px; margin-bottom: 15px;">Rekomendacja</h3>
                <div style="background: #faf9f9; padding: 20px; border-radius: 4px;">
                    <h4 style="color: #d4a574; margin: 0 0 10px 0;">${getRecommendedPumpModel(
                      configData
                    )}</h4>
                    <p><strong>Moc grzewcza:</strong> ${getHeatingPowerForEmail(configData)} kW</p>
                </div>
            </div>
        </div>`;
  }

  // Helper functions
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function getBuildingTypeText(data) {
    if (data.buildingType === 'house') return 'Dom jednorodzinny';
    if (data.buildingType === 'apartment') return 'Mieszkanie';
    return 'Nie określono';
  }

  function getHeatingTypeText(data) {
    if (data.heatingType === 'radiators') return 'Grzejniki';
    if (data.heatingType === 'floor') return 'Ogrzewanie podłogowe';
    return 'Mieszane';
  }

  function getRecommendedPumpModel(data) {
    const area = parseInt(data.area) || 100;
    if (area < 100) return 'PANASONIC Aquarea T-CAP 9kW';
    if (area < 150) return 'PANASONIC Aquarea T-CAP 12kW';
    return 'PANASONIC Aquarea T-CAP 16kW';
  }

  function getHeatingPowerForEmail(data) {
    const area = parseInt(data.area) || 100;
    return Math.round(area * 0.08);
  }

  // UI Helper functions
  function showEmailLoadingState() {
    const button = hpQs('.email-send-button');
    if (button) {
      button.disabled = true;
      button.innerHTML = '📧 Wysyłam...';
      button.style.opacity = '0.7';
    }
  }

  function hideEmailLoadingState() {
    const button = hpQs('.email-send-button');
    if (button) {
      button.disabled = false;
      button.innerHTML = '📧 Wyślij PDF';
      button.style.opacity = '1';
    }
  }

  function showEmailSuccessMessage(email) {
    const message = `✅ Oferta została wysłana na adres: ${email}`;
    showNotification(message, 'success');
  }

  function showEmailErrorMessage(error) {
    const message = `❌ Błąd wysyłki: ${error}`;
    showNotification(message, 'error');
  }

  function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `email-notification ${type}`;
    notification.innerHTML = message;
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#d4edda' : '#f8d7da'};
            color: ${type === 'success' ? '#155724' : '#721c24'};
            border: 1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'};
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            max-width: 300px;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;

    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 5000);
  }

  // Export to global scope for compatibility
  window.sendOfferByEmail = sendOfferByEmail;

})();
