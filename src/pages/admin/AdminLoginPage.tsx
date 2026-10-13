import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { Lock, User, Eye, EyeOff, Cake, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react';

export const AdminLoginPage: React.FC = () => {
  const { login, isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/admin';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim() || !password) {
      setErrorMessage('Please provide both username/email and password.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await login(usernameOrEmail.trim(), password);
      const from = (location.state as any)?.from?.pathname || '/admin';
      navigate(from, { replace: true });
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Invalid administrative credentials. Please verify your login details.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUseDemoCredentials = () => {
    setUsernameOrEmail('admin');
    setPassword('AdminBakery@2026');
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative selection:bg-[#FAF3E0]">
      {/* Background Subtle Bakery Accent */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#FAF3E0] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#FFF0F3] rounded-full blur-3xl" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 space-y-6">
        {/* Back to Storefront Link */}
        <div className="flex justify-start">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5C3D28] hover:text-[#2B1810] transition-colors bg-white px-3.5 py-1.5 rounded-full border border-[#E8DDD7] shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>Back to Storefront</span>
          </Link>
        </div>

        {/* Card Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-[#2B1810] text-[#DFBF77] mx-auto flex items-center justify-center shadow-lg border border-[#3D2314]">
            <Cake className="w-8 h-8" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#C5A059] block">
            Deep’s Cake Shop
          </span>
          <h1 className="font-serif text-3xl font-bold text-[#2B1810]">
            Bakery Control Center
          </h1>
          <p className="text-xs text-[#7E6355]">
            Administrative Portal for Catalog, Orders, & Operations
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-white p-8 sm:p-10 rounded-3xl border border-[#E8DDD7] shadow-xl space-y-6">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold uppercase text-[#5C3D28] tracking-wider block mb-1.5">
                Admin Username or Email
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder="admin or admin@deepscakes.com"
                  className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#2B1810] placeholder-[#7E6355]/40 focus:outline-hidden focus:border-[#C5A059] transition-colors"
                />
                <User className="w-4 h-4 text-[#C5A059] absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-[#5C3D28] tracking-wider block mb-1.5">
                Security Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl pl-10 pr-10 py-2.5 text-xs text-[#2B1810] placeholder-[#7E6355]/40 focus:outline-hidden focus:border-[#C5A059] transition-colors"
                />
                <Lock className="w-4 h-4 text-[#C5A059] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5 cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || authLoading}
              className="w-full py-3.5 px-4 rounded-xl bg-[#2B1810] hover:bg-[#3D2314] text-[#FFFDF9] text-xs font-bold tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying Session...</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#DFBF77]" />
                  <span>Authenticate Admin</span>
                </span>
              )}
            </button>
          </form>

          {/* Seeded Testing Helper Box */}
          <div className="p-3.5 rounded-2xl bg-[#FAF3E0]/70 border border-[#E8DDD7] text-xs text-[#5C3D28] space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-[11px] text-[#2B1810]">
                Initial Demo Credentials:
              </span>
              <button
                type="button"
                onClick={handleUseDemoCredentials}
                className="text-[10px] font-bold text-[#C5A059] hover:underline cursor-pointer"
              >
                Auto Fill
              </button>
            </div>
            <p className="text-[11px] font-mono text-stone-600 bg-white/70 p-1.5 rounded-lg border border-[#E8DDD7]/60">
              Username: <strong className="text-[#2B1810]">admin</strong> | Password: <strong className="text-[#2B1810]">AdminBakery@2026</strong>
            </p>
            <p className="text-[10px] text-stone-500 leading-relaxed">
              * Note: For production security, this default credential must be rotated upon deployment.
            </p>
          </div>
        </div>

        <p className="text-center text-[11px] text-stone-400">
          Deep’s Cake Shop Phase 3 • Secure Node.js + JWT Backend
        </p>
      </div>
    </div>
  );
};
