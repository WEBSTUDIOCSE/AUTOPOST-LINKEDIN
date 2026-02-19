/**
 * PayU Service - Client-side utilities
 * Handles client-side payment operations
 */

import { PAYU_CONFIG, PAYU_ENDPOINTS } from './payu-config';

export interface PaymentData {
  txnId: string;
  amount: number;
  productInfo: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  udf1?: string; // User defined fields - can be used for additional info
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  paymentMethod?: string; // Optional - to preselect payment method
}

export interface PaymentFormData {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  hash: string;
  address1?: string;
  city?: string;
  state?: string;
  country?: string;
  zipcode?: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  pg?: string;
  enforce_paymethod?: string;
}

/**
 * PayU Payment Service
 * Handles client-side payment operations
 */
export class PayuService {
  /**
   * Generate unique transaction ID
   */
  static generateTransactionId(prefix = 'TXN'): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}_${timestamp}_${randomString}`;
  }
  
  /**
   * Get PayU payment URL
   */
  static getPaymentUrl(): string {
    const { baseUrl } = PAYU_CONFIG;
    
    if (!baseUrl || baseUrl === 'null' || baseUrl === 'undefined') {
      throw new Error('PayU configuration error: Invalid base URL');
    }
    
    const paymentUrl = `${baseUrl}/${PAYU_ENDPOINTS.PAYMENT}`;
    
    return paymentUrl;
  }
  
  /**
   * Submit payment form to PayU
   * This function creates and submits a form to PayU with the provided data
   */
  static submitPaymentForm(formData: PaymentFormData): void {
    try {
      // Validate required fields
      if (!formData.txnid || !formData.amount || !formData.hash) {
        throw new Error('Missing required payment data');
      }
      
      // Create form element
      const form = document.createElement('form');
      form.method = 'POST';
      
      // Get PayU URL and validate
      const paymentUrl = this.getPaymentUrl();
      form.action = paymentUrl;
      form.style.display = 'none';

      // Add form fields
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = String(value);
          form.appendChild(input);
        }
      });

      // Add form to DOM and submit
      document.body.appendChild(form);
      
      form.submit();
      
      // Clean up - remove form after submission
      setTimeout(() => {
        if (document.body.contains(form)) {
          document.body.removeChild(form);
        }
      }, 1000);
      
    } catch (error) {
      throw new Error('Failed to submit payment form');
    }
  }
  
  /**
   * Validate payment form data
   */
  static validatePaymentData(data: PaymentData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!data.amount || data.amount <= 0) {
      errors.push('Amount must be greater than 0');
    }
    
    if (!data.productInfo || data.productInfo.trim().length < 3) {
      errors.push('Product description must be at least 3 characters');
    }
    
    if (!data.firstName || data.firstName.trim().length < 2) {
      errors.push('First name must be at least 2 characters');
    }
    
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push('Valid email address is required');
    }
    
    if (!data.phone || !/^\d{10}$/.test(data.phone.replace(/\D/g, ''))) {
      errors.push('Valid 10-digit phone number is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Format amount for display
   */
  static formatAmount(amount: number, currency = 'INR'): string {
    const formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    });
    
    return formatter.format(amount);
  }
  
  /**
   * Parse PayU response from URL parameters
   */
  static parsePaymentResponse(searchParams: URLSearchParams): Record<string, string> {
    const response: Record<string, string> = {};
    
    // Common PayU response parameters
    const payuParams = [
      'txnid', 'amount', 'productinfo', 'firstname', 'email', 'phone',
      'status', 'unmappedstatus', 'key', 'hash', 'payuMoneyId', 'mihpayid',
      'error', 'error_Message', 'cardCategory', 'cardnum', 'cardhash',
      'udf1', 'udf2', 'udf3', 'udf4', 'udf5'
    ];
    
    payuParams.forEach(param => {
      const value = searchParams.get(param);
      if (value !== null) {
        response[param] = value;
      }
    });
    
    return response;
  }
}

// PayU Service utility functions are exported above
