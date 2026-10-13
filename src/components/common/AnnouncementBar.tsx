import React from 'react';
import { Sparkles, Clock, Phone } from 'lucide-react';

export const AnnouncementBar: React.FC = () => {
  return (
    <aside aria-label="Bakery Announcements" className="bg-[#2B1810] text-[#FFFDF9] text-xs py-2 px-4 border-b border-[#3D2314]">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
        <div className="flex items-center justify-center gap-2 font-medium">
          <span className="flex items-center gap-1 text-[#DFBF77]">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <strong className="font-semibold text-white">Spring Celebration:</strong>
          </span>
          <span className="text-stone-200">
            Complimentary 2-Hour Express Delivery on orders above ₹799
          </span>
        </div>

        <div className="flex items-center justify-center gap-4 text-stone-300 text-[11px]">
          <div className="hidden md:flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-[#DFBF77]" />
            <span>Fresh Batches Baked Every 3 Hours</span>
          </div>
          <span className="hidden md:inline text-stone-600">|</span>
          <a
            href="tel:+919876543210"
            className="flex items-center gap-1 text-stone-200 hover:text-[#DFBF77] transition-colors"
          >
            <Phone className="w-3 h-3 text-[#DFBF77]" />
            <span>Order Desk: +91 98765 43210</span>
          </a>
        </div>
      </div>
    </aside>
  );
};
