import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Star, ShoppingBag, Sparkles } from 'lucide-react';
import type { Cake, WeightOption } from '../../types';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { EggBadge } from '../common/EggBadge';

interface ProductCardProps {
  cake: Cake;
}

const WEIGHT_OPTIONS: WeightOption[] = ['0.5 kg', '1 kg', '1.5 kg', '2 kg'];

export const ProductCard: React.FC<ProductCardProps> = ({ cake }) => {
  const [selectedWeight, setSelectedWeight] = useState<WeightOption>('0.5 kg');

  const { addItem } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const isFavorited = isInWishlist(cake.id);
  const currentPrice = cake.weightPrices[selectedWeight] || cake.basePrice;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(cake, selectedWeight, 1);
  };

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(cake);
  };

  return (
    <article className="group bg-white rounded-2xl border border-[#E8DDD7] overflow-hidden shadow-2xs hover:shadow-xl hover:border-[#C5A059]/40 transition-all duration-300 flex flex-col h-full relative">
      {/* Image container: EXACTLY ONE complete cake displayed */}
      <div className="relative aspect-square w-full overflow-hidden bg-[#FDFBF7]">
        <Link to={`/product/${cake.id}`} className="block w-full h-full">
          <img
            src={cake.image}
            alt={`${cake.name} - complete single cake`}
            loading="lazy"
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
          />
        </Link>

        {/* Top badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start pointer-events-none">
          {cake.isBestSeller && (
            <span className="px-2.5 py-0.5 rounded-full bg-[#2B1810] text-[#DFBF77] text-[10px] font-bold tracking-wider uppercase shadow-xs flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-[#DFBF77]" />
              Bestseller
            </span>
          )}
          <span className="px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur-xs text-[#2B1810] text-[11px] font-semibold shadow-xs">
            {cake.category}
          </span>
        </div>

        {/* Wishlist Button */}
        <button
          onClick={handleWishlistToggle}
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 shadow-md ${
            isFavorited
              ? 'bg-[#FFF0F3] text-[#D86A7F]'
              : 'bg-white/90 backdrop-blur-xs text-[#7E6355] hover:text-[#D86A7F] hover:bg-white'
          }`}
          aria-label={isFavorited ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart className={`w-4 h-4 ${isFavorited ? 'fill-[#D86A7F]' : ''}`} />
        </button>

        {/* Dietary / Eggless Indicator Pill overlay */}
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-full shadow-xs">
          <EggBadge isEggless={cake.isEggless} size="sm" />
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {/* Rating and Reviews */}
          <div className="flex items-center gap-1.5 text-xs text-[#7E6355] mb-1.5">
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#FAF3E0] text-[#B38E46] font-bold">
              <Star className="w-3 h-3 fill-current text-[#C5A059]" />
              {cake.rating.toFixed(1)}
            </span>
            <span className="text-[11px] text-[#7E6355]">
              ({cake.reviewsCount} reviews)
            </span>
          </div>

          {/* Product Name */}
          <Link
            to={`/product/${cake.id}`}
            className="block font-serif text-base sm:text-lg font-bold text-[#2B1810] hover:text-[#C5A059] transition-colors line-clamp-1"
          >
            {cake.name}
          </Link>

          {/* Flavor subtitle */}
          <p className="text-xs text-[#7E6355] line-clamp-1 mt-0.5">
            {cake.flavor}
          </p>
        </div>

        {/* Interactive Weight Options Selector */}
        <div className="pt-1">
          <div className="text-[11px] font-semibold text-[#5C3D28] mb-1.5 flex items-center justify-between">
            <span>Select Weight:</span>
            <span className="text-[#C5A059] font-bold">{selectedWeight}</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {WEIGHT_OPTIONS.map((weight) => (
              <button
                key={weight}
                type="button"
                onClick={() => setSelectedWeight(weight)}
                className={`text-[11px] font-medium py-1 rounded-md transition-all cursor-pointer ${
                  selectedWeight === weight
                    ? 'bg-[#2B1810] text-[#FFFDF9] font-bold shadow-2xs'
                    : 'bg-[#FDFBF7] text-[#5C3D28] border border-[#E8DDD7] hover:border-[#C5A059]'
                }`}
              >
                {weight}
              </button>
            ))}
          </div>
        </div>

        {/* Price & Add to Cart button */}
        <div className="pt-2 border-t border-[#F4EEE8] flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#7E6355] block">
              Price
            </span>
            <span className="text-lg sm:text-xl font-bold text-[#2B1810] tracking-tight">
              ₹{currentPrice.toLocaleString('en-IN')}
            </span>
          </div>

          <button
            onClick={handleAddToCart}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2B1810] hover:bg-[#3D2314] text-[#FFFDF9] text-xs font-bold transition-all shadow-xs group/btn cursor-pointer active:scale-95"
            aria-label={`Add ${cake.name} (${selectedWeight}) to cart`}
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#DFBF77] group-hover/btn:scale-110 transition-transform" />
            <span>Add</span>
          </button>
        </div>
      </div>
    </article>
  );
};
