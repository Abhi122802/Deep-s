import React, { useState } from 'react';
import {
  Sparkles,
  Upload,
  CheckCircle,
  FileImage,
  X,
  ArrowRight,
  Info,
} from 'lucide-react';
import type { WeightOption } from '../types';
import { cakeService } from '../services/cakeService';
import { useToast } from '../context/ToastContext';
import { EggBadge } from '../components/common/EggBadge';

const FLAVORS = [
  'Belgian Dark Chocolate Truffle (70%)',
  'Royal Red Velvet with Cream Cheese',
  'Roasted Hazelnut Praline Ganache',
  'Fresh Seasonal Berry & Vanilla Chantilly',
  'Salted Butter Caramel & Roasted Pecan',
  'Classic Alphonso Mango Mousse',
  'Pistachio Rosewater Saffron Delicacy',
];

const OCCASIONS = [
  'Birthday Celebration',
  'Wedding / Reception',
  'Romantic Anniversary',
  'Engagement Party',
  'Baby Shower / Gender Reveal',
  'Corporate Milestone',
  'Theme / Character Party',
];

const WEIGHT_LIST: WeightOption[] = ['0.5 kg', '1 kg', '1.5 kg', '2 kg'];

export const CustomCakePage: React.FC = () => {
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    email: '',
    occasion: OCCASIONS[0],
    flavor: FLAVORS[0],
    weight: '1 kg' as WeightOption,
    isEggless: true,
    messageOnCake: '',
    preferredDate: '',
    deliveryTimeSlot: '12:00 PM – 3:00 PM',
    tierCount: '1 Tier' as '1 Tier' | '2 Tiers' | '3 Tiers',
    specialInstructions: '',
    deliveryAddress: '',
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedInquiryId, setSubmittedInquiryId] = useState<string | null>(null);
  const [notificationPreferences, setNotificationPreferences] = useState({
    email: true,
    whatsapp: false,
    sms: false,
  });

  // Approximate base estimate calculation for live preview
  const estimatedPrice = React.useMemo(() => {
    let base = 800;
    if (formData.weight === '1 kg') base = 1500;
    if (formData.weight === '1.5 kg') base = 2200;
    if (formData.weight === '2 kg') base = 2900;
    if (formData.tierCount === '2 Tiers') base += 600;
    if (formData.tierCount === '3 Tiers') base += 1400;
    return base;
  }, [formData.weight, formData.tierCount]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('Image file should be under 5MB', 'warning');
        return;
      }
      setImageFile(file);
      setImageFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        showToast('Reference design image attached successfully!', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageFileName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.customerName.trim()) {
      showToast('Please provide your full name', 'warning');
      return;
    }
    if (!/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) {
      showToast('Please enter a valid 10-digit mobile number', 'warning');
      return;
    }
    if (!formData.email.includes('@')) {
      showToast('Please enter a valid email address', 'warning');
      return;
    }
    if (!formData.preferredDate) {
      showToast('Please select your preferred celebration date', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await cakeService.submitCustomInquiry({
        customerName: formData.customerName,
        phone: formData.phone,
        email: formData.email,
        occasion: formData.occasion,
        flavor: formData.flavor,
        weight: formData.weight,
        isEggless: formData.isEggless,
        messageOnCake: formData.messageOnCake,
        preferredDate: formData.preferredDate,
        deliveryTimeSlot: formData.deliveryTimeSlot,
        tierCount: formData.tierCount,
        specialInstructions: formData.specialInstructions,
        referenceImageName: imageFileName,
        referenceImagePreview: imagePreview || undefined,
        imageFile: imageFile || undefined,
        notificationPreferences,
      });

      setIsSubmitting(false);
      setSubmittedInquiryId(res.inquiryId);
      showToast('Custom cake inquiry submitted successfully!', 'success');
    } catch {
      setIsSubmitting(false);
      showToast('Error submitting inquiry. Please try again.', 'warning');
    }
  };

  return (
    <div className="bg-[#FDFBF7] py-12 md:py-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#FFF0F3] border border-[#F4ACB7]/50 text-xs font-bold uppercase tracking-wider text-[#D86A7F] mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Artisanal Custom Cake Studio</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-[#2B1810]">
            Design Your Bespoke Celebration Cake
          </h1>
          <p className="text-sm sm:text-base text-[#7E6355] mt-3 leading-relaxed">
            From fairytale florals to architectural tiered wonders, share your vision. Our head pastry chef will connect with you to finalize design nuances and delivery schedule.
          </p>
        </div>

        {submittedInquiryId ? (
          /* Confirmation State */
          <div className="max-w-xl mx-auto bg-white rounded-3xl p-8 border border-[#E8DDD7] shadow-xl text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-[#C5A059] uppercase tracking-widest">
                Inquiry Confirmed
              </span>
              <h2 className="font-serif text-2xl font-bold text-[#2B1810]">
                We’ve Received Your Custom Request!
              </h2>
              <p className="text-sm text-[#7E6355]">
                Reference ID: <strong className="text-[#2B1810] font-mono font-bold">{submittedInquiryId}</strong>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#FFFDF9] border border-[#E8DDD7] text-left text-xs space-y-2 text-[#5C3D28]">
              <p><strong>Occasion:</strong> {formData.occasion}</p>
              <p><strong>Flavor:</strong> {formData.flavor}</p>
              <p><strong>Weight:</strong> {formData.weight} ({formData.tierCount})</p>
              <p><strong>Egg Preference:</strong> {formData.isEggless ? '100% Pure Eggless' : 'Contains Egg'}</p>
              <p><strong>Preferred Date:</strong> {formData.preferredDate} ({formData.deliveryTimeSlot})</p>
              {formData.messageOnCake && (
                <p><strong>Piped Message:</strong> &quot;{formData.messageOnCake}&quot;</p>
              )}
            </div>

            <p className="text-xs text-[#7E6355] leading-relaxed">
              Our executive cake designer will contact you at <strong>{formData.phone}</strong> within 2 hours to confirm flavor samples and finalize your booking.
            </p>

            <button
              onClick={() => {
                setSubmittedInquiryId(null);
                setImagePreview(null);
                setImageFileName('');
              }}
              className="px-8 py-3 rounded-full bg-[#2B1810] hover:bg-[#3D2314] text-[#FFFDF9] text-xs font-bold transition-colors"
            >
              Submit Another Custom Request
            </button>
          </div>
        ) : (
          /* Custom Cake Form & Live Summary */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Form Column */}
            <form
              onSubmit={handleSubmit}
              className="lg:col-span-8 bg-white p-6 sm:p-10 rounded-3xl border border-[#E8DDD7] shadow-sm space-y-8"
            >
              {/* Section 1: Cake Specifications */}
              <div className="space-y-5">
                <h3 className="font-serif text-xl font-bold text-[#2B1810] flex items-center gap-2 border-b border-[#F4EEE8] pb-3">
                  <span className="w-6 h-6 rounded-full bg-[#FAF3E0] text-[#C5A059] text-xs flex items-center justify-center font-bold">
                    1
                  </span>
                  Cake Style & Flavor Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Occasion */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#5C3D28] block mb-1.5">
                      Celebration Occasion *
                    </label>
                    <select
                      value={formData.occasion}
                      onChange={(e) => setFormData({ ...formData, occasion: e.target.value })}
                      className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl px-3.5 py-2.5 text-xs font-medium text-[#2B1810] focus:outline-hidden focus:border-[#C5A059]"
                    >
                      {OCCASIONS.map((occ) => (
                        <option key={occ} value={occ}>
                          {occ}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Flavor */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#5C3D28] block mb-1.5">
                      Gourmet Flavor Pairing *
                    </label>
                    <select
                      value={formData.flavor}
                      onChange={(e) => setFormData({ ...formData, flavor: e.target.value })}
                      className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl px-3.5 py-2.5 text-xs font-medium text-[#2B1810] focus:outline-hidden focus:border-[#C5A059]"
                    >
                      {FLAVORS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Weight */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#5C3D28] block mb-1.5">
                      Approximate Weight *
                    </label>
                    <select
                      value={formData.weight}
                      onChange={(e) => setFormData({ ...formData, weight: e.target.value as WeightOption })}
                      className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl px-3.5 py-2.5 text-xs font-medium text-[#2B1810] focus:outline-hidden focus:border-[#C5A059]"
                    >
                      {WEIGHT_LIST.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tier Count */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#5C3D28] block mb-1.5">
                      Architecture / Tiers
                    </label>
                    <select
                      value={formData.tierCount}
                      onChange={(e) => setFormData({ ...formData, tierCount: e.target.value as any })}
                      className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl px-3.5 py-2.5 text-xs font-medium text-[#2B1810] focus:outline-hidden focus:border-[#C5A059]"
                    >
                      <option value="1 Tier">1 Tier (Standard)</option>
                      <option value="2 Tiers">2 Tiers (Celebration)</option>
                      <option value="3 Tiers">3 Tiers (Grand)</option>
                    </select>
                  </div>

                  {/* Eggless Preference */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#5C3D28] block mb-1.5">
                      Egg Preference *
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, isEggless: true })}
                        className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1 ${
                          formData.isEggless
                            ? 'bg-emerald-50 border-emerald-600 text-emerald-800'
                            : 'bg-white border-[#E8DDD7] text-stone-600'
                        }`}
                      >
                        <EggBadge isEggless={true} size="sm" showText={false} />
                        <span>Eggless</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, isEggless: false })}
                        className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1 ${
                          !formData.isEggless
                            ? 'bg-amber-50 border-amber-800 text-amber-900'
                            : 'bg-white border-[#E8DDD7] text-stone-600'
                        }`}
                      >
                        <EggBadge isEggless={false} size="sm" showText={false} />
                        <span>Egg</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Message on Cake */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#5C3D28] block mb-1.5">
                    Piped Message on Cake
                  </label>
                  <input
                    type="text"
                    maxLength={50}
                    placeholder="e.g. Happy 10th Anniversary Mom & Dad!"
                    value={formData.messageOnCake}
                    onChange={(e) => setFormData({ ...formData, messageOnCake: e.target.value })}
                    className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl px-4 py-2.5 text-xs text-[#2B1810] placeholder-[#7E6355]/50 focus:outline-hidden focus:border-[#C5A059]"
                  />
                </div>
              </div>

              {/* Section 2: Reference Image Upload with LIVE PREVIEW */}
              <div className="space-y-4">
                <h3 className="font-serif text-xl font-bold text-[#2B1810] flex items-center gap-2 border-b border-[#F4EEE8] pb-3">
                  <span className="w-6 h-6 rounded-full bg-[#FAF3E0] text-[#C5A059] text-xs flex items-center justify-center font-bold">
                    2
                  </span>
                  Reference Photo or Sketch
                </h3>

                <p className="text-xs text-[#7E6355]">
                  Attach a picture from Pinterest, Instagram, or a sketch of your desired cake design.
                </p>

                {imagePreview ? (
                  /* Image Preview Box */
                  <div className="relative rounded-2xl overflow-hidden border-2 border-[#C5A059] p-3 bg-[#FAF3E0]/30 flex flex-col sm:flex-row items-center gap-4">
                    <img
                      src={imagePreview}
                      alt="Reference design preview"
                      className="w-32 h-32 rounded-xl object-cover border border-[#E8DDD7] shadow-sm shrink-0"
                    />
                    <div className="flex-1 space-y-1 text-center sm:text-left">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#2B1810]">
                        <FileImage className="w-4 h-4 text-[#C5A059]" />
                        <span className="truncate max-w-[200px]">{imageFileName}</span>
                      </div>
                      <p className="text-[11px] text-[#7E6355]">
                        Preview loaded. Our head cake artist will reference this when crafting your bespoke cake.
                      </p>
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline pt-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        Remove / Replace Image
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Upload Dropzone */
                  <label className="border-2 border-dashed border-[#E8DDD7] hover:border-[#C5A059] bg-[#FFFDF9] rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors text-center group">
                    <div className="w-12 h-12 rounded-full bg-[#FFF0F3] text-[#D86A7F] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-[#2B1810]">
                      Click to upload reference design
                    </span>
                    <span className="text-[10px] text-[#7E6355] mt-1">
                      PNG, JPG, or WEBP up to 5MB
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Section 3: Delivery Timing & Instructions */}
              <div className="space-y-4">
                <h3 className="font-serif text-xl font-bold text-[#2B1810] flex items-center gap-2 border-b border-[#F4EEE8] pb-3">
                  <span className="w-6 h-6 rounded-full bg-[#FAF3E0] text-[#C5A059] text-xs flex items-center justify-center font-bold">
                    3
                  </span>
                  Schedule & Special Instructions
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#5C3D28] block mb-1.5">
                      Preferred Date *
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        value={formData.preferredDate}
                        onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                        className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl px-3.5 py-2.5 text-xs text-[#2B1810] focus:outline-hidden focus:border-[#C5A059]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#5C3D28] block mb-1.5">
                      Time Slot
                    </label>
                    <select
                      value={formData.deliveryTimeSlot}
                      onChange={(e) => setFormData({ ...formData, deliveryTimeSlot: e.target.value })}
                      className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl px-3.5 py-2.5 text-xs font-medium text-[#2B1810] focus:outline-hidden focus:border-[#C5A059]"
                    >
                      <option value="9:00 AM – 12:00 PM">Morning (9:00 AM – 12:00 PM)</option>
                      <option value="12:00 PM – 3:00 PM">Afternoon (12:00 PM – 3:00 PM)</option>
                      <option value="3:00 PM – 6:00 PM">Evening (3:00 PM – 6:00 PM)</option>
                      <option value="6:00 PM – 9:00 PM">Night (6:00 PM – 9:00 PM)</option>
                      <option value="Midnight 11:30 PM">Midnight Surprise (11:30 PM – 12:00 AM)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#5C3D28] block mb-1.5">
                    Special Design Notes / Dietary Allergies
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Specify color palette, topper requirements, nut-free preferences, or theme details..."
                    value={formData.specialInstructions}
                    onChange={(e) => setFormData({ ...formData, specialInstructions: e.target.value })}
                    className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl p-3.5 text-xs text-[#2B1810] placeholder-[#7E6355]/50 focus:outline-hidden focus:border-[#C5A059]"
                  />
                </div>
              </div>

              {/* Section 4: Customer Details */}
              <div className="space-y-4">
                <h3 className="font-serif text-xl font-bold text-[#2B1810] flex items-center gap-2 border-b border-[#F4EEE8] pb-3">
                  <span className="w-6 h-6 rounded-full bg-[#FAF3E0] text-[#C5A059] text-xs flex items-center justify-center font-bold">
                    4
                  </span>
                  Your Contact Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#5C3D28] block mb-1.5">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Priya Sharma"
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl px-3.5 py-2.5 text-xs text-[#2B1810] focus:outline-hidden focus:border-[#C5A059]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#5C3D28] block mb-1.5">
                      WhatsApp / Mobile *
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl px-3.5 py-2.5 text-xs text-[#2B1810] focus:outline-hidden focus:border-[#C5A059]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#5C3D28] block mb-1.5">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. priya@gmail.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl px-3.5 py-2.5 text-xs text-[#2B1810] focus:outline-hidden focus:border-[#C5A059]"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#5C3D28] block mb-1.5">
                    Delivery Address / Venue (Optional for initial quote)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Flat 402, Greenfield Residences, Indiranagar"
                    value={formData.deliveryAddress}
                    onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
                    className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl px-3.5 py-2.5 text-xs text-[#2B1810] focus:outline-hidden focus:border-[#C5A059]"
                  />
                </div>

                {/* Notification Channel Preferences */}
                <div className="p-3.5 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-[#5C3D28] tracking-wider block">
                      Quotation & Design Updates
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
                      <span>Email Quotation & Design Proposal (Default)</span>
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
                      <span>WhatsApp Instant Chef Consultation & Quote (Opt-in)</span>
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
                      <span>SMS Text Alerts (Opt-in)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 px-6 rounded-2xl bg-[#2B1810] hover:bg-[#3D2314] text-[#FFFDF9] font-bold text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-70 cursor-pointer"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting Custom Cake Inquiry...
                    </span>
                  ) : (
                    <>
                      <span>Submit Custom Cake Order Request</span>
                      <ArrowRight className="w-4 h-4 text-[#DFBF77]" />
                    </>
                  )}
                </button>
                <p className="text-[11px] text-center text-[#7E6355] mt-2">
                  No advance payment taken now. Our head chef will call you to discuss details and give exact quotation.
                </p>
              </div>
            </form>

            {/* Live Estimate Sidebar */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-[#E8DDD7] shadow-sm sticky top-28 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-[#F4EEE8]">
                  <h3 className="font-serif text-lg font-bold text-[#2B1810]">
                    Inquiry Summary
                  </h3>
                  <span className="text-[11px] font-bold text-[#C5A059] bg-[#FAF3E0] px-2.5 py-1 rounded-full">
                    Live Preview
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1 border-b border-stone-100">
                    <span className="text-[#7E6355]">Occasion:</span>
                    <span className="font-semibold text-[#2B1810]">{formData.occasion}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-100">
                    <span className="text-[#7E6355]">Size & Tiers:</span>
                    <span className="font-semibold text-[#2B1810]">
                      {formData.weight} • {formData.tierCount}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-100">
                    <span className="text-[#7E6355]">Dietary:</span>
                    <span className="font-semibold text-[#2B1810]">
                      {formData.isEggless ? '100% Pure Eggless' : 'Contains Egg'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-100">
                    <span className="text-[#7E6355]">Flavor Base:</span>
                    <span className="font-semibold text-[#2B1810] truncate max-w-[160px]">
                      {formData.flavor}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-100">
                    <span className="text-[#7E6355]">Target Date:</span>
                    <span className="font-semibold text-[#2B1810]">
                      {formData.preferredDate || 'Not selected'}
                    </span>
                  </div>
                  {imageFileName && (
                    <div className="flex justify-between py-1 border-b border-stone-100">
                      <span className="text-[#7E6355]">Design Image:</span>
                      <span className="font-semibold text-emerald-700 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Attached
                      </span>
                    </div>
                  )}
                </div>

                {/* Price Quote Estimate */}
                <div className="p-4 rounded-2xl bg-[#FFFDF9] border border-[#E8DDD7] space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-[#7E6355] block">
                    Estimated Base Quotation
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-[#2B1810]">
                      ~₹{estimatedPrice.toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs text-[#7E6355]">
                      (Subject to custom sugar art complexity)
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#FFF0F3] border border-[#F4ACB7]/40 text-xs text-[#2B1810] space-y-1">
                  <p className="font-bold text-[#D86A7F] flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" />
                    How It Works:
                  </p>
                  <p className="text-[11px] text-[#5C3D28] leading-relaxed">
                    1. Submit your inquiry here.<br />
                    2. Chef calls to discuss sketch details.<br />
                    3. Exact quote & payment link provided in Phase 2.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
