import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { EggBadge } from '../components/common/EggBadge';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShieldCheck,
  Tag,
  CheckCircle,
  X,
  Sparkles,
} from 'lucide-react';

import { cakeService, type OrderCreationPayload } from '../services/cakeService';

export const CartPage: React.FC = () => {
  const {
    items,
    removeItem,
    updateQuantity,
    clearCart,
    subtotal,
    deliveryFee,
    total,
  } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [discountCodeName, setDiscountCodeName] = useState<string>('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [orderPlacedDetails, setOrderPlacedDetails] = useState<{
    orderId: string;
    totalPaid: number;
    itemCount: number;
    status?: string;
  } | null>(null);

  const [customerDetails, setCustomerDetails] = useState({
    name: 'Deepika Sharma',
    email: 'deepika.sharma@example.com',
    phone: '9876543210',
    address: 'Flat 402, Lotus Grand, MG Road',
    city: 'Mumbai',
    pincode: '400001',
  });
  const [notificationPreferences, setNotificationPreferences] = useState({
    email: true,
    whatsapp: false,
    sms: false,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    if (code === 'SWEET10' || code === 'DEEPS10') {
      const discount = Math.round(subtotal * 0.1);
      setAppliedDiscount(discount);
      setDiscountCodeName(code);
      showToast(`Promo ${code} applied! Saved ₹${discount}`, 'success');
      setCouponCode('');
    } else {
      showToast('Invalid coupon code. Try code "SWEET10" for 10% off!', 'warning');
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedDiscount(0);
    setDiscountCodeName('');
    showToast('Coupon removed', 'info');
  };

  const finalGrandTotal = Math.max(0, total - appliedDiscount);

  const handleConfirmCheckout = async () => {
    const errors: Record<string, string> = {};
    if (!customerDetails.name.trim()) errors.name = 'Full name is required';
    if (!customerDetails.phone.trim() || customerDetails.phone.replace(/\D/g, '').length < 10) {
      errors.phone = 'Valid 10-digit phone number is required';
    }
    if (!customerDetails.address.trim()) errors.address = 'Street address is required';
    if (!customerDetails.pincode.trim() || customerDetails.pincode.length < 5) {
      errors.pincode = 'Valid pincode is required';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setIsProcessingCheckout(true);

    try {
      const orderPayload: OrderCreationPayload = {
        customer: {
          name: customerDetails.name.trim(),
          email: customerDetails.email.trim() || 'customer@deepscakes.com',
          phone: customerDetails.phone.trim(),
          address: `${customerDetails.address.trim()}, ${customerDetails.city.trim()} - ${customerDetails.pincode.trim()}`,
        },
        items: items.map((item) => ({
          cakeId: String(item.cake.id),
          selectedWeight: item.selectedWeight,
          quantity: item.quantity,
          customMessage: item.customMessage,
        })),
        couponCode: discountCodeName || undefined,
        deliveryNotes: deliveryNote.trim() || undefined,
        idempotencyKey: `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        notificationPreferences,
        customerConsent: notificationPreferences,
      };

      const res = await cakeService.createOrder(orderPayload);
      setIsProcessingCheckout(false);
      setIsCheckoutModalOpen(false);

      setOrderPlacedDetails({
        orderId: res.orderId,
        totalPaid: res.data?.pricing?.total ?? finalGrandTotal,
        itemCount: items.length,
        status: res.data?.status ?? 'Pending',
      });
      clearCart();
      showToast(`Order #${res.orderId} placed successfully!`, 'success');
    } catch (err: any) {
      setIsProcessingCheckout(false);
      showToast(err.message || 'Failed to place order. Please try again.', 'warning');
    }
  };

  if (items.length === 0 && !orderPlacedDetails) {
    return (
      <div className="bg-[#FDFBF7] min-h-[70vh] flex items-center justify-center py-16 px-4">
        <div className="text-center max-w-md bg-white p-8 sm:p-12 rounded-3xl border border-[#E8DDD7] shadow-sm space-y-5">
          <div className="w-20 h-20 rounded-full bg-[#FFF0F3] text-[#D86A7F] mx-auto flex items-center justify-center">
            <ShoppingBag className="w-10 h-10" />
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#2B1810]">
            Your Bakery Cart is Empty
          </h1>
          <p className="text-sm text-[#7E6355] leading-relaxed">
            You haven’t added any cakes yet. Treat yourself or your loved ones with our freshly baked Belgian creations!
          </p>
          <div className="pt-2">
            <Link
              to="/cakes"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#2B1810] hover:bg-[#3D2314] text-[#FFFDF9] text-xs font-bold transition-all shadow-md"
            >
              <span>Explore Bakery Menu</span>
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E8DDD7] pb-6">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#2B1810]">
              Shopping Cart
            </h1>
            <p className="text-sm text-[#7E6355] mt-1">
              Review your items, customize messages, and prepare for delivery
            </p>
          </div>
          <Link
            to="/cakes"
            className="text-xs font-bold text-[#C5A059] hover:underline flex items-center gap-1"
          >
            <span>Continue Shopping</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Order Success State */}
        {orderPlacedDetails ? (
          <div className="max-w-xl mx-auto bg-white p-8 sm:p-10 rounded-3xl border border-[#E8DDD7] shadow-xl text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C5A059]">
                Order Confirmed
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#2B1810]">
                Thank You for Your Order!
              </h2>
              <p className="text-sm text-[#7E6355]">
                Order Reference:{' '}
                <strong className="font-mono text-[#2B1810] bg-[#FAF3E0] px-2.5 py-1 rounded-md border border-[#C5A059]/30">
                  {orderPlacedDetails.orderId}
                </strong>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#FFFDF9] border border-[#E8DDD7] text-left text-xs space-y-2.5 text-[#5C3D28]">
              <div className="flex justify-between items-center">
                <span>Order Status:</span>
                <span className="font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 text-[11px]">
                  {orderPlacedDetails.status || 'Pending'} (Awaiting Phase 3 Payment)
                </span>
              </div>
              <div className="flex justify-between">
                <span>Items Ordered:</span>
                <span className="font-bold">{orderPlacedDetails.itemCount} items</span>
              </div>
              <div className="flex justify-between">
                <span>Server-Verified Total:</span>
                <span className="font-bold text-sm text-[#2B1810]">
                  ₹{orderPlacedDetails.totalPaid.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Estimated Delivery:</span>
                <span className="font-bold text-emerald-700">Within 2-3 Hours Today</span>
              </div>
            </div>

            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-left text-xs text-emerald-900 leading-relaxed">
              <strong>Database Saved:</strong> Your order has been securely validated and stored in the Deep’s Cake Shop MongoDB backend. Keep your reference ID <strong>{orderPlacedDetails.orderId}</strong> for tracking!
            </div>

            <button
              onClick={() => {
                setOrderPlacedDetails(null);
                navigate('/cakes');
              }}
              className="px-8 py-3 rounded-full bg-[#2B1810] text-[#FFFDF9] text-xs font-bold hover:bg-[#3D2314] transition-colors cursor-pointer"
            >
              Order More Cakes
            </button>
          </div>
        ) : (
          /* Cart Items & Summary Grid */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Items Table Column */}
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-white rounded-3xl border border-[#E8DDD7] shadow-sm overflow-hidden">
                <div className="p-5 border-b border-[#F4EEE8] flex justify-between items-center bg-[#FDFBF7]">
                  <h2 className="font-serif text-lg font-bold text-[#2B1810]">
                    Bakery Items ({items.length})
                  </h2>
                  <button
                    onClick={clearCart}
                    className="text-xs font-semibold text-stone-400 hover:text-rose-600 transition-colors"
                  >
                    Clear All
                  </button>
                </div>

                <div className="divide-y divide-[#F4EEE8]">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:bg-[#FFFDF9] transition-colors"
                    >
                      {/* Image & Title */}
                      <div className="flex gap-4 items-center min-w-0 flex-1">
                        <img
                          src={item.cake.image}
                          alt={item.cake.name}
                          className="w-20 h-20 rounded-2xl object-cover shrink-0 border border-[#E8DDD7]"
                        />

                        <div className="space-y-1 min-w-0">
                          <Link
                            to={`/product/${item.cake.id}`}
                            className="font-serif text-base font-bold text-[#2B1810] hover:text-[#C5A059] block truncate"
                          >
                            {item.cake.name}
                          </Link>

                          <div className="flex items-center gap-2">
                            <EggBadge isEggless={item.cake.isEggless} size="sm" showText={false} />
                            <span className="text-xs font-bold text-[#C5A059] bg-[#FAF3E0] px-2 py-0.5 rounded-md">
                              {item.selectedWeight}
                            </span>
                            <span className="text-xs text-[#7E6355]">
                              ₹{item.unitPrice.toLocaleString('en-IN')} each
                            </span>
                          </div>

                          {item.customMessage && (
                            <p className="text-xs text-[#7E6355] italic truncate max-w-xs">
                              Message: &quot;{item.customMessage}&quot;
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Quantity Stepper & Price */}
                      <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F4EEE8]">
                        <div className="flex items-center border border-[#E8DDD7] rounded-xl bg-[#FDFBF7]">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="p-1.5 hover:bg-[#E8DDD7] text-[#2B1810] transition-colors"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-3 text-xs font-bold text-[#2B1810]">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="p-1.5 hover:bg-[#E8DDD7] text-[#2B1810] transition-colors"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="text-right min-w-[80px]">
                          <span className="font-bold text-base text-[#2B1810]">
                            ₹{(item.unitPrice * item.quantity).toLocaleString('en-IN')}
                          </span>
                        </div>

                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-stone-400 hover:text-rose-600 transition-colors p-1"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery instructions note */}
              <div className="bg-white p-5 rounded-3xl border border-[#E8DDD7] shadow-2xs space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#5C3D28] block">
                  Delivery Landmark / Gate Instructions (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Leave with building security if unavailable, or ring doorbell twice"
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl px-4 py-2.5 text-xs text-[#2B1810] placeholder-[#7E6355]/50 focus:outline-hidden focus:border-[#C5A059]"
                />
              </div>
            </div>

            {/* Order Summary Column */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-[#E8DDD7] shadow-sm space-y-5">
                <h3 className="font-serif text-lg font-bold text-[#2B1810] border-b border-[#F4EEE8] pb-3">
                  Bill Summary
                </h3>

                {/* Coupon Code Input */}
                <div>
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Coupon (try SWEET10)"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl pl-8 pr-3 py-2 text-xs uppercase tracking-wider text-[#2B1810] placeholder-stone-400 focus:outline-hidden focus:border-[#C5A059]"
                      />
                      <Tag className="w-3.5 h-3.5 text-[#C5A059] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-[#2B1810] hover:bg-[#3D2314] text-[#FFFDF9] text-xs font-bold transition-colors cursor-pointer"
                    >
                      Apply
                    </button>
                  </form>

                  {appliedDiscount > 0 && (
                    <div className="flex items-center justify-between mt-2 p-2 rounded-lg bg-emerald-50 text-emerald-800 text-xs">
                      <span className="flex items-center gap-1 font-semibold">
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        {discountCodeName} Applied (-10%)
                      </span>
                      <button
                        onClick={handleRemoveCoupon}
                        className="text-emerald-700 hover:text-emerald-900 font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                {/* Breakdown */}
                <div className="space-y-2.5 text-xs text-[#5C3D28] pt-2 border-t border-[#F4EEE8]">
                  <div className="flex justify-between">
                    <span>Items Subtotal</span>
                    <span className="font-bold text-[#2B1810]">
                      ₹{subtotal.toLocaleString('en-IN')}
                    </span>
                  </div>

                  {appliedDiscount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Discount ({discountCodeName})</span>
                      <span>-₹{appliedDiscount.toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span>Delivery Express</span>
                    <span className={deliveryFee === 0 ? 'text-emerald-700 font-bold' : 'text-[#2B1810]'}>
                      {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
                    </span>
                  </div>

                  <div className="flex justify-between text-stone-500 text-[11px]">
                    <span>Taxes & GST (Included)</span>
                    <span>₹0 (Included)</span>
                  </div>

                  <div className="flex justify-between text-base font-bold text-[#2B1810] pt-3 border-t border-[#E8DDD7]">
                    <span>Total Amount</span>
                    <span className="text-xl text-[#2B1810]">
                      ₹{finalGrandTotal.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Checkout Trigger Button */}
                <button
                  onClick={() => setIsCheckoutModalOpen(true)}
                  className="w-full py-4 px-6 rounded-2xl bg-[#2B1810] hover:bg-[#3D2314] text-[#FFFDF9] font-bold text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all cursor-pointer"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4 text-[#DFBF77]" />
                </button>

                <div className="pt-2 text-[11px] text-[#7E6355] space-y-1.5 text-center">
                  <p className="flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Safe Contactless Express Delivery
                  </p>
                  <p className="text-[10px] text-stone-400">
                    Phase 1 Demo • No real payment card charged
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Checkout Delivery Details Modal */}
        {isCheckoutModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-[#E8DDD7] shadow-2xl space-y-5 relative my-8 max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setIsCheckoutModalOpen(false)}
                className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#C5A059]">
                  Phase 2 Real Backend Checkout
                </span>
                <h3 className="font-serif text-2xl font-bold text-[#2B1810]">
                  Delivery Information
                </h3>
                <p className="text-xs text-[#7E6355]">
                  Please enter where you'd like your freshly baked cakes delivered.
                </p>
              </div>

              {/* Delivery Input Fields */}
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-[#5C3D28] tracking-wider block mb-1">
                    Recipient Full Name *
                  </label>
                  <input
                    type="text"
                    value={customerDetails.name}
                    onChange={(e) =>
                      setCustomerDetails((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="e.g. Deepika Sharma"
                    className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl px-3.5 py-2 text-xs text-[#2B1810] focus:outline-hidden focus:border-[#C5A059]"
                  />
                  {formErrors.name && (
                    <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.name}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase text-[#5C3D28] tracking-wider block mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      value={customerDetails.phone}
                      onChange={(e) =>
                        setCustomerDetails((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      placeholder="10-digit mobile number"
                      className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl px-3.5 py-2 text-xs text-[#2B1810] focus:outline-hidden focus:border-[#C5A059]"
                    />
                    {formErrors.phone && (
                      <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.phone}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase text-[#5C3D28] tracking-wider block mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={customerDetails.email}
                      onChange={(e) =>
                        setCustomerDetails((prev) => ({ ...prev, email: e.target.value }))
                      }
                      placeholder="recipient@example.com"
                      className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl px-3.5 py-2 text-xs text-[#2B1810] focus:outline-hidden focus:border-[#C5A059]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-[#5C3D28] tracking-wider block mb-1">
                    Street / Flat / Delivery Address *
                  </label>
                  <textarea
                    rows={2}
                    value={customerDetails.address}
                    onChange={(e) =>
                      setCustomerDetails((prev) => ({ ...prev, address: e.target.value }))
                    }
                    placeholder="Complete delivery address with landmarks"
                    className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl px-3.5 py-2 text-xs text-[#2B1810] focus:outline-hidden focus:border-[#C5A059] resize-none"
                  />
                  {formErrors.address && (
                    <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.address}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase text-[#5C3D28] tracking-wider block mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={customerDetails.city}
                      onChange={(e) =>
                        setCustomerDetails((prev) => ({ ...prev, city: e.target.value }))
                      }
                      placeholder="City"
                      className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl px-3.5 py-2 text-xs text-[#2B1810] focus:outline-hidden focus:border-[#C5A059]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase text-[#5C3D28] tracking-wider block mb-1">
                      Pincode *
                    </label>
                    <input
                      type="text"
                      value={customerDetails.pincode}
                      onChange={(e) =>
                        setCustomerDetails((prev) => ({ ...prev, pincode: e.target.value }))
                      }
                      placeholder="e.g. 400001"
                      className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl px-3.5 py-2 text-xs text-[#2B1810] focus:outline-hidden focus:border-[#C5A059]"
                    />
                    {formErrors.pincode && (
                      <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.pincode}</p>
                    )}
                  </div>
                </div>

                {/* Notification Channel Preferences */}
                <div className="p-3.5 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-[#5C3D28] tracking-wider block">
                      Order Updates & Notifications
                    </span>
                    <span className="text-[10px] text-stone-500 font-medium">Channel Consent</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-[#2B1810]">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={notificationPreferences.email}
                        onChange={(e) =>
                          setNotificationPreferences((prev) => ({ ...prev, email: e.target.checked }))
                        }
                        className="rounded border-[#E8DDD7] text-[#2B1810] focus:ring-[#C5A059] accent-[#2B1810]"
                      />
                      <span>Email Order Receipt & Baking Confirmation (Default)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={notificationPreferences.whatsapp}
                        onChange={(e) =>
                          setNotificationPreferences((prev) => ({ ...prev, whatsapp: e.target.checked }))
                        }
                        className="rounded border-[#E8DDD7] text-[#2B1810] focus:ring-[#C5A059] accent-[#2B1810]"
                      />
                      <span>WhatsApp Out-for-Delivery Alerts (Opt-in)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={notificationPreferences.sms}
                        onChange={(e) =>
                          setNotificationPreferences((prev) => ({ ...prev, sms: e.target.checked }))
                        }
                        className="rounded border-[#E8DDD7] text-[#2B1810] focus:ring-[#C5A059] accent-[#2B1810]"
                      />
                      <span>SMS Dispatch & Delivery Text Notifications (Opt-in)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Order Breakdown Box */}
              <div className="p-3.5 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] space-y-1.5 text-xs">
                <div className="flex justify-between text-stone-600">
                  <span>Selected Cakes:</span>
                  <span className="font-bold text-[#2B1810]">{items.length} items</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Items Subtotal:</span>
                  <span>₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                {appliedDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount ({discountCodeName}):</span>
                    <span>-₹{appliedDiscount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between text-stone-600">
                  <span>Delivery Charges:</span>
                  <span className={deliveryFee === 0 ? 'text-emerald-700 font-semibold' : 'text-[#2B1810]'}>
                    {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-sm text-[#2B1810] pt-2 border-t border-[#E8DDD7]">
                  <span>Total Payable:</span>
                  <span className="text-base text-[#2B1810]">
                    ₹{finalGrandTotal.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50/80 text-amber-900 text-[11px] border border-amber-200/80 leading-relaxed">
                <strong>Order Policy:</strong> Orders are created in <strong>Pending</strong> status in MongoDB. Server will calculate and confirm exact pricing. Payment gateway connects in Phase 3.
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className="flex-1 py-3 px-4 rounded-xl border border-[#E8DDD7] text-xs font-bold text-[#5C3D28] hover:bg-stone-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isProcessingCheckout}
                  onClick={handleConfirmCheckout}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#2B1810] hover:bg-[#3D2314] text-[#FFFDF9] text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                >
                  {isProcessingCheckout ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating Order in Backend...
                    </span>
                  ) : (
                    <span>Confirm & Place Order</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
