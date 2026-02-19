'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { deleteAccountSchema, type DeleteAccountFormData } from '@/lib/validations/auth';
import { APIBook } from '@/lib/firebase/services';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import PasswordInput from '@/components/ui/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Trash2, AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function DeleteAccountForm() {
  const { user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const form = useForm<DeleteAccountFormData>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: {
      password: '',
      confirmText: '',
    },
  });

  const isGoogleUser = user?.providerData[0]?.providerId === 'google.com';

  const handleDeleteAccount = async (data: DeleteAccountFormData) => {
    setIsDeleting(true);
    setError('');

    try {
      const result = await APIBook.auth.deleteAccount(isGoogleUser ? undefined : data.password);
      
      if (result.success) {
        // Account deleted successfully, user will be automatically signed out
        // Use window.location to ensure clean navigation and prevent race conditions
        window.location.href = '/login?message=Account deleted successfully';
        return; // Prevent further execution
      } else {
        setError(result.error || 'Failed to delete account');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGoogleReauth = async () => {
    setIsDeleting(true);
    setError('');

    try {
      // For Google users, the re-authentication happens inside the deleteAccount method
      const result = await APIBook.auth.deleteAccount();
      
      if (result.success) {
        window.location.href = '/login?message=Account deleted successfully';
        return; // Prevent further execution
      } else {
        setError(result.error || 'Failed to delete account');
      }
    } catch (err) {
      setError('Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!showConfirmation) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center space-x-2">
          <Link href="/profile">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Profile
            </Button>
          </Link>
        </div>

        <Card className="border-destructive">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="title text-destructive">Delete Account</CardTitle>
            </div>
            <CardDescription className="muted">
              This action cannot be undone. This will permanently delete your account and remove all associated data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> Deleting your account will:
                <ul className="mt-2 list-disc list-inside space-y-1">
                  <li>Permanently remove all your account data</li>
                  <li>Sign you out of all devices</li>
                  <li>Remove access to any associated services</li>
                  <li>This action cannot be reversed</li>
                </ul>
              </AlertDescription>
            </Alert>

            <Separator />

            <div className="space-y-3">
              <p className="muted">
                If you&apos;re sure you want to delete your account, click the button below to proceed with the deletion process.
              </p>
              
              <Button 
                onClick={() => setShowConfirmation(true)}
                variant="destructive"
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                I understand, delete my account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center space-x-2">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setShowConfirmation(false)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>

      <Card className="border-destructive">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            <CardTitle className="title text-destructive">Confirm Account Deletion</CardTitle>
          </div>
          <CardDescription className="muted">
            {isGoogleUser 
              ? 'You will need to re-authenticate with Google to confirm account deletion.'
              : 'Please enter your password and confirmation text to delete your account.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isGoogleUser ? (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  You will be prompted to sign in with Google again to confirm this action.
                </AlertDescription>
              </Alert>
              
              <Button 
                onClick={handleGoogleReauth}
                disabled={isDeleting}
                variant="destructive"
                className="w-full"
              >
                {isDeleting ? (
                  'Deleting Account...'
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Confirm with Google & Delete Account
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleDeleteAccount)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <PasswordInput
                          placeholder="Enter your current password"
                          disabled={isDeleting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Type <code className="bg-muted px-1 rounded text-destructive font-bold">DELETE</code> to confirm
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Type DELETE to confirm"
                          disabled={isDeleting}
                          className="font-mono"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  disabled={isDeleting}
                  variant="destructive"
                  className="w-full"
                >
                  {isDeleting ? (
                    'Deleting Account...'
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete My Account Permanently
                    </>
                  )}
                </Button>
              </form>
            </Form>
          )}

          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              This action is irreversible. Once deleted, your account cannot be recovered.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
