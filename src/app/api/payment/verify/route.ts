/**
 * API Route: Payment Verification
 * Verifies PayU payment response
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { IS_PRODUCTION } from '@/lib/firebase/config/environments';

/**
 * Generate hash for PayU response verification
 * Format: salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
 */
function generateResponseHash(responseData: Record<string, string>): string {
  const merchantSalt = process.env.PAYU_MERCHANT_SALT;
  
  if (!merchantSalt) {
    throw new Error('Merchant salt not configured');
  }
  
  const hashString = [
    merchantSalt,
    responseData.status || '',
    '', '', '', '', '',
    responseData.udf5 || '',
    responseData.udf4 || '',
    responseData.udf3 || '',
    responseData.udf2 || '',
    responseData.udf1 || '',
    responseData.email || '',
    responseData.firstname || '',
    responseData.productinfo || '',
    responseData.amount || '',
    responseData.txnid || '',
    responseData.key || ''
  ].join('|');
  
  return crypto.createHash('sha512').update(hashString).digest('hex');
}

/**
 * Verify payment with PayU server
 */
async function verifyWithPayU(txnId: string): Promise<{ verified: boolean; data: unknown }> {
  try {
    const merchantKey = process.env.NEXT_PUBLIC_PAYU_MERCHANT_KEY;
    const merchantSalt = process.env.PAYU_MERCHANT_SALT;
    
    if (!merchantKey || !merchantSalt) {
      return { verified: false, data: null };
    }
    
    if (!txnId) {
      return { verified: false, data: null };
    }
    
    const command = 'verify_payment';
    const baseUrl = IS_PRODUCTION
      ? 'https://secure.payu.in' 
      : 'https://test.payu.in'; // Use test environment for consistency
    
    // Create hash for verification
    const hashString = `${merchantKey}|${command}|${txnId}|${merchantSalt}`;
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');
    
    // Prepare request data
    const requestData = {
      key: merchantKey,
      command,
      var1: txnId,
      hash
    };
    
    // Make POST request to PayU verify API
    const response = await fetch(`${baseUrl}/merchant/postservice?form=2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(requestData).toString()
    });
    
    const data = await response.json();
    return {
      verified: data.status === 'success' && data.transaction_details?.[txnId]?.status === 'success',
      data
    };
  } catch (error) {
    return { verified: false, data: null };
  }
}

export async function POST(request: NextRequest) {
  try {
    const responseData = await request.json();
    const { txnid, status, hash, amount } = responseData;
    
    if (!txnid) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transaction ID is required' 
      }, { status: 400 });
    }
    
    // Verify hash if present
    if (hash) {
      const calculatedHash = generateResponseHash(responseData);
      if (hash !== calculatedHash) {
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid payment signature' 
        }, { status: 400 });
      }
    }
    
    // Determine payment status based on PayU response
    let paymentStatus: string;
    switch (status?.toLowerCase()) {
      case 'success':
        paymentStatus = 'success';
        break;
      case 'failure':
      case 'failed':
        paymentStatus = 'failed';
        break;
      case 'cancel':
      case 'cancelled':
        paymentStatus = 'cancelled';
        break;
      default:
        paymentStatus = 'failed';
    }
    
    // For successful payments, optionally verify with PayU server
    if (paymentStatus === 'success' && txnid) {
      const verification = await verifyWithPayU(txnid);
      if (!verification.verified) {
        paymentStatus = 'failed';
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Payment verification completed',
      data: {
        txnId: txnid,
        status: paymentStatus,
        amount: amount,
        verified: true
      }
    });
    
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Payment verification failed' 
    }, { status: 500 });
  }
}
