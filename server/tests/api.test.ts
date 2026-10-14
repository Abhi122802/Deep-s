import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';

describe('Deep’s Cake Shop — Phase 2 Backend API Test Suite', () => {
  describe('1. Health Check Endpoint', () => {
    it('GET /api/health returns 503 and degraded payload when database is disconnected', async () => {
      const origState = mongoose.connection.readyState;
      Object.defineProperty(mongoose.connection, 'readyState', { value: 0, configurable: true });
      try {
        const res = await request(app).get('/api/health');
        assert.equal(res.status, 503);
        assert.equal(res.body.status, 'degraded');
        assert.equal(res.body.database, 'disconnected');
        assert.equal(res.body.service, "Deep's Cake Shop API");
        assert.ok(typeof res.body.uptimeSeconds === 'number');
        assert.equal(res.body.version, '2.0.0');
      } finally {
        Object.defineProperty(mongoose.connection, 'readyState', { value: origState, configurable: true });
      }
    });

    it('GET /api/health returns 200 and healthy service payload when database is connected', async () => {
      const origState = mongoose.connection.readyState;
      Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
      try {
        const res = await request(app).get('/api/health');
        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'ok');
        assert.equal(res.body.database, 'connected');
        assert.equal(res.body.service, "Deep's Cake Shop API");
        assert.ok(typeof res.body.uptimeSeconds === 'number');
        assert.equal(res.body.version, '2.0.0');
      } finally {
        Object.defineProperty(mongoose.connection, 'readyState', { value: origState, configurable: true });
      }
    });
  });

  describe('2. Cake Catalog Endpoints', () => {
    it('GET /api/cakes returns 200 and product list', async () => {
      const res = await request(app).get('/api/cakes');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length >= 12, 'Catalog must contain at least 12 demo cakes');
    });

    it('GET /api/cakes with search filter returns matching cakes', async () => {
      const res = await request(app).get('/api/cakes?search=truffle');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.length > 0);
      const firstCake = res.body.data[0];
      const matchesSearch =
        firstCake.name.toLowerCase().includes('truffle') ||
        firstCake.flavor.toLowerCase().includes('truffle') ||
        firstCake.description.toLowerCase().includes('truffle');
      assert.ok(matchesSearch, 'Returned cake must match the search query');
    });

    it('GET /api/cakes/:id retrieves a cake by slug or ID', async () => {
      const res = await request(app).get('/api/cakes/belgian-truffle-opera-cake');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.slug, 'belgian-truffle-opera-cake');
      assert.ok(res.body.data.weightPrices['0.5 kg'] > 0);
    });

    it('GET /api/cakes/:id returns 404 for non-existent cake', async () => {
      const res = await request(app).get('/api/cakes/non-existent-space-cake-999');
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });
  });

  describe('3. Category Endpoints', () => {
    it('GET /api/categories returns 7 bakery collections', async () => {
      const res = await request(app).get('/api/categories');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.equal(res.body.data.length, 7);
    });
  });

  describe('4. Custom Cake Inquiries Endpoint & Validation', () => {
    it('POST /api/custom-cakes rejects incomplete payload', async () => {
      const res = await request(app).post('/api/custom-cakes').send({
        // Missing name and phone
        flavor: 'Belgian Truffle',
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Request validation failed');
    });

    it('POST /api/custom-cakes accepts valid inquiry and returns unique reference ID', async () => {
      const res = await request(app).post('/api/custom-cakes').send({
        customerName: 'Ananya Sharma',
        phone: '9876543210',
        email: 'ananya@example.com',
        occasion: 'Birthday Celebration',
        flavor: 'Belgian Dark Chocolate Truffle (70%)',
        weight: '1 kg',
        tierCount: '1 Tier',
        isEggless: true,
        messageOnCake: 'Happy 21st Ananya!',
        preferredDate: '2026-12-25',
        deliveryTimeSlot: '3:00 PM – 6:00 PM',
        specialInstructions: 'Please add gold sprinkles on top.',
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.inquiryId.startsWith('INQ-'));
      assert.equal(res.body.data.estimatedPrice, 1500); // 1 kg base quote
    });
  });

  describe('5. Customer Orders & Server-Side Price Calculation', () => {
    it('POST /api/orders rejects empty items list', async () => {
      const res = await request(app).post('/api/orders').send({
        customer: {
          name: 'Rahul Verma',
          phone: '9876543210',
          email: 'rahul@example.com',
        },
        items: [],
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('POST /api/orders correctly computes server-side price, coupon discount, and delivery', async () => {
      // Belgian Truffle Opera Cake: 0.5 kg is ₹799
      // Adding 1 unit with coupon SWEET10 (10% off)
      // Subtotal = 799
      // Discount = 80 (10% of 799 rounded)
      // Delivery fee = 0 (since subtotal >= 799)
      // Grand total = 799 - 80 + 0 = 719
      const res = await request(app).post('/api/orders').send({
        customer: {
          name: 'Rahul Verma',
          phone: '9876543210',
          email: 'rahul@example.com',
          address: '402, Heritage Palms, MG Road',
        },
        items: [
          {
            cakeId: 'belgian-truffle-opera-cake',
            selectedWeight: '0.5 kg',
            quantity: 1,
            customMessage: 'Happy Birthday Rahul!',
          },
        ],
        couponCode: 'SWEET10',
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.orderId.startsWith('ORD-'));
      assert.equal(res.body.data.subtotal, 799);
      assert.equal(res.body.data.discountAmount, 80);
      assert.equal(res.body.data.deliveryFee, 0); // Free above 799
      assert.equal(res.body.data.grandTotal, 719);
      assert.equal(res.body.data.status, 'Pending');
      assert.equal(res.body.data.paymentStatus, 'Unpaid');
    });

    it('POST /api/orders charges delivery fee for subtotal under ₹799', async () => {
      // Black Forest Royale: 0.5 kg is ₹699
      // Subtotal = 699 (< 799) => delivery fee = 99
      // Grand total = 699 + 99 = 798
      const res = await request(app).post('/api/orders').send({
        customer: {
          name: 'Karan Mehra',
          phone: '9876543210',
          email: 'karan@example.com',
        },
        items: [
          {
            cakeId: 'black-forest-royale-kirsch-cake',
            selectedWeight: '0.5 kg',
            quantity: 1,
          },
        ],
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.subtotal, 699);
      assert.equal(res.body.data.deliveryFee, 99);
      assert.equal(res.body.data.grandTotal, 798);
    });
  });

  describe('6. Admin Authentication & Session Handling', () => {
    it('POST /api/auth/login rejects invalid administrative credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        usernameOrEmail: 'fake_admin',
        password: 'wrong_password_123',
      });
      // 401 or 503 if DB is offline, both indicate rejection
      assert.ok([401, 503].includes(res.status));
      assert.equal(res.body.success, false);
    });

    it('POST /api/auth/logout clears admin session cookie', async () => {
      const res = await request(app).post('/api/auth/logout');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.message, 'Admin logged out successfully.');
    });
  });

  describe('7. Protected Admin Dashboard Endpoints', () => {
    it('GET /api/admin/stats rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/admin/stats');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('Authentication required'));
    });

    it('GET /api/admin/stats rejects invalid or forged JWT with 403', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', 'Bearer invalid.forged.jwttoken');
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('Invalid or expired'));
    });

    it('GET /api/admin/stats succeeds with valid Bearer token and returns dashboard stats', async () => {
      const { env } = await import('../src/config/env.js');
      const jwt = (await import('jsonwebtoken')).default;

      const validToken = jwt.sign(
        {
          id: 'test-admin-id-12345',
          username: 'admin',
          role: 'superadmin',
        },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${validToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.stats);

      // Verify order counts and byStatus structure
      assert.ok(typeof res.body.stats.orders.total === 'number');
      assert.ok(typeof res.body.stats.orders.byStatus.Pending === 'number');
      assert.ok(typeof res.body.stats.orders.byStatus.Delivered === 'number');
      assert.ok(typeof res.body.stats.orders.byStatus.Cancelled === 'number');
      assert.ok(Array.isArray(res.body.stats.orders.recentOrders));

      // Verify revenue structure
      assert.ok(typeof res.body.stats.revenue.total === 'number');
      assert.ok(typeof res.body.stats.revenue.delivered === 'number');
      assert.ok(typeof res.body.stats.revenue.eligibleOrdersCount === 'number');
      assert.equal(res.body.stats.revenue.currency, 'INR');

      // Verify catalog and inquiries structure
      assert.ok(typeof res.body.stats.catalog.totalCakes === 'number');
      assert.ok(typeof res.body.stats.inquiries.total === 'number');
      assert.ok(typeof res.body.stats.inquiries.byStatus.pending === 'number');

      // Verify security alert presence for default admin
      assert.equal(res.body.stats.security.adminUsername, 'admin');
      assert.equal(res.body.stats.security.isDefaultCredentials, true);
      assert.ok(res.body.stats.security.warningMessage);
    });

    it('GET /api/admin/stats succeeds with valid HttpOnly cookie auth', async () => {
      const { env } = await import('../src/config/env.js');
      const jwt = (await import('jsonwebtoken')).default;

      const validToken = jwt.sign(
        {
          id: 'test-admin-id-cookie',
          username: 'bakery_manager',
          role: 'bakery_manager',
        },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/admin/stats')
        .set('Cookie', [`admin_token=${validToken}`]);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.stats.security.adminUsername, 'bakery_manager');
      assert.equal(res.body.stats.security.isDefaultCredentials, false);
    });
  });

  describe('8. Admin Order Management Endpoints', () => {
    let adminToken: string;

    it('sets up valid admin credentials token for test suite', async () => {
      const { env } = await import('../src/config/env.js');
      const jwt = (await import('jsonwebtoken')).default;

      adminToken = jwt.sign(
        {
          id: 'test-admin-orders',
          username: 'admin',
          role: 'superadmin',
        },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      assert.ok(adminToken);
    });

    it('GET /api/admin/orders rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/admin/orders');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('GET /api/admin/orders/:id rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/admin/orders/ORD-781920');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('PATCH /api/admin/orders/:id/status rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .patch('/api/admin/orders/ORD-781920/status')
        .send({ status: 'Confirmed' });
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('GET /api/admin/orders returns paginated orders with metadata', async () => {
      const res = await request(app)
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.pagination);
      assert.equal(res.body.pagination.page, 1);
      assert.ok(res.body.pagination.totalOrders > 0);
      assert.ok(Array.isArray(res.body.data));
    });

    it('GET /api/admin/orders filters by status', async () => {
      const res = await request(app)
        .get('/api/admin/orders?status=Baking')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.every((o: any) => o.status === 'Baking'));
    });

    it('GET /api/admin/orders searches by customer name or order ID', async () => {
      const res = await request(app)
        .get('/api/admin/orders?search=Rohan')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.length > 0);
      assert.ok(res.body.data[0].customer.name.includes('Rohan'));
    });

    it('GET /api/admin/orders paginates and respects page limit bounds', async () => {
      const res = await request(app)
        .get('/api/admin/orders?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 2);
      assert.equal(res.body.pagination.limit, 2);
      assert.ok(res.body.pagination.totalPages >= 2);
      assert.equal(res.body.pagination.hasNextPage, true);
      assert.equal(res.body.pagination.hasPrevPage, false);
    });

    it('GET /api/admin/orders/:id retrieves an order with full line items and delivery info', async () => {
      const res = await request(app)
        .get('/api/admin/orders/ORD-781920')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.orderId, 'ORD-781920');
      assert.equal(res.body.data.customer.name, 'Ananya Sharma');
      assert.ok(res.body.data.items.length > 0);
      assert.ok(res.body.data.items[0].selectedWeight);
      assert.equal(res.body.data.grandTotal, 1349);
      assert.equal(res.body.data.paymentStatus, 'Unpaid');
    });

    it('GET /api/admin/orders/:id returns 404 for nonexistent order', async () => {
      const res = await request(app)
        .get('/api/admin/orders/ORD-999999')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('not found'));
    });

    it('GET /api/admin/orders/:id returns 400 for malformed order identifier', async () => {
      const res = await request(app)
        .get('/api/admin/orders/invalid!@#id')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('Invalid order identifier format'));
    });

    it('PATCH /api/admin/orders/:id/status updates fulfillment status and preserves payment/pricing integrity', async () => {
      // Order ORD-781920 starts as 'Pending' with paymentStatus 'Unpaid'
      const res = await request(app)
        .patch('/api/admin/orders/ORD-781920/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Confirmed' });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'Confirmed');

      // CRITICAL INTEGRITY CHECK: payment status and prices MUST NOT change
      assert.equal(res.body.data.paymentStatus, 'Unpaid');
      assert.equal(res.body.data.subtotal, 1499);
      assert.equal(res.body.data.discountAmount, 150);
      assert.equal(res.body.data.deliveryFee, 0);
      assert.equal(res.body.data.grandTotal, 1349);
    });

    it('PATCH /api/admin/orders/:id/status executes subsequent valid transition (Confirmed -> Baking)', async () => {
      const res = await request(app)
        .patch('/api/admin/orders/ORD-781920/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Baking' });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'Baking');
      assert.equal(res.body.data.paymentStatus, 'Unpaid');
    });

    it('PATCH /api/admin/orders/:id/status rejects invalid transition (Baking -> Delivered)', async () => {
      // From Baking, only 'Out for Delivery' or 'Cancelled' is permitted
      const res = await request(app)
        .patch('/api/admin/orders/ORD-781920/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Delivered' });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('Invalid status transition'));
    });

    it('PATCH /api/admin/orders/:id/status rejects transitioning to the identical current status', async () => {
      // Order is currently in 'Baking'
      const res = await request(app)
        .patch('/api/admin/orders/ORD-781920/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Baking' });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('already in "Baking" status'));
    });

    it('PATCH /api/admin/orders/:id/status rejects modifying a Delivered order (terminal status)', async () => {
      // ORD-781924 is in 'Delivered' status
      const res = await request(app)
        .patch('/api/admin/orders/ORD-781924/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Pending' });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('terminal'));
    });

    it('PATCH /api/admin/orders/:id/status rejects modifying a Cancelled order (terminal status)', async () => {
      // ORD-781925 is in 'Cancelled' status
      const res = await request(app)
        .patch('/api/admin/orders/ORD-781925/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Confirmed' });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('terminal'));
    });
  });

  describe('9. Admin Cake Catalog CRUD Endpoints', () => {
    let adminToken: string;
    let createdCakeId: string;
    const testCakeSlug = `test-lotus-biscoff-cake-${Date.now()}`;

    it('sets up admin auth token for cake catalog test suite', async () => {
      const { env } = await import('../src/config/env.js');
      const jwt = (await import('jsonwebtoken')).default;
      adminToken = jwt.sign(
        { id: 'admin-cake-test', username: 'admin', role: 'superadmin' },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      assert.ok(adminToken);
    });

    it('GET /api/admin/cakes rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/admin/cakes');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('POST /api/admin/cakes rejects unauthenticated requests with 401', async () => {
      const res = await request(app).post('/api/admin/cakes').send({ name: 'Unauth Cake' });
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('POST /api/admin/cakes rejects invalid payloads with 400', async () => {
      const res = await request(app)
        .post('/api/admin/cakes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '',
          basePrice: -100, // Invalid negative price
        });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.errors);
    });

    it('POST /api/admin/cakes creates a new cake with generated slug and safe default rating', async () => {
      const newCakePayload = {
        name: 'Lotus Biscoff Dream Cake',
        slug: testCakeSlug,
        category: 'Designer',
        basePrice: 899,
        weightPrices: {
          '0.5 kg': 899,
          '1 kg': 1699,
          '1.5 kg': 2499,
          '2 kg': 3199,
        },
        isEggless: true,
        image: 'https://images.unsplash.com/photo-1542826438-bd32f43d626f?auto=format&fit=crop&w=700&q=80',
        description: 'Luxurious spiced caramel Biscoff spread swirled between fluffy vanilla layers.',
        flavor: 'Lotus Biscoff Caramel',
        ingredients: ['Lotus Biscoff Spread', 'Organic Flour', 'Butter', 'Madagascar Vanilla'],
        isBestSeller: true,
        isFeatured: false,
        preparationTimeHours: 3,
        dietaryTags: ['100% Vegetarian', 'Eggless'],
        isAvailable: true,
        rating: 1.0, // Untrusted client rating must be ignored
        reviewsCount: 999, // Untrusted client review count must be reset
      };

      const res = await request(app)
        .post('/api/admin/cakes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newCakePayload);

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.name, 'Lotus Biscoff Dream Cake');
      assert.equal(res.body.data.slug, testCakeSlug);
      assert.equal(res.body.data.reviewsCount, 0, 'New cake reviewsCount must start at 0');
      assert.ok(res.body.data.rating >= 4.5, 'Default rating must be set by server');
      createdCakeId = res.body.data._id || res.body.data.id;
    });

    it('POST /api/admin/cakes rejects duplicate slug with 409 Conflict', async () => {
      const duplicatePayload = {
        name: 'Lotus Biscoff Clone',
        slug: testCakeSlug, // Duplicate slug
        category: 'Designer',
        basePrice: 899,
        weightPrices: {
          '0.5 kg': 899,
          '1 kg': 1699,
          '1.5 kg': 2499,
          '2 kg': 3199,
        },
        image: 'https://images.unsplash.com/photo-1542826438-bd32f43d626f',
        description: 'Duplicate cake test description.',
        flavor: 'Caramel',
      };

      const res = await request(app)
        .post('/api/admin/cakes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(duplicatePayload);

      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('already exists'));
    });

    it('GET /api/admin/cakes returns paginated catalog list with search and filters', async () => {
      const res = await request(app)
        .get('/api/admin/cakes?search=Biscoff&category=Designer&page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.pagination);
      assert.ok(res.body.data.length >= 1);
      assert.ok(res.body.data.some((c: any) => c.slug === testCakeSlug));
    });

    it('GET /api/admin/cakes/:id retrieves single cake by ID or slug', async () => {
      const res = await request(app)
        .get(`/api/admin/cakes/${testCakeSlug}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.name, 'Lotus Biscoff Dream Cake');
    });

    it('GET /api/admin/cakes/:id returns 404 for nonexistent cake', async () => {
      const res = await request(app)
        .get('/api/admin/cakes/nonexistent-cake-xyz-999')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });

    it('PUT /api/admin/cakes/:id updates cake and preserves existing image if not provided', async () => {
      const res = await request(app)
        .put(`/api/admin/cakes/${createdCakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          basePrice: 949,
          flavor: 'Lotus Speculoos Caramel Royale',
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.basePrice, 949);
      assert.equal(res.body.data.flavor, 'Lotus Speculoos Caramel Royale');
      assert.ok(res.body.data.image, 'Image must be preserved when not updated');
    });

    it('PATCH /api/admin/cakes/:id/availability toggles cake availability', async () => {
      const res = await request(app)
        .patch(`/api/admin/cakes/${createdCakeId}/availability`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isAvailable: false });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.isAvailable, false);
    });

    it('DELETE /api/admin/cakes/:id soft-deactivates if referenced by orders', async () => {
      // belgian-truffle-opera-cake is referenced in MEMORY_ORDERS ORD-781920
      const res = await request(app)
        .delete('/api/admin/cakes/belgian-truffle-opera-cake')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.isSoftDeleted, true, 'Referenced cake must be soft-deactivated');
    });
  });

  describe('10. Admin Category Management CRUD Endpoints', () => {
    let adminToken: string;
    let createdCategoryId: string;
    const testCatSlug = `test-macaron-cakes-${Date.now()}`;
    const testCatName = `Macaron Gateaux ${Date.now()}`;

    it('sets up admin auth token for category management tests', async () => {
      const { env } = await import('../src/config/env.js');
      const jwt = (await import('jsonwebtoken')).default;
      adminToken = jwt.sign(
        { id: 'admin-cat-test', username: 'admin', role: 'superadmin' },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      assert.ok(adminToken);
    });

    it('GET /api/admin/categories rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/admin/categories');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('POST /api/admin/categories rejects invalid payloads with 400', async () => {
      const res = await request(app)
        .post('/api/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '' });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('POST /api/admin/categories creates a new category with generated slug', async () => {
      const res = await request(app)
        .post('/api/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: testCatName,
          slug: testCatSlug,
          tagline: 'Artisanal cakes crowned with crisp French almond macarons',
          image: 'https://images.unsplash.com/photo-1542826438-bd32f43d626f?auto=format&fit=crop&w=700&q=80',
          isActive: true,
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.name, testCatName);
      assert.equal(res.body.data.slug, testCatSlug);
      createdCategoryId = res.body.data._id || res.body.data.id;
    });

    it('POST /api/admin/categories rejects duplicate category name or slug with 409', async () => {
      const res = await request(app)
        .post('/api/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: testCatName,
          slug: testCatSlug,
          tagline: 'Duplicate category test',
          image: 'https://images.unsplash.com/photo-1542826438-bd32f43d626f',
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('already exists'));
    });

    it('GET /api/admin/categories returns categories with product counts', async () => {
      const res = await request(app)
        .get('/api/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.some((c: any) => c.name === testCatName));
      assert.ok(typeof res.body.data[0].itemCount === 'number');
    });

    it('GET /api/admin/categories/:id retrieves single category by id or slug', async () => {
      const res = await request(app)
        .get(`/api/admin/categories/${testCatSlug}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.name, testCatName);
    });

    it('PUT /api/admin/categories/:id updates category details', async () => {
      const res = await request(app)
        .put(`/api/admin/categories/${createdCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          tagline: 'Updated luxury French macaron cake towers',
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.tagline, 'Updated luxury French macaron cake towers');
    });

    it('DELETE /api/admin/categories/:id prevents unsafe deletion when cakes reference it', async () => {
      // 'Chocolate' category has multiple demo cakes referencing it
      const res = await request(app)
        .delete('/api/admin/categories/Chocolate')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('Cannot delete category'));
    });

    it('DELETE /api/admin/categories/:id successfully removes category with zero referencing cakes', async () => {
      const res = await request(app)
        .delete(`/api/admin/categories/${createdCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.message.includes('successfully removed'));
    });
  });

  describe('11. Admin Image Upload Endpoint', () => {
    let adminToken: string;

    it('sets up admin auth token for image upload tests', async () => {
      const { env } = await import('../src/config/env.js');
      const jwt = (await import('jsonwebtoken')).default;
      adminToken = jwt.sign(
        { id: 'admin-upload-test', username: 'admin', role: 'superadmin' },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      assert.ok(adminToken);
    });

    it('POST /api/admin/upload rejects unauthenticated requests with 401', async () => {
      const res = await request(app).post('/api/admin/upload');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('POST /api/admin/upload rejects requests without image file with 400', async () => {
      const res = await request(app)
        .post('/api/admin/upload')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('POST /api/admin/upload rejects invalid file extensions/mimes with 400', async () => {
      const textBuffer = Buffer.from('This is a test plain text file.');
      const res = await request(app)
        .post('/api/admin/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', textBuffer, 'malicious.txt');

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('Invalid file format'));
    });

    it('POST /api/admin/upload accepts valid image buffer and returns URL and publicId', async () => {
      // 1x1 transparent PNG buffer
      const pngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      const res = await request(app)
        .post('/api/admin/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', pngBuffer, 'test-cake.png');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.url);
      assert.ok(res.body.publicId);
    });
  });

  describe('12. Admin Custom Cake Inquiry Management Endpoints', () => {
    let adminToken: string;

    it('sets up admin auth token for inquiry management tests', async () => {
      const { env } = await import('../src/config/env.js');
      const jwt = (await import('jsonwebtoken')).default;
      adminToken = jwt.sign(
        { id: 'admin-inquiry-test', username: 'admin', role: 'superadmin' },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      assert.ok(adminToken);
    });

    it('GET /api/admin/inquiries rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/admin/inquiries');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('GET /api/admin/inquiries/:id rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/admin/inquiries/INQ-781920');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('PATCH /api/admin/inquiries/:id/status rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .patch('/api/admin/inquiries/INQ-781920/status')
        .send({ status: 'reviewed' });
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('GET /api/admin/inquiries returns paginated inquiries with metadata', async () => {
      const res = await request(app)
        .get('/api/admin/inquiries')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length > 0);
      assert.ok(res.body.pagination);
      assert.equal(res.body.pagination.page, 1);
    });

    it('GET /api/admin/inquiries filters by status', async () => {
      const res = await request(app)
        .get('/api/admin/inquiries?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      for (const inq of res.body.data) {
        assert.equal(inq.status, 'pending');
      }
    });

    it('GET /api/admin/inquiries searches by customer name or reference ID', async () => {
      const res = await request(app)
        .get('/api/admin/inquiries?search=Ananya')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.some((inq: any) => inq.customerName.includes('Ananya')));
    });

    it('GET /api/admin/inquiries paginates and respects page limit bounds', async () => {
      const res = await request(app)
        .get('/api/admin/inquiries?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.length <= 2);
      assert.equal(res.body.pagination.limit, 2);
    });

    it('GET /api/admin/inquiries/:id retrieves an inquiry with full customer requirements', async () => {
      const res = await request(app)
        .get('/api/admin/inquiries/INQ-781920')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.referenceId, 'INQ-781920');
      assert.equal(res.body.data.customerName, 'Ananya Sharma');
      assert.ok(res.body.data.flavor);
      assert.ok(res.body.data.tierCount);
      assert.ok(res.body.data.preferredDate);
    });

    it('GET /api/admin/inquiries/:id returns 404 for nonexistent inquiry', async () => {
      const res = await request(app)
        .get('/api/admin/inquiries/INQ-999999')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });

    it('GET /api/admin/inquiries/:id returns 400 for malformed inquiry identifier', async () => {
      const res = await request(app)
        .get('/api/admin/inquiries/invalid_id!@#$')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('PATCH /api/admin/inquiries/:id/status updates status from pending to reviewed', async () => {
      const res = await request(app)
        .patch('/api/admin/inquiries/INQ-781920/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'reviewed',
          internalNotes: 'Confirmed chef availability for requested date.',
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'reviewed');
      assert.ok(res.body.data.reviewedAt);
      assert.equal(res.body.data.internalNotes, 'Confirmed chef availability for requested date.');
      // Customer requirements must be preserved
      assert.equal(res.body.data.customerName, 'Ananya Sharma');
      assert.equal(res.body.data.flavor, 'Belgian Chocolate Truffle with Hazelnut Praline');
    });

    it('PATCH /api/admin/inquiries/:id/status transitions from reviewed to quoted with validated quotation', async () => {
      const res = await request(app)
        .patch('/api/admin/inquiries/INQ-781920/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'quoted',
          quotedAmount: 3850,
          quoteCurrency: 'INR',
          quoteValidityDays: 14,
          quoteNotes: 'Includes sugar roses, silver luster dust, and temperature-controlled carriage.',
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'quoted');
      assert.equal(res.body.data.quotedAmount, 3850);
      assert.equal(res.body.data.quoteCurrency, 'INR');
      assert.ok(res.body.data.quotedAt);
      assert.ok(res.body.data.quoteValidUntil);
    });

    it('PATCH /api/admin/inquiries/:id/status rejects transitioning to quoted without a positive quote amount (400)', async () => {
      const res = await request(app)
        .patch('/api/admin/inquiries/INQ-452109/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'quoted',
          quotedAmount: -100,
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('PATCH /api/admin/inquiries/:id/status rejects transitioning to the identical current status (400)', async () => {
      const res = await request(app)
        .patch('/api/admin/inquiries/INQ-781920/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'quoted',
          quotedAmount: 3850,
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('already in "quoted" status'));
    });

    it('PATCH /api/admin/inquiries/:id/status rejects invalid transitions (e.g. cancelled -> pending) (400)', async () => {
      const res = await request(app)
        .patch('/api/admin/inquiries/INQ-654321/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'pending',
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('Invalid status transition'));
    });

    it('PATCH /api/admin/inquiries/:id/status confirms inquiry while preserving customer requirements', async () => {
      const res = await request(app)
        .patch('/api/admin/inquiries/INQ-781920/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'confirmed',
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'confirmed');
      assert.ok(res.body.data.confirmedAt);
      // Customer specs strictly preserved
      assert.equal(res.body.data.customerName, 'Ananya Sharma');
      assert.equal(res.body.data.weight, '2 kg');
    });

    it('verifies confirming an inquiry does not automatically create an order in OrderModel', async () => {
      const ordersRes = await request(app)
        .get('/api/admin/orders?search=INQ-781920')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(ordersRes.status, 200);
      // Inquiries must remain distinct from orders unless an explicit conversion workflow is run
      assert.equal(ordersRes.body.data.length, 0);
    });
  });

  describe('13. Customer Notification Foundation', () => {
    let adminToken: string;

    it('sets up admin auth token for notification auditing tests', async () => {
      const { env } = await import('../src/config/env.js');
      const jwt = (await import('jsonwebtoken')).default;
      adminToken = jwt.sign(
        { id: 'admin-notif-test', username: 'admin', role: 'superadmin' },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      assert.ok(adminToken);
    });

    it('renderOrderPlacedTemplate generates complete receipts for email and messaging', async () => {
      const { renderOrderPlacedTemplate } = await import('../src/notifications/templates/orderPlaced.template.js');

      const data = {
        orderId: 'ORD-991122',
        customerName: 'Priya Patel',
        items: [
          {
            cakeName: 'Belgian Truffle Opera Cake',
            selectedWeight: '1 kg',
            quantity: 2,
            unitPrice: 1499,
            lineTotal: 2998,
            customMessage: 'Happy 1st Anniversary',
          },
        ],
        subtotal: 2998,
        discountAmount: 299,
        couponCode: 'SWEET10',
        deliveryFee: 0,
        grandTotal: 2699,
        deliveryAddress: 'Flat 101, Sea View Apts, Bandra, Mumbai 400050',
      };

      const emailRender = renderOrderPlacedTemplate(data, 'email');
      assert.ok(emailRender.subject.includes('ORD-991122'));
      assert.ok(emailRender.message.includes('Priya Patel'));
      assert.ok(emailRender.message.includes('Belgian Truffle Opera Cake'));
      assert.ok(emailRender.message.includes('₹2,699'));
      assert.ok(emailRender.message.includes('SWEET10'));

      const whatsappRender = renderOrderPlacedTemplate(data, 'whatsapp');
      assert.ok(whatsappRender.message.includes('*Order Summary:*'));
      assert.ok(whatsappRender.message.includes('ORD-991122'));
    });

    it('renderOrderStatusTemplate generates rich contextual messages for various stages', async () => {
      const { renderOrderStatusTemplate } = await import('../src/notifications/templates/orderStatus.template.js');

      const confirmedRender = renderOrderStatusTemplate({
        orderId: 'ORD-991122',
        customerName: 'Priya Patel',
        newStatus: 'Confirmed',
      });
      assert.ok(confirmedRender.subject.includes('Confirmed'));
      assert.ok(confirmedRender.message.includes('accepted your order'));

      const bakingRender = renderOrderStatusTemplate({
        orderId: 'ORD-991122',
        customerName: 'Priya Patel',
        newStatus: 'Baking',
      });
      assert.ok(bakingRender.subject.includes('Baking'));
      assert.ok(bakingRender.message.includes('whisking and layering'));

      const outRender = renderOrderStatusTemplate({
        orderId: 'ORD-991122',
        customerName: 'Priya Patel',
        newStatus: 'Out for Delivery',
      });
      assert.ok(outRender.subject.includes('Out for Delivery'));
      assert.ok(outRender.message.includes('on the way'));
    });

    it('renderInquiryQuotationTemplate generates compliant quotation proposal', async () => {
      const { renderInquiryQuotationTemplate } = await import('../src/notifications/templates/inquiryQuotation.template.js');

      const quoteData = {
        referenceId: 'INQ-554433',
        customerName: 'Rahul Verma',
        occasion: 'Superhero 5th Birthday',
        flavor: 'Dark Chocolate Ganache',
        weight: '2 kg',
        tierCount: '2 Tiers',
        isEggless: true,
        preferredDate: '2026-11-25',
        deliveryTimeSlot: '12:00 PM – 3:00 PM',
        quotedAmount: 3400,
        quoteCurrency: 'INR',
        quoteValidityDays: 14,
        quoteNotes: 'Includes fondant superhero mask topper and edible sparkle stars.',
      };

      const quoteRender = renderInquiryQuotationTemplate(quoteData, 'email');
      assert.ok(quoteRender.subject.includes('INQ-554433'));
      assert.ok(quoteRender.message.includes('Rahul Verma'));
      assert.ok(quoteRender.message.includes('₹3,400 INR'));
      assert.ok(quoteRender.message.includes('14 days'));
      assert.ok(quoteRender.message.includes('does not automatically confirm an order'));
    });

    it('sanitizeLogDetails redacts passwords, JWTs, and bearer tokens from logs', async () => {
      const { sanitizeLogDetails } = await import('../src/notifications/sanitize.js');

      const sampleJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyJ9.abcdef1234567890';
      const rawText = `Failed auth with Bearer ${sampleJwt} and password='supersecretpass123' at mongodb+srv://user:pass123@cluster.net`;
      const sanitized = sanitizeLogDetails(rawText);

      assert.ok(!sanitized.includes('supersecretpass123'));
      assert.ok(!sanitized.includes(sampleJwt));
      assert.ok(!sanitized.includes('pass123@cluster.net'));
      assert.ok(sanitized.includes('[REDACTED'));
    });

    it('dispatches notification and records delivery log in mock provider', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const mockProvider = notificationService.getMockProvider();
      mockProvider.clear();

      const uniqueKey = `test-dispatch-${Date.now()}`;
      const result = await notificationService.dispatch({
        channel: 'email',
        eventType: 'order_placed',
        recipient: 'test.customer@example.com',
        subject: 'Order Test Receipt',
        message: 'Your order has been recorded.',
        idempotencyKey: uniqueKey,
      });

      assert.equal(result.status, 'delivered');
      assert.equal(result.attempts, 1);
      assert.ok(result.notificationId);

      const sentRecords = mockProvider.getSentRecords();
      assert.ok(sentRecords.some((r) => r.payload.idempotencyKey === uniqueKey));
    });

    it('prevents duplicate sends using idempotency key', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const mockProvider = notificationService.getMockProvider();
      mockProvider.clear();

      const uniqueKey = `test-idempotency-${Date.now()}`;
      const firstResult = await notificationService.dispatch({
        channel: 'email',
        eventType: 'order_placed',
        recipient: 'idempotent@example.com',
        subject: 'Test Subject',
        message: 'First attempt message',
        idempotencyKey: uniqueKey,
      });

      assert.equal(firstResult.status, 'delivered');
      const initialCount = mockProvider.getSentRecords().length;

      // Duplicate dispatch attempt with identical key
      const secondResult = await notificationService.dispatch({
        channel: 'email',
        eventType: 'order_placed',
        recipient: 'idempotent@example.com',
        subject: 'Test Subject',
        message: 'Second attempt message',
        idempotencyKey: uniqueKey,
      });

      assert.equal(secondResult.status, 'delivered');
      assert.ok(secondResult.skippedReason?.includes('Duplicate send prevented'));
      // Provider send count should not have increased
      assert.equal(mockProvider.getSentRecords().length, initialCount);
    });

    it('handles retryable provider failure with bounded retries and succeeds', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const mockProvider = notificationService.getMockProvider();
      mockProvider.clear();

      // Configure 2 simulated transient failures before succeeding on 3rd attempt
      mockProvider.setFailureSimulation(2, true, 'Transient gateway timeout');

      const uniqueKey = `test-retry-success-${Date.now()}`;
      const result = await notificationService.dispatch({
        channel: 'email',
        eventType: 'order_status_updated',
        recipient: 'retry.test@example.com',
        subject: 'Retry Test',
        message: 'Status update message',
        idempotencyKey: uniqueKey,
        maxAttempts: 3,
      });

      assert.equal(result.status, 'delivered');
      assert.equal(result.attempts, 3);
    });

    it('marks deliveryStatus as failed when failure exceeds maxAttempts', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const mockProvider = notificationService.getMockProvider();
      mockProvider.clear();

      // Configure 5 failures when maxAttempts is 3
      mockProvider.setFailureSimulation(5, true, 'Persistent server unreachable');

      const uniqueKey = `test-retry-exhausted-${Date.now()}`;
      const result = await notificationService.dispatch({
        channel: 'email',
        eventType: 'order_status_updated',
        recipient: 'exhausted@example.com',
        subject: 'Exhausted Retry Test',
        message: 'Status update message',
        idempotencyKey: uniqueKey,
        maxAttempts: 3,
      });

      assert.equal(result.status, 'failed');
      assert.equal(result.attempts, 3);
      assert.ok(result.error?.includes('Persistent server unreachable'));
    });

    it('skips notification when customer explicitly declined channel consent', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const mockProvider = notificationService.getMockProvider();
      mockProvider.clear();

      const uniqueKey = `test-consent-declined-${Date.now()}`;
      const result = await notificationService.dispatch({
        channel: 'email',
        eventType: 'order_placed',
        recipient: 'optout@example.com',
        subject: 'Opted Out Test',
        message: 'Should not be sent',
        idempotencyKey: uniqueKey,
        customerConsent: { email: false },
      });

      assert.equal(result.status, 'skipped');
      assert.ok(result.skippedReason?.includes('explicitly declined'));
      assert.equal(mockProvider.getSentRecords().length, 0);
    });

    it('skips notification when recipient email or phone format is invalid', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');

      const invalidEmailResult = await notificationService.dispatch({
        channel: 'email',
        eventType: 'order_placed',
        recipient: 'not-an-email',
        subject: 'Invalid Test',
        message: 'Invalid email test',
        idempotencyKey: `test-invalid-email-${Date.now()}`,
      });
      assert.equal(invalidEmailResult.status, 'skipped');
      assert.ok(invalidEmailResult.skippedReason?.includes('Invalid email'));

      const invalidPhoneResult = await notificationService.dispatch({
        channel: 'whatsapp',
        eventType: 'order_placed',
        recipient: '123', // < 10 digits
        subject: 'Invalid Phone Test',
        message: 'Invalid phone test',
        idempotencyKey: `test-invalid-phone-${Date.now()}`,
      });
      assert.equal(invalidPhoneResult.status, 'skipped');
      assert.ok(invalidPhoneResult.skippedReason?.includes('Invalid phone'));
    });

    it('does not block order placement when notification provider fails', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const mockProvider = notificationService.getMockProvider();
      // Configure failure
      mockProvider.setFailureSimulation(5, true, 'Complete provider blackout');

      const res = await request(app)
        .post('/api/orders')
        .send({
          customer: {
            name: 'Rohit Deshmukh',
            phone: '9890123456',
            email: 'rohit.deshmukh@example.com',
            address: '101, Palm Court, Pune 411001',
          },
          items: [
            {
              cakeId: 'belgian-truffle-opera-cake',
              selectedWeight: '1 kg',
              quantity: 1,
            },
          ],
        });

      // Order placement MUST succeed 201 regardless of notification provider failure!
      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.orderId);

      // Reset mock provider after test
      mockProvider.clear();
    });

    it('GET /api/admin/notifications rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/admin/notifications');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('GET /api/admin/notifications returns notification logs for authenticated admin', async () => {
      const res = await request(app)
        .get('/api/admin/notifications')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });
  });

  describe('14. Phase 4 Milestone 2 Delivery Readiness Verification', () => {
    let adminToken: string;

    it('sets up admin auth token for delivery readiness tests', async () => {
      const jwt = (await import('jsonwebtoken')).default;
      const { env } = await import('../src/config/env.js');
      adminToken = jwt.sign(
        { id: 'admin-notif-m2-test', username: 'admin', role: 'superadmin' },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      assert.ok(adminToken);
    });

    it('validates safe configuration and flags missing credentials in production mode', async () => {
      const { validateNotificationConfig } = await import('../src/config/env.js');

      // Valid mock configuration (default)
      const mockConfig: any = {
        NOTIFICATION_MODE: 'mock',
        NOTIFICATION_EMAIL_PROVIDER: 'mock',
        NOTIFICATION_MESSAGING_PROVIDER: 'mock',
      };
      const validCheck = validateNotificationConfig(mockConfig);
      assert.equal(validCheck.valid, true);
      assert.equal(validCheck.errors.length, 0);

      // Invalid production configuration missing SendGrid API key
      const badProdConfig: any = {
        NOTIFICATION_MODE: 'production',
        NOTIFICATION_EMAIL_PROVIDER: 'sendgrid',
        NOTIFICATION_MESSAGING_PROVIDER: 'mock',
        SENDGRID_API_KEY: '',
      };
      const invalidCheck = validateNotificationConfig(badProdConfig);
      assert.equal(invalidCheck.valid, false);
      assert.ok(invalidCheck.errors.some((e: string) => e.includes('SENDGRID_API_KEY is required')));
    });

    it('guarantees mock mode as active default with zero real external calls', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const activeProvider = notificationService.getActiveProvider();

      assert.equal(activeProvider.name, 'mock');
      assert.ok(activeProvider instanceof (await import('../src/notifications/providers/mockProvider.js')).DevMockNotificationProvider);
    });

    it('handles concurrent duplicate dispatches using idempotency locking', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const mockProvider = notificationService.getMockProvider();
      mockProvider.clear();

      const sharedKey = `concurrent-test-${Date.now()}`;
      const payload = {
        channel: 'email' as const,
        eventType: 'order_placed' as const,
        recipient: 'concurrent@example.com',
        subject: 'Concurrent Test',
        message: 'Concurrent message delivery',
        idempotencyKey: sharedKey,
      };

      // Dispatch two identical requests concurrently
      const [res1, res2] = await Promise.all([
        notificationService.dispatch(payload),
        notificationService.dispatch(payload),
      ]);

      // Exactly one should be delivered or claimed, and provider should only record at most 1 send
      const deliveredCount = [res1, res2].filter((r) => r.status === 'delivered').length;
      assert.ok(deliveredCount >= 1, 'At least one dispatch must succeed');
      assert.ok(mockProvider.getSentRecords().length <= 1, 'Provider must not send duplicate external messages');
    });

    it('persists notification logs with unique idempotencyKey in database or sandbox', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const { NotificationLogModel } = await import('../src/models/NotificationLog.js');
      const { isDbConnected } = await import('../src/config/db.js');

      const uniqueKey = `persist-check-${Date.now()}`;
      await notificationService.dispatch({
        channel: 'email',
        eventType: 'order_status_updated',
        recipient: 'persist.check@example.com',
        subject: 'Persistence Verification',
        message: 'Testing audit log persistence',
        idempotencyKey: uniqueKey,
      });

      if (isDbConnected()) {
        const found = await NotificationLogModel.findOne({ idempotencyKey: uniqueKey }).lean();
        assert.ok(found, 'Log must be found in MongoDB database');
        assert.equal(found.recipient, 'persist.check@example.com');
      } else {
        const logs = await notificationService.getLogs({ search: uniqueKey });
        assert.ok(logs.length >= 1, 'Log must be found in fallback audit log');
      }
    });

    it('recovers stuck sending logs after process crash or timeout threshold', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const stuckKey = `stuck-sending-test-${Date.now()}`;

      // Simulate a crashed process log by manually saving a record stuck in 'sending' with old timestamp
      await notificationService.saveNotificationLog({
        notificationId: `NOTIF-STUCK-${Date.now()}`,
        idempotencyKey: stuckKey,
        channel: 'email',
        eventType: 'order_placed',
        recipient: 'stuck.user@example.com',
        provider: 'mock',
        deliveryStatus: 'sending',
        attempts: 1,
        maxAttempts: 3,
        queuedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        updatedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
      });

      // Run recovery with 5-minute threshold
      const recovered = await notificationService.recoverStuckSendingLogs(5 * 60 * 1000);
      assert.ok(recovered >= 1, 'Must recover at least 1 stuck log');

      // Check that the recovered log is now 'failed' with timeout notice
      const log = await notificationService.checkIdempotency(stuckKey);
      assert.equal(log?.deliveryStatus, 'failed');
      assert.ok(log?.sanitizedError?.includes('timed out') || log?.sanitizedError?.includes('terminated'));
    });

    it('enforces strict opt-in consent for WhatsApp/SMS messaging channels', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const mockProvider = notificationService.getMockProvider();
      mockProvider.clear();

      // Dispatch WhatsApp without consent -> MUST be skipped
      const noConsentResult = await notificationService.dispatch({
        channel: 'whatsapp',
        eventType: 'order_status_updated',
        recipient: '9876543210',
        subject: 'WhatsApp Update',
        message: 'Your cake is ready',
        idempotencyKey: `whatsapp-no-consent-${Date.now()}`,
      });

      assert.equal(noConsentResult.status, 'skipped');
      assert.ok(noConsentResult.skippedReason?.includes('not opted in'));

      // Dispatch WhatsApp WITH explicit consent -> MUST succeed
      const withConsentResult = await notificationService.dispatch({
        channel: 'whatsapp',
        eventType: 'order_status_updated',
        recipient: '9876543210',
        subject: 'WhatsApp Update',
        message: 'Your cake is ready',
        idempotencyKey: `whatsapp-with-consent-${Date.now()}`,
        customerConsent: { whatsapp: true },
      });

      assert.equal(withConsentResult.status, 'delivered');
    });

    it('prohibits silent in-memory fallback when production database write fails', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const { env } = await import('../src/config/env.js');

      // Temporarily switch NODE_ENV to production for strict assertion
      const originalEnv = env.NODE_ENV;
      (env as any).NODE_ENV = 'production';

      try {
        // Intentionally invalid log data or broken DB simulation in production should throw or reject
        const { isDbConnected } = await import('../src/config/db.js');
        if (!isDbConnected()) {
          await assert.rejects(
            async () => {
              await notificationService.saveNotificationLog({
                notificationId: 'NOTIF-PROD-FAIL',
                idempotencyKey: 'prod-fail-test',
                channel: 'email',
                eventType: 'order_placed',
                recipient: 'test@example.com',
                provider: 'mock',
                deliveryStatus: 'delivered',
              });
            },
            /Production notification log persistence failure/,
            'Production must reject silent in-memory fallback when DB is disconnected'
          );
        }
      } finally {
        (env as any).NODE_ENV = originalEnv;
      }
    });

    it('GET /api/admin/notifications supports pagination parameters with metadata', async () => {
      const res = await request(app)
        .get('/api/admin/notifications?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.pagination);
      assert.equal(res.body.pagination.page, 1);
      assert.equal(res.body.pagination.limit, 5);
      assert.ok(typeof res.body.pagination.total === 'number');
      assert.ok(typeof res.body.pagination.totalPages === 'number');
    });

    it('GET /api/admin/notifications supports filtering by channel, eventType, and status', async () => {
      const res = await request(app)
        .get('/api/admin/notifications?channel=email&eventType=order_placed&deliveryStatus=delivered&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      for (const item of res.body.data) {
        assert.equal(item.channel, 'email');
        assert.equal(item.eventType, 'order_placed');
        assert.equal(item.deliveryStatus, 'delivered');
      }
    });
  });

  describe('15. Phase 4 Milestone 2 Targeted Security Remediation & Reliability Hardening', () => {
    let adminToken: string;

    it('sets up admin auth token for remediation verification', async () => {
      const jwt = (await import('jsonwebtoken')).default;
      const { env } = await import('../src/config/env.js');
      adminToken = jwt.sign(
        { id: 'admin-remediation-test', username: 'admin', role: 'superadmin' },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      assert.ok(adminToken);
    });

    // Task 1 — JWT Secret Validation Tests
    it('JWT validation rejects missing secret in production', async () => {
      const { validateJwtSecret } = await import('../src/config/env.js');
      const missingCheck = validateJwtSecret('', 'production');
      assert.equal(missingCheck.valid, false);
      assert.ok(missingCheck.error?.includes('JWT_SECRET is required in production mode'));

      const undefinedCheck = validateJwtSecret(undefined, 'production');
      assert.equal(undefinedCheck.valid, false);
      assert.ok(undefinedCheck.error?.includes('JWT_SECRET is required in production mode'));
    });

    it('JWT validation rejects weak secrets (< 32 characters) in production', async () => {
      const { validateJwtSecret } = await import('../src/config/env.js');
      const weakCheck = validateJwtSecret('short_secret_key_123', 'production');
      assert.equal(weakCheck.valid, false);
      assert.ok(weakCheck.error?.includes('at least 32 characters'));
      assert.ok(!weakCheck.error?.includes('short_secret_key_123'), 'Secret value must not be leaked in error message');
    });

    it('JWT validation rejects default development secret in production', async () => {
      const { validateJwtSecret, DEV_DEFAULT_JWT_SECRET } = await import('../src/config/env.js');
      const defaultCheck = validateJwtSecret(DEV_DEFAULT_JWT_SECRET, 'production');
      assert.equal(defaultCheck.valid, false);
      assert.ok(defaultCheck.error?.includes('cannot use the default development secret in production mode'));
    });

    it('JWT validation accepts valid high-entropy secret (>= 32 chars) in production', async () => {
      const { validateJwtSecret } = await import('../src/config/env.js');
      const validProdSecret = 'super_secure_production_secret_key_with_at_least_32_characters!';
      const validCheck = validateJwtSecret(validProdSecret, 'production');
      assert.equal(validCheck.valid, true);
      assert.equal(validCheck.error, undefined);
    });

    it('JWT validation permits safe local fallback in development and test environments', async () => {
      const { validateJwtSecret } = await import('../src/config/env.js');
      const devCheck = validateJwtSecret(undefined, 'development');
      assert.equal(devCheck.valid, true);

      const testCheck = validateJwtSecret(undefined, 'test');
      assert.equal(testCheck.valid, true);
    });

    it('envSchema rejects production configuration when JWT_SECRET is missing or weak', async () => {
      const { envSchema } = await import('../src/config/env.js');
      const parseMissingResult = envSchema.safeParse({
        NODE_ENV: 'production',
        JWT_SECRET: '',
      });
      assert.equal(parseMissingResult.success, false);

      const parseWeakResult = envSchema.safeParse({
        NODE_ENV: 'production',
        JWT_SECRET: 'weak_123',
      });
      assert.equal(parseWeakResult.success, false);
    });

    // Task 2 — Restricted CORS Validation Tests
    it('CORS resolveAllowedOrigins accepts only explicitly configured origins in production', async () => {
      const { resolveAllowedOrigins } = await import('../src/app.js');
      const prodOrigins = resolveAllowedOrigins('production', 'https://deepscakeshop.in');
      assert.deepEqual(prodOrigins, ['https://deepscakeshop.in']);
      assert.ok(!prodOrigins.includes('http://localhost:5173'), 'Production must not include localhost dev servers');
    });

    it('CORS isOriginAllowed permits requests with no Origin header (server-to-server/health checks)', async () => {
      const { isOriginAllowed } = await import('../src/app.js');
      assert.equal(isOriginAllowed(undefined, 'production', 'https://deepscakeshop.in'), true);
      assert.equal(isOriginAllowed(undefined, 'development', 'http://localhost:5173'), true);
    });

    it('CORS isOriginAllowed permits configured origins in production and blocks unlisted origins', async () => {
      const { isOriginAllowed } = await import('../src/app.js');
      const prodUrl = 'https://deepscakeshop.in';
      assert.equal(isOriginAllowed('https://deepscakeshop.in', 'production', prodUrl), true);
      assert.equal(isOriginAllowed('https://evil-hacker.com', 'production', prodUrl), false);
      assert.equal(isOriginAllowed('http://localhost:5173', 'production', prodUrl), false);
    });

    it('CORS middleware returns Access-Control-Allow-Origin for approved origin', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:5173');

      assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
      assert.equal(res.headers['access-control-allow-credentials'], 'true');
    });

    it('CORS middleware denies Access-Control-Allow-Origin for unlisted arbitrary origin', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'https://unauthorized-random-origin.org');

      assert.equal(
        res.headers['access-control-allow-origin'],
        undefined,
        'Access-Control-Allow-Origin must not be set for unlisted origins'
      );
    });

    // Task 3 — MongoDB NotificationLog Index Management Tests
    it('REQUIRED_NOTIFICATION_LOG_INDEXES specifies required unique and compound indexes', async () => {
      const { REQUIRED_NOTIFICATION_LOG_INDEXES } = await import('../src/models/NotificationLog.js');
      const names = REQUIRED_NOTIFICATION_LOG_INDEXES.map((i) => i.name);

      assert.ok(names.includes('idempotencyKey_1'), 'Must include idempotencyKey unique index');
      assert.ok(names.includes('notificationId_1'), 'Must include notificationId unique index');
      assert.ok(names.includes('deliveryStatus_1_createdAt_-1'), 'Must include deliveryStatus compound index');
      assert.ok(names.includes('channel_1_createdAt_-1'), 'Must include channel compound index');
      assert.ok(names.includes('eventType_1_createdAt_-1'), 'Must include eventType compound index');
    });

    it('ensureNotificationLogIndexes in dryRun mode does not mutate database and lists planned indexes', async () => {
      const { ensureNotificationLogIndexes } = await import('../src/models/NotificationLog.js');
      const plan = await ensureNotificationLogIndexes({ dryRun: true });
      assert.equal(plan.dryRun, true);
      assert.equal(plan.applied, false);
      assert.ok(Array.isArray(plan.createdIndexes));
      assert.ok(Array.isArray(plan.alreadyPresent));
    });

    it('getNotificationLogIndexMetadata inspects indexes safely without printing credentials', async () => {
      const { getNotificationLogIndexMetadata } = await import('../src/models/NotificationLog.js');
      const metadata = await getNotificationLogIndexMetadata();
      assert.ok(typeof metadata.connected === 'boolean');
      assert.ok(typeof metadata.collectionName === 'string');
      assert.ok(Array.isArray(metadata.existingIndexes));
      assert.ok(Array.isArray(metadata.missingIndexes));
    });

    // Task 4 — Admin Notification Query Validation Tests
    it('GET /api/admin/notifications rejects invalid page parameter with 400', async () => {
      const res = await request(app)
        .get('/api/admin/notifications?page=-5')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Query parameter validation failed');
      assert.ok(res.body.errors.some((e: any) => e.field === 'page'));
    });

    it('GET /api/admin/notifications rejects non-numeric page with 400', async () => {
      const res = await request(app)
        .get('/api/admin/notifications?page=invalid')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Query parameter validation failed');
    });

    it('GET /api/admin/notifications rejects limit exceeding max 100 with 400', async () => {
      const res = await request(app)
        .get('/api/admin/notifications?limit=250')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.errors.some((e: any) => e.field === 'limit'));
    });

    it('GET /api/admin/notifications rejects unsupported channel with 400', async () => {
      const res = await request(app)
        .get('/api/admin/notifications?channel=telegram')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.errors.some((e: any) => e.field === 'channel'));
    });

    it('GET /api/admin/notifications rejects unsupported eventType with 400', async () => {
      const res = await request(app)
        .get('/api/admin/notifications?eventType=user_registered')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.errors.some((e: any) => e.field === 'eventType'));
    });

    it('GET /api/admin/notifications rejects unsupported deliveryStatus with 400', async () => {
      const res = await request(app)
        .get('/api/admin/notifications?deliveryStatus=archived')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.errors.some((e: any) => e.field === 'deliveryStatus'));
    });

    it('GET /api/admin/notifications rejects search query exceeding 100 characters with 400', async () => {
      const longSearch = 'a'.repeat(105);
      const res = await request(app)
        .get(`/api/admin/notifications?search=${longSearch}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.errors.some((e: any) => e.field === 'search'));
    });

    it('GET /api/admin/notifications accepts "all" filter values without schema rejection', async () => {
      const res = await request(app)
        .get('/api/admin/notifications?channel=all&eventType=all&deliveryStatus=all&page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });
  });

  describe('16. Phase 4 Milestone 3 Customer Notification Preferences & Admin Retry Management', () => {
    let adminToken: string;

    it('sets up admin auth token for Phase 4 Milestone 3 tests', async () => {
      const jwt = (await import('jsonwebtoken')).default;
      const { env } = await import('../src/config/env.js');
      adminToken = jwt.sign(
        { id: 'admin-m3-test', username: 'admin', role: 'superadmin' },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      assert.ok(adminToken);
    });

    it('persists customer notification preferences on order creation', async () => {
      const orderPayload = {
        customer: {
          name: 'Ananya Deshmukh',
          email: 'ananya.m3@example.com',
          phone: '9820011223',
          address: '42 Marine Drive, Mumbai',
        },
        items: [
          {
            cakeId: 'belgian-truffle-opera-cake',
            selectedWeight: '1 kg',
            quantity: 1,
          },
        ],
        notificationPreferences: {
          email: true,
          whatsapp: true,
          sms: false,
        },
        idempotencyKey: `m3-pref-order-${Date.now()}`,
      };

      const res = await request(app).post('/api/orders').send(orderPayload);
      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.orderId);
      assert.equal(res.body.data.notificationPreferences?.email, true);
      assert.equal(res.body.data.notificationPreferences?.whatsapp, true);
      assert.equal(res.body.data.notificationPreferences?.sms, false);
    });

    it('enforces customer opt-out for transactional email when email is set to false', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const orderPayload = {
        customer: {
          name: 'Rohan Gupta',
          email: 'rohan.optout@example.com',
          phone: '9820044556',
          address: '15 Bandra West, Mumbai',
        },
        items: [
          {
            cakeId: 'belgian-truffle-opera-cake',
            selectedWeight: '0.5 kg',
            quantity: 1,
          },
        ],
        notificationPreferences: {
          email: false,
          whatsapp: false,
          sms: false,
        },
        idempotencyKey: `m3-optout-order-${Date.now()}`,
      };

      // Order creation succeeds without degradation even when customer opts out of all notifications
      const res = await request(app).post('/api/orders').send(orderPayload);
      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      const orderId = res.body.orderId;

      // Verify email notification was skipped due to explicit opt-out
      const emailKey = `order-placed:${orderId}:email`;
      const emailLog = await notificationService.checkIdempotency(emailKey);
      assert.ok(emailLog, 'Audit log must record the skipped email dispatch');
      assert.equal(emailLog.deliveryStatus, 'skipped');
      assert.ok(emailLog.sanitizedError?.includes('explicitly declined EMAIL'));
    });

    it('does not treat missing consent as explicit consent for WhatsApp/SMS', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const orderPayload = {
        customer: {
          name: 'Meera Sen',
          email: 'meera.sen@example.com',
          phone: '9820077889',
          address: '78 Juhu Tara Road, Mumbai',
        },
        items: [
          {
            cakeId: 'belgian-truffle-opera-cake',
            selectedWeight: '0.5 kg',
            quantity: 1,
          },
        ],
        // No whatsapp or sms consent provided
        idempotencyKey: `m3-no-consent-${Date.now()}`,
      };

      const res = await request(app).post('/api/orders').send(orderPayload);
      assert.equal(res.status, 201);
      const orderId = res.body.orderId;

      // WhatsApp dispatch must not be delivered when consent is missing
      const whatsappKey = `order-placed:${orderId}:whatsapp`;
      const whatsappLog = await notificationService.checkIdempotency(whatsappKey);
      if (whatsappLog) {
        assert.equal(whatsappLog.deliveryStatus, 'skipped');
      }
    });

    it('respects stored customer notification preferences when admin updates order status', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const orderPayload = {
        customer: {
          name: 'Suresh Raina',
          email: 'suresh.status@example.com',
          phone: '9820099887',
          address: '10 Shivaji Park, Mumbai',
        },
        items: [
          {
            cakeId: 'belgian-truffle-opera-cake',
            selectedWeight: '1 kg',
            quantity: 1,
          },
        ],
        notificationPreferences: {
          email: true,
          whatsapp: false,
        },
        idempotencyKey: `m3-status-pref-${Date.now()}`,
      };

      const createRes = await request(app).post('/api/orders').send(orderPayload);
      assert.equal(createRes.status, 201);
      const orderId = createRes.body.orderId;

      // Admin updates status from Pending to Confirmed
      const updateRes = await request(app)
        .patch(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Confirmed' });

      assert.equal(updateRes.status, 200);

      // Verify email status update was dispatched
      const emailStatusKey = `order-status:${orderId}:Confirmed:email`;
      const emailLog = await notificationService.checkIdempotency(emailStatusKey);
      assert.ok(emailLog);
      assert.equal(emailLog.deliveryStatus, 'delivered');

      // Verify whatsapp status update was NOT sent without opt-in
      const whatsappStatusKey = `order-status:${orderId}:Confirmed:whatsapp`;
      const whatsappLog = await notificationService.checkIdempotency(whatsappStatusKey);
      if (whatsappLog) {
        assert.equal(whatsappLog.deliveryStatus, 'skipped');
      }
    });

    it('custom cake inquiry stores customer preferences and applies them during quotation', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const inqRes = await request(app)
        .post('/api/custom-cakes')
        .field('customerName', 'Tara Sutaria')
        .field('phone', '9819988776')
        .field('email', 'tara.custom@example.com')
        .field('occasion', 'Anniversary')
        .field('flavor', 'Belgian Chocolate')
        .field('weight', '2 kg')
        .field('tierCount', '2 Tiers')
        .field('isEggless', 'true')
        .field('preferredDate', '2026-11-20')
        .field('notificationPreferences[email]', 'true')
        .field('notificationPreferences[whatsapp]', 'true');

      assert.equal(inqRes.status, 201);
      const referenceId = inqRes.body.inquiryId;

      // Transition to reviewed
      await request(app)
        .patch(`/api/admin/inquiries/${referenceId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'reviewed' });

      // Transition to quoted with quotedAmount
      const quoteRes = await request(app)
        .patch(`/api/admin/inquiries/${referenceId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'quoted',
          quotedAmount: 3500,
          quoteNotes: 'Special vanilla bean butter-cream included',
        });

      assert.equal(quoteRes.status, 200);

      // Verify email quotation was delivered
      const quoteEmailKey = `inquiry-quote:${referenceId}:3500:email`;
      const emailLog = await notificationService.checkIdempotency(quoteEmailKey);
      assert.ok(emailLog);
      assert.equal(emailLog.deliveryStatus, 'delivered');
    });

    // Admin Retry Management Tests
    it('POST /api/admin/notifications/:id/retry rejects unauthenticated requests with 401', async () => {
      const res = await request(app).post('/api/admin/notifications/NOTIF-TEST-123/retry').send({});
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('POST /api/admin/notifications/:id/retry rejects malformed notification identifier with 400', async () => {
      const res = await request(app)
        .post('/api/admin/notifications/INVALID@ID$CHARS/retry')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message?.includes('validation failed') || res.body.message?.includes('format'));
    });

    it('POST /api/admin/notifications/:id/retry returns 404 for nonexistent notification', async () => {
      const res = await request(app)
        .post('/api/admin/notifications/NOTIF-NONEXISTENT-999/retry')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message?.includes('not found'));
    });

    it('POST /api/admin/notifications/:id/retry rejects retrying already delivered notification (400)', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const deliveredKey = `test-delivered-${Date.now()}`;
      const notifId = `NOTIF-DELIVERED-${Date.now()}`;

      await notificationService.saveNotificationLog({
        notificationId: notifId,
        idempotencyKey: deliveredKey,
        channel: 'email',
        eventType: 'order_placed',
        recipient: 'already.delivered@example.com',
        provider: 'mock',
        deliveryStatus: 'delivered',
        attempts: 1,
        maxAttempts: 3,
        subject: 'Delivered Subject',
        message: 'Delivered message body',
        queuedAt: new Date(),
        sentAt: new Date(),
      });

      const res = await request(app)
        .post(`/api/admin/notifications/${notifId}/retry`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message?.includes('already delivered'));
    });

    it('POST /api/admin/notifications/:id/retry rejects retrying skipped notification (400)', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const skippedKey = `test-skipped-${Date.now()}`;
      const notifId = `NOTIF-SKIPPED-${Date.now()}`;

      await notificationService.saveNotificationLog({
        notificationId: notifId,
        idempotencyKey: skippedKey,
        channel: 'whatsapp',
        eventType: 'order_placed',
        recipient: '9876543210',
        provider: 'mock',
        deliveryStatus: 'skipped',
        attempts: 0,
        maxAttempts: 3,
        subject: 'Skipped Subject',
        message: 'Skipped message body',
        sanitizedError: 'Customer has not opted in',
        queuedAt: new Date(),
      });

      const res = await request(app)
        .post(`/api/admin/notifications/${notifId}/retry`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message?.includes('skipped'));
    });

    it('POST /api/admin/notifications/:id/retry rejects retrying when attempts reached max ceiling (400)', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const exhaustedKey = `test-exhausted-${Date.now()}`;
      const notifId = `NOTIF-EXHAUSTED-${Date.now()}`;

      await notificationService.saveNotificationLog({
        notificationId: notifId,
        idempotencyKey: exhaustedKey,
        channel: 'email',
        eventType: 'order_placed',
        recipient: 'exhausted@example.com',
        provider: 'mock',
        deliveryStatus: 'failed',
        attempts: 5,
        maxAttempts: 3,
        subject: 'Exhausted Subject',
        message: 'Exhausted message body',
        sanitizedError: 'Permanent network rejection',
        queuedAt: new Date(),
        failedAt: new Date(),
      });

      const res = await request(app)
        .post(`/api/admin/notifications/${notifId}/retry`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message?.includes('maximum permitted attempt limit'));
    });

    it('POST /api/admin/notifications/:id/retry prevents concurrent retry while status is "sending" (409)', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const sendingKey = `test-sending-${Date.now()}`;
      const notifId = `NOTIF-SENDING-${Date.now()}`;

      await notificationService.saveNotificationLog({
        notificationId: notifId,
        idempotencyKey: sendingKey,
        channel: 'email',
        eventType: 'order_placed',
        recipient: 'sending@example.com',
        provider: 'mock',
        deliveryStatus: 'sending',
        attempts: 1,
        maxAttempts: 3,
        subject: 'Sending Subject',
        message: 'Sending message body',
        queuedAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .post(`/api/admin/notifications/${notifId}/retry`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message?.includes('currently in flight'));
    });

    it('POST /api/admin/notifications/:id/retry successfully retries eligible failed notification', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const mockProvider = notificationService.getMockProvider();
      mockProvider.clear();

      const failedKey = `test-failed-${Date.now()}`;
      const notifId = `NOTIF-FAILED-${Date.now()}`;

      await notificationService.saveNotificationLog({
        notificationId: notifId,
        idempotencyKey: failedKey,
        channel: 'email',
        eventType: 'order_status_updated',
        recipient: 'retry.success@example.com',
        provider: 'mock',
        deliveryStatus: 'failed',
        attempts: 1,
        maxAttempts: 3,
        subject: 'Retry Test Subject',
        message: 'Order status has been updated to Baking',
        sanitizedError: 'Temporary network timeout',
        queuedAt: new Date(),
        failedAt: new Date(),
      });

      const res = await request(app)
        .post(`/api/admin/notifications/${notifId}/retry`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.message?.includes('successfully'));
      assert.equal(res.body.data.deliveryStatus, 'delivered');
      assert.equal(res.body.data.attempts, 2);

      // Verify provider received the dispatched retry
      const sentRecords = mockProvider.getSentRecords();
      assert.ok(sentRecords.some((r) => r.payload.recipient === 'retry.success@example.com'));
    });

    it('POST /api/admin/notifications/:id/retry ignores arbitrary body overrides (recipient/content tampering prevented)', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const mockProvider = notificationService.getMockProvider();
      mockProvider.clear();

      const tamperKey = `test-tamper-${Date.now()}`;
      const notifId = `NOTIF-TAMPER-${Date.now()}`;

      await notificationService.saveNotificationLog({
        notificationId: notifId,
        idempotencyKey: tamperKey,
        channel: 'email',
        eventType: 'order_placed',
        recipient: 'legitimate.customer@example.com',
        provider: 'mock',
        deliveryStatus: 'failed',
        attempts: 1,
        maxAttempts: 3,
        subject: 'Legitimate Receipt',
        message: 'Your genuine cake order is confirmed',
        sanitizedError: 'Simulated failure',
        queuedAt: new Date(),
        failedAt: new Date(),
      });

      // Attacker attempts to override recipient and message content via request body
      const res = await request(app)
        .post(`/api/admin/notifications/${notifId}/retry`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recipient: 'hacker.attacker@evil.org',
          message: 'Hacked arbitrary message body',
          channel: 'sms',
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.recipient, 'legitimate.customer@example.com');

      // Provider must have received dispatch to original recipient ONLY
      const sentRecords = mockProvider.getSentRecords();
      assert.ok(sentRecords.some((r) => r.payload.recipient === 'legitimate.customer@example.com'));
      assert.ok(!sentRecords.some((r) => r.payload.recipient === 'hacker.attacker@evil.org'));
    });

    it('legacy order without preferences defaults to email receipt and skips messaging', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const res = await request(app)
        .post('/api/orders')
        .send({
          customer: {
            name: 'Legacy Customer',
            email: 'legacy.customer@example.com',
            phone: '9988776655',
            address: '404 Old Street, Bangalore',
          },
          items: [
            {
              cakeId: 'belgian-truffle-opera-cake',
              cakeName: 'Belgian Truffle Opera Cake',
              selectedWeight: '1 kg',
              quantity: 1,
            },
          ],
        });

      assert.equal(res.status, 201);
      const orderId = res.body.orderId;

      const emailKey = `order-placed:${orderId}:email`;
      const emailLog = await notificationService.checkIdempotency(emailKey);
      assert.ok(emailLog);
      assert.equal(emailLog.deliveryStatus, 'delivered');

      const whatsappKey = `order-placed:${orderId}:whatsapp`;
      const whatsappLog = await notificationService.checkIdempotency(whatsappKey);
      assert.equal(whatsappLog, null);
    });

    it('enforces email opt-out on order status transition when customer explicitly declined email', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const res = await request(app)
        .post('/api/orders')
        .send({
          customer: {
            name: 'OptedOut Status Customer',
            email: 'optout.status@example.com',
            phone: '9988776655',
            address: '100 Quiet Lane, Pune',
          },
          items: [
            {
              cakeId: 'belgian-truffle-opera-cake',
              cakeName: 'Belgian Truffle Opera Cake',
              selectedWeight: '1 kg',
              quantity: 1,
            },
          ],
          notificationPreferences: {
            email: false,
            whatsapp: false,
            sms: false,
          },
        });

      assert.equal(res.status, 201);
      const orderId = res.body.orderId;

      // Update status to Confirmed
      const updateRes = await request(app)
        .patch(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Confirmed' });

      assert.equal(updateRes.status, 200);

      const statusEmailKey = `order-status:${orderId}:Confirmed:email`;
      const statusEmailLog = await notificationService.checkIdempotency(statusEmailKey);
      assert.ok(statusEmailLog);
      assert.equal(statusEmailLog.deliveryStatus, 'skipped');
      assert.ok(statusEmailLog.sanitizedError?.includes('explicitly declined EMAIL'));
    });

    it('enforces email opt-out on custom cake quotation when customer declined email', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const inqRes = await request(app)
        .post('/api/custom-cakes')
        .send({
          customerName: 'NoEmail Inquiry Customer',
          phone: '9877665544',
          email: 'noemail.inq@example.com',
          occasion: 'Retirement',
          flavor: 'Pineapple',
          weight: '1 kg',
          tierCount: '1 Tier',
          isEggless: true,
          preferredDate: '2026-12-05',
          notificationPreferences: {
            email: false,
            whatsapp: false,
            sms: false,
          },
        });

      assert.equal(inqRes.status, 201);
      const refId = inqRes.body.inquiryId;

      await request(app)
        .patch(`/api/admin/inquiries/${refId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'reviewed' });

      const quoteRes = await request(app)
        .patch(`/api/admin/inquiries/${refId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'quoted', quotedAmount: 2200 });

      assert.equal(quoteRes.status, 200);

      const quoteEmailKey = `inquiry-quote:${refId}:2200:email`;
      const quoteLog = await notificationService.checkIdempotency(quoteEmailKey);
      assert.ok(quoteLog);
      assert.equal(quoteLog.deliveryStatus, 'skipped');
      assert.ok(quoteLog.sanitizedError?.includes('explicitly declined EMAIL'));
    });

    it('retryNotification preserves original idempotencyKey on dispatched payload', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const mockProvider = notificationService.getMockProvider();
      mockProvider.clear();

      const origKey = `preserve-key-${Date.now()}`;
      const notifId = `NOTIF-PRESERVE-${Date.now()}`;

      await notificationService.saveNotificationLog({
        notificationId: notifId,
        idempotencyKey: origKey,
        channel: 'email',
        eventType: 'order_status_updated',
        recipient: 'preserve.key@example.com',
        provider: 'mock',
        deliveryStatus: 'failed',
        attempts: 1,
        maxAttempts: 3,
        subject: 'Preserve Key Test',
        message: 'Order is baking',
        sanitizedError: 'Provider timeout',
        queuedAt: new Date(),
        failedAt: new Date(),
      });

      const res = await request(app)
        .post(`/api/admin/notifications/${notifId}/retry`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      assert.equal(res.status, 200);
      const lastRecord = mockProvider.getLastRecord();
      assert.ok(lastRecord);
      // Original idempotencyKey must be preserved directly (no :retry: suffix generated)
      assert.equal(lastRecord.payload.idempotencyKey, origKey);
      assert.equal(lastRecord.payload.metadata?.isRetry, true);
    });

    it('crash recovery flags uncertainOutcome on stuck sending logs and retry acknowledges it', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const stuckKey = `stuck-crash-${Date.now()}`;
      const notifId = `NOTIF-STUCK-${Date.now()}`;

      // Insert a stuck log simulated from 10 minutes ago
      await notificationService.saveNotificationLog({
        notificationId: notifId,
        idempotencyKey: stuckKey,
        channel: 'email',
        eventType: 'order_placed',
        recipient: 'crashed.order@example.com',
        provider: 'mock',
        deliveryStatus: 'sending',
        attempts: 1,
        maxAttempts: 3,
        subject: 'Crashed Dispatch Receipt',
        message: 'Your order was received',
        queuedAt: new Date(Date.now() - 10 * 60 * 1000),
        updatedAt: new Date(Date.now() - 10 * 60 * 1000),
      });

      // Run recovery
      const recovered = await notificationService.recoverStuckSendingLogs(5 * 60 * 1000);
      assert.ok(recovered >= 1);

      const recoveredLog = await notificationService.checkIdempotency(stuckKey);
      assert.ok(recoveredLog);
      assert.equal(recoveredLog.deliveryStatus, 'failed');
      assert.equal(recoveredLog.metadata?.uncertainOutcome, true);
      assert.equal(recoveredLog.metadata?.crashedWhileSending, true);

      // Now retry the recovered log
      const retryRes = await request(app)
        .post(`/api/admin/notifications/${notifId}/retry`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      assert.equal(retryRes.status, 200);
      assert.equal(retryRes.body.data.deliveryStatus, 'delivered');
      assert.equal(retryRes.body.data.metadata?.uncertainOutcomeAcknowledged, true);
    });
  });

  describe('17. Phase 5 Milestone 1 Production Reliability & Security Hardening', () => {
    let testAdminToken: string;

    it('sets up admin auth token for Phase 5 Milestone 1 tests', async () => {
      const { env } = await import('../src/config/env.js');
      const jwt = (await import('jsonwebtoken')).default;
      testAdminToken = jwt.sign(
        { id: '67a000000000000000000099', username: 'admin', role: 'superadmin' },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      assert.ok(testAdminToken);
    });

    // A. HTTP Security & Helmet Tests
    it('Helmet sets standard security headers on API responses', async () => {
      const res = await request(app).get('/api/health');
      assert.equal(res.headers['x-content-type-options'], 'nosniff');
      assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN');
      assert.equal(res.headers['x-dns-prefetch-control'], 'off');
      assert.equal(res.headers['cross-origin-resource-policy'], 'cross-origin');
    });

    it('configureTrustProxy sets trust proxy setting on Express app', async () => {
      const express = (await import('express')).default;
      const { configureTrustProxy } = await import('../src/app.js');

      const testApp1 = express();
      configureTrustProxy(testApp1, '1');
      assert.equal(testApp1.get('trust proxy'), 1);

      const testApp2 = express();
      configureTrustProxy(testApp2, 'false');
      assert.equal(testApp2.get('trust proxy'), false);

      const testApp3 = express();
      configureTrustProxy(testApp3, '2');
      assert.equal(testApp3.get('trust proxy'), 2);

      const testApp4 = express();
      configureTrustProxy(testApp4, '127.0.0.1');
      assert.equal(testApp4.get('trust proxy'), '127.0.0.1');
    });

    // B. Correlation ID & Structured Logging Tests
    it('generates X-Request-Id correlation header when not supplied by client', async () => {
      const res = await request(app).get('/api/health');
      assert.ok(res.headers['x-request-id']);
      assert.ok(res.headers['x-request-id'].startsWith('req_'));
    });

    it('propagates client-supplied X-Request-Id on response', async () => {
      const clientCorrelationId = 'client-trace-123456789';
      const res = await request(app)
        .get('/api/health')
        .set('X-Request-Id', clientCorrelationId);
      assert.equal(res.headers['x-request-id'], clientCorrelationId);
    });

    it('redactLogData redacts sensitive keys and masks emails/phone numbers', async () => {
      const { redactLogData } = await import('../src/utils/logger.js');
      const sample = {
        username: 'admin',
        password: 'SuperSecretPassword@2026',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        authorization: 'Bearer secret_token_123',
        email: 'customer.support@deepscakeshop.in',
        phone: '9876543210',
        metadata: {
          apiKey: 'SG.1234567890abcdef',
          mongodbUri: 'mongodb+srv://user:pass@cluster0.net/db',
        },
      };

      const redacted = redactLogData(sample);
      assert.equal(redacted.username, 'admin');
      assert.equal(redacted.password, '[REDACTED]');
      assert.equal(redacted.token, '[REDACTED]');
      assert.equal(redacted.authorization, '[REDACTED]');
      assert.ok(redacted.email.includes('c***@deepscakeshop.in'));
      assert.ok(redacted.phone.includes('******3210'));
      assert.equal(redacted.metadata.apiKey, '[REDACTED]');
      assert.equal(redacted.metadata.mongodbUri, '[REDACTED]');
    });

    // C. Notification Recovery Scheduler Lifecycle Tests
    it('NotificationRecoveryScheduler manages timer lifecycle and prevents duplicate timers', async () => {
      const { NotificationRecoveryScheduler } = await import('../src/notifications/notificationRecoveryScheduler.js');
      const scheduler = new NotificationRecoveryScheduler(60000);

      assert.equal(scheduler.isRunning(), false);
      scheduler.start();
      assert.equal(scheduler.isRunning(), true);

      // Calling start again should not throw and should remain running
      scheduler.start();
      assert.equal(scheduler.isRunning(), true);

      scheduler.stop();
      assert.equal(scheduler.isRunning(), false);
    });

    it('NotificationRecoveryScheduler prevents concurrent tick executions', async () => {
      const { NotificationRecoveryScheduler } = await import('../src/notifications/notificationRecoveryScheduler.js');
      const scheduler = new NotificationRecoveryScheduler(60000);

      (scheduler as any).isExecuting = true;
      const count = await scheduler.tick();
      assert.equal(count, 0, 'Must return 0 and skip when scan is already in progress');
      (scheduler as any).isExecuting = false;
    });

    it('recoverStuckSendingLogs logs clean count via structured logger without leaking payloads', async () => {
      const { notificationService } = await import('../src/notifications/notificationService.js');
      const { logger } = await import('../src/utils/logger.js');

      let loggedMessage = '';
      let loggedMeta: any = null;
      const origInfo = logger.info.bind(logger);
      (logger as any).info = (msg: string, meta?: any) => {
        loggedMessage = msg;
        loggedMeta = meta;
        origInfo(msg, meta);
      };

      try {
        const count = await notificationService.recoverStuckSendingLogs(0);
        assert.ok(typeof count === 'number');
        if (count > 0) {
          assert.ok(loggedMessage.includes('Notification Recovery'));
          assert.ok(loggedMeta && typeof loggedMeta.recoveredCount === 'number');
          assert.equal(loggedMeta.password, undefined);
          assert.equal(loggedMeta.token, undefined);
        }
      } finally {
        logger.info = origInfo;
      }
    });

    // D. Admin Password Management Tests (PUT /api/auth/password)
    it('PUT /api/auth/password rejects unauthenticated request with 401', async () => {
      const res = await request(app)
        .put('/api/auth/password')
        .send({ currentPassword: 'any', newPassword: 'AnyNewPassword@123' });
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('PUT /api/auth/password rejects weak new password with 400 (< 10 chars, missing complexity)', async () => {
      const res = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${testAdminToken}`)
        .send({
          currentPassword: 'AdminBakery@2026',
          newPassword: 'short',
        });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('PUT /api/auth/password rejects new password identical to current password with 400', async () => {
      const res = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${testAdminToken}`)
        .send({
          currentPassword: 'AdminBakery@2026',
          newPassword: 'AdminBakery@2026',
        });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      const hasIdenticalError =
        (typeof res.body.message === 'string' && res.body.message.includes('identical')) ||
        (Array.isArray(res.body.errors) &&
          res.body.errors.some((err: any) => err.message && err.message.includes('identical')));
      assert.ok(hasIdenticalError, 'Should report that new password cannot be identical to current password');
    });

    it('PUT /api/auth/password rejects incorrect current password with 401', async () => {
      const res = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${testAdminToken}`)
        .send({
          currentPassword: 'WrongPassword@999',
          newPassword: 'BrandNewSecureBakery@2026',
        });
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('verification failed'));
    });

    it('PUT /api/auth/password successfully updates password and clears cookie session', async () => {
      const res = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${testAdminToken}`)
        .send({
          currentPassword: 'AdminBakery@2026',
          newPassword: 'SuperBrandNewSecureBakery@2026',
          confirmPassword: 'SuperBrandNewSecureBakery@2026',
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.message.includes('successfully updated'));
      assert.ok(res.body.sessionRevocation);
      assert.equal(res.body.sessionRevocation.cookieSessionCleared, true);
      assert.ok(res.body.sessionRevocation.bearerTokenLimitation);

      // Verify Set-Cookie clears admin_token
      const setCookie = res.headers['set-cookie'];
      assert.ok(setCookie);
      const cookieStr = Array.isArray(setCookie) ? setCookie.join(';') : String(setCookie);
      assert.ok(cookieStr.includes('admin_token=;'));

      // Verify subsequent login succeeds with new password
      const loginResSuccess = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'admin',
          password: 'SuperBrandNewSecureBakery@2026',
        });
      assert.equal(loginResSuccess.status, 200);
      assert.equal(loginResSuccess.body.success, true);
      const newAdminToken = loginResSuccess.body.token;
      assert.ok(newAdminToken);

      // Verify that the old testAdminToken is now revoked and rejected with 401
      const oldTokenRevokedRes = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${testAdminToken}`);
      assert.equal(oldTokenRevokedRes.status, 401);
      assert.equal(oldTokenRevokedRes.body.success, false);

      // Verify subsequent login fails with old password
      const loginResFail = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'admin',
          password: 'AdminBakery@2026',
        });
      assert.equal(loginResFail.status, 401);
      assert.equal(loginResFail.body.success, false);

      // Restore password back to default for idempotency using the new token
      const restoreRes = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${newAdminToken}`)
        .send({
          currentPassword: 'SuperBrandNewSecureBakery@2026',
          newPassword: 'AdminBakery@2026',
          confirmPassword: 'AdminBakery@2026',
        });
      assert.equal(restoreRes.status, 200);

      // Verify that newAdminToken is now also revoked after restoring password
      const restoredRevokedRes = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${newAdminToken}`);
      assert.equal(restoredRevokedRes.status, 401);

      // Re-login with default password to refresh testAdminToken for subsequent operations
      const reLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'admin',
          password: 'AdminBakery@2026',
        });
      assert.equal(reLoginRes.status, 200);
      testAdminToken = reLoginRes.body.token;
    });

    it('legacy tokens lacking tokenVersion are handled safely based on migration policy', async () => {
      const { env } = await import('../src/config/env.js');
      const jwt = (await import('jsonwebtoken')).default;
      const { MEMORY_ADMIN } = await import('../src/models/Admin.js');

      // Create a legacy token without tokenVersion claim
      const legacyToken = jwt.sign(
        { id: MEMORY_ADMIN.id, username: MEMORY_ADMIN.username, role: 'superadmin' },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // When admin has rotated password (tokenVersion > 0), legacy token must be rejected
      const origTokenVersion = MEMORY_ADMIN.tokenVersion;
      try {
        MEMORY_ADMIN.tokenVersion = 5;
        const resRevoked = await request(app)
          .get('/api/admin/stats')
          .set('Authorization', `Bearer ${legacyToken}`);
        assert.equal(resRevoked.status, 401);
        assert.ok(resRevoked.body.message.includes('revoked'));

        // When token has an explicitly mismatched tokenVersion, it is rejected
        const mismatchedToken = jwt.sign(
          { id: MEMORY_ADMIN.id, username: MEMORY_ADMIN.username, role: 'superadmin', tokenVersion: 1 },
          env.JWT_SECRET,
          { expiresIn: '1h' }
        );
        const resMismatch = await request(app)
          .get('/api/admin/stats')
          .set('Authorization', `Bearer ${mismatchedToken}`);
        assert.equal(resMismatch.status, 401);

        // When tokenVersion matches current admin version, it is accepted
        const validToken = jwt.sign(
          { id: MEMORY_ADMIN.id, username: MEMORY_ADMIN.username, role: 'superadmin', tokenVersion: 5 },
          env.JWT_SECRET,
          { expiresIn: '1h' }
        );
        const resValid = await request(app)
          .get('/api/admin/stats')
          .set('Authorization', `Bearer ${validToken}`);
        assert.equal(resValid.status, 200);

        // When admin tokenVersion is 0 (unmigrated/initial state), legacy tokens without claim are accepted
        MEMORY_ADMIN.tokenVersion = 0;
        const resMigrated = await request(app)
          .get('/api/admin/stats')
          .set('Authorization', `Bearer ${legacyToken}`);
        assert.equal(resMigrated.status, 200);
      } finally {
        MEMORY_ADMIN.tokenVersion = origTokenVersion;
      }
    });

    // E. Request ID Validation & Sanitization Tests
    it('rejects oversized (>64 chars) X-Request-Id and generates server-side UUID fallback', async () => {
      const oversizedId = 'A'.repeat(80);
      const res = await request(app)
        .get('/api/health')
        .set('X-Request-Id', oversizedId);

      const returnedId = res.headers['x-request-id'];
      assert.ok(returnedId);
      assert.ok(returnedId.startsWith('req_'));
      assert.notEqual(returnedId, oversizedId);
      assert.ok(returnedId.length <= 64);
    });

    it('rejects invalid characters in X-Request-Id and generates server-side UUID fallback', async () => {
      const invalidChars = '<script>alert(1)</script>';
      const res = await request(app)
        .get('/api/health')
        .set('X-Request-Id', invalidChars);

      const returnedId = res.headers['x-request-id'];
      assert.ok(returnedId);
      assert.ok(returnedId.startsWith('req_'));
      assert.notEqual(returnedId, invalidChars);
      assert.ok(!returnedId.includes('<'));
    });

    it('trims whitespace around valid client-supplied X-Request-Id', async () => {
      const baseId = 'trace-valid_request-12345';
      const paddedId = `   ${baseId}   `;
      const res = await request(app)
        .get('/api/health')
        .set('X-Request-Id', paddedId);

      assert.equal(res.headers['x-request-id'], baseId);
    });

    it('accepts valid client-supplied X-Request-Id matching ^[a-zA-Z0-9_-]{1,64}$', async () => {
      const validId = 'Client_Trace-ID-99.2026'.replace('.', '_'); // ensure matches [a-zA-Z0-9_-]
      const res = await request(app)
        .get('/api/health')
        .set('X-Request-Id', validId);

      assert.equal(res.headers['x-request-id'], validId);
    });

    it('requestLogger logs pathname without query strings and omits sensitive query parameters', async () => {
      const express = (await import('express')).default;
      const { requestLogger } = await import('../src/middlewares/requestLogger.js');
      const { logger } = await import('../src/utils/logger.js');

      let loggedPath = '';
      const origInfo = logger.info.bind(logger);
      (logger as any).info = (msg: string, meta?: any) => {
        if (meta && meta.path) {
          loggedPath = meta.path;
        }
        origInfo(msg, meta);
      };

      try {
        const testApp = express();
        testApp.use(requestLogger);
        testApp.get('/test-query', (_req, res) => res.json({ ok: true }));

        const res = await request(testApp)
          .get('/test-query?secret=SuperSecretToken123&password=SecretPass456&client=test');
        assert.equal(res.status, 200);
        assert.equal(loggedPath, '/test-query');
        assert.ok(!loggedPath.includes('secret'));
        assert.ok(!loggedPath.includes('password'));
      } finally {
        logger.info = origInfo;
      }
    });

    // F. Notification In-Flight Task Tracking & Safe Draining Tests
    it('drainInFlight completes immediately with drained=true when no tasks are active', async () => {
      const { drainInFlight, getActiveTaskCount } = await import('../src/notifications/notificationService.js');
      const count = getActiveTaskCount();
      const result = await drainInFlight(1000);
      assert.equal(result.drained, true);
      assert.equal(result.pendingCount, count);
    });

    it('drainInFlight waits for tracked in-flight tasks to resolve', async () => {
      const { drainInFlight, trackTask } = await import('../src/notifications/notificationService.js');

      let taskFinished = false;
      const delayedTask = new Promise<void>((resolve) => {
        setTimeout(() => {
          taskFinished = true;
          resolve();
        }, 50);
      });

      trackTask(delayedTask);
      const result = await drainInFlight(1000);
      assert.equal(result.drained, true);
      assert.equal(taskFinished, true);
    });

    it('drainInFlight handles timeout gracefully when task exceeds duration', async () => {
      const { drainInFlight, trackTask } = await import('../src/notifications/notificationService.js');

      // Unresolved promise that takes longer than drain timeout
      const longTask = new Promise<void>((resolve) => {
        setTimeout(resolve, 500);
      });

      trackTask(longTask);
      const result = await drainInFlight(20);
      assert.equal(result.drained, false);
      assert.ok(result.pendingCount >= 1);
    });

    it('createShutdownHandler executes shutdown sequence idempotently upon repeated signals', async () => {
      const { createShutdownHandler } = await import('../src/index.js');

      let serverClosedCount = 0;
      let schedulerStoppedCount = 0;

      const mockServer = {
        close: (cb?: () => void) => {
          serverClosedCount++;
          if (cb) cb();
        },
      };

      const mockScheduler = {
        stop: () => {
          schedulerStoppedCount++;
        },
      };

      const shutdownHandler = createShutdownHandler({
        server: mockServer as any,
        recoveryScheduler: mockScheduler as any,
        drainTimeoutMs: 50,
      });

      // Call twice with different signals
      await shutdownHandler('SIGTERM');
      await shutdownHandler('SIGINT');

      // Assert idempotent execution: close and stop called exactly once
      assert.equal(serverClosedCount, 1);
      assert.equal(schedulerStoppedCount, 1);
    });

    it('createShutdownHandler closes idle connections and enforces bounded timeout if server.close hangs', async () => {
      const { createShutdownHandler } = await import('../src/index.js');

      let idleClosed = false;
      let allClosed = false;
      let dbDisconnected = false;

      const mockHangingServer = {
        close: (_cb?: (err?: Error) => void) => {
          // Intentionally do not invoke cb to simulate hanging keep-alive connections
        },
        closeIdleConnections: () => {
          idleClosed = true;
        },
        closeAllConnections: () => {
          allClosed = true;
        },
      };

      const mockScheduler = {
        stop: () => {},
      };

      const mockDisconnectDB = async () => {
        dbDisconnected = true;
      };

      const shutdownHandler = createShutdownHandler({
        server: mockHangingServer as any,
        recoveryScheduler: mockScheduler as any,
        disconnectDB: mockDisconnectDB,
        serverCloseTimeoutMs: 30,
        drainTimeoutMs: 30,
      });

      const startTime = Date.now();
      await shutdownHandler('SIGTERM');
      const elapsedMs = Date.now() - startTime;

      assert.equal(idleClosed, true, 'Must call closeIdleConnections when supported');
      assert.equal(allClosed, true, 'Must call closeAllConnections when server close times out');
      assert.equal(dbDisconnected, true, 'Must disconnect DB strictly after draining / bounded close');
      assert.ok(elapsedMs < 2000, 'Must complete bounded shutdown within reasonable timeout');
    });

    // G. Centralized Error Logging & Expanded PII Redaction Tests
    it('redactLogData redacts sensitive keys, tokens, and secrets in nested metadata', async () => {
      const { redactLogData } = await import('../src/utils/logger.js');

      const sensitivePayload = {
        jwt_secret: 'super-secret-key-12345',
        access_token: 'ey123456789.secret',
        refresh_token: 'refresh_987654',
        client_secret: 'oauth_client_secret_xyz',
        currentPassword: 'CurrentPassword@2026',
        newPassword: 'NewPassword@2026',
        confirmPassword: 'NewPassword@2026',
        dbUri: 'mongodb+srv://admin:pass@cluster.mongodb.net/production',
      };

      const redacted = redactLogData(sensitivePayload);
      assert.equal(redacted.jwt_secret, '[REDACTED]');
      assert.equal(redacted.access_token, '[REDACTED]');
      assert.equal(redacted.refresh_token, '[REDACTED]');
      assert.equal(redacted.client_secret, '[REDACTED]');
      assert.equal(redacted.currentPassword, '[REDACTED]');
      assert.equal(redacted.newPassword, '[REDACTED]');
      assert.equal(redacted.confirmPassword, '[REDACTED]');
      assert.equal(redacted.dbUri, '[REDACTED]');
    });

    it('redactLogData masks emails, phone numbers, mobile, and recipient contacts', async () => {
      const { redactLogData } = await import('../src/utils/logger.js');

      const contactPayload = {
        customerEmail: 'deepika.patel@example.com',
        userEmail: 'manager@bakery.org',
        recipientEmail: 'order.confirmation@gmail.com',
        customerPhone: '+919876543210',
        mobile: '9123456789',
        contact: '9988776655',
        recipientEmailType: {
          recipient: 'delivery.agent@deepscakeshop.in',
        },
        recipientPhoneType: {
          recipient: '+91 98765 43210',
        },
      };

      const redacted = redactLogData(contactPayload);
      assert.ok(redacted.customerEmail.includes('d***@example.com'));
      assert.ok(redacted.userEmail.includes('m***@bakery.org'));
      assert.ok(redacted.recipientEmail.includes('o***@gmail.com'));
      assert.ok(redacted.customerPhone.includes('******3210'));
      assert.ok(redacted.mobile.includes('******6789'));
      assert.ok(redacted.contact.includes('******6655'));
      assert.ok(redacted.recipientEmailType.recipient.includes('d***@deepscakeshop.in'));
      assert.ok(redacted.recipientPhoneType.recipient.includes('******3210'));
    });

    it('redactLogData recursively handles Error instances and custom error properties', async () => {
      const { redactLogData } = await import('../src/utils/logger.js');

      const customErr: any = new Error('Database connection failed');
      customErr.password = 'DbPassword@123';
      customErr.token = 'secret-session-token';
      customErr.userEmail = 'admin@deepscakeshop.in';
      customErr.nested = {
        apiKey: 'secret_key_999',
        customerPhone: '9876543210',
      };

      const redacted = redactLogData(customErr);
      assert.equal(redacted.message, 'Database connection failed');
      assert.equal(redacted.password, '[REDACTED]');
      assert.equal(redacted.token, '[REDACTED]');
      assert.ok(redacted.userEmail.includes('a***@deepscakeshop.in'));
      assert.equal(redacted.nested.apiKey, '[REDACTED]');
      assert.ok(redacted.nested.customerPhone.includes('******3210'));
    });

    it('error middleware logs through structured logger with correlation ID and does not leak secrets', async () => {
      const express = (await import('express')).default;
      const { errorHandler } = await import('../src/middlewares/error.middleware.js');
      const testErrApp = express();

      testErrApp.use((req, _res, next) => {
        (req as any).correlationId = 'trace-err-test-999';
        next();
      });

      testErrApp.get('/error-test', (_req, _res, next) => {
        const err: any = new Error('Simulated test failure');
        err.secretToken = 'leaked-token-123';
        err.status = 500;
        next(err);
      });

      testErrApp.use(errorHandler);

      const res = await request(testErrApp).get('/error-test');
      assert.equal(res.status, 500);
      assert.equal(res.body.success, false);
      assert.equal(res.body.correlationId, 'trace-err-test-999');
      // Must not leak secretToken in response payload
      assert.equal(res.body.secretToken, undefined);
    });

    // H. Proxy Trust Review Tests
    it('configureTrustProxy supports direct-exposure (false/0) and reverse-proxy (true/1/numeric) modes safely', async () => {
      const express = (await import('express')).default;
      const { configureTrustProxy } = await import('../src/app.js');

      const appZero = express();
      configureTrustProxy(appZero, '0');
      assert.equal(appZero.get('trust proxy'), false);

      const appFalse = express();
      configureTrustProxy(appFalse, 'false');
      assert.equal(appFalse.get('trust proxy'), false);

      const appOne = express();
      configureTrustProxy(appOne, '1');
      assert.equal(appOne.get('trust proxy'), 1);

      const appTrue = express();
      configureTrustProxy(appTrue, 'true');
      assert.equal(appTrue.get('trust proxy'), 1);

      const appUnknown = express();
      configureTrustProxy(appUnknown, 'invalid-proxy-config');
      assert.equal(appUnknown.get('trust proxy'), false);
    });
  });
});
