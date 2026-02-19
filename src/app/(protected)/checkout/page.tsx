import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import { Suspense } from 'react';
import PaymentForm from '@/components/payment/PaymentForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Complete your secure payment',
};

interface CheckoutPageProps {
  searchParams: Promise<{
    product?: string;
    amount?: string;
    allowCustomAmount?: string;
  }>;
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  // Server-side auth check
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?redirect=/checkout&message=Please sign in to make a payment');
  }

  // Get search params
  const params = await searchParams;
  const productInfo = params.product ? decodeURIComponent(params.product) : '';
  const amount = params.amount ? parseFloat(params.amount) : 0;
  const allowCustomAmount = params.allowCustomAmount !== 'false';

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center space-x-2 mb-8">
          <Button 
            variant="ghost" 
            size="sm" 
            asChild
          >
            <a href="javascript:history.back()">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </a>
          </Button>
          <div>
            <h1 className="heading">Secure Checkout</h1>
            <p className="muted">Complete your payment safely</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Payment Form */}
          <div className="lg:col-span-2">
            <Suspense fallback={
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Loading payment form...</p>
              </div>
            }>
              <PaymentForm
                productInfo={productInfo}
                amount={amount}
                allowCustomAmount={allowCustomAmount}
                className="w-full"
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
