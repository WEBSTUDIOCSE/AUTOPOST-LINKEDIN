import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Forgot Password',
  description: 'Reset your account password',
};

export default async function ForgotPasswordPage() {
  // If user is already authenticated, redirect to profile
  const user = await getCurrentUser();

  if (user) {
    redirect('/profile');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <ForgotPasswordForm 
        showBackToLogin={true}
      />
    </div>
  );
}
