import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import AppShell from '@/components/layout/AppShell';
import type { Metadata } from 'next';

// Force dynamic rendering since we check authentication cookies
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Manage your account and settings',
};

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if user is authenticated
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?expired=1');
  }

  return <AppShell>{children}</AppShell>;
}
