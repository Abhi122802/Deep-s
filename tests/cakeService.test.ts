import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { cakeService, normalizeCake } from '../src/services/cakeService.js';
import { api, ApiError } from '../src/services/api.js';
import { DEMO_CAKES } from '../src/data/cakes.js';

describe("Storefront Dynamic Catalog & cakeService Test Suite", () => {
  let origGet: typeof api.get;

  beforeEach(() => {
    origGet = api.get;
  });

  afterEach(() => {
    api.get = origGet;
  });

  describe('1. normalizeCake', () => {
    it('normalizes MongoDB document with _id into id', () => {
      const raw = {
        _id: '6720f1234567890abcdef123',
        name: 'Pistachio Saffron Cake',
        basePrice: 899,
        category: 'Designer',
      };
      const normalized = normalizeCake(raw);
      assert.equal(normalized.id, '6720f1234567890abcdef123');
      assert.equal(normalized.basePrice, 899);
      assert.ok(normalized.weightPrices['0.5 kg'] === 899);
      assert.ok(normalized.weightPrices['1 kg'] > 899);
      assert.equal(normalized.isAvailable, true);
    });

    it('preserves existing id and isAvailable: false flag', () => {
      const raw = {
        id: 'cake-custom-01',
        name: 'Lotus Biscoff Dream',
        basePrice: 950,
        isAvailable: false,
      };
      const normalized = normalizeCake(raw);
      assert.equal(normalized.id, 'cake-custom-01');
      assert.equal(normalized.isAvailable, false);
    });
  });

  describe('2. cakeService.getCatalogResponse (Dynamic Fetching & Error vs Empty)', () => {
    it('returns dynamic cakes with isFallback=false on successful backend response', async () => {
      const dynamicCakes = [
        {
          id: 'cake-live-01',
          name: 'Fresh Mango Cream Cake',
          slug: 'fresh-mango-cream-cake',
          category: 'Birthday',
          basePrice: 850,
          weightPrices: { '0.5 kg': 850, '1 kg': 1600, '1.5 kg': 2350, '2 kg': 3100 },
          isEggless: true,
          image: 'https://images.unsplash.com/mango.jpg',
          rating: 4.9,
          reviewsCount: 15,
          description: 'Juicy Alphonso mango chunks and velvety chantilly cream',
          flavor: 'Alphonso Mango',
          ingredients: ['Alphonso Mango', 'Fresh Cream'],
          preparationTimeHours: 2,
          isAvailable: true,
        },
      ];

      api.get = async () => ({ success: true, data: dynamicCakes as any });

      const res = await cakeService.getCatalogResponse();
      assert.equal(res.isFallback, false);
      assert.equal(res.error, null);
      assert.equal(res.cakes.length, 1);
      assert.equal(res.cakes[0].name, 'Fresh Mango Cream Cake');
      assert.equal(res.cakes[0].id, 'cake-live-01');
    });

    it('clearly distinguishes an empty catalog response from a failure (does NOT fallback to DEMO_CAKES)', async () => {
      // Backend returned valid empty array
      api.get = async () => ({ success: true, data: [] });

      const res = await cakeService.getCatalogResponse();
      assert.equal(res.isFallback, false, 'Must NOT be marked as fallback when backend successfully returns empty list');
      assert.equal(res.error, null, 'Error must be null for valid empty catalog');
      assert.deepEqual(res.cakes, [], 'Cakes must be an empty array, NOT DEMO_CAKES');
    });

    it('falls back to DEMO_CAKES and sets isFallback=true when API throws a network error', async () => {
      api.get = async () => {
        throw new ApiError('Failed to fetch: Connection refused', 500);
      };

      const res = await cakeService.getCatalogResponse();
      assert.equal(res.isFallback, true, 'Must fall back on genuine network failure');
      assert.ok(res.error !== null, 'Must report user-friendly error string');
      assert.ok(res.cakes.length >= 10, 'Must provide full fallback catalog');
      assert.equal(res.cakes[0].name, DEMO_CAKES[0].name);
    });

    it('applies client-side filtering to fallback catalog on network failure', async () => {
      api.get = async () => {
        throw new Error('Network offline');
      };

      const res = await cakeService.getCatalogResponse({ category: 'Chocolate', eggPreference: 'eggless' });
      assert.equal(res.isFallback, true);
      assert.ok(res.cakes.length > 0);
      for (const c of res.cakes) {
        assert.equal(c.category, 'Chocolate');
        assert.equal(c.isEggless, true);
      }
    });
  });

  describe('3. cakeService.getCakes convenience wrapper', () => {
    it('returns dynamic cakes when backend is online', async () => {
      api.get = async () => ({
        success: true,
        data: [{ id: 'dynamic-1', name: 'Caramel Macchiato Cake', basePrice: 799 } as any],
      });

      const cakes = await cakeService.getCakes();
      assert.equal(cakes.length, 1);
      assert.equal(cakes[0].name, 'Caramel Macchiato Cake');
    });

    it('returns empty array when backend has zero matching cakes', async () => {
      api.get = async () => ({ success: true, data: [] });

      const cakes = await cakeService.getCakes({ search: 'non-existent-flavor' });
      assert.deepEqual(cakes, []);
    });
  });

  describe('4. cakeService.getCakeById', () => {
    it('returns cake data when cake exists in backend', async () => {
      api.get = async (endpoint: string) => {
        if (endpoint === 'cakes/belgian-truffle-opera-cake') {
          return {
            success: true,
            data: {
              _id: '6720f9999999999abcdef001',
              name: 'Belgian Truffle Opera Cake',
              slug: 'belgian-truffle-opera-cake',
              basePrice: 799,
              isAvailable: true,
            } as any,
          };
        }
        throw new ApiError('Not Found', 404);
      };

      const cake = await cakeService.getCakeById('belgian-truffle-opera-cake');
      assert.ok(cake);
      assert.equal(cake?.id, '6720f9999999999abcdef001');
      assert.equal(cake?.name, 'Belgian Truffle Opera Cake');
    });

    it('returns undefined for 404 (does NOT resurrect deleted cakes with fallback)', async () => {
      api.get = async () => {
        throw new ApiError('Cake product with identifier "deleted-cake-id" was not found.', 404);
      };

      const cake = await cakeService.getCakeById('deleted-cake-id');
      assert.equal(cake, undefined, 'A 404 Not Found must return undefined, not resurrect from static DEMO_CAKES');
    });

    it('falls back to static demo cake only on genuine network failure', async () => {
      api.get = async () => {
        throw new ApiError('Network timeout', 408);
      };

      const cake = await cakeService.getCakeById('cake-01');
      assert.ok(cake);
      assert.equal(cake?.id, 'cake-01');
      assert.equal(cake?.name, 'Belgian Truffle Opera Cake');
    });
  });

  describe('5. cakeService.getFeaturedCakes and getBestSellers', () => {
    it('returns live featured cakes from backend', async () => {
      api.get = async () => ({
        success: true,
        data: [{ id: 'feat-1', name: 'Signature Tiramisu Cake', isFeatured: true, basePrice: 999 } as any],
      });

      const featured = await cakeService.getFeaturedCakes();
      assert.equal(featured.length, 1);
      assert.equal(featured[0].id, 'feat-1');
      assert.equal(featured[0].name, 'Signature Tiramisu Cake');
    });

    it('falls back gracefully to static featured cakes on network failure', async () => {
      api.get = async () => {
        throw new Error('Connection refused');
      };

      const featured = await cakeService.getFeaturedCakes();
      assert.ok(featured.length > 0);
      assert.ok(featured.every((c) => c.isFeatured));
    });

    it('returns live best seller cakes from backend', async () => {
      api.get = async () => ({
        success: true,
        data: [{ id: 'best-1', name: 'Signature Black Forest Cake', isBestSeller: true, basePrice: 799 } as any],
      });

      const bestsellers = await cakeService.getBestSellers();
      assert.equal(bestsellers.length, 1);
      assert.equal(bestsellers[0].id, 'best-1');
      assert.equal(bestsellers[0].name, 'Signature Black Forest Cake');
    });
  });

  describe('6. Admin-Managed Dynamic Catalog Propagation', () => {
    it('propagates admin-added cake to storefront catalog', async () => {
      const adminCreatedCake = {
        id: 'cake-admin-new-42',
        name: 'Zesty Blueberry Lemon Gateau',
        slug: 'zesty-blueberry-lemon-gateau',
        category: 'Birthday',
        basePrice: 899,
        weightPrices: { '0.5 kg': 899, '1 kg': 1699, '1.5 kg': 2499, '2 kg': 3299 },
        isEggless: true,
        image: 'https://images.unsplash.com/blueberry.jpg',
        rating: 5.0,
        reviewsCount: 1,
        description: 'Meyer lemon sponge layered with slow-cooked wild blueberry compote',
        flavor: 'Wild Blueberry & Meyer Lemon',
        ingredients: ['Wild Blueberries', 'Meyer Lemon', 'Pure Butter'],
        isBestSeller: false,
        isFeatured: true,
        preparationTimeHours: 2,
        dietaryTags: ['100% Eggless', 'Handcrafted'],
        isAvailable: true,
      };

      api.get = async (endpoint: string) => {
        if (endpoint === 'cakes') {
          return { success: true, data: [adminCreatedCake as any] };
        }
        if (endpoint === 'cakes/zesty-blueberry-lemon-gateau' || endpoint === 'cakes/cake-admin-new-42') {
          return { success: true, data: adminCreatedCake as any };
        }
        throw new ApiError('Not found', 404);
      };

      // Catalog page fetch
      const catalog = await cakeService.getCakes();
      assert.equal(catalog.length, 1);
      assert.equal(catalog[0].id, 'cake-admin-new-42');
      assert.equal(catalog[0].name, 'Zesty Blueberry Lemon Gateau');

      // Product detail fetch
      const detail = await cakeService.getCakeById('zesty-blueberry-lemon-gateau');
      assert.ok(detail);
      assert.equal(detail?.id, 'cake-admin-new-42');
      assert.equal(detail?.basePrice, 899);
      assert.equal(detail?.isAvailable, true);
    });

    it('correctly handles unavailable admin-managed cakes', async () => {
      const unavailableCake = {
        id: 'cake-admin-unavail',
        name: 'Seasonal Mango Mousse Cake',
        slug: 'seasonal-mango-mousse-cake',
        category: 'Designer',
        basePrice: 999,
        isAvailable: false,
      };

      api.get = async () => ({ success: true, data: [unavailableCake as any] });

      const catalog = await cakeService.getCakes();
      assert.equal(catalog.length, 1);
      assert.equal(catalog[0].isAvailable, false);
    });
  });
});
