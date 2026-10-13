import React, { useState, useEffect, useCallback } from 'react';
import {
  adminService,
  type AdminCategory,
  type CreateCategoryPayload,
  type UpdateCategoryPayload,
} from '../../services/adminService';
import { useToast } from '../../context/ToastContext';
import {
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Layers,
  AlertCircle,
  AlertTriangle,
  X,
  Cake,
  Upload,
} from 'lucide-react';

export const AdminCategoriesPage: React.FC = () => {
  const { showToast } = useToast();

  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [search, setSearch] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);

  // Delete guard states
  const [categoryToDelete, setCategoryToDelete] = useState<AdminCategory | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteBlockedWarning, setDeleteBlockedWarning] = useState<{
    categoryName: string;
    count: number;
  } | null>(null);

  // Form states
  const [formName, setFormName] = useState<string>('');
  const [formSlug, setFormSlug] = useState<string>('');
  const [formTagline, setFormTagline] = useState<string>('');
  const [formImage, setFormImage] = useState<string>('');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);

  // Fetch categories
  const fetchCategories = useCallback(async (isBg = false) => {
    if (isBg) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await adminService.getCategories({ search: search.trim() });
      if (res.success && Array.isArray(res.data)) {
        setCategories(res.data);
      } else {
        setErrorMessage('Failed to load categories list.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to retrieve categories.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Open modal for Create
  const handleOpenCreateModal = () => {
    setEditingCategory(null);
    setFormName('');
    setFormSlug('');
    setFormTagline('');
    setFormImage('https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=700&q=80');
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (cat: AdminCategory) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormSlug(cat.slug || '');
    setFormTagline(cat.tagline || '');
    setFormImage(cat.image || '');
    setFormIsActive(cat.isActive !== undefined ? cat.isActive : true);
    setIsModalOpen(true);
  };

  // Name change auto-slug
  const handleNameChange = (val: string) => {
    setFormName(val);
    if (!editingCategory || !formSlug) {
      const generated = val
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setFormSlug(generated);
    }
  };

  // Handle image upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const res = await adminService.uploadImage(file);
      if (res.success && res.url) {
        setFormImage(res.url);
        showToast('Category image uploaded successfully.', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to upload category image.', 'warning');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Submit create or edit
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formTagline.trim() || !formImage.trim()) {
      showToast('Please fill all required category fields.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCategory) {
        const payload: UpdateCategoryPayload = {
          name: formName.trim(),
          slug: formSlug.trim() || undefined,
          tagline: formTagline.trim(),
          image: formImage.trim(),
          isActive: formIsActive,
        };

        const res = await adminService.updateCategory(
          editingCategory.id || editingCategory._id || editingCategory.slug,
          payload
        );

        if (res.success) {
          showToast(`Category "${res.data.name}" updated successfully.`, 'success');
          setIsModalOpen(false);
          fetchCategories(true);
        }
      } else {
        const payload: CreateCategoryPayload = {
          name: formName.trim(),
          slug: formSlug.trim() || undefined,
          tagline: formTagline.trim(),
          image: formImage.trim(),
          isActive: formIsActive,
        };

        const res = await adminService.createCategory(payload);
        if (res.success) {
          showToast(`Category "${res.data.name}" created successfully.`, 'success');
          setIsModalOpen(false);
          fetchCategories(true);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save category.', 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Safe delete handler with referencing products guard
  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setIsDeleting(true);

    try {
      const id = categoryToDelete.id || categoryToDelete._id || categoryToDelete.slug;
      const res = await adminService.deleteCategory(id);

      if (res.success) {
        showToast(`Category "${categoryToDelete.name}" removed successfully.`, 'success');
        setCategoryToDelete(null);
        fetchCategories(true);
      }
    } catch (err: any) {
      if (err.statusCode === 400 && err.message?.includes('referenced')) {
        // Blocked because cakes reference it
        setCategoryToDelete(null);
        setDeleteBlockedWarning({
          categoryName: categoryToDelete.name,
          count: categoryToDelete.itemCount || 1,
        });
      } else {
        showToast(err.message || 'Failed to remove category.', 'warning');
      }
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
              Menu Collections
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Live CRUD
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#2B1810] mt-1">
            Category Management
          </h1>
          <p className="text-xs sm:text-sm text-[#7E6355] mt-0.5">
            Organize the bakery storefront collections, configure taglines, and monitor product distribution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchCategories(true)}
            disabled={isLoading || isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#FAF3E0] hover:bg-[#F5E8C7] text-[#5C3D28] text-xs font-bold border border-[#E8DDD7] transition-all cursor-pointer shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#C5A059]' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#2B1810] hover:bg-[#3D2314] text-[#FFFDF9] text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 text-[#DFBF77]" />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-bold block">Error:</strong>
            <p className="text-rose-700">{errorMessage}</p>
          </div>
          <button
            onClick={() => fetchCategories()}
            className="underline font-bold text-rose-900 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#E8DDD7] shadow-2xs">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories by name, slug, or tagline..."
            className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] text-xs font-medium text-[#2B1810] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40 focus:border-[#C5A059]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Categories Grid */}
      <div className="bg-white rounded-3xl border border-[#E8DDD7] shadow-2xs p-6 sm:p-8">
        {isLoading ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-10 h-10 border-3 border-[#C5A059] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-[#7E6355]">Loading collections...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-[#FAF3E0] rounded-2xl flex items-center justify-center mx-auto text-[#C5A059]">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-base font-bold text-[#2B1810]">No Categories Found</h3>
            <p className="text-xs text-stone-500">
              {search
                ? 'No collections match your search term. Clear the search to view all.'
                : 'No bakery categories created yet. Click "Add Category" above.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat) => (
              <div
                key={cat.id || cat.slug || cat.name}
                className="bg-[#FFFDF9] rounded-3xl border border-[#E8DDD7] overflow-hidden hover:border-[#C5A059] hover:shadow-lg transition-all duration-300 flex flex-col group"
              >
                {/* Category Header Image */}
                <div className="relative h-44 overflow-hidden bg-stone-100">
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=700&q=80';
                    }}
                  />

                  {/* Badges Overlay */}
                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#2B1810]/85 text-[#FFFDF9] backdrop-blur-xs flex items-center gap-1 shadow-xs">
                      <Cake className="w-3 h-3 text-[#DFBF77]" />
                      <span>{cat.itemCount || 0} Designs</span>
                    </span>

                    {cat.isActive !== false ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500 text-white shadow-xs">
                        Active
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-stone-600 text-white shadow-xs">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#2B1810]">
                      {cat.name}
                    </h3>
                    <p className="text-[11px] font-mono text-[#C5A059] mb-1">
                      /{cat.slug || cat.id}
                    </p>
                    <p className="text-xs text-[#7E6355] line-clamp-2 leading-relaxed">
                      {cat.tagline}
                    </p>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-[#F4EEE8] flex items-center justify-between">
                    <span className="text-[11px] text-stone-400">
                      Collection ID: <span className="font-mono text-[#2B1810]">{cat.id}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEditModal(cat)}
                        className="p-2 rounded-xl bg-[#FAF3E0] hover:bg-[#F5E8C7] text-[#5C3D28] transition-colors cursor-pointer"
                        title="Edit Category"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setCategoryToDelete(cat)}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                        title="Remove Category"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================
          Create / Edit Category Modal
         ======================================================== */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => {
            if (!isSubmitting) setIsModalOpen(false);
          }}
        >
          <div
            className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-[#E8DDD7] p-6 sm:p-7 space-y-5 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#F4EEE8] pb-3">
              <h3 className="font-serif text-xl font-bold text-[#2B1810]">
                {editingCategory ? `Edit Category: ${editingCategory.name}` : 'Create New Collection'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-[#7E6355] uppercase tracking-wider block mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Birthday Cakes, Cheesecake Royale"
                  required
                  className="w-full p-3 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] text-xs font-semibold text-[#2B1810] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40"
                />
              </div>

              <div>
                <label className="font-bold text-[#7E6355] uppercase tracking-wider block mb-1">
                  URL-Friendly Slug *
                </label>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="e.g. birthday-cakes"
                  required
                  className="w-full p-3 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] text-xs font-mono text-[#2B1810]"
                />
              </div>

              <div>
                <label className="font-bold text-[#7E6355] uppercase tracking-wider block mb-1">
                  Tagline / Subheading *
                </label>
                <textarea
                  value={formTagline}
                  onChange={(e) => setFormTagline(e.target.value)}
                  placeholder="Heartfelt romantic expressions in velvet, berries & gold leaf..."
                  rows={2}
                  required
                  className="w-full p-3 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] text-xs font-medium text-[#2B1810]"
                />
              </div>

              <div>
                <label className="font-bold text-[#7E6355] uppercase tracking-wider block mb-1">
                  Cover Photo URL or File Upload *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formImage}
                    onChange={(e) => setFormImage(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    required
                    className="flex-1 p-2.5 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] text-xs font-mono"
                  />

                  <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#FAF3E0] hover:bg-[#F5E8C7] text-[#5C3D28] text-xs font-bold border border-[#E8DDD7] cursor-pointer shrink-0">
                    <Upload className="w-3.5 h-3.5 text-[#C5A059]" />
                    <span>{isUploadingImage ? '...' : 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      onChange={handleFileUpload}
                      disabled={isUploadingImage}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 p-3 rounded-2xl bg-[#FAF3E0]/60 border border-[#E8DDD7] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="rounded text-[#C5A059] focus:ring-[#C5A059]"
                  />
                  <span className="font-bold text-[#2B1810]">
                    Active & Visible in Customer Storefront
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F4EEE8]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-2xl bg-white border border-[#E8DDD7] text-xs font-bold text-[#5C3D28] hover:bg-stone-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 rounded-2xl bg-[#2B1810] hover:bg-[#3D2314] text-white text-xs font-bold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          Delete Category Confirmation Dialog
         ======================================================== */}
      {categoryToDelete && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => {
            if (!isDeleting) setCategoryToDelete(null);
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
                  Confirm Category Removal
                </h3>
                <p className="text-xs text-stone-500 font-mono">
                  {categoryToDelete.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Are you sure you want to remove <strong>&ldquo;{categoryToDelete.name}&rdquo;</strong>?
              Categories with existing products cannot be deleted to prevent orphaning active cakes.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-2xl bg-white border border-[#E8DDD7] text-xs font-bold text-[#5C3D28] hover:bg-stone-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteCategory}
                disabled={isDeleting}
                className="px-5 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          Blocked Delete Safety Warning Modal
         ======================================================== */}
      {deleteBlockedWarning && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setDeleteBlockedWarning(null)}
        >
          <div
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-amber-300 p-6 space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-[#2B1810]">
                  Deletion Blocked by Data Guard
                </h3>
                <p className="text-xs text-stone-500">
                  Referencing Products Detected
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
              Cannot delete <strong>&ldquo;{deleteBlockedWarning.categoryName}&rdquo;</strong> because it is currently linked to <strong>{deleteBlockedWarning.count} active cake creation(s)</strong> in your catalog.
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              To delete this collection, please reassign or delete its associated cakes first. Alternatively, you can edit this category and toggle its status to <strong>Inactive</strong> to hide it from customer navigation without breaking catalog references.
            </p>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setDeleteBlockedWarning(null)}
                className="px-5 py-2 rounded-2xl bg-[#2B1810] text-[#FFFDF9] text-xs font-bold hover:bg-[#3D2314] cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
