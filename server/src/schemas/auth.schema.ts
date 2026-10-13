import { z } from 'zod';

export const adminLoginSchema = z.object({
  usernameOrEmail: z.string().trim().min(3, 'Username or email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
