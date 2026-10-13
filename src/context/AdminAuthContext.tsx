import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { adminService, type AdminUser } from '../services/adminService';
import { authStorage } from '../services/api';

interface AdminAuthContextType {
  admin: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDefaultCredentials: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isDefaultCredentials, setIsDefaultCredentials] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const checkAuth = useCallback(async () => {
    // Only attempt verification if a token exists or cookies are present
    const hasToken = !!authStorage.getToken();
    try {
      const res = await adminService.getMe();
      if (res.success && res.admin) {
        setAdmin(res.admin);
        setIsDefaultCredentials(!!res.isDefaultCredentials);
      } else {
        setAdmin(null);
        authStorage.clearToken();
      }
    } catch {
      // If unauthorized or network error, reset state
      setAdmin(null);
      if (hasToken) {
        authStorage.clearToken();
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (usernameOrEmail: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await adminService.login(usernameOrEmail, password);
      if (res.success && res.admin) {
        setAdmin(res.admin);
        setIsDefaultCredentials(!!res.isDefaultCredentials);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await adminService.logout();
    } finally {
      setAdmin(null);
      setIsDefaultCredentials(false);
      setIsLoading(false);
    }
  };

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        isAuthenticated: !!admin,
        isLoading,
        isDefaultCredentials,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = (): AdminAuthContextType => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
