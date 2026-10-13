import React from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  Clock,
  ShieldCheck,
  Star,
  Award,
} from 'lucide-react';

export const HeroBanner: React.FC = () => {
  return (
    <section className="relative overflow-hidden bg-linear-to-b from-[#FFFDF9] via-[#FDFBF7] to-[#F5EFEB] py-12 md:py-20 border-b border-[#E8DDD7]">
      {/* Decorative ambient pastel gradients */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#F7CAD0]/30 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-10 w-80 h-80 bg-[#FAF3E0] rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            {/* Top pill badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFF0F3] border border-[#F4ACB7]/60 shadow-xs">
              <Sparkles className="w-4 h-4 text-[#D86A7F]" />
              <span className="text-xs font-bold text-[#2B1810] tracking-wide uppercase">
                Boutique Confectionery & Patisserie
              </span>
            </div>

            {/* Headline */}
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#2B1810] leading-[1.15] tracking-tight">
              Artisan Cakes Crafted For Life’s{' '}
              <span className="text-transparent bg-clip-text bg-linear-to-r from-[#D86A7F] via-[#C5A059] to-[#3D2314] italic">
                Sweetest Moments
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-base sm:text-lg text-[#5C3D28] max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
              Indulge in freshly baked celebration cakes, rich Belgian chocolate ganaches, and customized tiered creations. 100% pure eggless options handcrafted daily to perfection.
            </p>

            {/* Shopping & Custom Cake Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Link
                to="/cakes"
                className="w-full sm:w-auto px-8 py-4 rounded-full bg-[#2B1810] hover:bg-[#3D2314] text-[#FFFDF9] font-bold text-sm tracking-wide shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>Explore Cake Menu</span>
                <ArrowRight className="w-4 h-4 text-[#DFBF77] group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                to="/custom-cake"
                className="w-full sm:w-auto px-8 py-4 rounded-full bg-linear-to-r from-[#F4ACB7] to-[#F7CAD0] hover:from-[#E88295] hover:to-[#F4ACB7] text-[#2B1810] font-bold text-sm tracking-wide shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer border border-[#F4ACB7]"
              >
                <Sparkles className="w-4 h-4 text-[#2B1810]" />
                <span>Design Custom Cake</span>
              </Link>
            </div>

            {/* Trust Highlights */}
            <div className="pt-6 grid grid-cols-3 gap-3 border-t border-[#E8DDD7] max-w-lg mx-auto lg:mx-0">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#C5A059] shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-bold text-[#2B1810]">2-Hr Delivery</p>
                  <p className="text-[10px] text-[#7E6355]">Rush Available</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-bold text-[#2B1810]">100% Eggless</p>
                  <p className="text-[10px] text-[#7E6355]">Dedicated Line</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-[#DFBF77] shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-bold text-[#2B1810]">Belgian Cacao</p>
                  <p className="text-[10px] text-[#7E6355]">Pure Couverture</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Visual Column (EXACTLY ONE COMPLETE CAKE) */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* Outer decorative ring */}
              <div className="absolute -inset-3 rounded-3xl bg-linear-to-tr from-[#C5A059]/20 via-[#F7CAD0]/40 to-transparent blur-md" />

              {/* Main Card with single cake */}
              <div className="relative rounded-3xl overflow-hidden bg-white p-3 shadow-2xl border border-[#E8DDD7]">
                <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-[#FDFBF7]">
                  <img
                    src="https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1000&q=80"
                    alt="Signature Belgian Truffle Single Complete Cake"
                    className="w-full h-full object-cover object-center transform hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute top-3 left-3 bg-[#2B1810]/90 backdrop-blur-xs text-[#DFBF77] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm">
                    <Sparkles className="w-3 h-3" />
                    Chef’s Masterpiece
                  </div>
                </div>

                {/* Floating reviews badge */}
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-serif text-base font-bold text-[#2B1810]">
                      Belgian Dark Truffle Opera
                    </h3>
                    <p className="text-xs text-[#7E6355]">
                      70% Pure Couverture • 100% Eggless
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-amber-500 justify-end">
                      <Star className="w-3.5 h-3.5 fill-current text-[#C5A059]" />
                      <span className="text-xs font-bold text-[#2B1810]">4.9</span>
                    </div>
                    <span className="text-sm font-bold text-[#2B1810]">
                      ₹799 onwards
                    </span>
                  </div>
                </div>
              </div>

              {/* Floating review card */}
              <div className="absolute -bottom-6 -left-6 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl shadow-xl border border-[#E8DDD7] hidden sm:flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FAF3E0] flex items-center justify-center text-[#B38E46] font-serif font-bold text-lg">
                  ★
                </div>
                <div>
                  <p className="text-xs font-bold text-[#2B1810]">
                    &quot;Best chocolate cake in town!&quot;
                  </p>
                  <p className="text-[10px] text-[#7E6355]">
                    Over 2,500+ celebrations sweetened
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
