import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Search,
  Heart,
  ShoppingBag,
  Menu,
  X,
  Cake as CakeIcon,
  Sparkles,
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';

export const Navbar: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const { itemCount, subtotal, openCart } = useCart();
  const { wishlistCount } = useWishlist();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/cakes?search=${encodeURIComponent(searchQuery.trim())}`);
      setIsMobileMenuOpen(false);
    }
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors duration-200 relative py-1 ${
      isActive
        ? 'text-[#2B1810] font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#C5A059]'
        : 'text-[#5C3D28] hover:text-[#2B1810]'
    }`;

  return (
    <header className="sticky top-0 z-40 bg-[#FFFDF9]/90 backdrop-blur-md border-b border-[#E8DDD7]/80 transition-shadow duration-300 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-[#2B1810] hover:text-[#C5A059] rounded-lg transition-colors"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 shrink-0 group">
            <div className="w-11 h-11 rounded-full bg-linear-to-tr from-[#3D2314] to-[#2B1810] flex items-center justify-center text-[#DFBF77] shadow-sm group-hover:scale-105 transition-transform duration-300">
              <CakeIcon className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-2xl md:text-2xl font-bold tracking-tight text-[#2B1810] flex items-center gap-1.5">
                Deep’s <span className="text-[#C5A059] font-normal italic">Bakery</span>
              </span>
              <span className="text-[10px] uppercase tracking-widest text-[#7E6355] font-semibold">
                Artisanal Patisserie
              </span>
            </div>
          </Link>

          {/* Desktop Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <input
                type="text"
                placeholder="Search Belgian Truffle, Red Velvet, Photo Cake..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-full pl-10 pr-12 py-2 text-sm text-[#2B1810] placeholder-[#7E6355]/60 focus:outline-hidden focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 transition-all"
              />
              <Search className="w-4 h-4 text-[#7E6355] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-[#2B1810] hover:bg-[#3D2314] text-[#FFFDF9] text-xs font-medium rounded-full transition-colors"
              >
                Find
              </button>
            </form>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7">
            <NavLink to="/" className={navLinkClass}>
              Home
            </NavLink>
            <NavLink to="/cakes" className={navLinkClass}>
              All Cakes
            </NavLink>
            <NavLink
              to="/custom-cake"
              className={({ isActive }) =>
                `text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
                  isActive
                    ? 'bg-[#F4ACB7] text-[#2B1810] font-semibold shadow-xs'
                    : 'bg-[#FFF0F3] text-[#2B1810] hover:bg-[#F7CAD0]'
                }`
              }
            >
              <Sparkles className="w-3.5 h-3.5 text-[#D86A7F]" />
              Custom Cake
            </NavLink>
            <NavLink to="/about" className={navLinkClass}>
              Our Story
            </NavLink>
            <NavLink to="/contact" className={navLinkClass}>
              Contact
            </NavLink>
          </nav>

          {/* Action Icons: Wishlist & Cart */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Wishlist Link */}
            <Link
              to="/wishlist"
              className="relative p-2.5 rounded-full text-[#3D2314] hover:bg-[#FFF0F3] hover:text-[#D86A7F] transition-all"
              aria-label={`Wishlist with ${wishlistCount} items`}
            >
              <Heart className="w-5 h-5" />
              {wishlistCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#D86A7F] text-white text-[10px] font-bold flex items-center justify-center shadow-xs animate-in zoom-in">
                  {wishlistCount}
                </span>
              )}
            </Link>

            {/* Quick Cart Drawer Trigger */}
            <button
              onClick={openCart}
              className="relative flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#2B1810] hover:bg-[#3D2314] text-[#FFFDF9] transition-all shadow-xs group cursor-pointer"
              aria-label={`Open shopping cart with ${itemCount} items`}
            >
              <div className="relative">
                <ShoppingBag className="w-4 h-4 text-[#DFBF77]" />
                {itemCount > 0 && (
                  <span className="absolute -top-2 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#D86A7F] text-white text-[10px] font-bold flex items-center justify-center">
                    {itemCount}
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold tracking-wide hidden sm:inline">
                {subtotal > 0 ? `₹${subtotal.toLocaleString('en-IN')}` : 'Cart'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Search Bar below header */}
        <div className="md:hidden pb-3">
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <input
              type="text"
              placeholder="Search chocolate, eggless, wedding..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-full pl-9 pr-12 py-1.5 text-xs text-[#2B1810] placeholder-[#7E6355]/60 focus:outline-hidden focus:border-[#C5A059]"
            />
            <Search className="w-3.5 h-3.5 text-[#7E6355] absolute left-3 top-1/2 -translate-y-1/2" />
            <button
              type="submit"
              className="absolute right-1 top-1/2 -translate-y-1/2 px-2.5 py-0.5 bg-[#2B1810] text-[#FFFDF9] text-[11px] font-medium rounded-full"
            >
              Go
            </button>
          </form>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-[#E8DDD7] bg-[#FFFDF9] px-6 py-5 shadow-lg animate-in slide-in-from-top-4">
          <nav className="flex flex-col gap-4">
            <Link
              to="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-base font-medium text-[#2B1810] hover:text-[#C5A059] py-1"
            >
              Home
            </Link>
            <Link
              to="/cakes"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-base font-medium text-[#2B1810] hover:text-[#C5A059] py-1"
            >
              All Cakes Catalog
            </Link>
            <Link
              to="/custom-cake"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-2 text-base font-semibold text-[#D86A7F] bg-[#FFF0F3] p-3 rounded-xl"
            >
              <Sparkles className="w-4 h-4" />
              Order Custom Bespoke Cake
            </Link>
            <Link
              to="/cart"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-base font-medium text-[#2B1810] hover:text-[#C5A059] py-1"
            >
              View Full Cart ({itemCount})
            </Link>
            <Link
              to="/wishlist"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-base font-medium text-[#2B1810] hover:text-[#C5A059] py-1"
            >
              Saved Wishlist ({wishlistCount})
            </Link>
            <Link
              to="/about"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-base font-medium text-[#2B1810] hover:text-[#C5A059] py-1"
            >
              Our Story & Philosophy
            </Link>
            <Link
              to="/contact"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-base font-medium text-[#2B1810] hover:text-[#C5A059] py-1"
            >
              Contact & Store Timings
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
};
