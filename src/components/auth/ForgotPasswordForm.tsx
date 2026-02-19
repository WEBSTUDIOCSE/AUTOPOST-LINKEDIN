'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { APIBook } from '@/lib/firebase/services';
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/validations/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ForgotPasswordFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  showBackToLogin?: boolean;
}

export default function ForgotPasswordForm({ 
  onSuccess, 
  onCancel, 
  showBackToLogin = true 
}: ForgotPasswordFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setLoading(true);
    setError('');

    const result = await APIBook.auth.resetPassword(data.email);
    
    if (result.success) {
      setEmailSent(true);
      setError('');
      
      // Call success callback after showing success message
      setTimeout(() => {
        onSuccess?.();
      }, 3000);
    } else {
      setError(result.error || 'Failed to send reset email');
    }
    
    setLoading(false);
  };

  if (emailSent) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CheckCircle className="h-12 w-12 mx-auto mb-2" />
          <CardTitle className="title">Reset Email Sent</CardTitle>
          <CardDescription className="muted">
            We&apos;ve sent a password reset link to your email address.
            Please check your inbox and follow the instructions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="muted text-center">
            Didn&apos;t receive the email? Check your spam folder or try again.
          </div>
          
          <div className="flex gap-3">
            {onCancel && (
              <Button
                variant="outline"
                onClick={onCancel}
                className="flex-1"
              >
                Close
              </Button>
            )}
            {showBackToLogin && (
              <Link href="/login" className="flex-1">
                <Button className="w-full">
                  Back to Login
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <Mail className="h-8 w-8 text-primary mx-auto mb-2" />
        <CardTitle className="title">Reset Password</CardTitle>
        <CardDescription className="muted">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Enter your email address"
                      {...field}
                      id="forgot-password-email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-2">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
              )}
              {showBackToLogin && !onCancel && (
                <Link href="/login" className="flex-1">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loading}
                    className="w-full"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Login
                  </Button>
                </Link>
              )}
              <Button
                type="submit"
                disabled={loading}
                className={onCancel || showBackToLogin ? "flex-1" : "w-full"}
              >
                {loading ? 'Sending Email...' : 'Send Reset Email'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
