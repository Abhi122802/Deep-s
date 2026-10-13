import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AdminModel } from '../models/Admin.js';
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

    // Generate JWT
    const token = jwt.sign(
      {
        id: admin._id.toString(),
        username: admin.username,
        role: admin.role,
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

    const admin = await AdminModel.findById(req.user.id);
    if (!admin) {
      res.status(404).json({ success: false, message: 'Admin account not found' });
      return;
    }

    const isDefault = admin.username.toLowerCase() === 'admin';

    res.json({
      success: true,
      admin: {
        id: admin._id.toString(),
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
