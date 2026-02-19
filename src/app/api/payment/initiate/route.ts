/**
 * API Route: Payment Initiation
 * Securely generates PayU payment parameters with hash
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { PayuService } from '@/lib/payment/payu-service';
import { IS_PRODUCTION } from '@/lib/firebase/config/environments';

interface PaymentInitiationRequest {
  userId: string;
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
  paymentMethod?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: PaymentInitiationRequest = await request.json();
    
    // Validate required fields
    if (!body.userId || !body.amount || !body.productInfo || !body.firstName || !body.email || !body.phone) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields' 
      }, { status: 400 });
    }
    
    // Validate amount
    if (body.amount <= 0 || body.amount > 1000000) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid amount. Must be between 1 and 1,000,000' 
      }, { status: 400 });
    }
    
    // Generate unique transaction ID
    const txnId = PayuService.generateTransactionId();
    
    // Get PayU configuration from environment variables
    const merchantKey = process.env.NEXT_PUBLIC_PAYU_MERCHANT_KEY;
    const merchantSalt = process.env.PAYU_MERCHANT_SALT;
    
    if (!merchantKey || !merchantSalt) {
      return NextResponse.json({ 
        success: false, 
        error: 'PayU configuration not found' 
      }, { status: 500 });
    }
    
    // Prepare URLs with validation
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const baseUrl = (!appUrl || appUrl === 'null' || appUrl === 'undefined') 
      ? 'http://localhost:3000' 
      : appUrl;
    
    const successUrl = `${baseUrl}/api/payment/success`;
    const failureUrl = `${baseUrl}/api/payment/failure`;
    
    // Generate hash string as per PayU documentation
    // Standard format: key|txnid|amount|productinfo|firstname|email|||||||||||salt
    const hashString = [
      merchantKey,
      txnId,
      body.amount.toString(),
      body.productInfo,
      body.firstName,
      body.email,
      '', '', '', '', '', // udf1-udf5 empty for now
      '', '', '', '', '', // 5 empty fields as per PayU spec
      merchantSalt
    ].join('|');
    
    // Generate SHA512 hash
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');
    
    // Get PayU base URL based on IS_PRODUCTION flag
    const payuBaseUrl = IS_PRODUCTION
      ? 'https://secure.payu.in' 
      : 'https://test.payu.in'; // Official PayU test environment URL
    
    // Return payment parameters for form submission
    return NextResponse.json({
      success: true,
      data: {
        key: merchantKey,
        txnid: txnId,
        amount: body.amount.toString(),
        productinfo: body.productInfo,
        firstname: body.firstName,
        lastname: body.lastName || '',
        email: body.email,
        phone: body.phone,
        surl: successUrl,
        furl: failureUrl,
        hash: hash,
        udf1: '', // No Firebase ID for now
        address1: body.address || '',
        city: body.city || '',
        state: body.state || '',
        country: body.country || 'India',
        zipcode: body.zipCode || '',
        pg: body.paymentMethod || '',
        enforce_paymethod: body.paymentMethod || '',
        baseUrl: payuBaseUrl
      }
    });
    
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Payment initialization failed' 
    }, { status: 500 });
  }
}
