/**
 * PayU Payment Gateway Configuration
 * Secure configuration for PayU integration
 */

import { IS_PRODUCTION } from '@/lib/firebase/config/environments';

export interface PayuConfig {
  merchantKey: string;
  baseUrl: string;
  successUrl: string;
  failureUrl: string;
  paymentMode: 'test' | 'production';
}

// Helper function to safely get app URL
function getAppUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl || appUrl === 'null' || appUrl === 'undefined') {
    return 'http://localhost:3000';
  }
  return appUrl;
}

// Client-side configuration (only non-sensitive data)
export const PAYU_CONFIG: PayuConfig = {
  merchantKey: process.env.NEXT_PUBLIC_PAYU_MERCHANT_KEY || '',
  baseUrl: IS_PRODUCTION
    ? 'https://secure.payu.in' 
    : 'https://test.payu.in', // Official PayU test environment
  successUrl: `${getAppUrl()}/api/payment/success`,
  failureUrl: `${getAppUrl()}/api/payment/failure`,
  paymentMode: IS_PRODUCTION ? 'production' : 'test',
};

// PayU API endpoints
export const PAYU_ENDPOINTS = {
  PAYMENT: '_payment',
  VERIFY_PAYMENT: 'merchant/postservice?form=2',
};

// Available payment methods (customize as per your needs)
export const PAYMENT_METHODS = [
  { id: 'CC', name: 'Credit Card', icon: '💳' },
  { id: 'DC', name: 'Debit Card', icon: '💳' },
  { id: 'NB', name: 'Net Banking', icon: '🏦' },
  { id: 'UPI', name: 'UPI', icon: '📱' },
  { id: 'WALLET', name: 'Wallet', icon: '👛' },
];

// Payment status enum
export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

// Currency options
export const SUPPORTED_CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
];

export const DEFAULT_CURRENCY = 'INR';
