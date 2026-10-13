import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

export function requireAdminAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  let token: string | undefined;

  // 1. Check HttpOnly cookie first for browser sessions
  if (req.cookies && req.cookies.admin_token) {
    token = req.cookies.admin_token;
  }
  // 2. Fall back to Authorization Bearer header for API clients / testing
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Authentication required. Missing or malformed authorization token.',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      id: string;
      username: string;
      role: string;
    };
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({
      success: false,
      message: 'Invalid or expired authentication token.',
    });
  }
}
