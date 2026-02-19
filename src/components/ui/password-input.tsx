'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { checkPasswordStrength } from '@/lib/auth/config';
import { cn } from '@/lib/utils';

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showStrength?: boolean;
  className?: string;
  id?: string;
}

/**
 * Enhanced password input with visibility toggle and strength indicator
 */
export default function PasswordInput({ 
  value, 
  onChange, 
  placeholder = "Enter your password",
  showStrength = false,
  className,
  id 
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  
  // Calculate password strength
  const strength = showStrength ? checkPasswordStrength(value) : null;
  
  // Get strength color and label
  const getStrengthInfo = (score: number) => {
    if (score < 2) return { color: 'destructive', label: 'Weak' };
    if (score < 3) return { color: 'secondary', label: 'Fair' };
    if (score < 4) return { color: 'default', label: 'Good' };
    return { color: 'default', label: 'Strong' };
  };

  const strengthInfo = strength ? getStrengthInfo(strength.score) : null;

  return (
    <div className="space-y-2">
      {/* Password Input Field */}
      <div className="relative">
        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          id={id}
          type={showPassword ? 'text' : 'password'}
          placeholder={placeholder}
          className={cn("pl-10 pr-10", className)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1 h-8 w-8 px-0"
          onClick={() => setShowPassword(!showPassword)}
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Eye className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="sr-only">
            {showPassword ? 'Hide password' : 'Show password'}
          </span>
        </Button>
      </div>

      {/* Password Strength Indicator */}
      {showStrength && value && strength && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Password strength:</span>
            <Badge 
              variant={strengthInfo?.color === 'destructive' ? 'destructive' : 'default'}
              className="text-xs"
            >
              {strengthInfo?.label}
            </Badge>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-muted rounded-full h-1">
            <div
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                strength.score < 2 && "bg-destructive w-1/4",
                strength.score >= 2 && strength.score < 3 && "bg-muted-foreground w-2/4",
                strength.score >= 3 && strength.score < 4 && "bg-primary w-3/4",
                strength.score >= 4 && "bg-primary w-full"
              )}
            />
          </div>

          {/* Feedback Messages */}
          {strength.feedback.length > 0 && (
            <ul className="text-xs text-muted-foreground space-y-1">
              {strength.feedback.map((feedback, index) => (
                <li key={index} className="flex items-center">
                  <span className="w-1 h-1 bg-muted-foreground rounded-full mr-2" />
                  {feedback}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
