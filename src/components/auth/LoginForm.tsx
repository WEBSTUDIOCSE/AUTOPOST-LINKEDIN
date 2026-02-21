'use client';

import { useState, useRef, useEffect } from 'react';
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

export default function LoginForm() {
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  // Prevents the isAuthenticated effect from double-navigating when
  // onSubmit has already called router.replace.
  const isRedirectingRef = useRef(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading } = useAuth();

  // Show any ?message= query param (e.g. from post-signup redirect)
  useEffect(() => {
    const message = searchParams.get('message');
    if (message) {
      setSuccessMessage(decodeURIComponent(message));
      window.history.replaceState({}, '', window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount — searchParams is stable on initial load

  // Client-side redirect once Firebase has fully initialised.
  // Guard with !loading so we don't act on stale IndexedDB cache
  // before onAuthStateChanged has fired for the first time.
  useEffect(() => {
    if (!loading && isAuthenticated && !isRedirectingRef.current) {
      const redirectTo = searchParams.get('redirect') || '/dashboard';
      router.replace(redirectTo);
    }
  }, [loading, isAuthenticated, router, searchParams]);

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
      isRedirectingRef.current = true;
      const redirectTo = searchParams.get('redirect') || '/dashboard';
      router.replace(redirectTo);
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
      isRedirectingRef.current = true;
      const redirectTo = searchParams.get('redirect') || '/dashboard';
      router.replace(redirectTo);
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
