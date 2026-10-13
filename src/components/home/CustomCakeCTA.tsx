import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, Upload, Palette, HeartHandshake } from 'lucide-react';

export const CustomCakeCTA: React.FC = () => {
  return (
    <section className="py-16 bg-linear-to-r from-[#2B1810] via-[#3D2314] to-[#2B1810] text-[#FFFDF9] relative overflow-hidden">
      {/* Subtle gold glow background */}
      <div className="absolute right-0 top-0 w-96 h-96 bg-[#DFBF77]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-5 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#DFBF77]/20 border border-[#DFBF77]/40 text-[#DFBF77] text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Bespoke Design Studio</span>
            </div>

            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
              Have a Dream Cake in Mind?{' '}
              <span className="text-[#DFBF77] italic font-normal">
                We’ll Bring It To Life.
              </span>
            </h2>

            <p className="text-sm sm:text-base text-stone-300 max-w-xl leading-relaxed">
              Upload your Pinterest board reference, choose custom sponge & ganache flavor pairings, and let our sugar artists craft a one-of-a-kind centerpiece for your celebration.
            </p>

            <div className="pt-2 flex flex-wrap gap-4 justify-center lg:justify-start text-xs text-stone-300">
              <span className="flex items-center gap-1.5 bg-[#4A2E1B] px-3 py-1.5 rounded-full border border-[#DFBF77]/20">
                <Upload className="w-3.5 h-3.5 text-[#DFBF77]" />
                Photo / Sketch Upload
              </span>
              <span className="flex items-center gap-1.5 bg-[#4A2E1B] px-3 py-1.5 rounded-full border border-[#DFBF77]/20">
                <Palette className="w-3.5 h-3.5 text-[#F7CAD0]" />
                Custom Color & Flavors
              </span>
              <span className="flex items-center gap-1.5 bg-[#4A2E1B] px-3 py-1.5 rounded-full border border-[#DFBF77]/20">
                <HeartHandshake className="w-3.5 h-3.5 text-[#DFBF77]" />
                Chef Consultation Call
              </span>
            </div>

            <div className="pt-4 flex justify-center lg:justify-start">
              <Link
                to="/custom-cake"
                className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-linear-to-r from-[#DFBF77] to-[#C5A059] hover:from-[#E5C378] hover:to-[#B38E46] text-[#2B1810] font-bold text-sm tracking-wide shadow-lg hover:shadow-xl transition-all group cursor-pointer"
              >
                <span>Request Custom Cake Quote</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Right image card: single gorgeous custom floral tiered cake */}
          <div className="lg:col-span-5">
            <div className="relative max-w-sm mx-auto rounded-3xl overflow-hidden border-2 border-[#DFBF77]/40 shadow-2xl p-2 bg-[#3D2314]">
              <div className="relative aspect-square rounded-2xl overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1542826438-bd32f43d626f?auto=format&fit=crop&w=800&q=80"
                  alt="Custom bespoke designer pastel cake"
                  className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent flex items-end p-4">
                  <p className="text-xs text-white/90 font-medium">
                    &quot;Crafted for Ananya’s 25th Parisian Themed Celebration&quot;
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
