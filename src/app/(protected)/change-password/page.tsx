import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import ChangePasswordForm from '@/components/auth/ChangePasswordForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Change Password',
  description: 'Update your account password',
};

export default async function ChangePasswordPage() {
  // Server-side auth check
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?redirect=/change-password&message=Please sign in to change password');
  }

  // Note: We can't check provider on server-side without full user data
  // The form component will handle Google user detection client-side

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/profile">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Profile
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Change Password</h1>
        </div>

        <div className="flex justify-center">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
