import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import { Suspense } from 'react';
import PaymentSuccessContent from './PaymentSuccessContent';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Payment Success',
  description: 'Your payment was successful',
};

export default async function PaymentSuccessPage() {
  // Server-side auth check
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?message=Please sign in to view payment status');
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading payment details...</p>
        </div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
