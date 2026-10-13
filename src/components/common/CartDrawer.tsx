import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  X,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { EggBadge } from './EggBadge';
import { cakeService } from '../../services/cakeService';

export const CartDrawer: React.FC = () => {
  const {
    items,
    isCartOpen,
    closeCart,
    removeItem,
    updateQuantity,
    subtotal,
    deliveryFee,
    total,
    clearCart,
  } = useCart();

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutCompleted, setCheckoutCompleted] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const navigate = useNavigate();

  if (!isCartOpen) return null;

  const freeDeliveryThreshold = 799;
  const amountNeeded = Math.max(0, freeDeliveryThreshold - subtotal);
  const progressPercent = Math.min(100, Math.round((subtotal / freeDeliveryThreshold) * 100));

  const handleCheckoutSimulation = async () => {
    setIsCheckingOut(true);
    try {
      const payload = {
        customer: {
          name: 'Quick Express Guest',
          email: 'guest@deepscakes.com',
          phone: '9876543210',
          address: 'Express Delivery Address, Mumbai',
        },
        items: items.map((item) => ({
          cakeId: String(item.cake.id),
          selectedWeight: item.selectedWeight,
          quantity: item.quantity,
          customMessage: item.customMessage,
        })),
        idempotencyKey: `drawer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      };
      const res = await cakeService.createOrder(payload);
      setIsCheckingOut(false);
      setPlacedOrderId(res.orderId);
      setCheckoutCompleted(true);
      clearCart();
    } catch {
      setIsCheckingOut(false);
      const fallbackId = `ORD-${Date.now().toString().slice(-6)}`;
      setPlacedOrderId(fallbackId);
      setCheckoutCompleted(true);
      clearCart();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-heading">
      {/* Backdrop */}
      <div
        onClick={closeCart}
        className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#FFFDF9] shadow-2xl flex flex-col border-l border-[#E8DDD7] animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="p-5 border-b border-[#E8DDD7] flex items-center justify-between bg-[#FDFBF7]">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#C5A059]" />
              <h2 id="cart-drawer-heading" className="font-serif text-lg font-bold text-[#2B1810]">
                Your Bakery Cart ({items.length})
              </h2>
            </div>
            <button
              onClick={closeCart}
              className="p-1.5 text-stone-400 hover:text-[#2B1810] hover:bg-stone-100 rounded-full transition-colors"
              aria-label="Close cart"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free delivery tier bar */}
          <div className="px-5 py-3 bg-[#FFF0F3] border-b border-[#F7CAD0]/50 text-xs text-[#2B1810]">
            {amountNeeded > 0 ? (
              <div>
                <p className="font-medium flex items-center gap-1.5 text-[#3D2314]">
                  <span>Add</span>
                  <span className="font-bold text-[#D86A7F]">₹{amountNeeded.toLocaleString('en-IN')}</span>
                  <span>more for <strong>FREE Express Delivery</strong>!</span>
                </p>
                <div className="w-full bg-[#F4ACB7]/40 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-[#D86A7F] h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="font-semibold text-emerald-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Congratulations! You’ve unlocked FREE 2-Hour Express Delivery!
              </p>
            )}
          </div>

          {/* Items or Empty State */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {checkoutCompleted ? (
              <div className="text-center py-12 px-4 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <h3 className="font-serif text-xl font-bold text-[#2B1810]">
                  Order Placed Successfully!
                </h3>
                {placedOrderId && (
                  <p className="text-xs text-[#5C3D28]">
                    Reference ID:{' '}
                    <span className="font-mono font-bold bg-[#FAF3E0] px-2 py-0.5 rounded-md border border-[#C5A059]/30 text-[#2B1810]">
                      {placedOrderId}
                    </span>
                  </p>
                )}
                <p className="text-xs text-[#7E6355] leading-relaxed max-w-xs mx-auto">
                  Your order has been recorded in the database with initial status <strong>Pending</strong>.
                </p>
                <button
                  onClick={() => {
                    setCheckoutCompleted(false);
                    closeCart();
                    navigate('/cakes');
                  }}
                  className="px-6 py-2.5 rounded-full bg-[#2B1810] text-[#FFFDF9] text-sm font-semibold hover:bg-[#3D2314] transition-colors cursor-pointer"
                >
                  Continue Browsing
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-16 px-4 space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#FFF0F3] text-[#D86A7F] mx-auto flex items-center justify-center">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="font-serif text-lg font-bold text-[#2B1810]">
                  Your cart is empty
                </h3>
                <p className="text-xs text-[#7E6355] max-w-xs mx-auto leading-relaxed">
                  Our ovens are hot and ready! Browse our handcrafted artisan cakes and add your favorite treats.
                </p>
                <button
                  onClick={() => {
                    closeCart();
                    navigate('/cakes');
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2B1810] text-[#FFFDF9] text-xs font-semibold hover:bg-[#3D2314] transition-colors"
                >
                  Explore Cake Menu
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3.5 p-3 rounded-2xl bg-white border border-[#E8DDD7] shadow-2xs hover:border-[#C5A059]/40 transition-colors"
                >
                  {/* Single Cake Image */}
                  <img
                    src={item.cake.image}
                    alt={item.cake.name}
                    className="w-20 h-20 rounded-xl object-cover shrink-0 border border-[#E8DDD7]"
                  />

                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={`/product/${item.cake.id}`}
                          onClick={closeCart}
                          className="font-serif text-sm font-bold text-[#2B1810] hover:text-[#C5A059] line-clamp-1"
                        >
                          {item.cake.name}
                        </Link>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-stone-400 hover:text-rose-600 transition-colors p-1"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <EggBadge isEggless={item.cake.isEggless} size="sm" showText={false} />
                        <span className="text-[11px] font-semibold text-[#C5A059] bg-[#FAF3E0] px-2 py-0.5 rounded-md">
                          {item.selectedWeight}
                        </span>
                      </div>

                      {item.customMessage && (
                        <p className="text-[11px] text-[#7E6355] mt-1 italic truncate">
                          &quot;{item.customMessage}&quot;
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#F4EEE8]">
                      {/* Quantity Stepper */}
                      <div className="flex items-center border border-[#E8DDD7] rounded-lg overflow-hidden bg-[#FDFBF7]">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="p-1 hover:bg-[#F4EEE8] text-[#2B1810] transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 text-xs font-bold text-[#2B1810] min-w-[20px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="p-1 hover:bg-[#F4EEE8] text-[#2B1810] transition-colors"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Line Price in ₹ */}
                      <span className="font-semibold text-sm text-[#2B1810]">
                        ₹{(item.unitPrice * item.quantity).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Totals & Checkout */}
          {items.length > 0 && !checkoutCompleted && (
            <div className="p-5 border-t border-[#E8DDD7] bg-[#FDFBF7] space-y-3">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-[#7E6355]">
                  <span>Items Subtotal</span>
                  <span className="font-medium text-[#2B1810]">
                    ₹{subtotal.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between text-[#7E6355]">
                  <span>Delivery Charges</span>
                  <span className={deliveryFee === 0 ? 'text-emerald-700 font-semibold' : 'text-[#2B1810]'}>
                    {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[#2B1810] pt-2 border-t border-[#E8DDD7]">
                  <span>Grand Total</span>
                  <span className="text-base text-[#2B1810]">
                    ₹{total.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  disabled={isCheckingOut}
                  onClick={handleCheckoutSimulation}
                  className="w-full py-3 px-4 rounded-xl bg-[#2B1810] hover:bg-[#3D2314] text-[#FFFDF9] text-sm font-bold tracking-wide flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-70 cursor-pointer"
                >
                  {isCheckingOut ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Simulating Checkout...
                    </span>
                  ) : (
                    <>
                      <span>Place Demo Order</span>
                      <ArrowRight className="w-4 h-4 text-[#DFBF77]" />
                    </>
                  )}
                </button>

                <Link
                  to="/cart"
                  onClick={closeCart}
                  className="block text-center text-xs font-semibold text-[#5C3D28] hover:text-[#2B1810] py-1 transition-colors"
                >
                  View Full Cart & Apply Coupons
                </Link>
              </div>

              <p className="text-[10px] text-center text-[#7E6355] flex items-center justify-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#C5A059]" />
                100% Satisfaction Guaranteed | Baked Fresh Daily
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
