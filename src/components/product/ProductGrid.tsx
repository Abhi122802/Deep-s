import React from 'react';
import type { Cake } from '../../types';
import { ProductCard } from './ProductCard';
import { Cake as CakeIcon, RotateCcw } from 'lucide-react';

interface ProductGridProps {
  cakes: Cake[];
  onResetFilters?: () => void;
  title?: string;
  subtitle?: string;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  cakes,
  onResetFilters,
  title,
  subtitle,
}) => {
  return (
    <section className="w-full">
      {(title || subtitle) && (
        <div className="mb-6">
          {title && (
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#2B1810]">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-sm text-[#7E6355] mt-1">{subtitle}</p>
          )}
        </div>
      )}

      {cakes.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-2xl border border-[#E8DDD7] shadow-2xs max-w-lg mx-auto my-6 space-y-4">
          <div className="w-16 h-16 rounded-full bg-[#FFF0F3] text-[#D86A7F] mx-auto flex items-center justify-center">
            <CakeIcon className="w-8 h-8" />
          </div>
          <h3 className="font-serif text-xl font-bold text-[#2B1810]">
            No matching cakes found
          </h3>
          <p className="text-sm text-[#7E6355] max-w-xs mx-auto leading-relaxed">
            We couldn't find any cakes matching your current filters or search terms. Try adjusting your selections.
          </p>
          {onResetFilters && (
            <button
              onClick={onResetFilters}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2B1810] text-[#FFFDF9] text-xs font-semibold hover:bg-[#3D2314] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {cakes.map((cake) => (
            <ProductCard key={cake.id} cake={cake} />
          ))}
        </div>
      )}
    </section>
  );
};
