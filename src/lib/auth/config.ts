/**
 * Authentication Configuration
 * Project-wide settings for authentication behavior
 */
export interface AuthConfig {
  emailVerification: {
    required: boolean;
    sendOnSignup: boolean;
  };
  passwordRequirements: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  };
}

/**
 * Default authentication configuration
 * Modify these flags based on project requirements
 */
export const AUTH_CONFIG: AuthConfig = {
  emailVerification: {
    required: false, // Set to true if email verification is mandatory
    sendOnSignup: true, // Send verification email on signup
  },
  passwordRequirements: {
    minLength: 6,
    requireUppercase: false,
    requireLowercase: false,
    requireNumbers: false,
    requireSpecialChars: false,
  },
};

/**
 * Password strength checker
 */
export const checkPasswordStrength = (password: string) => {
  const { passwordRequirements } = AUTH_CONFIG;
  const strength = {
    score: 0,
    feedback: [] as string[],
    isValid: password.length >= passwordRequirements.minLength,
  };

  // Length check
  if (password.length >= passwordRequirements.minLength) {
    strength.score += 1;
  } else {
    strength.feedback.push(`At least ${passwordRequirements.minLength} characters`);
  }

  // Uppercase check
  if (passwordRequirements.requireUppercase) {
    if (/[A-Z]/.test(password)) {
      strength.score += 1;
    } else {
      strength.feedback.push('Include uppercase letters');
    }
  }

  // Lowercase check
  if (passwordRequirements.requireLowercase) {
    if (/[a-z]/.test(password)) {
      strength.score += 1;
    } else {
      strength.feedback.push('Include lowercase letters');
    }
  }

  // Numbers check
  if (passwordRequirements.requireNumbers) {
    if (/\d/.test(password)) {
      strength.score += 1;
    } else {
      strength.feedback.push('Include numbers');
    }
  }

  // Special characters check
  if (passwordRequirements.requireSpecialChars) {
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      strength.score += 1;
    } else {
      strength.feedback.push('Include special characters');
    }
  }

  // Additional strength indicators
  if (password.length >= 8) strength.score += 0.5;
  if (password.length >= 12) strength.score += 0.5;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength.score += 0.5;
  if (/\d/.test(password)) strength.score += 0.5;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength.score += 0.5;

  return strength;
};
