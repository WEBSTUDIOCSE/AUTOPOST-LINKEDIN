import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import DeleteAccountForm from '@/components/auth/DeleteAccountForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Delete Account',
  description: 'Permanently delete your account and all associated data',
};

export default async function DeleteAccountPage() {
  // Server-side auth check - no loading state needed!
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?redirect=/delete-account&message=Please sign in to access account deletion');
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-destructive">Delete Account</h1>
            <p className="text-muted-foreground mt-2">
              Permanently remove your account and all associated data
            </p>
          </div>
          
          <DeleteAccountForm />
        </div>
      </div>
    </div>
  );
}
