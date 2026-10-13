import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Cake } from 'lucide-react';

export const AdminRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-3xl bg-[#2B1810] flex items-center justify-center text-[#DFBF77] shadow-xl animate-pulse mb-4">
          <Cake className="w-8 h-8 animate-bounce" />
        </div>
        <h3 className="font-serif text-lg font-bold text-[#2B1810]">
          Verifying Admin Access...
        </h3>
        <p className="text-xs text-[#7E6355] mt-1">
          Deep’s Cake Shop Bakery Control Center
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};
