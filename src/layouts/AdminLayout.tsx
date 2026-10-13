import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import {
  LayoutDashboard,
  Cake,
  ShoppingBag,
  Sparkles,
  ExternalLink,
  LogOut,
  Menu,
  X,
  ShieldAlert,
  User,
  Store,
  Layers,
  Bell,
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { admin, isDefaultCredentials, logout } = useAdminAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const navItems = [
    {
      name: 'Overview Dashboard',
      path: '/admin',
      exact: true,
      icon: LayoutDashboard,
      badge: 'Live',
    },
    {
      name: 'Cake Catalog',
      path: '/admin/cakes',
      exact: false,
      icon: Cake,
      badge: 'Live',
    },
    {
      name: 'Categories',
      path: '/admin/categories',
      exact: false,
      icon: Layers,
      badge: 'Live',
    },
    {
      name: 'Orders Management',
      path: '/admin/orders',
      exact: false,
      icon: ShoppingBag,
      badge: 'Live',
    },
    {
      name: 'Custom Inquiries',
      path: '/admin/inquiries',
      exact: false,
      icon: Sparkles,
      badge: 'Live',
    },
    {
      name: 'Notifications Audit',
      path: '/admin/notifications',
      exact: false,
      icon: Bell,
      badge: 'Audit',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8F4EE] flex flex-col md:flex-row text-[#2B1810]">
      {/* Mobile Header Bar */}
      <div className="md:hidden bg-[#2B1810] text-[#FFFDF9] px-4 py-3.5 flex items-center justify-between sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#C5A059] flex items-center justify-center text-[#2B1810] font-serif font-black text-sm">
            D
          </div>
          <div>
            <h1 className="font-serif font-bold text-sm tracking-wide text-[#FFFDF9]">
              Deep’s Admin
            </h1>
            <p className="text-[10px] text-[#DFBF77] -mt-0.5">Control Center</p>
          </div>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[#FFFDF9] transition-colors"
          aria-label="Toggle navigation menu"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar for Desktop & Mobile Overlay */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#2B1810] text-[#FFFDF9] flex flex-col transition-transform duration-300 md:static md:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } shadow-2xl md:shadow-none`}
      >
        {/* Brand Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#DFBF77] to-[#C5A059] text-[#2B1810] flex items-center justify-center font-serif font-bold text-lg shadow-md group-hover:scale-105 transition-transform">
              D
            </div>
            <div>
              <span className="font-serif font-bold text-base tracking-wide text-[#FFFDF9] block">
                Deep’s Cake Shop
              </span>
              <span className="text-[11px] font-medium text-[#DFBF77] tracking-wider uppercase block">
                Admin Dashboard
              </span>
            </div>
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden text-stone-400 hover:text-white p-1"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Alert Badge in Sidebar if default credentials */}
        {isDefaultCredentials && (
          <div className="mx-4 mt-4 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex gap-2.5 items-start">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="font-bold text-amber-300 block text-[11px]">Security Notice</strong>
              <p className="text-[10px] text-amber-200/90 leading-relaxed">
                Default password in use. Change before production deployment.
              </p>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">
            Bakery Management
          </div>

          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#C5A059] text-[#2B1810] shadow-md font-bold'
                    : 'text-stone-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    item.badge === 'Live'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-white/10 text-stone-300 border border-white/10'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/10 space-y-3 bg-black/10">
          <Link
            to="/"
            target="_blank"
            className="flex items-center justify-between px-3.5 py-2 rounded-xl text-xs text-stone-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Store className="w-4 h-4 text-[#DFBF77]" />
              <span>Customer Storefront</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
          </Link>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[#DFBF77] shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{admin?.username}</p>
                <p className="text-[10px] text-stone-400 capitalize truncate">{admin?.role || 'Manager'}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 text-stone-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
              title="Logout from admin dashboard"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile drawer */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden animate-in fade-in"
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Desktop Top Header Bar */}
        <header className="hidden md:flex bg-white border-b border-[#E8DDD7] px-8 py-4 items-center justify-between sticky top-0 z-30 shadow-2xs">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#C5A059]">
              Administration Console
            </span>
            <h2 className="font-serif text-xl font-bold text-[#2B1810]">
              Deep’s Cake Shop Bakery Operations
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FAF3E0] hover:bg-[#F5E8C7] text-[#5C3D28] text-xs font-semibold border border-[#E8DDD7] transition-colors"
            >
              <Store className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Live Storefront</span>
              <ExternalLink className="w-3 h-3 text-[#7E6355]" />
            </Link>

            <div className="h-6 w-px bg-[#E8DDD7]" />

            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[#5C3D28] font-medium">System Online</span>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#2B1810] hover:bg-[#3D2314] text-[#FFFDF9] text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Child Views */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
