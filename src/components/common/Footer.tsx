import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Cake,
  Heart,
  Phone,
  Mail,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export const Footer: React.FC = () => {
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const { showToast } = useToast();

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim() || !newsletterEmail.includes('@')) {
      showToast('Please enter a valid email address', 'warning');
      return;
    }
    showToast('Subscribed! Check your inbox for 10% off your first order.', 'success');
    setNewsletterEmail('');
  };

  return (
    <footer className="bg-[#2B1810] text-[#FFFDF9] border-t border-[#3D2314] pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-[#3D2314]">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-linear-to-tr from-[#3D2314] to-[#4A2E1B] border border-[#DFBF77]/30 flex items-center justify-center text-[#DFBF77]">
                <Cake className="w-5 h-5" />
              </div>
              <span className="font-serif text-2xl font-bold tracking-tight text-[#FFFDF9]">
                Deep’s <span className="text-[#DFBF77] font-normal italic">Cake Shop</span>
              </span>
            </Link>

            <p className="text-stone-300 text-sm leading-relaxed max-w-sm">
              Artisanal patisserie crafting celebrations with pure Belgian chocolate, fresh local dairy, and bespoke confectionery artistry. Every cake is baked fresh to order in our hygiene-certified kitchen.
            </p>

            <div className="pt-2 space-y-2 text-xs text-stone-300">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-[#DFBF77] shrink-0" />
                <span>Shop 14, Heritage Bakery Walk, Downtown Promenade</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-[#DFBF77] shrink-0" />
                <span>Open Daily: 8:00 AM – 11:30 PM IST</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-[#DFBF77] shrink-0" />
                <span>Direct Line: +91 98765 43210</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-[#DFBF77] shrink-0" />
                <span>hello@deepscakeshop.in</span>
              </div>
            </div>
          </div>

          {/* Cake Categories */}
          <div className="space-y-3">
            <h4 className="font-serif text-base font-bold text-[#DFBF77] tracking-wide">
              Cake Collections
            </h4>
            <ul className="space-y-2 text-xs text-stone-300">
              <li>
                <Link to="/cakes?category=Birthday" className="hover:text-[#DFBF77] transition-colors">
                  Birthday Cakes
                </Link>
              </li>
              <li>
                <Link to="/cakes?category=Anniversary" className="hover:text-[#DFBF77] transition-colors">
                  Anniversary Cakes
                </Link>
              </li>
              <li>
                <Link to="/cakes?category=Chocolate" className="hover:text-[#DFBF77] transition-colors">
                  Belgian Chocolate Cakes
                </Link>
              </li>
              <li>
                <Link to="/cakes?category=Designer" className="hover:text-[#DFBF77] transition-colors">
                  Designer Signature Cakes
                </Link>
              </li>
              <li>
                <Link to="/cakes?category=Photo" className="hover:text-[#DFBF77] transition-colors">
                  Custom Photo Cakes
                </Link>
              </li>
              <li>
                <Link to="/cakes?category=Eggless" className="hover:text-[#DFBF77] transition-colors">
                  100% Pure Eggless
                </Link>
              </li>
              <li>
                <Link to="/cakes?category=Wedding" className="hover:text-[#DFBF77] transition-colors">
                  Grand Wedding Tiers
                </Link>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="font-serif text-base font-bold text-[#DFBF77] tracking-wide">
              Quick Links
            </h4>
            <ul className="space-y-2 text-xs text-stone-300">
              <li>
                <Link to="/cakes" className="hover:text-[#DFBF77] transition-colors">
                  Browse All Cakes
                </Link>
              </li>
              <li>
                <Link to="/custom-cake" className="hover:text-[#DFBF77] transition-colors flex items-center gap-1 text-[#F7CAD0]">
                  <Sparkles className="w-3 h-3" />
                  Order Custom Cake
                </Link>
              </li>
              <li>
                <Link to="/cart" className="hover:text-[#DFBF77] transition-colors">
                  Shopping Cart
                </Link>
              </li>
              <li>
                <Link to="/wishlist" className="hover:text-[#DFBF77] transition-colors">
                  My Wishlist
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-[#DFBF77] transition-colors">
                  About Our Chefs
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-[#DFBF77] transition-colors">
                  Store Locator & Support
                </Link>
              </li>
            </ul>
          </div>

          {/* VIP Club Newsletter */}
          <div className="space-y-4">
            <h4 className="font-serif text-base font-bold text-[#DFBF77] tracking-wide">
              Sweet Club
            </h4>
            <p className="text-xs text-stone-300 leading-relaxed">
              Subscribe to receive weekly seasonal flavor drops and special discounts.
            </p>

            <form onSubmit={handleNewsletterSubmit} className="space-y-2">
              <div className="relative">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  className="w-full bg-[#1F100A] border border-[#3D2314] rounded-xl px-3.5 py-2 text-xs text-white placeholder-stone-400 focus:outline-hidden focus:border-[#DFBF77]"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 px-3 rounded-xl bg-linear-to-r from-[#DFBF77] to-[#C5A059] hover:from-[#E5C378] hover:to-[#B38E46] text-[#2B1810] text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>Subscribe for 10% Off</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="pt-2 text-[11px] text-stone-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#DFBF77]" />
              <span>No spam. Unsubscribe anytime.</span>
            </div>
          </div>
        </div>

        {/* Bottom Bar & Prototype Notice */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-stone-400">
          <div className="flex items-center gap-2">
            <span>© {new Date().getFullYear()} Deep’s Cake Shop. All rights reserved.</span>
            <span className="hidden sm:inline">|</span>
            <span className="text-[#DFBF77] flex items-center gap-1">
              Crafted with <Heart className="w-3 h-3 text-[#D86A7F] fill-current" /> in India
            </span>
          </div>

          <div className="px-3 py-1 rounded-full bg-[#3D2314]/80 text-stone-300 text-[11px] border border-[#4A2E1B]">
            Phase 1 Frontend • Modular API Layer ready for Express + MongoDB
          </div>
        </div>
      </div>
    </footer>
  );
};
