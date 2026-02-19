'use client';

import { useAuth } from '@/contexts/AuthContext';
import { APIBook } from '@/lib/firebase/services';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LogOut, Mail, User, Calendar, CheckCircle, AlertCircle, Settings, Trash2 } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

export default function UserProfile() {
  const { user } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const handleLogout = async () => {
    setLoggingOut(true);
    setLogoutError('');
    
    const result = await APIBook.auth.signOut();
    if (!result.success) {
      setLogoutError(result.error || 'Logout failed');
      setLoggingOut(false);
    }
    // If successful, the auth context will handle the state change
  };

  if (!user) {
    return null;
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {logoutError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{logoutError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.photoURL || ''} alt={user.displayName || 'User'} />
                <AvatarFallback className="text-lg">
                  {user.displayName ? getInitials(user.displayName) : 
                   user.email ? getInitials(user.email) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="title">
                  {user.displayName || 'Anonymous User'}
                </CardTitle>
                <CardDescription className="muted flex items-center mt-1">
                  <Mail className="h-4 w-4 mr-1" />
                  {user.email}
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              disabled={loggingOut}
              variant="outline"
              size="sm"
            >
              {loggingOut ? (
                <>
                  <LogOut className="mr-2 h-4 w-4" />
                  Signing out...
                </>
              ) : (
                <>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="body">Email Verification</span>
              <Badge variant={user.emailVerified ? "default" : "secondary"}>
                {user.emailVerified ? (
                  <>
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Verified
                  </>
                ) : (
                  <>
                    <AlertCircle className="mr-1 h-3 w-3" />
                    Unverified
                  </>
                )}
              </Badge>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="body">User ID:</span>
                <span className="code">{user.uid}</span>
              </div>

              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="body">Account Created:</span>
                <span className="muted">
                  {formatDate(user.metadata.creationTime)}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="body">Last Sign In:</span>
                <span className="muted">
                  {formatDate(user.metadata.lastSignInTime)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="title">Account Security</CardTitle>
          <CardDescription className="muted">
            Manage your account security settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="body">Provider</p>
                <p className="muted">
                  {user.providerData[0]?.providerId === 'google.com' ? 'Google' : 'Email/Password'}
                </p>
              </div>
              <Badge variant="outline">
                {user.providerData[0]?.providerId === 'google.com' ? 'OAuth' : 'Email'}
              </Badge>
            </div>

            {!user.emailVerified && user.providerData[0]?.providerId !== 'google.com' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please verify your email address to secure your account. Check your inbox for a verification email.
                </AlertDescription>
              </Alert>
            )}

            {/* Change Password Option - Only for email/password users */}
            {user.providerData[0]?.providerId !== 'google.com' && (
              <div className="pt-2">
                <Link href="/change-password">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Change Password
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="title text-destructive">Danger Zone</CardTitle>
          <CardDescription className="muted">
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Account deletion is permanent and cannot be undone. All your data will be lost.
              </AlertDescription>
            </Alert>

            <Link href="/delete-account">
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Account
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
