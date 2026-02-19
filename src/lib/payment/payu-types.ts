/**
 * PayU Payment Gateway Types
 * TypeScript definitions for PayU integration
 */

export interface PayuPaymentRequest {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  lastname?: string;
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

export interface PayuPaymentResponse {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  lastname?: string;
  email: string;
  phone: string;
  status: 'success' | 'failure' | 'pending' | 'cancel';
  unmappedstatus?: string;
  hash: string;
  mihpayid?: string;
  payuMoneyId?: string;
  error?: string;
  error_Message?: string;
  cardCategory?: string;
  cardnum?: string;
  cardhash?: string;
  bankcode?: string;
  PG_TYPE?: string;
  bank_ref_num?: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}

export interface PayuVerificationRequest {
  key: string;
  command: string;
  var1: string;
  hash: string;
}

export interface PayuVerificationResponse {
  status: 'success' | 'failure';
  transaction_details: {
    [txnid: string]: {
      mihpayid: string;
      request_id: string;
      bank_ref_num: string;
      amt: string;
      txnid: string;
      additional_charges: string;
      productinfo: string;
      firstname: string;
      bankcode: string;
      udf1: string;
      udf2: string;
      udf3: string;
      udf4: string;
      udf5: string;
      field2: string;
      field9: string;
      error_code: string;
      addedon: string;
      payment_source: string;
      card_type: string;
      error_Message: string;
      net_amount_debit: string;
      disc: string;
      mode: string;
      PG_TYPE: string;
      card_no: string;
      name_on_card: string;
      udf6: string;
      udf7: string;
      udf8: string;
      udf9: string;
      udf10: string;
      status: 'success' | 'failure' | 'pending';
      unmappedstatus: string;
      Merchant_UTR: string;
      Settled_At: string;
    };
  };
}

export interface PaymentError {
  code: string;
  message: string;
  description?: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  minAmount?: number;
  maxAmount?: number;
}

export interface PaymentValidationError {
  field: string;
  message: string;
}

// Common PayU error codes
export const PAYU_ERROR_CODES = {
  E000: 'No Error',
  E001: 'Unauthorized Payment Mode',
  E002: 'Unauthorized Key',
  E003: 'Unauthorized Txn Id',
  E004: 'Unauthorized Amount',
  E005: 'Unauthorized Merchant',
  E006: 'Unauthorized Return URL',
  E007: 'Unauthorized Email',
  E008: 'Unauthorized Phone',
  E009: 'Unauthorized Product Info',
  E010: 'Unauthorized First Name',
  E011: 'Unauthorized Hash',
  E012: 'Transaction Cancelled By User',
  E013: 'Invalid Hash',
  E014: 'Payment failed at Bank end',
  E015: 'Your transaction was not completed',
  E016: 'Transaction Declined',
  E017: 'Transaction Timeout',
  E018: 'Duplicate Transaction',
  E019: 'Invalid Card Details',
  E020: 'Insufficient Funds',
} as const;

export type PayuErrorCode = keyof typeof PAYU_ERROR_CODES;
