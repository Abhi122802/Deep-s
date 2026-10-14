import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AdminModel, MEMORY_ADMIN } from '../models/Admin.js';
import { isDbConnected } from '../config/db.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
    tokenVersion?: number;
  };
}

export async function requireAdminAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
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
      tokenVersion?: number;
    };

    // Validate persistent tokenVersion to support immediate token revocation
    let currentAdmin: { tokenVersion?: number } | null = null;
    if (isDbConnected()) {
      currentAdmin = await AdminModel.findById(decoded.id).select('tokenVersion').lean();
      if (!currentAdmin && decoded.username) {
        currentAdmin = await AdminModel.findOne({ username: decoded.username.toLowerCase() }).select('tokenVersion').lean();
      }
    } else if (env.NODE_ENV !== 'production') {
      if (decoded.id === MEMORY_ADMIN.id || decoded.username === MEMORY_ADMIN.username) {
        currentAdmin = MEMORY_ADMIN;
      } else {
        // Fallback for mock test accounts in offline dev/test environments
        currentAdmin = { tokenVersion: 0 };
      }
    }

    if (!currentAdmin) {
      res.status(401).json({
        success: false,
        message: 'Admin account associated with this token no longer exists.',
      });
      return;
    }

    const expectedVersion = currentAdmin.tokenVersion ?? 0;
    const providedVersion = decoded.tokenVersion;

    // Handle legacy tokens (tokens that lack tokenVersion claim):
    // If the admin has never rotated password (expectedVersion === 0), allow legacy token.
    // If expectedVersion > 0, legacy tokens are strictly revoked.
    if (providedVersion === undefined) {
      if (expectedVersion > 0) {
        res.status(401).json({
          success: false,
          message: 'Authentication token has been revoked due to a credential change. Please log in again.',
        });
        return;
      }
    } else if (providedVersion !== expectedVersion) {
      res.status(401).json({
        success: false,
        message: 'Authentication token has been revoked. Please log in again.',
      });
      return;
    }

    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({
      success: false,
      message: 'Invalid or expired authentication token.',
    });
  }
}
