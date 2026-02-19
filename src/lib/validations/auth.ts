import { z } from 'zod';
import { AUTH_CONFIG } from '@/lib/auth/config';

// Password validation based on auth config
const passwordValidation = z
  .string()
  .min(1, 'Password is required')
  .min(AUTH_CONFIG.passwordRequirements.minLength, `Password must be at least ${AUTH_CONFIG.passwordRequirements.minLength} characters`);

// Login form validation schema
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address'),
  password: z
    .string()
    .min(1, 'Password is required'),
});

// Signup form validation schema
export const signupSchema = z.object({
  displayName: z
    .string()
    .optional(),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address'),
  password: passwordValidation,
  confirmPassword: z
    .string()
    .min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don&apos;t match",
  path: ["confirmPassword"],
});

// Password reset form validation schema
export const resetPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address'),
});

// Change password form validation schema
export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'Current password is required'),
  newPassword: passwordValidation,
  confirmNewPassword: z
    .string()
    .min(1, 'Please confirm your new password'),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "New passwords don't match",
  path: ["confirmNewPassword"],
});

// Delete account form validation schema
export const deleteAccountSchema = z.object({
  password: z
    .string()
    .min(1, 'Password is required to delete your account'),
  confirmText: z
    .string()
    .min(1, 'Please type "DELETE" to confirm')
    .refine((val) => val === 'DELETE', {
      message: 'Please type "DELETE" exactly to confirm account deletion',
    }),
});

// Type exports
export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
// Manual type for DeleteAccountFormData to avoid Zod 4.x refine type narrowing
export type DeleteAccountFormData = {
  password: string;
  confirmText: string;
};
