import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import { Suspense } from 'react';
import LoginForm from '@/components/auth/LoginForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Sign in to your account',
};

export default async function LoginPage() {
  // If already authenticated, redirect to profile
  const user = await getCurrentUser();

  if (user) {
    redirect('/profile');
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
