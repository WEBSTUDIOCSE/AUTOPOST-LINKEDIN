'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { APIBook } from '@/lib/firebase/services';
import { loginSchema, type LoginFormData } from '@/lib/validations/auth';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PasswordInput from '@/components/ui/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Mail, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

export default function LoginForm() {
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();

  // Check for success/info messages from URL params
  useEffect(() => {
    const message = searchParams.get('message');
    if (message) {
      setSuccessMessage(message);
      // Clear the URL params after showing the message
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [searchParams]);

  // Note: Page already handles server-side redirect if authenticated
  // This is just a client-side optimization to avoid form render
  useEffect(() => {
    if (isAuthenticated) {
      const redirect = searchParams.get('redirect') || '/profile';
      router.push(redirect);
    }
  }, [isAuthenticated, router, searchParams]);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setEmailLoading(true);
    setError('');

    const result = await APIBook.auth.loginWithEmail(data.email, data.password);
    
    if (result.success) {
      // Redirect to original page or profile
      const redirect = searchParams.get('redirect') || '/profile';
      router.push(redirect);
    } else {
      setError(result.error || 'Login failed');
    }
    
    setEmailLoading(false);
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError('');

    const result = await APIBook.auth.loginWithGoogle();
    
    if (result.success) {
      // Redirect to original page or profile
      const redirect = searchParams.get('redirect') || '/profile';
      router.push(redirect);
    } else {
      setError(result.error || 'Google login failed');
    }
    
    setGoogleLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="subheading">Sign In</CardTitle>
          <CardDescription className="muted">
            Enter your email and password to access your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {successMessage && (
            <Alert className="mb-4">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}
          
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
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        {...field}
                        id="login-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Enter your password"
                        id="login-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={emailLoading}
              >
                {emailLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </Form>

          <div className="mt-4 space-y-2 text-center text-sm">
            <Link href="/forgot-password" className="block">
              <Button
                type="button"
                variant="link"
                className="p-0 h-auto font-normal"
              >
                Forgot your password?
              </Button>
            </Link>
            
            <div>
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-medium text-primary hover:underline">
                Sign up
              </Link>
            </div>
          </div>

          <div className="mt-6">
            <Separator className="mb-4" />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
            >
              <Mail className="mr-2 h-4 w-4" />
              {googleLoading ? 'Signing in...' : 'Continue with Google'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
