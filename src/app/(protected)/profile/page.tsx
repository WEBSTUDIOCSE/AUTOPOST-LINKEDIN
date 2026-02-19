/**
 * Profile Page - Universal profile component for any project
 * Displays user information and provides logout functionality
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import UserProfile from '@/components/auth/UserProfile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profile',
  description: 'Manage your account settings and preferences',
};

export default async function ProfilePage() {
  // Server-side auth check
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?redirect=/profile&message=Please sign in to view your profile');
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="heading">Profile</h1>
              <p className="muted">
                Manage your account settings and preferences
              </p>
            </div>
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>

        {/* Profile Content */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* User Profile Card */}
          <div className="md:col-span-2 lg:col-span-2">
            <UserProfile />
          </div>

          {/* Quick Actions Card */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/profile" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    Edit Profile
                  </Button>
                </Link>
                <Link href="/change-password" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    Change Password
                  </Button>
                </Link>
                <Link href="/delete-account" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    Delete Account
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Account Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="muted">Email verified:</span>
                  <span className={user.emailVerified ? 'success' : 'muted'}>
                    {user.emailVerified ? 'Yes' : 'No'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
