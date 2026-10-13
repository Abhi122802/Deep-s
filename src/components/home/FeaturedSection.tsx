import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { DEMO_CAKES } from '../../data/cakes';
import { ProductCard } from '../product/ProductCard';
import { ArrowRight, Award } from 'lucide-react';

type TabType = 'all' | 'bestsellers' | 'eggless' | 'chocolate';

export const FeaturedSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('all');

  const filteredCakes = DEMO_CAKES.filter((cake) => {
    if (activeTab === 'bestsellers') return cake.isBestSeller;
    if (activeTab === 'eggless') return cake.isEggless;
    if (activeTab === 'chocolate') return cake.category === 'Chocolate';
    return cake.isFeatured;
  }).slice(0, 8);

  return (
    <section className="py-16 bg-[#FDFBF7]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C5A059] mb-1.5">
              <Award className="w-3.5 h-3.5" />
              <span>Handcrafted By Master Pastry Chefs</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#2B1810]">
              Signature Creations
            </h2>
            <p className="text-sm text-[#7E6355] mt-1">
              Freshly whisked and baked in micro-batches with pure butter and real fruit coulis
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[#2B1810] text-[#FFFDF9] shadow-xs'
                  : 'bg-white text-[#5C3D28] border border-[#E8DDD7] hover:border-[#C5A059]'
              }`}
            >
              Featured Menu
            </button>
            <button
              onClick={() => setActiveTab('bestsellers')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'bestsellers'
                  ? 'bg-[#2B1810] text-[#FFFDF9] shadow-xs'
                  : 'bg-white text-[#5C3D28] border border-[#E8DDD7] hover:border-[#C5A059]'
              }`}
            >
              ⭐ Bestsellers
            </button>
            <button
              onClick={() => setActiveTab('eggless')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'eggless'
                  ? 'bg-[#2B1810] text-[#FFFDF9] shadow-xs'
                  : 'bg-white text-[#5C3D28] border border-[#E8DDD7] hover:border-[#C5A059]'
              }`}
            >
              🌱 100% Eggless
            </button>
            <button
              onClick={() => setActiveTab('chocolate')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'chocolate'
                  ? 'bg-[#2B1810] text-[#FFFDF9] shadow-xs'
                  : 'bg-white text-[#5C3D28] border border-[#E8DDD7] hover:border-[#C5A059]'
              }`}
            >
              🍫 Pure Chocolate
            </button>
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredCakes.map((cake) => (
            <ProductCard key={cake.id} cake={cake} />
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <Link
            to="/cakes"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white border border-[#E8DDD7] hover:border-[#C5A059] text-[#2B1810] hover:text-[#C5A059] text-sm font-bold shadow-xs hover:shadow-md transition-all group cursor-pointer"
          >
            <span>Explore All 14+ Handcrafted Cakes</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-[#C5A059]" />
          </Link>
        </div>
      </div>
    </section>
  );
};
