'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PayuService } from '@/lib/payment/payu-service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Home, ArrowRight, Copy, Check } from 'lucide-react';
import Link from 'next/link';

interface PaymentResponseData {
  txnId: string;
  status: string;
  amount: string;
  payuMoneyId?: string;
  productInfo: string;
  firstName: string;
  email: string;
  phone: string;
  error?: string;
  errorMessage?: string;
}

export default function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentResponseData | null>(null);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Process PayU callback parameters
  useEffect(() => {
    const processPayment = async () => {
      try {
        // Parse PayU response from URL parameters
        const response = PayuService.parsePaymentResponse(searchParams);
        
        if (!response.txnid || !response.status) {
          setError('Invalid payment response received');
          setLoading(false);
          return;
        }
        
        // Set payment data
        const paymentResponseData: PaymentResponseData = {
          txnId: response.txnid,
          status: response.status,
          amount: response.amount || '0',
          payuMoneyId: response.payuMoneyId || response.mihpayid,
          productInfo: response.productinfo || '',
          firstName: response.firstname || '',
          email: response.email || '',
          phone: response.phone || '',
          error: response.error,
          errorMessage: response.error_Message || response.error,
        };
        
        setPaymentData(paymentResponseData);
        setPaymentVerified(response.status?.toLowerCase() === 'success');
        
        // Verify payment with backend API
        try {
          const verifyResponse = await fetch('/api/payment/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(response),
          });
          
          const verifyResult = await verifyResponse.json();
          
          // Payment verification handled
        } catch (verifyError) {
          // Continue to show payment status even if verification fails
        }
        
        setLoading(false);
        
      } catch (error) {
        setError('An error occurred while processing the payment response');
        setLoading(false);
      }
    };
    
    processPayment();
  }, [searchParams]);
  
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Failed to copy
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 muted">Loading payment details...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <Card className="border-destructive shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-bold text-destructive">
              Payment Processing Error
            </CardTitle>
            <CardDescription>
              {error}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center space-x-4">
            <Button asChild variant="outline">
              <Link href="/checkout">
                <ArrowRight className="w-4 h-4 mr-2" />
                Try Again
              </Link>
            </Button>
            <Button asChild>
              <Link href="/">
                <Home className="w-4 h-4 mr-2" />
                Home
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  if (!paymentData) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <Card className="border-muted shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold">
              No Payment Data
            </CardTitle>
            <CardDescription>
              No payment information was found. This might be because the payment wasn&apos;t completed or the session expired.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center space-x-4">
            <Button asChild variant="outline">
              <Link href="/checkout">
                <ArrowRight className="w-4 h-4 mr-2" />
                Make Payment
              </Link>
            </Button>
            <Button asChild>
              <Link href="/">
                <Home className="w-4 h-4 mr-2" />
                Home
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  const isSuccess = paymentVerified;
  const isFailure = paymentData.status?.toLowerCase() === 'failure';
  
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <Card className={`shadow-lg ${
        isSuccess ? 'border-primary' : isFailure ? 'border-destructive' : 'border-muted'
      }`}>
        <CardHeader className="text-center">
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
            isSuccess ? 'bg-primary/10' : isFailure ? 'bg-destructive/10' : 'bg-muted'
          }`}>
            {isSuccess ? (
              <CheckCircle className="w-8 h-8 text-primary" />
            ) : (
              <AlertCircle className={`w-8 h-8 ${isFailure ? 'text-destructive' : 'text-muted-foreground'}`} />
            )}
          </div>
          <CardTitle className={`heading ${
            isSuccess ? 'text-primary' : isFailure ? 'text-destructive' : 'text-foreground'
          }`}>
            {isSuccess ? 'Payment Successful!' : isFailure ? 'Payment Failed' : 'Payment Pending'}
          </CardTitle>
          <CardDescription className="body">
            {isSuccess 
              ? 'Your payment has been processed successfully.'
              : isFailure 
              ? 'Your payment could not be processed.'
              : 'Your payment is being processed.'
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {isSuccess && (
            <Alert className="border-primary bg-primary/10">
              <CheckCircle className="w-4 h-4 text-primary" />
              <AlertDescription>
                Thank you for your payment! You will receive a confirmation email shortly.
              </AlertDescription>
            </Alert>
          )}
          
          {isFailure && paymentData.errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                <strong>Error:</strong> {paymentData.errorMessage}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="bg-muted rounded-lg p-4 space-y-3">
            <h3 className="title">Payment Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="muted">Transaction ID:</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="code">
                    {paymentData.txnId}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => copyToClipboard(paymentData.txnId)}
                  >
                    {copied ? (
                      <Check className="w-3 h-3 text-primary" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>
              
              <div>
                <span className="muted">Amount:</span>
                <p className="body font-semibold">₹{paymentData.amount}</p>
              </div>
              
              <div>
                <span className="muted">Status:</span>
                <p className={`body font-semibold capitalize ${
                  isSuccess ? 'text-primary' : isFailure ? 'text-destructive' : 'text-muted-foreground'
                }`}>
                  {paymentData.status}
                </p>
              </div>
              
              {paymentData.payuMoneyId && (
                <div>
                  <span className="muted">PayU ID:</span>
                  <p className="code">{paymentData.payuMoneyId}</p>
                </div>
              )}
              
              {paymentData.productInfo && (
                <div>
                  <span className="muted">Product:</span>
                  <p className="body">{paymentData.productInfo}</p>
                </div>
              )}
              
              <div>
                <span className="muted">Customer:</span>
                <p className="body">{paymentData.firstName}</p>
                <p className="muted">{paymentData.email}</p>
              </div>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex flex-col sm:flex-row justify-center gap-4">
          {isFailure && (
            <Button asChild variant="destructive" className="w-full sm:w-auto">
              <Link href="/checkout">
                <ArrowRight className="w-4 h-4 mr-2" />
                Try Again
              </Link>
            </Button>
          )}
          
          <Button asChild variant={isFailure ? "outline" : "default"} className="w-full sm:w-auto">
            <Link href="/">
              <Home className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
          </Button>
          
          {isSuccess && (
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/profile">
                View Profile
              </Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
