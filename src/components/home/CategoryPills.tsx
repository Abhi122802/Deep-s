import React from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES_DATA } from '../../data/categories';
import { ArrowRight, Sparkles } from 'lucide-react';

export const CategoryPills: React.FC = () => {
  return (
    <section className="py-16 bg-[#FFFDF9] border-b border-[#E8DDD7]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C5A059] mb-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Explore By Occasion & Style</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#2B1810]">
              Cake Categories
            </h2>
            <p className="text-sm text-[#7E6355] mt-1">
              From intimate birthdays to royal wedding towers, find the perfect sweet pairing
            </p>
          </div>

          <Link
            to="/cakes"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2B1810] hover:text-[#C5A059] transition-colors group"
          >
            <span>View All Collections</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* 7 Categories Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
          {CATEGORIES_DATA.map((cat) => (
            <Link
              key={cat.id}
              to={`/cakes?category=${cat.id}`}
              className="group flex flex-col items-center text-center p-3.5 rounded-2xl bg-white border border-[#E8DDD7] hover:border-[#C5A059] hover:shadow-lg transition-all duration-300"
            >
              {/* Single complete cake image in round frame */}
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden mb-3 border-2 border-[#FAF3E0] group-hover:border-[#C5A059] transition-all duration-300 group-hover:scale-105 shadow-2xs">
                <img
                  src={cat.image}
                  alt={`${cat.name} single cake`}
                  className="w-full h-full object-cover"
                />
              </div>

              <h3 className="font-serif text-xs sm:text-sm font-bold text-[#2B1810] group-hover:text-[#C5A059] transition-colors line-clamp-1">
                {cat.name}
              </h3>
              <span className="text-[10px] text-[#7E6355] mt-0.5">
                {cat.itemCount}+ Designs
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};
