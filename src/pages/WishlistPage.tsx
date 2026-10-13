import React from 'react';
import { Link } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { EggBadge } from '../components/common/EggBadge';
import { Heart, ShoppingBag, Trash2, ArrowRight } from 'lucide-react';

export const WishlistPage: React.FC = () => {
  const { wishlist, removeFromWishlist } = useWishlist();
  const { addItem } = useCart();

  if (wishlist.length === 0) {
    return (
      <div className="bg-[#FDFBF7] min-h-[70vh] flex items-center justify-center py-16 px-4">
        <div className="text-center max-w-md bg-white p-8 sm:p-12 rounded-3xl border border-[#E8DDD7] shadow-sm space-y-5">
          <div className="w-20 h-20 rounded-full bg-[#FFF0F3] text-[#D86A7F] mx-auto flex items-center justify-center">
            <Heart className="w-10 h-10" />
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#2B1810]">
            Your Wishlist is Empty
          </h1>
          <p className="text-sm text-[#7E6355] leading-relaxed">
            Save your favorite artisanal creations here to order anytime for birthdays, anniversaries, and parties!
          </p>
          <div className="pt-2">
            <Link
              to="/cakes"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#2B1810] hover:bg-[#3D2314] text-[#FFFDF9] text-xs font-bold transition-all shadow-md"
            >
              <span>Discover Handcrafted Cakes</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#DFBF77]" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#FDFBF7] py-10 md:py-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="border-b border-[#E8DDD7] pb-6">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#2B1810]">
            My Saved Cakes ({wishlist.length})
          </h1>
          <p className="text-sm text-[#7E6355] mt-1">
            Your personal selection of favorite treats ready to order
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {wishlist.map((cake) => (
            <div
              key={cake.id}
              className="bg-white rounded-2xl border border-[#E8DDD7] overflow-hidden shadow-2xs hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <div className="relative aspect-square w-full overflow-hidden bg-[#FDFBF7]">
                <Link to={`/product/${cake.id}`}>
                  <img
                    src={cake.image}
                    alt={cake.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                  />
                </Link>
                <button
                  onClick={() => removeFromWishlist(cake.id)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 text-stone-400 hover:text-rose-600 flex items-center justify-center transition-colors shadow-sm"
                  aria-label="Remove from wishlist"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-full shadow-xs">
                  <EggBadge isEggless={cake.isEggless} size="sm" />
                </div>
              </div>

              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#C5A059] tracking-wider block">
                    {cake.category}
                  </span>
                  <Link
                    to={`/product/${cake.id}`}
                    className="font-serif text-base font-bold text-[#2B1810] hover:text-[#C5A059] line-clamp-1 mt-0.5"
                  >
                    {cake.name}
                  </Link>
                  <p className="text-xs text-[#7E6355] line-clamp-1 mt-0.5">
                    {cake.flavor}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#F4EEE8] flex items-center justify-between">
                  <span className="text-base font-bold text-[#2B1810]">
                    ₹{cake.basePrice.toLocaleString('en-IN')}
                  </span>
                  <button
                    onClick={() => addItem(cake, '0.5 kg', 1)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2B1810] hover:bg-[#3D2314] text-[#FFFDF9] text-xs font-bold transition-all cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-[#DFBF77]" />
                    <span>Add to Cart</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
