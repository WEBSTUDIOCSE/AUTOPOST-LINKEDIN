import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import SignupForm from '@/components/auth/SignupForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create a new account',
};

export default async function SignupPage() {
  // If already authenticated, redirect to profile
  const user = await getCurrentUser();

  if (user) {
    redirect('/profile');
  }

  return <SignupForm />;
}
