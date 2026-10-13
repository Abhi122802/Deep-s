import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  adminService,
  type CreateCakePayload,
  type AdminCategory,
} from '../../services/adminService';
import { useToast } from '../../context/ToastContext';
import {
  ArrowLeft,
  Upload,
  Save,
  AlertCircle,
  X,
  Calculator,
  Eye,
} from 'lucide-react';

export const AdminCakeFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [isLoadingCake, setIsLoadingCake] = useState<boolean>(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Available categories
  const [categories, setCategories] = useState<AdminCategory[]>([]);

  // Form states
  const [name, setName] = useState<string>('');
  const [slug, setSlug] = useState<string>('');
  const [category, setCategory] = useState<string>('Birthday');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [basePrice, setBasePrice] = useState<number>(799);
  const [weightPrices, setWeightPrices] = useState<{
    '0.5 kg': number;
    '1 kg': number;
    '1.5 kg': number;
    '2 kg': number;
  }>({
    '0.5 kg': 799,
    '1 kg': 1499,
    '1.5 kg': 2199,
    '2 kg': 2899,
  });
  const [isEggless, setIsEggless] = useState<boolean>(true);
  const [image, setImage] = useState<string>(
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=700&q=80'
  );
  const [secondaryImages, setSecondaryImages] = useState<string[]>([]);
  const [newSecondaryImage, setNewSecondaryImage] = useState<string>('');
  const [flavor, setFlavor] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [ingredientsText, setIngredientsText] = useState<string>('');
  const [dietaryTagsText, setDietaryTagsText] = useState<string>('100% Eggless, Vegetarian');
  const [preparationTimeHours, setPreparationTimeHours] = useState<number>(2);
  const [isBestSeller, setIsBestSeller] = useState<boolean>(false);
  const [isFeatured, setIsFeatured] = useState<boolean>(false);
  const [isAvailable, setIsAvailable] = useState<boolean>(true);

  // Load categories
  useEffect(() => {
    adminService.getCategories().then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setCategories(res.data);
      }
    }).catch(() => {});
  }, []);

  // Load existing cake in edit mode
  useEffect(() => {
    if (isEditMode && id) {
      setIsLoadingCake(true);
      adminService
        .getCakeById(id)
        .then((res) => {
          if (res.success && res.data) {
            const cake = res.data;
            setName(cake.name);
            setSlug(cake.slug);
            setCategory(cake.category);
            setBasePrice(cake.basePrice);
            setWeightPrices({
              '0.5 kg': cake.weightPrices?.['0.5 kg'] || cake.basePrice,
              '1 kg': cake.weightPrices?.['1 kg'] || Math.round(cake.basePrice * 1.85),
              '1.5 kg': cake.weightPrices?.['1.5 kg'] || Math.round(cake.basePrice * 2.7),
              '2 kg': cake.weightPrices?.['2 kg'] || Math.round(cake.basePrice * 3.5),
            });
            setIsEggless(cake.isEggless);
            setImage(cake.image);
            setSecondaryImages(cake.secondaryImages || []);
            setFlavor(cake.flavor);
            setDescription(cake.description);
            setIngredientsText(cake.ingredients?.join(', ') || '');
            setDietaryTagsText(cake.dietaryTags?.join(', ') || '');
            setPreparationTimeHours(cake.preparationTimeHours || 2);
            setIsBestSeller(Boolean(cake.isBestSeller));
            setIsFeatured(Boolean(cake.isFeatured));
            setIsAvailable(cake.isAvailable !== undefined ? cake.isAvailable : true);
          } else {
            setErrorMessage('Could not load cake data for editing.');
          }
        })
        .catch((err) => {
          setErrorMessage(err.message || 'Failed to load cake.');
        })
        .finally(() => {
          setIsLoadingCake(false);
        });
    }
  }, [isEditMode, id]);

  // Auto-generate slug when name changes (in create mode or if slug empty)
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEditMode || !slug) {
      const generated = val
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setSlug(generated);
    }
  };

  // Helper: auto calculate standard tiered weight prices from basePrice
  const autoCalculateWeightPrices = (base: number) => {
    setBasePrice(base);
    setWeightPrices({
      '0.5 kg': base,
      '1 kg': Math.round((base * 1.85) / 10) * 10 - 1, // e.g. 799 -> 1479 -> 1499 roundings
      '1.5 kg': Math.round((base * 2.7) / 10) * 10 - 1,
      '2 kg': Math.round((base * 3.5) / 10) * 10 - 1,
    });
  };

  // Handle local file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const res = await adminService.uploadImage(file);
      if (res.success && res.url) {
        setImage(res.url);
        showToast('Image uploaded and processed successfully.', 'success');
      } else {
        showToast(res.message || 'Image upload failed.', 'warning');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to upload image.', 'warning');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Add secondary image
  const handleAddSecondaryImage = () => {
    if (!newSecondaryImage.trim()) return;
    setSecondaryImages([...secondaryImages, newSecondaryImage.trim()]);
    setNewSecondaryImage('');
  };

  // Remove secondary image
  const handleRemoveSecondaryImage = (idx: number) => {
    setSecondaryImages(secondaryImages.filter((_, i) => i !== idx));
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Please provide a cake title.');
      return;
    }
    if (!flavor.trim()) {
      setErrorMessage('Please provide a flavor profile description.');
      return;
    }
    if (!image.trim()) {
      setErrorMessage('A main product image is required.');
      return;
    }

    const resolvedCategory = category === 'custom' ? customCategory.trim() : category;
    if (!resolvedCategory) {
      setErrorMessage('Please select or specify a category.');
      return;
    }

    const payload: CreateCakePayload = {
      name: name.trim(),
      slug: slug.trim() || undefined,
      category: resolvedCategory,
      basePrice: Number(basePrice),
      weightPrices: {
        '0.5 kg': Number(weightPrices['0.5 kg']),
        '1 kg': Number(weightPrices['1 kg']),
        '1.5 kg': Number(weightPrices['1.5 kg']),
        '2 kg': Number(weightPrices['2 kg']),
      },
      isEggless,
      image: image.trim(),
      secondaryImages,
      flavor: flavor.trim(),
      description: description.trim() || `${name.trim()} - handcrafted artisanal bakery creation.`,
      ingredients: ingredientsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      dietaryTags: dietaryTagsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      preparationTimeHours: Number(preparationTimeHours) || 2,
      isBestSeller,
      isFeatured,
      isAvailable,
    };

    setIsSubmitting(true);
    try {
      if (isEditMode && id) {
        const res = await adminService.updateCake(id, payload);
        if (res.success) {
          showToast(`"${res.data.name}" has been updated successfully.`, 'success');
          navigate('/admin/cakes');
        } else {
          setErrorMessage(res.message || 'Failed to update cake.');
        }
      } else {
        const res = await adminService.createCake(payload);
        if (res.success) {
          showToast(`"${res.data.name}" has been created and added to the catalog!`, 'success');
          navigate('/admin/cakes');
        } else {
          setErrorMessage(res.message || 'Failed to create cake.');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while saving the cake.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingCake) {
    return (
      <div className="p-16 text-center space-y-4">
        <div className="w-10 h-10 border-3 border-[#C5A059] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-bold text-[#7E6355]">Loading cake details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#E8DDD7] shadow-2xs">
        <div className="flex items-center gap-4">
          <Link
            to="/admin/cakes"
            className="p-2 rounded-2xl bg-[#FAF3E0] hover:bg-[#F5E8C7] text-[#5C3D28] transition-colors"
            title="Back to Cakes list"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#C5A059]">
              {isEditMode ? 'Catalog Editor' : 'New Creation'}
            </span>
            <h1 className="font-serif text-2xl font-bold text-[#2B1810]">
              {isEditMode ? `Edit Cake: ${name || 'Product'}` : 'Add New Cake Creation'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/cakes')}
            className="px-4 py-2.5 rounded-2xl bg-white border border-[#E8DDD7] text-xs font-bold text-[#5C3D28] hover:bg-stone-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="cake-form"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#2B1810] hover:bg-[#3D2314] text-[#FFFDF9] text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-[#DFBF77]" />
            <span>{isSubmitting ? 'Saving Cake...' : isEditMode ? 'Update Cake' : 'Publish Cake'}</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-bold block">Validation Error:</strong>
            <p className="text-rose-700">{errorMessage}</p>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Form and Preview Layout */}
      <form id="cake-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form Fields */}
        <div className="lg:col-span-8 space-y-6">
          {/* Section 1: Basic Information */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-[#E8DDD7] shadow-2xs space-y-4">
            <h3 className="font-serif text-lg font-bold text-[#2B1810] border-b border-[#F4EEE8] pb-3">
              1. Cake Identity & Flavor Profile
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-[#7E6355] uppercase tracking-wider block mb-1">
                  Cake Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Belgian Truffle Opera Cake"
                  required
                  className="w-full p-3 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] text-xs font-medium text-[#2B1810] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-[#7E6355] uppercase tracking-wider block mb-1">
                    URL Slug
                  </label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="e.g. belgian-truffle-opera-cake"
                    className="w-full p-3 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] text-xs font-mono text-[#2B1810] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40"
                  />
                  <span className="text-[10px] text-stone-400 mt-1 block">
                    Auto-generated lowercase identifier used in links.
                  </span>
                </div>

                <div>
                  <label className="font-bold text-[#7E6355] uppercase tracking-wider block mb-1">
                    Bakery Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-3 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] text-xs font-semibold text-[#2B1810] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40"
                  >
                    {categories.map((c) => (
                      <option key={c.id || c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    <option value="custom">+ Specify Other Category...</option>
                  </select>

                  {category === 'custom' && (
                    <input
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="Enter custom category name"
                      className="w-full mt-2 p-2.5 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] text-xs font-medium"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="font-bold text-[#7E6355] uppercase tracking-wider block mb-1">
                  Flavor Profile *
                </label>
                <input
                  type="text"
                  value={flavor}
                  onChange={(e) => setFlavor(e.target.value)}
                  placeholder="e.g. 70% Dark Belgian Couverture with Dutch Cocoa Ganache"
                  required
                  className="w-full p-3 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] text-xs font-medium text-[#2B1810] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40"
                />
              </div>

              <div>
                <label className="font-bold text-[#7E6355] uppercase tracking-wider block mb-1">
                  Detailed Description *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the layers, textures, and artisanal inspiration for customer browsing..."
                  rows={4}
                  required
                  className="w-full p-3 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] text-xs font-medium text-[#2B1810] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40 leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Weight Variants & Prices */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-[#E8DDD7] shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#F4EEE8] pb-3">
              <h3 className="font-serif text-lg font-bold text-[#2B1810]">
                2. Weight Variants & Prices (₹ INR)
              </h3>
              <button
                type="button"
                onClick={() => autoCalculateWeightPrices(basePrice)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF3E0] hover:bg-[#F5E8C7] text-[#5C3D28] text-xs font-bold border border-[#E8DDD7] transition-colors"
                title="Auto-calculate higher weights from base price"
              >
                <Calculator className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Auto Tier Multipliers</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-[#2B1810] block">0.5 kg (Base) *</label>
                <input
                  type="number"
                  value={basePrice}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setBasePrice(val);
                    setWeightPrices((prev) => ({ ...prev, '0.5 kg': val }));
                  }}
                  min={0}
                  required
                  className="w-full p-2.5 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] font-mono font-bold text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#2B1810] block">1 kg Price *</label>
                <input
                  type="number"
                  value={weightPrices['1 kg']}
                  onChange={(e) =>
                    setWeightPrices((prev) => ({ ...prev, '1 kg': Number(e.target.value) }))
                  }
                  min={0}
                  required
                  className="w-full p-2.5 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] font-mono font-bold text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#2B1810] block">1.5 kg Price *</label>
                <input
                  type="number"
                  value={weightPrices['1.5 kg']}
                  onChange={(e) =>
                    setWeightPrices((prev) => ({ ...prev, '1.5 kg': Number(e.target.value) }))
                  }
                  min={0}
                  required
                  className="w-full p-2.5 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] font-mono font-bold text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#2B1810] block">2 kg Price *</label>
                <input
                  type="number"
                  value={weightPrices['2 kg']}
                  onChange={(e) =>
                    setWeightPrices((prev) => ({ ...prev, '2 kg': Number(e.target.value) }))
                  }
                  min={0}
                  required
                  className="w-full p-2.5 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] font-mono font-bold text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Imagery & Photography */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-[#E8DDD7] shadow-2xs space-y-4">
            <h3 className="font-serif text-lg font-bold text-[#2B1810] border-b border-[#F4EEE8] pb-3">
              3. Imagery & Photography
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-[#7E6355] uppercase tracking-wider block mb-1">
                  Main Cake Photograph URL or File Upload *
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    placeholder="https://images.unsplash.com/... or /uploads/..."
                    required
                    className="flex-1 p-3 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] text-xs font-mono"
                  />

                  <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#FAF3E0] hover:bg-[#F5E8C7] text-[#5C3D28] text-xs font-bold border border-[#E8DDD7] transition-colors cursor-pointer shrink-0">
                    <Upload className="w-4 h-4 text-[#C5A059]" />
                    <span>{isUploadingImage ? 'Uploading...' : 'Upload Image File'}</span>
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

              {/* Secondary Images List */}
              <div>
                <label className="font-bold text-[#7E6355] uppercase tracking-wider block mb-1">
                  Additional Gallery Images (Optional)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newSecondaryImage}
                    onChange={(e) => setNewSecondaryImage(e.target.value)}
                    placeholder="Enter secondary image URL..."
                    className="flex-1 p-2.5 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddSecondaryImage}
                    className="px-4 py-2 rounded-2xl bg-[#2B1810] text-[#FFFDF9] text-xs font-bold cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                {secondaryImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {secondaryImages.map((img, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 border border-stone-200 text-[11px]"
                      >
                        <span className="truncate max-w-[160px] font-mono">{img}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSecondaryImage(i)}
                          className="text-stone-400 hover:text-rose-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Specifications, Ingredients & Attributes */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-[#E8DDD7] shadow-2xs space-y-4">
            <h3 className="font-serif text-lg font-bold text-[#2B1810] border-b border-[#F4EEE8] pb-3">
              4. Bakery Specifications & Attributes
            </h3>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-[#7E6355] uppercase tracking-wider block mb-1">
                    Ingredients (Comma Separated)
                  </label>
                  <input
                    type="text"
                    value={ingredientsText}
                    onChange={(e) => setIngredientsText(e.target.value)}
                    placeholder="e.g. Belgian Dark Chocolate, Organic Flour, Butter"
                    className="w-full p-3 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#7E6355] uppercase tracking-wider block mb-1">
                    Dietary Tags (Comma Separated)
                  </label>
                  <input
                    type="text"
                    value={dietaryTagsText}
                    onChange={(e) => setDietaryTagsText(e.target.value)}
                    placeholder="e.g. 100% Eggless, Vegetarian, Nut-Free"
                    className="w-full p-3 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] text-xs font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#7E6355] uppercase tracking-wider block mb-1">
                  Preparation Time (Hours)
                </label>
                <input
                  type="number"
                  value={preparationTimeHours}
                  onChange={(e) => setPreparationTimeHours(Number(e.target.value))}
                  min={1}
                  max={48}
                  className="w-32 p-2.5 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] font-mono text-xs font-bold"
                />
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#F4EEE8]">
                <label className="flex items-center gap-2 p-3 rounded-2xl bg-[#FAF3E0]/60 border border-[#E8DDD7] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isEggless}
                    onChange={(e) => setIsEggless(e.target.checked)}
                    className="rounded text-[#C5A059] focus:ring-[#C5A059]"
                  />
                  <span className="font-bold text-[#2B1810]">100% Eggless</span>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-2xl bg-[#FAF3E0]/60 border border-[#E8DDD7] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isBestSeller}
                    onChange={(e) => setIsBestSeller(e.target.checked)}
                    className="rounded text-[#C5A059] focus:ring-[#C5A059]"
                  />
                  <span className="font-bold text-[#2B1810]">Bestseller Badge</span>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-2xl bg-[#FAF3E0]/60 border border-[#E8DDD7] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="rounded text-[#C5A059] focus:ring-[#C5A059]"
                  />
                  <span className="font-bold text-[#2B1810]">Featured in Hero</span>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAvailable}
                    onChange={(e) => setIsAvailable(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-bold text-emerald-900">Live / Available</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Storefront Card Preview */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-[#E8DDD7] shadow-2xs space-y-4 sticky top-24">
            <div className="flex items-center justify-between border-b border-[#F4EEE8] pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C5A059] flex items-center gap-1.5">
                <Eye className="w-4 h-4" />
                <span>Customer Card Preview</span>
              </span>
              <span className="text-[10px] text-stone-400">Live Simulation</span>
            </div>

            {/* Cake Card Preview */}
            <div className="rounded-3xl overflow-hidden border border-[#E8DDD7] bg-[#FFFDF9] shadow-md group">
              <div className="relative aspect-square overflow-hidden bg-stone-100">
                <img
                  src={image}
                  alt={name || 'Cake Preview'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80';
                  }}
                />

                {/* Badges */}
                <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                  {isEggless && (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/95 text-emerald-800 shadow-xs backdrop-blur-xs">
                      100% Eggless
                    </span>
                  )}
                  {isBestSeller && (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#C5A059] text-[#2B1810] shadow-xs">
                      Bestseller
                    </span>
                  )}
                </div>

                {!isAvailable && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center">
                    <span className="px-4 py-1.5 rounded-full bg-rose-600 text-white font-bold text-xs uppercase tracking-wider">
                      Currently Unavailable
                    </span>
                  </div>
                )}
              </div>

              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-[#7E6355]">
                  <span className="font-semibold uppercase tracking-wider">
                    {category === 'custom' ? customCategory || 'Custom' : category}
                  </span>
                  <span className="font-bold text-[#C5A059]">★ 4.9 (New)</span>
                </div>

                <h4 className="font-serif text-base font-bold text-[#2B1810] line-clamp-1">
                  {name || 'Cake Name Here'}
                </h4>

                <p className="text-xs text-[#7E6355] line-clamp-2 leading-relaxed">
                  {flavor || description || 'Delicious flavor profile description will display here...'}
                </p>

                <div className="pt-2 border-t border-[#F4EEE8] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-stone-400 block -mb-0.5">Starting from (0.5 kg)</span>
                    <span className="font-mono text-base font-bold text-[#2B1810]">
                      ₹{basePrice?.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <span className="px-3 py-1 rounded-full bg-[#FAF3E0] text-[#5C3D28] text-xs font-bold">
                    View Cake
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-stone-400 text-center leading-relaxed">
              Updates saved here immediately propagate to customer catalog searches and category collections.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
};
