import React from 'react';
import { Sparkles, ShieldCheck, Heart, Truck, Award } from 'lucide-react';

export const WhyChooseUs: React.FC = () => {
  const pillars = [
    {
      icon: <Award className="w-6 h-6 text-[#DFBF77]" />,
      title: 'Baked Fresh to Order',
      desc: 'Never frozen. Each cake is mixed, baked, and frosted within hours of your delivery time.',
    },
    {
      icon: <Sparkles className="w-6 h-6 text-[#D86A7F]" />,
      title: 'Belgian Couverture & Pure Butter',
      desc: 'We use 70% Belgian chocolate, farm-fresh dairy cream, and pure extracts—no synthetic substitutes.',
    },
    {
      icon: <Truck className="w-6 h-6 text-[#C5A059]" />,
      title: '2-Hour Safe Rush Delivery',
      desc: 'Hand-delivered in shock-proof, refrigerated bakery boxes so your cake arrives in pristine perfection.',
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-emerald-600" />,
      title: '100% Pure Eggless Guarantee',
      desc: 'Dedicated vegetarian preparation areas for zero cross-contamination without sacrificing fluffiness.',
    },
  ];

  return (
    <section className="py-16 bg-[#FFFDF9] border-t border-b border-[#E8DDD7]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#C5A059] mb-2">
            <Heart className="w-3.5 h-3.5 text-[#D86A7F]" />
            <span>The Deep’s Quality Promise</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#2B1810]">
            Why Celebrations Begin With Us
          </h2>
          <p className="text-sm text-[#7E6355] mt-2">
            Every bite is a celebration of craftsmanship, fine culinary art, and sincere passion.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {pillars.map((p, idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-white border border-[#E8DDD7] shadow-2xs hover:shadow-md hover:border-[#C5A059]/40 transition-all text-center space-y-3 flex flex-col items-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#FFF0F3] flex items-center justify-center">
                {p.icon}
              </div>
              <h3 className="font-serif text-base font-bold text-[#2B1810]">
                {p.title}
              </h3>
              <p className="text-xs text-[#7E6355] leading-relaxed">
                {p.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
