/**
 * Digital Wallet Integration Utilities
 * Provides Apple Pay and Google Pay functionality across the app
 */

class DigitalWalletService {
  constructor() {
    this.applePay = null;
    this.googlePay = null;
    this.isApplePayAvailable = false;
    this.isGooglePayAvailable = false;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    await Promise.all([
      this.initializeApplePay(),
      this.initializeGooglePay()
    ]);

    this.initialized = true;
  }

  async initializeApplePay() {
    try {
      // Check if Apple Pay is available
      if (typeof window !== 'undefined' && window.ApplePaySession && window.ApplePaySession.canMakePayments()) {
        this.isApplePayAvailable = true;
        console.log('✅ Apple Pay is available');
      } else {
        console.log('❌ Apple Pay not available');
      }
    } catch (error) {
      console.error('Apple Pay initialization error:', error);
    }
  }

  async initializeGooglePay() {
    try {
      if (typeof window !== 'undefined' && window.google && window.google.payments && window.google.payments.api) {
        const paymentsClient = new window.google.payments.api.PaymentsClient({
          environment: process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'TEST'
        });

        const isReadyToPayRequest = {
          allowedPaymentMethods: [{
            type: 'CARD',
            parameters: {
              allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
              allowedCardNetworks: ['VISA', 'MASTERCARD', 'AMEX']
            }
          }]
        };

        const response = await paymentsClient.isReadyToPay(isReadyToPayRequest);
        
        if (response.result) {
          this.isGooglePayAvailable = true;
          this.googlePay = paymentsClient;
          console.log('✅ Google Pay is available');
        } else {
          console.log('❌ Google Pay not available');
        }
      } else {
        console.log('❌ Google Pay API not loaded');
      }
    } catch (error) {
      console.error('Google Pay initialization error:', error);
    }
  }

  /**
   * Process Apple Pay payment
   */
  async processApplePayment({
    amount,
    currency = 'USD',
    countryCode = 'US',
    merchantName = 'Digis',
    onValidateMerchant,
    onPaymentAuthorized,
    onCancel,
    onError
  }) {
    if (!this.isApplePayAvailable || typeof window === 'undefined' || !window.ApplePaySession) {
      throw new Error('Apple Pay is not available');
    }

    const paymentRequest = {
      countryCode,
      currencyCode: currency,
      supportedNetworks: ['visa', 'masterCard', 'amex', 'discover'],
      merchantCapabilities: ['supports3DS'],
      total: {
        label: merchantName,
        amount: amount.toFixed(2)
      }
    };

    const session = new window.ApplePaySession(3, paymentRequest);

    // Event handlers
    session.onvalidatemerchant = async (event) => {
      try {
        const merchantSession = await onValidateMerchant(event.validationURL);
        session.completeMerchantValidation(merchantSession);
      } catch (error) {
        console.error('Apple Pay merchant validation failed:', error);
        session.abort();
        onError?.(error);
      }
    };

    session.onpaymentauthorized = async (event) => {
      try {
        const result = await onPaymentAuthorized(event.payment);
        
        if (result.success) {
          session.completePayment(window.ApplePaySession.STATUS_SUCCESS);
        } else {
          session.completePayment(window.ApplePaySession.STATUS_FAILURE);
          onError?.(new Error(result.error || 'Payment failed'));
        }
      } catch (error) {
        console.error('Apple Pay authorization failed:', error);
        session.completePayment(window.ApplePaySession.STATUS_FAILURE);
        onError?.(error);
      }
    };

    session.oncancel = () => {
      onCancel?.();
    };

    // Start the payment session
    session.begin();
    
    return session;
  }

  /**
   * Process Google Pay payment
   */
  async processGooglePayment({
    amount,
    currency = 'USD',
    merchantName = 'Digis',
    onPaymentAuthorized,
    onCancel,
    onError
  }) {
    if (!this.isGooglePayAvailable || !this.googlePay) {
      throw new Error('Google Pay is not available');
    }

    const paymentDataRequest = {
      allowedPaymentMethods: [{
        type: 'CARD',
        parameters: {
          allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
          allowedCardNetworks: ['VISA', 'MASTERCARD', 'AMEX']
        },
        tokenizationSpecification: {
          type: 'PAYMENT_GATEWAY',
          parameters: {
            gateway: 'stripe',
            'stripe:version': '2020-08-27',
            'stripe:publishableKey': import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
          }
        }
      }],
      transactionInfo: {
        totalPriceStatus: 'FINAL',
        totalPrice: amount.toFixed(2),
        currencyCode: currency
      },
      merchantInfo: {
        merchantName: merchantName
      }
    };

    try {
      const paymentData = await this.googlePay.loadPaymentData(paymentDataRequest);
      
      const result = await onPaymentAuthorized({
        paymentMethodData: paymentData.paymentMethodData,
        paymentData: paymentData
      });

      if (!result.success) {
        throw new Error(result.error || 'Payment failed');
      }

      return result;
    } catch (error) {
      if (error.statusCode === 'CANCELED') {
        onCancel?.();
      } else {
        console.error('Google Pay error:', error);
        onError?.(error);
      }
      throw error;
    }
  }

  /**
   * Create Apple Pay button
   */
  createApplePayButton({
    container,
    onClick,
    style = 'black',
    type = 'buy',
    locale = 'en'
  }) {
    if (!this.isApplePayAvailable) return null;

    const button = document.createElement('apple-pay-button');
    button.setAttribute('buttonstyle', style);
    button.setAttribute('type', type);
    button.setAttribute('locale', locale);
    
    button.addEventListener('click', onClick);
    
    // Apply custom styling
    button.style.cssText = `
      -apple-pay-button-style: ${style};
      -apple-pay-button-type: ${type};
      -apple-pay-button-locale: ${locale};
      width: 100%;
      height: 50px;
      border-radius: 12px;
      cursor: pointer;
    `;

    if (container) {
      container.appendChild(button);
    }

    return button;
  }

  /**
   * Create Google Pay button
   */
  createGooglePayButton({
    container,
    onClick,
    buttonColor = 'default',
    buttonType = 'buy',
    buttonSizeMode = 'fill'
  }) {
    if (!this.isGooglePayAvailable) return null;

    const button = this.googlePay.createButton({
      onClick,
      buttonColor,
      buttonType,
      buttonSizeMode,
      buttonLocale: 'en'
    });

    // Apply custom styling
    button.style.cssText = `
      width: 100%;
      height: 50px;
      border-radius: 12px;
      margin: 0;
    `;

    if (container) {
      container.appendChild(button);
    }

    return button;
  }

  /**
   * Check device capabilities
   */
  getDeviceCapabilities() {
    return {
      applePayAvailable: this.isApplePayAvailable,
      googlePayAvailable: this.isGooglePayAvailable,
      touchID: /iPad|iPhone|iPod/.test(navigator.userAgent) && 'TouchEvent' in window,
      faceID: /iPad|iPhone|iPod/.test(navigator.userAgent) && window.DeviceMotionEvent,
      fingerprint: 'credentials' in navigator && 'PublicKeyCredential' in window,
      vibration: 'vibrate' in navigator,
      webAuthn: 'credentials' in navigator && 'PublicKeyCredential' in window
    };
  }

  /**
   * Format amount for display
   */
  formatAmount(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  /**
   * Validate payment amount
   */
  validateAmount(amount) {
    const numAmount = parseFloat(amount);
    
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Invalid payment amount');
    }
    
    if (numAmount < 0.50) {
      throw new Error('Minimum payment amount is $0.50');
    }
    
    if (numAmount > 999999.99) {
      throw new Error('Maximum payment amount is $999,999.99');
    }
    
    return numAmount;
  }

  /**
   * Get payment method priority based on device
   */
  getPaymentMethodPriority() {
    const capabilities = this.getDeviceCapabilities();
    const methods = [];

    // Prioritize based on device and availability
    if (capabilities.applePayAvailable && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
      methods.push('apple_pay');
    }
    
    if (capabilities.googlePayAvailable && /Android/.test(navigator.userAgent)) {
      methods.push('google_pay');
    }
    
    if (capabilities.applePayAvailable && !/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      methods.push('apple_pay');
    }
    
    if (capabilities.googlePayAvailable && !/Android/.test(navigator.userAgent)) {
      methods.push('google_pay');
    }

    methods.push('card'); // Always include card as fallback

    return methods;
  }

  /**
   * Get recommended payment method for user
   */
  getRecommendedPaymentMethod() {
    const priority = this.getPaymentMethodPriority();
    return priority[0] || 'card';
  }
}

// Create singleton instance
const digitalWalletService = new DigitalWalletService();

export default digitalWalletService;

// Export individual functions for convenience
export const {
  initialize,
  processApplePayment,
  processGooglePayment,
  createApplePayButton,
  createGooglePayButton,
  getDeviceCapabilities,
  formatAmount,
  validateAmount,
  getPaymentMethodPriority,
  getRecommendedPaymentMethod
} = digitalWalletService;