import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { DEMO_CAKES } from '../data/cakes';
import type { Cake, WeightOption } from '../types';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
import { cakeService } from '../services/cakeService';
import { EggBadge } from '../components/common/EggBadge';
import { ProductCard } from '../components/product/ProductCard';
import {
  Heart,
  Star,
  ShoppingBag,
  Clock,
  Sparkles,
  ShieldCheck,
  Truck,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Share2,
} from 'lucide-react';

const WEIGHT_OPTIONS: WeightOption[] = ['0.5 kg', '1 kg', '1.5 kg', '2 kg'];

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { showToast } = useToast();

  const [cake, setCake] = useState<Cake | null>(null);
  const [selectedWeight, setSelectedWeight] = useState<WeightOption>('0.5 kg');
  const [quantity, setQuantity] = useState<number>(1);
  const [customMessage, setCustomMessage] = useState<string>('');
  const [pincode, setPincode] = useState<string>('');
  const [pincodeStatus, setPincodeStatus] = useState<{
    checked: boolean;
    serviceable: boolean;
    message: string;
    deliveryTime?: string;
  } | null>(null);
  const [isCheckingPincode, setIsCheckingPincode] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'ingredients' | 'care'>('details');

  useEffect(() => {
    window.scrollTo(0, 0);
    const found = DEMO_CAKES.find((c) => c.id === id || c.slug === id);
    if (found) {
      setCake(found);
      setSelectedWeight('0.5 kg');
      setQuantity(1);
      setCustomMessage('');
      setPincodeStatus(null);
    }
  }, [id]);

  if (!cake) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 bg-[#FDFBF7]">
        <h2 className="font-serif text-2xl font-bold text-[#2B1810]">Cake Not Found</h2>
        <p className="text-sm text-[#7E6355] mt-2 mb-6">
          The requested cake may have been moved or is currently out of seasonal rotation.
        </p>
        <Link
          to="/cakes"
          className="px-6 py-2.5 rounded-full bg-[#2B1810] text-[#FFFDF9] text-sm font-semibold hover:bg-[#3D2314] transition-colors"
        >
          Return to Catalog
        </Link>
      </div>
    );
  }

  const currentPrice = cake.weightPrices[selectedWeight] || cake.basePrice;
  const isWishlisted = isInWishlist(cake.id);

  const handleAddToCart = () => {
    addItem(cake, selectedWeight, quantity, customMessage);
  };

  const handleCheckPincode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pincode.trim()) return;

    setIsCheckingPincode(true);
    const res = await cakeService.checkPincode(pincode);
    setIsCheckingPincode(false);
    setPincodeStatus({
      checked: true,
      serviceable: res.serviceable,
      message: res.message,
      deliveryTime: res.deliveryTime,
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: cake.name,
          text: `Check out ${cake.name} at Deep’s Cake Shop!`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('Cake link copied to clipboard!', 'info');
    }
  };

  // Related cakes in same category
  const relatedCakes = DEMO_CAKES.filter(
    (c) => c.category === cake.category && c.id !== cake.id
  ).slice(0, 4);

  return (
    <div className="bg-[#FDFBF7] py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Back breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5C3D28] hover:text-[#2B1810] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to browsing</span>
          </button>

          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7E6355] hover:text-[#2B1810] transition-colors px-3 py-1.5 rounded-full border border-[#E8DDD7] bg-white shadow-2xs"
          >
            <Share2 className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>Share</span>
          </button>
        </div>

        {/* Product Hero: Two Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Column: Image Showcase (EXACTLY ONE COMPLETE CAKE) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="relative aspect-square w-full rounded-3xl overflow-hidden bg-white border border-[#E8DDD7] shadow-lg">
              <img
                src={cake.image}
                alt={`${cake.name} - complete single cake`}
                className="w-full h-full object-cover object-center"
              />

              {/* Bestseller / Category tags */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {cake.isBestSeller && (
                  <span className="px-3 py-1 rounded-full bg-[#2B1810] text-[#DFBF77] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md">
                    <Sparkles className="w-3 h-3 text-[#DFBF77]" />
                    Bestseller
                  </span>
                )}
                <span className="px-3 py-1 rounded-full bg-white/95 backdrop-blur-xs text-[#2B1810] text-xs font-semibold shadow-xs">
                  {cake.category} Cake
                </span>
              </div>

              {/* Wishlist Button */}
              <button
                onClick={() => toggleWishlist(cake)}
                className={`absolute top-4 right-4 w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-md ${
                  isWishlisted
                    ? 'bg-[#FFF0F3] text-[#D86A7F]'
                    : 'bg-white/90 backdrop-blur-xs text-[#7E6355] hover:text-[#D86A7F]'
                }`}
                aria-label="Toggle Wishlist"
              >
                <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-[#D86A7F]' : ''}`} />
              </button>

              {/* Guarantee overlay */}
              <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-xl shadow-xs">
                <EggBadge isEggless={cake.isEggless} size="md" />
              </div>
            </div>

            {/* Micro bakery badges */}
            <div className="grid grid-cols-3 gap-3 text-center text-xs text-[#5C3D28]">
              <div className="p-3 bg-white rounded-xl border border-[#E8DDD7] flex flex-col items-center gap-1">
                <Clock className="w-4 h-4 text-[#C5A059]" />
                <span className="font-semibold text-[11px]">Bake Time</span>
                <span className="text-[10px] text-[#7E6355]">{cake.preparationTimeHours} Hours Fresh</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-[#E8DDD7] flex flex-col items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-[11px]">Vegetarian</span>
                <span className="text-[10px] text-[#7E6355]">{cake.isEggless ? '100% Pure' : 'Contains Egg'}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-[#E8DDD7] flex flex-col items-center gap-1">
                <Truck className="w-4 h-4 text-[#D86A7F]" />
                <span className="font-semibold text-[11px]">Delivery</span>
                <span className="text-[10px] text-[#7E6355]">2-Hr Express</span>
              </div>
            </div>
          </div>

          {/* Right Column: Cake Options, Weight Picker, Message, Actions */}
          <div className="lg:col-span-6 space-y-6">
            <div>
              {/* Rating */}
              <div className="flex items-center gap-2 mb-2">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FAF3E0] text-[#B38E46] text-xs font-bold">
                  <Star className="w-3.5 h-3.5 fill-current text-[#C5A059]" />
                  {cake.rating.toFixed(1)}
                </span>
                <span className="text-xs text-[#7E6355]">
                  • {cake.reviewsCount} customer reviews
                </span>
              </div>

              {/* Cake Title */}
              <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-[#2B1810]">
                {cake.name}
              </h1>

              {/* Flavor Profile Subtitle */}
              <p className="text-sm font-medium text-[#7E6355] mt-1">
                {cake.flavor}
              </p>
            </div>

            {/* Dynamic Price Display */}
            <div className="p-4 rounded-2xl bg-white border border-[#E8DDD7] flex items-center justify-between">
              <div>
                <span className="text-xs text-[#7E6355] uppercase tracking-wider block">
                  Price ({selectedWeight})
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-[#2B1810]">
                    ₹{currentPrice.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-stone-400 line-through">
                    ₹{Math.round(currentPrice * 1.15).toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    Save ~15%
                  </span>
                </div>
              </div>
              <div className="text-right text-[11px] text-[#7E6355]">
                <span>Inclusive of all taxes</span>
                <p className="font-bold text-emerald-700">Free delivery &gt; ₹799</p>
              </div>
            </div>

            {/* Weight Selection with live prices */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#2B1810] block">
                Select Cake Weight (Servings)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {WEIGHT_OPTIONS.map((weight) => {
                  const weightPrice = cake.weightPrices[weight];
                  const isSelected = selectedWeight === weight;

                  return (
                    <button
                      key={weight}
                      type="button"
                      onClick={() => setSelectedWeight(weight)}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#2B1810] bg-[#2B1810] text-[#FFFDF9] shadow-md ring-2 ring-[#DFBF77]/30'
                          : 'border-[#E8DDD7] bg-white text-[#2B1810] hover:border-[#C5A059]'
                      }`}
                    >
                      <div className="text-xs font-bold">{weight}</div>
                      <div className={`text-[11px] mt-0.5 ${isSelected ? 'text-[#DFBF77]' : 'text-[#7E6355]'}`}>
                        ₹{weightPrice.toLocaleString('en-IN')}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Message on Cake Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label htmlFor="cake-message" className="font-bold uppercase tracking-wider text-[#2B1810]">
                  Piped Message on Cake (Optional)
                </label>
                <span className="text-[#7E6355] text-[11px]">
                  {customMessage.length}/35 characters
                </span>
              </div>
              <input
                id="cake-message"
                type="text"
                maxLength={35}
                placeholder="e.g. Happy Birthday Sarah! 🎉"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full bg-white border border-[#E8DDD7] rounded-xl px-4 py-2.5 text-sm text-[#2B1810] placeholder-[#7E6355]/50 focus:outline-hidden focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20"
              />
            </div>

            {/* Quantity Stepper & Add to Cart Button */}
            <div className="flex items-center gap-4 pt-2">
              <div className="flex items-center border border-[#E8DDD7] rounded-2xl bg-white p-1">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-9 h-9 rounded-xl hover:bg-[#F4EEE8] text-[#2B1810] font-bold text-lg flex items-center justify-center transition-colors"
                  aria-label="Decrease quantity"
                >
                  -
                </button>
                <span className="w-10 text-center font-bold text-sm text-[#2B1810]">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-9 h-9 rounded-xl hover:bg-[#F4EEE8] text-[#2B1810] font-bold text-lg flex items-center justify-center transition-colors"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                className="flex-1 py-4 px-6 rounded-2xl bg-[#2B1810] hover:bg-[#3D2314] text-[#FFFDF9] font-bold text-sm tracking-wide flex items-center justify-center gap-2.5 shadow-lg hover:shadow-xl transition-all cursor-pointer active:scale-98"
              >
                <ShoppingBag className="w-5 h-5 text-[#DFBF77]" />
                <span>
                  Add To Bakery Cart • ₹{(currentPrice * quantity).toLocaleString('en-IN')}
                </span>
              </button>
            </div>

            {/* Pincode Delivery Availability Checker */}
            <div className="p-4 rounded-2xl bg-white border border-[#E8DDD7] space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#2B1810]">
                <Truck className="w-4 h-4 text-[#C5A059]" />
                <span>Check Delivery Availability</span>
              </div>
              <form onSubmit={handleCheckPincode} className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Enter 6-digit Pincode"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl px-3 py-2 text-xs text-[#2B1810] placeholder-[#7E6355]/60 focus:outline-hidden focus:border-[#C5A059]"
                />
                <button
                  type="submit"
                  disabled={isCheckingPincode || pincode.length !== 6}
                  className="px-4 py-2 bg-[#2B1810] disabled:bg-stone-300 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  {isCheckingPincode ? 'Checking...' : 'Verify'}
                </button>
              </form>

              {pincodeStatus && (
                <div
                  className={`p-2.5 rounded-xl text-xs flex items-start gap-2 ${
                    pincodeStatus.serviceable
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {pincodeStatus.serviceable ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold">{pincodeStatus.message}</p>
                    {pincodeStatus.deliveryTime && (
                      <p className="text-[11px] mt-0.5 font-bold">
                        Estimated arrival: {pincodeStatus.deliveryTime}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Product Details Tabs (Description, Ingredients, Care) */}
        <div className="bg-white rounded-3xl border border-[#E8DDD7] p-6 sm:p-8 shadow-2xs">
          <div className="flex border-b border-[#E8DDD7] gap-8">
            <button
              onClick={() => setActiveTab('details')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'details'
                  ? 'border-[#2B1810] text-[#2B1810]'
                  : 'border-transparent text-[#7E6355] hover:text-[#2B1810]'
              }`}
            >
              Description & Flavor
            </button>
            <button
              onClick={() => setActiveTab('ingredients')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'ingredients'
                  ? 'border-[#2B1810] text-[#2B1810]'
                  : 'border-transparent text-[#7E6355] hover:text-[#2B1810]'
              }`}
            >
              Gourmet Ingredients
            </button>
            <button
              onClick={() => setActiveTab('care')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'care'
                  ? 'border-[#2B1810] text-[#2B1810]'
                  : 'border-transparent text-[#7E6355] hover:text-[#2B1810]'
              }`}
            >
              Storage & Cake Care
            </button>
          </div>

          <div className="pt-6">
            {activeTab === 'details' && (
              <div className="space-y-4 text-sm text-[#5C3D28] leading-relaxed max-w-3xl">
                <p>{cake.description}</p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {cake.dietaryTags?.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full bg-[#FAF3E0] text-[#5C3D28] text-xs font-semibold"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'ingredients' && (
              <div className="space-y-3 max-w-2xl">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#2B1810]">
                  Fine Culinary Components
                </h4>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#5C3D28]">
                  {cake.ingredients.map((ing, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C5A059]" />
                      <span>{ing}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-[#7E6355] pt-2 italic">
                  All our chocolates are 100% pure cocoa butter couverture sourced from Belgium and Switzerland.
                </p>
              </div>
            )}

            {activeTab === 'care' && (
              <div className="space-y-3 text-xs text-[#5C3D28] max-w-2xl leading-relaxed">
                <p>
                  <strong>Refrigeration:</strong> Keep chilled in its bakery box between 2°C – 5°C until 30 minutes before cutting.
                </p>
                <p>
                  <strong>Serving:</strong> Allow the cake to rest at room temperature for 25-30 minutes so the chocolate ganache softens to its signature molten velvety texture.
                </p>
                <p>
                  <strong>Shelf Life:</strong> Best enjoyed within 48 hours of delivery. Keep away from direct sunlight or heat sources.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Related Category Cakes */}
        {relatedCakes.length > 0 && (
          <div className="pt-8 space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <h3 className="font-serif text-2xl font-bold text-[#2B1810]">
                  More from {cake.category} Cakes
                </h3>
                <p className="text-xs text-[#7E6355] mt-1">
                  Handcrafted favorites from the same patisserie collection
                </p>
              </div>
              <Link
                to={`/cakes?category=${cake.category}`}
                className="text-xs font-bold text-[#C5A059] hover:underline"
              >
                View all {cake.category} cakes &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedCakes.map((c) => (
                <ProductCard key={c.id} cake={c} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
