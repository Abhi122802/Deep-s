import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  adminService,
  type AdminCake,
  type AdminCategory,
} from '../../services/adminService';
import { useToast } from '../../context/ToastContext';
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Cake as CakeIcon,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  Award,
  Clock,
} from 'lucide-react';

export const AdminCakesPage: React.FC = () => {
  const { showToast } = useToast();

  // Query states
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'true' | 'false'>('all');
  const [sortBy, setSortBy] = useState<any>('newest');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  // Data states
  const [cakes, setCakes] = useState<AdminCake[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal states for delete confirmation
  const [cakeToDelete, setCakeToDelete] = useState<AdminCake | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Fetch categories for filter dropdown
  useEffect(() => {
    adminService.getCategories().then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setCategories(res.data);
      }
    }).catch(() => {});
  }, []);

  // Fetch cakes
  const fetchCakes = useCallback(async (isBg = false) => {
    if (isBg) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await adminService.getCakes({
        page,
        limit,
        search: search.trim(),
        category: selectedCategory,
        isAvailable: availabilityFilter,
        sortBy,
      });

      if (response.success) {
        setCakes(response.data || []);
        setPagination(response.pagination);
      } else {
        setErrorMessage('Unable to retrieve cakes catalog.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to communicate with cakes endpoint.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, limit, search, selectedCategory, availabilityFilter, sortBy]);

  useEffect(() => {
    fetchCakes();
  }, [fetchCakes]);

  // Toggle availability
  const handleToggleAvailability = async (cake: AdminCake) => {
    const nextState = !cake.isAvailable;
    try {
      const res = await adminService.toggleCakeAvailability(cake.id || cake._id!, nextState);
      if (res.success) {
        showToast(
          `"${cake.name}" is now ${nextState ? 'available in storefront' : 'hidden from customers'}.`,
          'success'
        );
        setCakes((prev) =>
          prev.map((c) => (c.id === cake.id || c.slug === cake.slug ? { ...c, isAvailable: nextState } : c))
        );
      }
    } catch (err: any) {
      showToast(err.message || 'Could not update cake availability.', 'warning');
    }
  };

  // Delete cake
  const handleDeleteCake = async () => {
    if (!cakeToDelete) return;
    setIsDeleting(true);

    try {
      const id = cakeToDelete.id || cakeToDelete._id!;
      const res = await adminService.deleteCake(id);

      if (res.success) {
        if (res.isSoftDeleted) {
          showToast(
            `"${cakeToDelete.name}" was deactivated to protect historical order records.`,
            'info'
          );
          setCakes((prev) =>
            prev.map((c) => (c.id === cakeToDelete.id ? { ...c, isAvailable: false } : c))
          );
        } else {
          showToast(`"${cakeToDelete.name}" was deleted from catalog.`, 'success');
          setCakes((prev) => prev.filter((c) => c.id !== cakeToDelete.id));
        }
        setCakeToDelete(null);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to remove cake.', 'warning');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-7 rounded-3xl border border-[#E8DDD7] shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#C5A059]">
              Inventory & Menus
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Live CRUD
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#2B1810] mt-1">
            Cake Catalog Management
          </h1>
          <p className="text-xs sm:text-sm text-[#7E6355] mt-0.5">
            Add artisan cakes, manage price tiers across weight variants, and adjust live availability.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchCakes(true)}
            disabled={isLoading || isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#FAF3E0] hover:bg-[#F5E8C7] text-[#5C3D28] text-xs font-bold border border-[#E8DDD7] transition-all cursor-pointer shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#C5A059]' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <Link
            to="/admin/cakes/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#2B1810] hover:bg-[#3D2314] text-[#FFFDF9] text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 text-[#DFBF77]" />
            <span>Add New Cake</span>
          </Link>
        </div>
      </div>

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-bold block">Catalog Error:</strong>
            <p className="text-rose-700">{errorMessage}</p>
          </div>
          <button
            onClick={() => fetchCakes()}
            className="underline font-bold text-rose-900 hover:text-rose-950 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Search, Filter & Controls Bar */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#E8DDD7] shadow-2xs space-y-4">
        {/* Availability Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <Filter className="w-4 h-4 text-[#7E6355] shrink-0 mr-1" />
          {[
            { label: 'All Cakes', value: 'all' },
            { label: 'Live & Available', value: 'true' },
            { label: 'Hidden / Inactive', value: 'false' },
          ].map((tab) => {
            const isActive = availabilityFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => {
                  setAvailabilityFilter(tab.value as any);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#2B1810] text-[#FFFDF9] shadow-xs'
                    : 'bg-[#FAF3E0] hover:bg-[#F5E8C7] text-[#5C3D28] border border-[#E8DDD7]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search, Category, Sort, Limit */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-[#F4EEE8]">
          {/* Search Box */}
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by cake title, flavor, or slug..."
              className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] text-xs font-medium text-[#2B1810] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40 focus:border-[#C5A059]"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="sm:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="w-full py-2.5 px-3 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] text-xs font-semibold text-[#2B1810] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40 cursor-pointer"
            >
              <option value="All">All Categories</option>
              {categories.map((c) => (
                <option key={c.id || c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div className="sm:col-span-2">
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="w-full py-2.5 px-3 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] text-xs font-semibold text-[#2B1810] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40 cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="name-asc">Name: A-Z</option>
              <option value="rating">Top Rated</option>
            </select>
          </div>

          {/* Page Limit */}
          <div className="sm:col-span-2">
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="w-full py-2.5 px-3 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] text-xs font-semibold text-[#2B1810] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40 cursor-pointer"
            >
              <option value="10">10 per page</option>
              <option value="20">20 per page</option>
              <option value="50">50 per page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Catalog Table Container */}
      <div className="bg-white rounded-3xl border border-[#E8DDD7] shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-10 h-10 border-3 border-[#C5A059] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-[#7E6355]">Loading cake creations...</p>
          </div>
        ) : cakes.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-14 h-14 bg-[#FAF3E0] rounded-3xl flex items-center justify-center mx-auto text-[#C5A059]">
              <CakeIcon className="w-7 h-7" />
            </div>
            <h3 className="font-serif text-lg font-bold text-[#2B1810]">No Cakes Found</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              {search || selectedCategory !== 'All' || availabilityFilter !== 'all'
                ? 'No cakes match your filter criteria. Try resetting your search query or filters.'
                : 'No cake items exist in the catalog yet. Click "Add New Cake" above to create your first.'}
            </p>
            {(search || selectedCategory !== 'All' || availabilityFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearch('');
                  setSelectedCategory('All');
                  setAvailabilityFilter('all');
                  setPage(1);
                }}
                className="mt-2 px-4 py-2 rounded-2xl bg-[#2B1810] text-[#FFFDF9] text-xs font-bold hover:bg-[#3D2314] transition-colors cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#FAF3E0]/70 border-b border-[#E8DDD7] text-[#7E6355] text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">Cake Product</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Base Price (0.5 kg)</th>
                  <th className="py-3.5 px-4">Attributes</th>
                  <th className="py-3.5 px-4">Storefront Status</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4EEE8]">
                {cakes.map((cake) => {
                  const cakeId = cake.id || cake._id || cake.slug;

                  return (
                    <tr
                      key={cakeId}
                      className="hover:bg-[#FDFBF7] transition-colors group"
                    >
                      {/* Product details with image */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl overflow-hidden bg-stone-100 border border-[#E8DDD7] shrink-0">
                            <img
                              src={cake.image}
                              alt={cake.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src =
                                  'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=400&q=80';
                              }}
                            />
                          </div>
                          <div>
                            <div className="font-bold text-sm text-[#2B1810] group-hover:text-[#C5A059] transition-colors">
                              {cake.name}
                            </div>
                            <div className="text-[11px] text-stone-400 font-mono truncate max-w-[180px]">
                              {cake.slug}
                            </div>
                            <div className="text-[11px] text-[#7E6355] truncate max-w-[200px]">
                              {cake.flavor}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#FAF3E0] text-[#5C3D28] border border-[#E8DDD7]">
                          {cake.category}
                        </span>
                      </td>

                      {/* Base Price */}
                      <td className="py-4 px-4">
                        <div className="font-mono font-bold text-sm text-[#2B1810]">
                          ₹{cake.basePrice?.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-stone-400">
                          1 kg: ₹{cake.weightPrices?.['1 kg']?.toLocaleString('en-IN') || (cake.basePrice * 1.85)}
                        </div>
                      </td>

                      {/* Attributes */}
                      <td className="py-4 px-4 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {cake.isEggless && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              Eggless
                            </span>
                          )}
                          {cake.isBestSeller && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <Award className="w-3 h-3 text-amber-600" />
                              Bestseller
                            </span>
                          )}
                          {cake.isFeatured && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                              <Sparkles className="w-3 h-3 text-indigo-600" />
                              Featured
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-stone-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Prep: {cake.preparationTimeHours || 2}h</span>
                        </div>
                      </td>

                      {/* Storefront Status */}
                      <td className="py-4 px-4">
                        <button
                          onClick={() => handleToggleAvailability(cake)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                            cake.isAvailable
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                          }`}
                          title={`Click to ${cake.isAvailable ? 'hide cake' : 'make cake available'}`}
                        >
                          {cake.isAvailable ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Live</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5 text-stone-500" />
                              <span>Hidden</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/admin/cakes/${cakeId}/edit`}
                            className="p-2 rounded-xl bg-[#FAF3E0] hover:bg-[#F5E8C7] text-[#5C3D28] hover:text-[#2B1810] transition-colors"
                            title="Edit Cake"
                            aria-label="Edit Cake"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>

                          <Link
                            to={`/product/${cake.slug || cakeId}`}
                            target="_blank"
                            className="p-2 rounded-xl bg-[#FAF3E0] hover:bg-[#F5E8C7] text-[#5C3D28] hover:text-[#2B1810] transition-colors"
                            title="View on Storefront"
                            aria-label="View on Storefront"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          <button
                            onClick={() => setCakeToDelete(cake)}
                            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                            title="Delete / Deactivate Cake"
                            aria-label="Delete Cake"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {cakes.length > 0 && (
          <div className="bg-[#FAF3E0]/40 border-t border-[#E8DDD7] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#7E6355]">
            <div>
              Showing <span className="font-bold text-[#2B1810]">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
              <span className="font-bold text-[#2B1810]">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{' '}
              of <span className="font-bold text-[#2B1810]">{pagination.total}</span> cakes
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!pagination.hasPrevPage}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-[#E8DDD7] text-xs font-semibold text-[#2B1810] hover:bg-[#FAF3E0] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <span className="px-3 py-1 font-mono font-bold text-[#2B1810]">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={!pagination.hasNextPage}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-[#E8DDD7] text-xs font-semibold text-[#2B1810] hover:bg-[#FAF3E0] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete / Deactivate Confirmation Modal */}
      {cakeToDelete && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => {
            if (!isDeleting) setCakeToDelete(null);
          }}
        >
          <div
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-[#E8DDD7] p-6 space-y-5 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-[#2B1810]">
                  Confirm Cake Removal
                </h3>
                <p className="text-xs text-stone-500 font-mono">
                  {cakeToDelete.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Are you sure you want to remove <strong>&ldquo;{cakeToDelete.name}&rdquo;</strong>?
              If this cake is referenced by any existing customer orders, it will be safely <strong>soft-deactivated</strong> rather than deleted to protect historical order records and pricing.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCakeToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-2xl bg-white border border-[#E8DDD7] text-xs font-bold text-[#5C3D28] hover:bg-stone-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteCake}
                disabled={isDeleting}
                className="px-5 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isDeleting ? 'Processing...' : 'Confirm Removal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
