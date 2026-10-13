import React from 'react';
import { Link } from 'react-router-dom';
import {
  Heart,
  Sparkles,
  Award,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="bg-[#FDFBF7] py-12 md:py-20 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#FFF0F3] border border-[#F4ACB7]/50 text-xs font-bold uppercase tracking-wider text-[#D86A7F]">
            <Heart className="w-3.5 h-3.5" />
            <span>Our Heritage & Craft</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-[#2B1810]">
            The Sweet Passion Behind Deep’s Cake Shop
          </h1>
          <p className="text-base text-[#7E6355] leading-relaxed">
            Founded with a simple mission: to elevate everyday moments into unforgettable memories through genuine French confectionery craft, rich Belgian chocolates, and honest, farm-fresh ingredients.
          </p>
        </div>

        {/* Narrative Section with Image */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 relative">
            <div className="relative rounded-3xl overflow-hidden border border-[#E8DDD7] shadow-xl">
              <img
                src="https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1000&q=80"
                alt="Master baker finishing single Belgian cake"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="lg:col-span-6 space-y-6">
            <span className="text-xs font-bold uppercase tracking-wider text-[#C5A059]">
              Pure Confectionery Artistry
            </span>
            <h2 className="font-serif text-3xl font-bold text-[#2B1810]">
              From Whisks to Wonders
            </h2>
            <div className="space-y-4 text-sm text-[#5C3D28] leading-relaxed">
              <p>
                At Deep’s, we believe a celebration cake shouldn’t just look like a museum centerpiece—it must taste transcendent. That’s why our sponges are baked fresh every single morning, layered with slow-simmered fruit preserves and single-origin cocoa ganaches.
              </p>
              <p>
                We never use frozen pre-mixes, chemical preservatives, or vegetable oil fats. From Madagascar Bourbon vanilla beans to imported Callebaut couverture, our pantry is stocked exclusively with ingredients worthy of your most special milestones.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-white border border-[#E8DDD7]">
                <p className="font-serif text-2xl font-bold text-[#2B1810]">100%</p>
                <p className="text-xs text-[#7E6355] mt-0.5">Vegetarian Eggless Certified</p>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-[#E8DDD7]">
                <p className="font-serif text-2xl font-bold text-[#2B1810]">2 Hours</p>
                <p className="text-xs text-[#7E6355] mt-0.5">Rush Express City Delivery</p>
              </div>
            </div>
          </div>
        </div>

        {/* Core Values */}
        <div className="bg-white p-8 sm:p-12 rounded-3xl border border-[#E8DDD7] shadow-sm space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#2B1810]">
              Our Guiding Principles
            </h3>
            <p className="text-xs text-[#7E6355]">
              Every cake that leaves our kitchen carries our uncompromising commitment to excellence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-[#FFFDF9] border border-[#E8DDD7] space-y-3">
              <Award className="w-8 h-8 text-[#C5A059]" />
              <h4 className="font-serif text-base font-bold text-[#2B1810]">
                Artisanal Integrity
              </h4>
              <p className="text-xs text-[#7E6355] leading-relaxed">
                Hand-swirled frostings, hand-piped sugar flowers, and meticulously balanced sweetness levels designed for discerning palates.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#FFFDF9] border border-[#E8DDD7] space-y-3">
              <ShieldCheck className="w-8 h-8 text-emerald-600" />
              <h4 className="font-serif text-base font-bold text-[#2B1810]">
                Clean Hygiene Standards
              </h4>
              <p className="text-xs text-[#7E6355] leading-relaxed">
                Temperature-monitored prep zones and strict segregation for pure vegetarian batches ensure uncompromised quality and trust.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#FFFDF9] border border-[#E8DDD7] space-y-3">
              <Sparkles className="w-8 h-8 text-[#D86A7F]" />
              <h4 className="font-serif text-base font-bold text-[#2B1810]">
                Custom Design Expertise
              </h4>
              <p className="text-xs text-[#7E6355] leading-relaxed">
                No vision is too grand or whimsical. Our dedicated cake artists work closely with you to transform ideas into edible reality.
              </p>
            </div>
          </div>
        </div>

        {/* Call to action */}
        <div className="text-center space-y-4 pt-4">
          <h3 className="font-serif text-2xl font-bold text-[#2B1810]">
            Ready to taste the difference?
          </h3>
          <div className="flex justify-center gap-4">
            <Link
              to="/cakes"
              className="px-8 py-3.5 rounded-full bg-[#2B1810] hover:bg-[#3D2314] text-[#FFFDF9] text-xs font-bold transition-all shadow-md flex items-center gap-2"
            >
              <span>Explore Bakery Menu</span>
              <ArrowRight className="w-4 h-4 text-[#DFBF77]" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
