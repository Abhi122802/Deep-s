import { z } from 'zod';

export const adminLoginSchema = z.object({
  usernameOrEmail: z.string().trim().min(3, 'Username or email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

/**
 * Documented Administrative Password Policy:
 * 1. Minimum 10 characters, maximum 128 characters.
 * 2. At least one uppercase letter (A-Z).
 * 3. At least one lowercase letter (a-z).
 * 4. At least one numeric digit (0-9).
 * 5. At least one special symbol.
 * 6. Must not be identical to the current password.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(10, 'New password must be at least 10 characters long')
      .max(128, 'New password must not exceed 128 characters')
      .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'New password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'New password must contain at least one numeric digit')
      .regex(/[^A-Za-z0-9]/, 'New password must contain at least one special character'),
    confirmPassword: z.string().optional(),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password cannot be identical to the current password',
    path: ['newPassword'],
  })
  .refine(
    (data) => {
      if (data.confirmPassword !== undefined) {
        return data.newPassword === data.confirmPassword;
      }
      return true;
    },
    {
      message: 'New password and confirmation password do not match',
      path: ['confirmPassword'],
    }
  );
