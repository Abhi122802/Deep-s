import React, { useState } from 'react';
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Send,
  MessageCircle,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

export const ContactPage: React.FC = () => {
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'General Inquiry',
    message: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      showToast('Please fill out all required fields', 'warning');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      showToast('Thank you! Your inquiry has been sent to our desk.', 'success');
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: 'General Inquiry',
        message: '',
      });
    }, 600);
  };

  const faqs = [
    {
      q: 'How fast can I get a cake delivered in an emergency?',
      a: 'We offer 2-hour express rush delivery across the city for catalog cakes. Custom designer and photo cakes typically require 4-6 hours notice.',
    },
    {
      q: 'Are your eggless cakes prepared in a separate vegetarian facility?',
      a: 'Yes, 100%. Our eggless recipes are produced using dedicated clean equipment, whisks, and bake molds to ensure zero cross-contact.',
    },
    {
      q: 'Can you deliver a cake at midnight (11:59 PM)?',
      a: 'Absolutely! Select our "Midnight Surprise (11:30 PM – 12:00 AM)" slot during checkout or when submitting your custom order inquiry.',
    },
    {
      q: 'Can I request less sugar or diabetic-friendly adjustments?',
      a: 'Yes! Use the special instructions field in our Custom Cake Studio to request reduced-sweetness or dark chocolate sugar-free adaptations.',
    },
  ];

  return (
    <div className="bg-[#FDFBF7] py-12 md:py-20 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#FFF0F3] border border-[#F4ACB7]/50 text-xs font-bold uppercase tracking-wider text-[#D86A7F]">
            <MessageCircle className="w-3.5 h-3.5" />
            <span>We’d Love To Hear From You</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-[#2B1810]">
            Contact Our Bakery Desk
          </h1>
          <p className="text-sm text-[#7E6355]">
            Have a question about custom themes, bulk corporate orders, or same-day deliveries? Reach out to us anytime.
          </p>
        </div>

        {/* Contact Cards & Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left: Contact Info */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E8DDD7] shadow-sm space-y-6">
              <h3 className="font-serif text-xl font-bold text-[#2B1810] border-b border-[#F4EEE8] pb-3">
                Bakery Information
              </h3>

              <div className="space-y-4 text-xs text-[#5C3D28]">
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#FAF3E0] text-[#C5A059] flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="block text-sm text-[#2B1810] font-bold">Location</strong>
                    <span>Shop 14, Heritage Bakery Walk, Promenade Avenue, Central Metro Station</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#FFF0F3] text-[#D86A7F] flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="block text-sm text-[#2B1810] font-bold">Telephone Desk</strong>
                    <span>+91 98765 43210 / +91 98765 43211</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#FAF3E0] text-[#C5A059] flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="block text-sm text-[#2B1810] font-bold">Email</strong>
                    <span>hello@deepscakeshop.in / orders@deepscakeshop.in</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="block text-sm text-[#2B1810] font-bold">Baking Hours</strong>
                    <span>Open 7 Days a Week: 8:00 AM – 11:30 PM IST</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick WhatsApp Notice */}
            <div className="p-6 rounded-3xl bg-[#2B1810] text-[#FFFDF9] space-y-2">
              <h4 className="font-serif text-base font-bold text-[#DFBF77]">
                Urgent Same-Day Rush?
              </h4>
              <p className="text-xs text-stone-300 leading-relaxed">
                Need a cake within the next 90 minutes? Call our dispatch desk directly at +91 98765 43210 for immediate slot reservation.
              </p>
            </div>
          </div>

          {/* Right: Message Form */}
          <div className="lg:col-span-7 bg-white p-6 sm:p-10 rounded-3xl border border-[#E8DDD7] shadow-sm">
            <h3 className="font-serif text-xl font-bold text-[#2B1810] mb-6">
              Send Us a Message
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#5C3D28] block mb-1.5">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl px-3.5 py-2.5 text-xs text-[#2B1810] focus:outline-hidden focus:border-[#C5A059]"
                    placeholder="e.g. Rahul Verma"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#5C3D28] block mb-1.5">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl px-3.5 py-2.5 text-xs text-[#2B1810] focus:outline-hidden focus:border-[#C5A059]"
                    placeholder="e.g. rahul@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#5C3D28] block mb-1.5">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl px-3.5 py-2.5 text-xs text-[#2B1810] focus:outline-hidden focus:border-[#C5A059]"
                    placeholder="e.g. 9876543210"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#5C3D28] block mb-1.5">
                    Subject
                  </label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl px-3.5 py-2.5 text-xs font-medium text-[#2B1810] focus:outline-hidden focus:border-[#C5A059]"
                  >
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Custom Cake Question">Custom Cake Question</option>
                    <option value="Bulk Corporate Gifting">Bulk Corporate Gifting</option>
                    <option value="Wedding Tasting Box">Wedding Tasting Box</option>
                    <option value="Delivery Status">Delivery Status</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#5C3D28] block mb-1.5">
                  Your Message *
                </label>
                <textarea
                  rows={4}
                  required
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl p-3.5 text-xs text-[#2B1810] placeholder-[#7E6355]/50 focus:outline-hidden focus:border-[#C5A059]"
                  placeholder="How can our pastry chefs assist your celebration?"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#2B1810] hover:bg-[#3D2314] text-[#FFFDF9] font-bold text-xs tracking-wide flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-70"
              >
                <Send className="w-3.5 h-3.5 text-[#DFBF77]" />
                <span>{isSubmitting ? 'Sending Message...' : 'Send Message'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* FAQs Accordion */}
        <div className="bg-white p-8 sm:p-12 rounded-3xl border border-[#E8DDD7] shadow-sm space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h3 className="font-serif text-2xl font-bold text-[#2B1810] flex items-center justify-center gap-2">
              <HelpCircle className="w-6 h-6 text-[#C5A059]" />
              Frequently Asked Questions
            </h3>
            <p className="text-xs text-[#7E6355]">
              Quick answers about our baking process, deliveries, and dietary standards
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-3 pt-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="border border-[#E8DDD7] rounded-2xl overflow-hidden bg-[#FFFDF9]"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full p-4 text-left flex justify-between items-center gap-4 text-xs sm:text-sm font-bold text-[#2B1810] hover:text-[#C5A059] transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#7E6355] shrink-0 transition-transform ${
                      openFaq === idx ? 'rotate-180 text-[#C5A059]' : ''
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-4 pb-4 pt-1 text-xs text-[#5C3D28] leading-relaxed border-t border-[#F4EEE8]">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
