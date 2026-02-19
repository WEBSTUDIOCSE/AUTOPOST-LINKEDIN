/**
 * PayU Payment Form Component
 * Secure payment form that integrates with PayU gateway
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { PayuService, type PaymentFormData } from '@/lib/payment/payu-service';
import { PAYMENT_METHODS } from '@/lib/payment/payu-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CreditCard, Loader2 } from 'lucide-react';

// Form validation schema
const paymentFormSchema = z.object({
  amount: z.number().min(1, 'Amount must be at least ₹1').max(1000000, 'Amount must be less than ₹10,00,000'),
  productInfo: z.string().min(3, 'Product description is required'),
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().optional(),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  paymentMethod: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  zipCode: z.string().optional(),
});

type PaymentFormType = z.infer<typeof paymentFormSchema>;

interface PaymentFormProps {
  productInfo?: string;
  amount?: number;
  allowCustomAmount?: boolean;
  onSuccess?: (paymentId: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

export default function PaymentForm({
  productInfo = '',
  amount = 0,
  allowCustomAmount = true,
  onSuccess,
  onError,
  className = '',
}: PaymentFormProps) {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<PaymentFormType>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      amount: Number(amount) || 100, // Default to ₹100
      productInfo: productInfo || '',
      firstName: '',
      lastName: '',
      email: user?.email || '',
      phone: '',
      paymentMethod: 'all',
      address: '',
      city: '',
      state: '',
      country: 'India',
      zipCode: '',
    },
  });

  // Populate form with user data if available
  useEffect(() => {
    if (user) {
      const displayName = user.displayName || '';
      const nameParts = displayName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      form.setValue('email', user.email || '');
      if (firstName) form.setValue('firstName', firstName);
      if (lastName) form.setValue('lastName', lastName);
    }
  }, [user, form]);

  const onSubmit = async (data: PaymentFormType) => {
    setError(null);
    setLoading(true);

    try {
      if (!user) {
        setError('You must be logged in to make a payment');
        setLoading(false);
        return;
      }

      // Clean phone number
      const cleanPhone = data.phone.replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        setError('Please enter a valid 10-digit phone number');
        setLoading(false);
        return;
      }

      // Call secure API to initiate payment with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await fetch('/api/payment/initiate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            userId: user.uid,
            amount: data.amount,
            productInfo: data.productInfo,
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phone: cleanPhone,
            address: data.address,
            city: data.city,
            state: data.state,
            country: data.country,
            zipCode: data.zipCode,
            paymentMethod: data.paymentMethod === 'all' ? '' : data.paymentMethod,
          }),
        });

        clearTimeout(timeoutId);

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to initialize payment');
        }

        // Submit payment form to PayU
        const formData: PaymentFormData = result.data;
        PayuService.submitPaymentForm(formData);

        // Call success callback if provided
        onSuccess?.(result.data.udf1);
        
      } catch (error) {
        clearTimeout(timeoutId);
        
        let errorMessage = 'Payment initialization failed';
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            errorMessage = 'Request timeout. Please check your internet connection and try again.';
          } else {
            errorMessage = error.message;
          }
        }
        
        throw new Error(errorMessage); // Re-throw to be caught by outer catch
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment initialization failed';
      setError(errorMessage);
      onError?.(errorMessage);
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please sign in to make a payment.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center">
          <CreditCard className="mr-2 h-5 w-5" /> Payment Details
        </CardTitle>
        <CardDescription>
          Enter your payment details to proceed with the secure transaction
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
            {/* Amount Field */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (INR) *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                        ₹
                      </span>
                      <Input
                        {...field}
                        type="number"
                        placeholder="Enter amount"
                        disabled={!allowCustomAmount || loading}
                        className="pl-8"
                        min="1"
                        max="1000000"
                        step="0.01"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Product Info Field */}
            <FormField
              control={form.control}
              name="productInfo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter product or service description"
                      disabled={!!productInfo || loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Personal Info Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="First name" disabled={loading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Last name" disabled={loading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Contact Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Email address" disabled={loading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="10-digit phone number" 
                        disabled={loading}
                        maxLength={10}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Payment Method */}
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preferred Payment Method</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={loading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="all">All Payment Methods</SelectItem>
                      {PAYMENT_METHODS.map(method => (
                        <SelectItem key={method.id} value={method.id}>
                          <span className="flex items-center">
                            <span className="mr-2">{method.icon}</span>
                            {method.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `Pay ${PayuService.formatAmount(form.watch('amount') || amount)}`
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
