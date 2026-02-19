'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PayuService } from '@/lib/payment/payu-service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Home, RefreshCw, Copy, Check } from 'lucide-react';
import Link from 'next/link';

interface PaymentFailureData {
  txnId: string;
  status: string;
  amount: string;
  productInfo: string;
  firstName: string;
  email: string;
  phone: string;
  error?: string;
  errorMessage?: string;
  errorCode?: string;
}

export default function PaymentFailureContent() {
  const searchParams = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentFailureData | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Process PayU callback parameters
  useEffect(() => {
    const processFailedPayment = async () => {
      try {
        // Parse PayU response from URL parameters
        const response = PayuService.parsePaymentResponse(searchParams);
        
        if (!response.txnid) {
          setError('Invalid payment response received');
          setLoading(false);
          return;
        }
        
        // Set payment data
        const paymentFailureData: PaymentFailureData = {
          txnId: response.txnid,
          status: response.status || 'failed',
          amount: response.amount || '0',
          productInfo: response.productinfo || '',
          firstName: response.firstname || '',
          email: response.email || '',
          phone: response.phone || '',
          error: response.error,
          errorMessage: response.error_Message || response.error,
          errorCode: response.error_code,
        };
        
        setPaymentData(paymentFailureData);
        
        // Update payment status in backend
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
          // Continue processing
        }
        
        setLoading(false);
        
      } catch (error) {
        setError('Failed to process payment response');
        setLoading(false);
      }
    };
    
    processFailedPayment();
  }, [searchParams]);
  
  const copyTransactionId = async () => {
    if (paymentData?.txnId) {
      try {
        await navigator.clipboard.writeText(paymentData.txnId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        // Failed to copy
      }
    }
  };
  
  const retryPayment = () => {
    // Go back to previous page or checkout
    window.history.back();
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
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-2" />
          <CardTitle className="text-2xl text-destructive">Payment Failed</CardTitle>
          <CardDescription>
            Your transaction could not be completed
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {paymentData && (
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Transaction ID:</span>
                <div className="flex items-center space-x-2">
                  <code className="text-sm bg-background px-2 py-1 rounded">
                    {paymentData.txnId}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyTransactionId}
                    className="h-6 w-6 p-0"
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-primary" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
              
              {paymentData.amount && parseFloat(paymentData.amount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Amount:</span>
                  <span className="text-sm font-semibold">
                    {PayuService.formatAmount(parseFloat(paymentData.amount))}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span className="text-sm font-medium">Status:</span>
                <span className="text-sm font-semibold text-destructive">
                  {paymentData.status.toUpperCase()}
                </span>
              </div>
              
              {paymentData.errorCode && (
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Error Code:</span>
                  <code className="text-sm bg-background px-2 py-1 rounded text-destructive">
                    {paymentData.errorCode}
                  </code>
                </div>
              )}
              
              {paymentData.productInfo && (
                <div className="pt-2 border-t">
                  <span className="text-sm font-medium">Description:</span>
                  <p className="text-sm text-muted-foreground mt-1">
                    {paymentData.productInfo}
                  </p>
                </div>
              )}
            </div>
          )}
          
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {paymentData?.errorMessage || 
               'Your payment was not successful. Please try again or contact support if the problem persists.'}
            </AlertDescription>
          </Alert>
          
          {/* Common reasons for payment failure */}
          <div className="bg-muted/50 p-3 rounded-lg">
            <h4 className="text-sm font-medium mb-2">Common reasons for payment failure:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Insufficient account balance</li>
              <li>• Incorrect card details or expired card</li>
              <li>• Network connectivity issues</li>
              <li>• Transaction limits exceeded</li>
              <li>• Bank server temporarily unavailable</li>
            </ul>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between gap-2">
          <Link href="/" className="flex-1">
            <Button variant="outline" className="w-full">
              <Home className="mr-2 h-4 w-4" />
              Home
            </Button>
          </Link>
          
          <Button onClick={retryPayment} className="flex-1">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
