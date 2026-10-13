import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CakeCategory, WeightOption } from '../types';
import { DEMO_CAKES } from '../data/cakes';
import { ProductGrid } from '../components/product/ProductGrid';
import {
  Search,
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
  ChevronDown,
  X,
} from 'lucide-react';
import { EggBadge } from '../components/common/EggBadge';

const CATEGORIES: ('All' | CakeCategory)[] = [
  'All',
  'Birthday',
  'Anniversary',
  'Chocolate',
  'Designer',
  'Photo',
  'Eggless',
  'Wedding',
];

const WEIGHT_OPTIONS: ('all' | WeightOption)[] = [
  'all',
  '0.5 kg',
  '1 kg',
  '1.5 kg',
  '2 kg',
];

export const CatalogPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial from URL
  const initialCategory = (searchParams.get('category') as CakeCategory) || 'All';
  const initialSearch = searchParams.get('search') || '';

  const [category, setCategory] = useState<'All' | CakeCategory>(initialCategory);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [eggPreference, setEggPreference] = useState<'all' | 'eggless' | 'contains-egg'>('all');
  const [maxPrice, setMaxPrice] = useState<number>(6000);
  const [weightFilter, setWeightFilter] = useState<'all' | WeightOption>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'price-low' | 'price-high' | 'rating' | 'bestseller'>('featured');
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  // Sync URL changes
  useEffect(() => {
    const urlCat = searchParams.get('category') as CakeCategory | null;
    const urlSearch = searchParams.get('search');
    if (urlCat) {
      setCategory(urlCat);
    }
    if (urlSearch !== null) {
      setSearchTerm(urlSearch);
    }
  }, [searchParams]);

  const updateCategoryFilter = (cat: 'All' | CakeCategory) => {
    setCategory(cat);
    if (cat === 'All') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', cat);
    }
    setSearchParams(searchParams);
  };

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    if (val.trim()) {
      searchParams.set('search', val.trim());
    } else {
      searchParams.delete('search');
    }
    setSearchParams(searchParams);
  };

  const resetAllFilters = () => {
    setCategory('All');
    setSearchTerm('');
    setEggPreference('all');
    setMaxPrice(6000);
    setWeightFilter('all');
    setSortBy('featured');
    setSearchParams({});
  };

  // Filter & sort logic
  const filteredCakes = useMemo(() => {
    let list = [...DEMO_CAKES];

    // Search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.flavor.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
      );
    }

    // Category
    if (category !== 'All') {
      list = list.filter((c) => c.category === category);
    }

    // Egg preference
    if (eggPreference === 'eggless') {
      list = list.filter((c) => c.isEggless);
    } else if (eggPreference === 'contains-egg') {
      list = list.filter((c) => !c.isEggless);
    }

    // Weight filter (all cakes have weight prices, but this allows specific pricing verification)
    if (weightFilter !== 'all') {
      list = list.filter((c) => !!c.weightPrices[weightFilter]);
    }

    // Price
    list = list.filter((c) => c.basePrice <= maxPrice);

    // Sorting
    switch (sortBy) {
      case 'price-low':
        list.sort((a, b) => a.basePrice - b.basePrice);
        break;
      case 'price-high':
        list.sort((a, b) => b.basePrice - a.basePrice);
        break;
      case 'rating':
        list.sort((a, b) => b.rating - a.rating);
        break;
      case 'bestseller':
        list.sort((a, b) => (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0));
        break;
      default:
        // featured
        list.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
        break;
    }

    return list;
  }, [category, searchTerm, eggPreference, weightFilter, maxPrice, sortBy]);

  const hasActiveFilters =
    category !== 'All' ||
    searchTerm.trim() !== '' ||
    eggPreference !== 'all' ||
    weightFilter !== 'all' ||
    maxPrice < 6000 ||
    sortBy !== 'featured';

  return (
    <div className="bg-[#FDFBF7] min-h-screen py-8 md:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Page Title & Breadcrumb */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E8DDD7] pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#C5A059] mb-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Handcrafted Confections</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#2B1810]">
              Cake Catalog
            </h1>
            <p className="text-sm text-[#7E6355] mt-1">
              Explore 14+ handcrafted cakes baked fresh with premium ingredients
            </p>
          </div>

          <div className="text-xs text-[#7E6355]">
            Showing <strong className="text-[#2B1810] font-bold">{filteredCakes.length}</strong> cakes available for 2-hour delivery
          </div>
        </div>

        {/* Search & Sort Controls Bar */}
        <div className="bg-white p-4 rounded-2xl border border-[#E8DDD7] shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Live Search Input */}
          <div className="relative w-full md:max-w-md">
            <input
              type="text"
              placeholder="Search by cake name, flavor, or ingredient..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl pl-10 pr-10 py-2.5 text-sm text-[#2B1810] placeholder-[#7E6355]/60 focus:outline-hidden focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/15"
            />
            <Search className="w-4 h-4 text-[#7E6355] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            {searchTerm && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Right Filters & Sort */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <button
              onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
              className="md:hidden flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E8DDD7] bg-[#FDFBF7] text-xs font-bold text-[#2B1810]"
            >
              <SlidersHorizontal className="w-4 h-4 text-[#C5A059]" />
              <span>Filters {hasActiveFilters && '• Active'}</span>
            </button>

            {/* Price & Rating Sort Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#7E6355] font-medium hidden sm:inline">
                Sort by:
              </span>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="appearance-none bg-[#FDFBF7] border border-[#E8DDD7] rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-[#2B1810] focus:outline-hidden focus:border-[#C5A059] cursor-pointer"
                >
                  <option value="featured">Featured Collection</option>
                  <option value="bestseller">Best Sellers First</option>
                  <option value="rating">Highest Rated</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#7E6355] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Category Pills Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => updateCategoryFilter(cat)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                category === cat
                  ? 'bg-[#2B1810] text-[#FFFDF9] shadow-xs'
                  : 'bg-white text-[#5C3D28] border border-[#E8DDD7] hover:border-[#C5A059]'
              }`}
            >
              {cat === 'All' ? 'All Cakes' : cat}
            </button>
          ))}
        </div>

        {/* Main Grid + Filter Sidebar Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* Desktop Filter Sidebar */}
          <aside
            className={`lg:block bg-white p-6 rounded-2xl border border-[#E8DDD7] shadow-2xs space-y-6 ${
              isMobileFiltersOpen ? 'block' : 'hidden'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#F4EEE8]">
              <h3 className="font-serif text-base font-bold text-[#2B1810] flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#C5A059]" />
                Filters
              </h3>
              {hasActiveFilters && (
                <button
                  onClick={resetAllFilters}
                  className="text-[11px] font-semibold text-[#D86A7F] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>

            {/* Egg Preference Filter */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-[#5C3D28] block">
                Dietary Preference
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2.5 text-xs text-[#2B1810] cursor-pointer">
                  <input
                    type="radio"
                    name="eggPref"
                    checked={eggPreference === 'all'}
                    onChange={() => setEggPreference('all')}
                    className="accent-[#2B1810]"
                  />
                  <span>Show All (Eggless & Egg)</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-[#2B1810] cursor-pointer">
                  <input
                    type="radio"
                    name="eggPref"
                    checked={eggPreference === 'eggless'}
                    onChange={() => setEggPreference('eggless')}
                    className="accent-[#2B1810]"
                  />
                  <EggBadge isEggless={true} size="sm" />
                </label>
                <label className="flex items-center gap-2.5 text-xs text-[#2B1810] cursor-pointer">
                  <input
                    type="radio"
                    name="eggPref"
                    checked={eggPreference === 'contains-egg'}
                    onChange={() => setEggPreference('contains-egg')}
                    className="accent-[#2B1810]"
                  />
                  <EggBadge isEggless={false} size="sm" />
                </label>
              </div>
            </div>

            {/* Weight Filter */}
            <div className="space-y-3 pt-3 border-t border-[#F4EEE8]">
              <label className="text-xs font-bold uppercase tracking-wider text-[#5C3D28] block">
                Filter by Weight
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {WEIGHT_OPTIONS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWeightFilter(w)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      weightFilter === w
                        ? 'bg-[#2B1810] text-[#FFFDF9] font-bold'
                        : 'bg-[#FDFBF7] text-[#5C3D28] border border-[#E8DDD7] hover:border-[#C5A059]'
                    }`}
                  >
                    {w === 'all' ? 'All Weights' : w}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Range Slider */}
            <div className="space-y-3 pt-3 border-t border-[#F4EEE8]">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold uppercase tracking-wider text-[#5C3D28]">
                  Max Price
                </span>
                <span className="font-bold text-[#2B1810] text-sm">
                  Up to ₹{maxPrice.toLocaleString('en-IN')}
                </span>
              </div>
              <input
                type="range"
                min="599"
                max="6000"
                step="100"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-[#2B1810] cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-[#7E6355]">
                <span>₹599</span>
                <span>₹6,000+</span>
              </div>
            </div>

            {/* Quality Promise */}
            <div className="p-4 rounded-xl bg-[#FFF0F3] border border-[#F4ACB7]/40 text-xs text-[#2B1810] space-y-1.5">
              <p className="font-bold text-[#D86A7F]">
                Fresh Bakery Guarantee
              </p>
              <p className="text-[11px] text-[#5C3D28] leading-relaxed">
                All cakes are baked in certified hygienic facilities within 3 hours of dispatch.
              </p>
            </div>
          </aside>

          {/* Product Grid Area */}
          <div className="lg:col-span-3">
            <ProductGrid
              cakes={filteredCakes}
              onResetFilters={resetAllFilters}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
