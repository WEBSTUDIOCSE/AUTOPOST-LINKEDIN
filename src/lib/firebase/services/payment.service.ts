/**
 * Payment Service for Firebase
 * Handles payment records in Firestore
 */

import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  getDoc, 
  query, 
  where, 
  getDocs, 
  orderBy,
  limit,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { firebaseHandler, type ApiResponse } from '../handler';
import { IS_PRODUCTION } from '../config/environments';
import { PaymentStatus } from '@/lib/payment/payu-config';

export interface PaymentRecord {
  id?: string;
  userId: string;
  txnId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  productInfo: string;
  paymentMethod?: string;
  payuResponse?: Record<string, string | number | boolean>;
  createdAt?: unknown;
  updatedAt?: unknown;
  metadata?: {
    firstName: string;
    lastName?: string;
    email: string;
    phone: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
  refundInfo?: {
    refundId: string;
    refundAmount: number;
    refundDate: unknown;
    refundReason: string;
  };
}

/**
 * Payment Service for Firebase
 */
export const PaymentService = {
  /**
   * Create a new payment record
   */
  createPayment: async (paymentData: Omit<PaymentRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<PaymentRecord>> => {
    return firebaseHandler(async () => {
      // Collection path based on environment
      const collectionPath = IS_PRODUCTION ? 'payments' : 'payments_test';
      
      // Add timestamp
      const dataWithTimestamp = {
        ...paymentData,
        status: PaymentStatus.PENDING, // Always start with pending
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      // Create document in Firestore
      const docRef = await addDoc(collection(db, collectionPath), dataWithTimestamp);
      
      return {
        id: docRef.id,
        ...dataWithTimestamp
      } as PaymentRecord;
    }, 'payment/create-payment');
  },
  
  /**
   * Update payment record
   */
  updatePaymentStatus: async (
    id: string, 
    status: PaymentStatus, 
    responseData?: Record<string, unknown>
  ): Promise<ApiResponse<boolean>> => {
    return firebaseHandler(async () => {
      const collectionPath = IS_PRODUCTION ? 'payments' : 'payments_test';
      
      // Update document in Firestore
      await updateDoc(doc(db, collectionPath, id), {
        status,
        payuResponse: responseData || {},
        updatedAt: serverTimestamp()
      });
      
      return true;
    }, 'payment/update-payment');
  },
  
  /**
   * Get payment by transaction ID
   */
  getPaymentByTxnId: async (txnId: string): Promise<ApiResponse<PaymentRecord | null>> => {
    return firebaseHandler(async () => {
      const collectionPath = IS_PRODUCTION ? 'payments' : 'payments_test';
      
      // Query for payment with the transaction ID
      const q = query(collection(db, collectionPath), where('txnId', '==', txnId));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      // Get the first matching document
      const paymentDoc = querySnapshot.docs[0];
      return {
        id: paymentDoc.id,
        ...paymentDoc.data()
      } as PaymentRecord;
    }, 'payment/get-by-txnid');
  },
  
  /**
   * Get payment by ID
   */
  getPaymentById: async (id: string): Promise<ApiResponse<PaymentRecord | null>> => {
    return firebaseHandler(async () => {
      const collectionPath = IS_PRODUCTION ? 'payments' : 'payments_test';
      
      // Get document by ID
      const paymentDoc = await getDoc(doc(db, collectionPath, id));
      
      if (!paymentDoc.exists()) {
        return null;
      }
      
      return {
        id: paymentDoc.id,
        ...paymentDoc.data()
      } as PaymentRecord;
    }, 'payment/get-by-id');
  },
  
  /**
   * Get payments by user ID
   */
  getPaymentsByUserId: async (userId: string, limitCount = 10): Promise<ApiResponse<PaymentRecord[]>> => {
    return firebaseHandler(async () => {
      const collectionPath = IS_PRODUCTION ? 'payments' : 'payments_test';
      
      // Query for payments from the user, ordered by creation date (newest first)
      const q = query(
        collection(db, collectionPath), 
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PaymentRecord[];
    }, 'payment/get-by-userid');
  },

  /**
   * Get payment statistics for a user
   */
  getPaymentStats: async (userId: string): Promise<ApiResponse<{
    totalPayments: number;
    successfulPayments: number;
    totalAmount: number;
    successfulAmount: number;
  }>> => {
    return firebaseHandler(async () => {
      const collectionPath = IS_PRODUCTION ? 'payments' : 'payments_test';
      
      // Get all payments for the user
      const q = query(collection(db, collectionPath), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      let totalPayments = 0;
      let successfulPayments = 0;
      let totalAmount = 0;
      let successfulAmount = 0;
      
      querySnapshot.docs.forEach(doc => {
        const payment = doc.data() as PaymentRecord;
        totalPayments++;
        totalAmount += payment.amount;
        
        if (payment.status === PaymentStatus.SUCCESS) {
          successfulPayments++;
          successfulAmount += payment.amount;
        }
      });
      
      return {
        totalPayments,
        successfulPayments,
        totalAmount,
        successfulAmount
      };
    }, 'payment/get-stats');
  }
};

// Export the service
export default PaymentService;
