import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { AdminModel, MEMORY_ADMIN } from '../models/Admin.js';
import { env } from '../config/env.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { isDbConnected } from '../config/db.js';

export async function adminLogin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { usernameOrEmail, password } = req.body;

    if (!isDbConnected()) {
      if (env.NODE_ENV !== 'production') {
        const lower = usernameOrEmail.toLowerCase();
        if (lower === MEMORY_ADMIN.username || lower === MEMORY_ADMIN.email) {
          const isMatch = await MEMORY_ADMIN.comparePassword(password);
          if (isMatch) {
            const token = jwt.sign(
              {
                id: MEMORY_ADMIN.id,
                username: MEMORY_ADMIN.username,
                role: MEMORY_ADMIN.role,
                tokenVersion: MEMORY_ADMIN.tokenVersion ?? 0,
              },
              env.JWT_SECRET,
              { expiresIn: '8h' }
            );
            res.cookie('admin_token', token, {
              httpOnly: true,
              secure: false,
              sameSite: 'lax',
              maxAge: 8 * 60 * 60 * 1000,
              path: '/',
            });
            res.json({
              success: true,
              token,
              admin: {
                id: MEMORY_ADMIN.id,
                username: MEMORY_ADMIN.username,
                email: MEMORY_ADMIN.email,
                role: MEMORY_ADMIN.role,
              },
              isDefaultCredentials: true,
              message: 'Admin authentication successful.',
            });
            return;
          }
          res.status(401).json({
            success: false,
            message: 'Invalid administrative credentials.',
          });
          return;
        }
      }

      res.status(503).json({
        success: false,
        message: 'Database is currently offline. Cannot authenticate admin.',
      });
      return;
    }

    const admin = await AdminModel.findOne({
      $or: [
        { username: usernameOrEmail.toLowerCase() },
        { email: usernameOrEmail.toLowerCase() },
      ],
    }).select('+passwordHash');

    if (!admin) {
      res.status(401).json({
        success: false,
        message: 'Invalid administrative credentials.',
      });
      return;
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Invalid administrative credentials.',
      });
      return;
    }

    // Generate JWT with tokenVersion
    const token = jwt.sign(
      {
        id: admin._id.toString(),
        username: admin.username,
        role: admin.role,
        tokenVersion: admin.tokenVersion ?? 0,
      },
      env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Set secure, HttpOnly cookie with SameSite protection
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
      path: '/',
    });

    const isDefault = admin.username.toLowerCase() === 'admin';

    res.json({
      success: true,
      token,
      admin: {
        id: admin._id.toString(),
        username: admin.username,
        email: admin.email,
        role: admin.role,
      },
      isDefaultCredentials: isDefault,
      message: 'Admin authentication successful.',
    });
  } catch (error) {
    next(error);
  }
}

export async function adminLogout(
  _req: Request,
  res: Response
): Promise<void> {
  res.clearCookie('admin_token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  res.json({
    success: true,
    message: 'Admin logged out successfully.',
  });
}

export async function getAdminMe(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    let admin: any = null;
    if (isDbConnected()) {
      admin = await AdminModel.findById(req.user.id);
    } else if (env.NODE_ENV !== 'production') {
      if (req.user.id === MEMORY_ADMIN.id || req.user.username === MEMORY_ADMIN.username) {
        admin = MEMORY_ADMIN;
      }
    }

    if (!admin) {
      res.status(404).json({ success: false, message: 'Admin account not found' });
      return;
    }

    const isDefault = admin.username.toLowerCase() === 'admin';

    res.json({
      success: true,
      admin: {
        id: admin._id ? admin._id.toString() : admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
      },
      isDefaultCredentials: isDefault,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/auth/password
 * Authenticated administrative password change endpoint.
 *
 * Requirements:
 * 1. Admin must be authenticated.
 * 2. Current password must match stored bcrypt hash.
 * 3. New password must satisfy documented complexity policy (validated via changePasswordSchema).
 * 4. Password hash is updated; plaintext password and hash are NEVER returned or logged.
 * 5. Active HttpOnly session cookie is cleared upon password change.
 * 6. Limitation disclosure: Stateless Bearer JWT tokens in flight expire at their 8h TTL,
 *    as immediate server-side revocation requires stateful session tracking or Redis.
 */
export async function changeAdminPassword(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    let admin: any = null;
    if (isDbConnected()) {
      admin = await AdminModel.findById(req.user.id).select('+passwordHash');
    } else if (env.NODE_ENV !== 'production') {
      if (req.user.id === MEMORY_ADMIN.id || req.user.username === MEMORY_ADMIN.username) {
        admin = MEMORY_ADMIN;
      }
    } else {
      res.status(503).json({
        success: false,
        message: 'Database is required in production mode. Cannot update admin credentials.',
      });
      return;
    }

    if (!admin) {
      res.status(404).json({ success: false, message: 'Admin account not found.' });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Current password verification failed. Please verify your current credentials.',
      });
      return;
    }

    // Generate new bcrypt salt and hash
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    admin.passwordHash = newHash;
    admin.tokenVersion = (admin.tokenVersion ?? 0) + 1;
    await admin.save();

    // Terminate current browser cookie session
    res.clearCookie('admin_token', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    res.json({
      success: true,
      message: 'Admin password successfully updated. Active cookie session has been terminated; please log in with your new credentials.',
      sessionRevocation: {
        cookieSessionCleared: true,
        bearerTokensRevoked: true,
        tokenVersion: admin.tokenVersion,
        bearerTokenLimitation: 'Previous tokens revoked via tokenVersion increment.',
      },
    });
  } catch (error) {
    next(error);
  }
}
