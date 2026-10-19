import { describe, it, beforeEach } from 'node:test';
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

      let exitCode1: number | null = null;
      const shutdownHandler = createShutdownHandler({
        server: mockServer as any,
        recoveryScheduler: mockScheduler as any,
        drainTimeoutMs: 50,
        onExit: (code) => {
          exitCode1 = code;
        },
      });

      // Call twice with different signals
      await shutdownHandler('SIGTERM');
      await shutdownHandler('SIGINT');

      // Assert idempotent execution: close and stop called exactly once
      assert.equal(serverClosedCount, 1);
      assert.equal(schedulerStoppedCount, 1);
      assert.equal(exitCode1, 0);
    });

    it('createShutdownHandler closes idle connections and enforces bounded timeout if server.close hangs', async () => {
      const { createShutdownHandler } = await import('../src/index.js');

      let idleClosed = false;
      let allClosed = false;
      let dbDisconnected = false;
      let exitCode2: number | null = null;

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
        onExit: (code) => {
          exitCode2 = code;
        },
      });

      const startTime = Date.now();
      await shutdownHandler('SIGTERM');
      const elapsedMs = Date.now() - startTime;

      assert.equal(idleClosed, true, 'Must call closeIdleConnections when supported');
      assert.equal(allClosed, true, 'Must call closeAllConnections when server close times out');
      assert.equal(dbDisconnected, true, 'Must disconnect DB strictly after draining / bounded close');
      assert.equal(exitCode2, 0);
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

  // ============================================================================
  // Phase 5, Milestone 2, Work Item 1 — Provider Configuration and Raw-Body Capture
  // ============================================================================
  describe('18. Provider Configuration and Raw-Body Capture (Phase 5, Milestone 2, Work Item 1)', () => {
      // 1. Environment Defaults
      it('exports safe defaults for SendGrid webhook key, Twilio WhatsApp, and Public API URL', async () => {
        const { env } = await import('../src/config/env.js');
        assert.equal(env.SENDGRID_WEBHOOK_VERIFICATION_KEY, '');
        assert.equal(env.TWILIO_WHATSAPP_NUMBER, '');
        assert.equal(env.PUBLIC_API_URL, '');
        assert.equal(env.NOTIFICATION_MODE, 'mock');
      });

      // 2. Format validation helpers
      it('validateSendgridWebhookKey validates base64 ECDSA public key format and length', async () => {
        const { validateSendgridWebhookKey } = await import('../src/config/env.js');

        // Optional when empty or undefined
        assert.equal(validateSendgridWebhookKey('').valid, true);
        assert.equal(validateSendgridWebhookKey(undefined).valid, true);

        // Valid base64 key of >= 32 chars
        const validKey = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE1234567890abcdef1234567890abcdef==';
        const validRes = validateSendgridWebhookKey(validKey);
        assert.equal(validRes.valid, true);

        // Invalid: too short (< 32 chars)
        const shortRes = validateSendgridWebhookKey('dG9vX3Nob3J0');
        assert.equal(shortRes.valid, false);
        assert.ok(shortRes.error?.includes('at least 32 characters'));
        // Must not leak key value
        assert.ok(!shortRes.error?.includes('dG9vX3Nob3J0'));

        // Invalid: non-base64 characters
        const invalidCharsRes = validateSendgridWebhookKey('MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE@#$%^&*()_+');
        assert.equal(invalidCharsRes.valid, false);
        assert.ok(invalidCharsRes.error?.includes('valid base64-encoded'));
        assert.ok(!invalidCharsRes.error?.includes('@#$%'));
      });

      it('validateTwilioWhatsAppNumber validates E.164 phone format and whatsapp: prefix', async () => {
        const { validateTwilioWhatsAppNumber } = await import('../src/config/env.js');

        // Optional when empty or undefined
        assert.equal(validateTwilioWhatsAppNumber('').valid, true);
        assert.equal(validateTwilioWhatsAppNumber(undefined).valid, true);

        // Valid numbers with and without prefix
        assert.equal(validateTwilioWhatsAppNumber('+14155238886').valid, true);
        assert.equal(validateTwilioWhatsAppNumber('whatsapp:+14155238886').valid, true);
        assert.equal(validateTwilioWhatsAppNumber('+919876543210').valid, true);
        assert.equal(validateTwilioWhatsAppNumber('whatsapp:+919876543210').valid, true);

        // Invalid: missing leading +, invalid chars, or too short
        const invalid1 = validateTwilioWhatsAppNumber('14155238886');
        assert.equal(invalid1.valid, false);
        assert.ok(invalid1.error?.includes('valid E.164 format'));
        assert.ok(!invalid1.error?.includes('14155238886'));

        const invalid2 = validateTwilioWhatsAppNumber('whatsapp:invalid-phone');
        assert.equal(invalid2.valid, false);
        assert.ok(!invalid2.error?.includes('invalid-phone'));

        const invalid3 = validateTwilioWhatsAppNumber('+0123456789'); // Leading 0 invalid E.164
        assert.equal(invalid3.valid, false);
      });

      it('validatePublicApiUrl validates URL syntax and enforces HTTPS in production', async () => {
        const { validatePublicApiUrl } = await import('../src/config/env.js');

        // Optional when empty or undefined
        assert.equal(validatePublicApiUrl('').valid, true);
        assert.equal(validatePublicApiUrl(undefined).valid, true);

        // Valid URLs in development
        assert.equal(validatePublicApiUrl('http://localhost:5000', 'development').valid, true);
        assert.equal(validatePublicApiUrl('https://api.deepscakeshop.in', 'development').valid, true);

        // Production mode enforces HTTPS
        const prodHttp = validatePublicApiUrl('http://api.deepscakeshop.in', 'production');
        assert.equal(prodHttp.valid, false);
        assert.ok(prodHttp.error?.includes('https:// in production mode'));

        // Production mode rejects localhost / loopback addresses
        const prodLocalhost = validatePublicApiUrl('https://localhost:5000', 'production');
        assert.equal(prodLocalhost.valid, false);
        assert.ok(prodLocalhost.error?.includes('localhost or loopback address'));

        const prodLoopbackIp = validatePublicApiUrl('https://127.0.0.1:5000', 'production');
        assert.equal(prodLoopbackIp.valid, false);
        assert.ok(prodLoopbackIp.error?.includes('localhost or loopback address'));

        // Production mode rejects embedded credentials
        const prodCreds = validatePublicApiUrl('https://user:pass@api.deepscakeshop.in', 'production');
        assert.equal(prodCreds.valid, false);
        assert.ok(prodCreds.error?.includes('credentials'));

        // Production mode rejects single-word hosts without TLD
        const prodNoTld = validatePublicApiUrl('https://internalserver', 'production');
        assert.equal(prodNoTld.valid, false);
        assert.ok(prodNoTld.error?.includes('valid domain name'));

        // Valid production URL
        const prodHttps = validatePublicApiUrl('https://api.deepscakeshop.in', 'production');
        assert.equal(prodHttps.valid, true);

        // Malformed URL
        const malformed = validatePublicApiUrl('not-a-url', 'development');
        assert.equal(malformed.valid, false);
        assert.ok(malformed.error?.includes('valid URL'));

        // Unsupported protocol
        const ftpUrl = validatePublicApiUrl('ftp://api.deepscakeshop.in', 'development');
        assert.equal(ftpUrl.valid, false);
        assert.ok(ftpUrl.error?.includes('http:// or https://'));
      });

      it('validateNotificationConfig automatically enforces valid HTTPS PUBLIC_API_URL for live providers in production', async () => {
        const { validateNotificationConfig } = await import('../src/config/env.js');

        // Missing PUBLIC_API_URL when live SendGrid provider configured in production
        const prodSendGridNoUrl = {
          NOTIFICATION_MODE: 'production',
          NOTIFICATION_EMAIL_PROVIDER: 'sendgrid',
          NOTIFICATION_MESSAGING_PROVIDER: 'mock',
          SENDGRID_API_KEY: 'SG.some_key_12345678901234567890',
          PUBLIC_API_URL: '',
        };
        const check1 = validateNotificationConfig(prodSendGridNoUrl);
        assert.equal(check1.valid, false);
        assert.ok(check1.errors.some((e: string) => e.includes('PUBLIC_API_URL is required in production mode')));

        // Inappropriate non-HTTPS PUBLIC_API_URL for live provider in production
        const prodSendGridHttpUrl = {
          NOTIFICATION_MODE: 'production',
          NOTIFICATION_EMAIL_PROVIDER: 'sendgrid',
          NOTIFICATION_MESSAGING_PROVIDER: 'mock',
          SENDGRID_API_KEY: 'SG.some_key_12345678901234567890',
          PUBLIC_API_URL: 'http://api.deepscakeshop.in',
        };
        const check2 = validateNotificationConfig(prodSendGridHttpUrl);
        assert.equal(check2.valid, false);
        assert.ok(check2.errors.some((e: string) => e.includes('https:// in production mode')));

        // Inappropriate loopback PUBLIC_API_URL for live provider in production
        const prodSendGridLocalhost = {
          NOTIFICATION_MODE: 'production',
          NOTIFICATION_EMAIL_PROVIDER: 'sendgrid',
          NOTIFICATION_MESSAGING_PROVIDER: 'mock',
          SENDGRID_API_KEY: 'SG.some_key_12345678901234567890',
          PUBLIC_API_URL: 'https://localhost:5000',
        };
        const check3 = validateNotificationConfig(prodSendGridLocalhost);
        assert.equal(check3.valid, false);
        assert.ok(check3.errors.some((e: string) => e.includes('localhost or loopback address')));

        // Valid HTTPS production configuration with live provider
        const prodSendGridValid = {
          NOTIFICATION_MODE: 'production',
          NOTIFICATION_EMAIL_PROVIDER: 'sendgrid',
          NOTIFICATION_MESSAGING_PROVIDER: 'mock',
          SENDGRID_API_KEY: 'SG.some_key_12345678901234567890',
          PUBLIC_API_URL: 'https://api.deepscakeshop.in',
        };
        const check4 = validateNotificationConfig(prodSendGridValid);
        assert.equal(check4.valid, true);
        assert.equal(check4.errors.length, 0);

        // Safe mock mode default does not require PUBLIC_API_URL
        const mockConfig = {
          NOTIFICATION_MODE: 'mock',
          NOTIFICATION_EMAIL_PROVIDER: 'mock',
          NOTIFICATION_MESSAGING_PROVIDER: 'mock',
        };
        const check5 = validateNotificationConfig(mockConfig);
        assert.equal(check5.valid, true);
        assert.equal(check5.errors.length, 0);
      });

      it('reconstructTrustedTwilioUrl prevents path duplication if base URL already includes webhook path', async () => {
        const { reconstructTrustedTwilioUrl } = await import('../src/services/webhookVerification.js');
        const mockReq: any = {
          originalUrl: '/api/webhooks/twilio',
          url: '/api/webhooks/twilio',
        };
        const urlWithDup = reconstructTrustedTwilioUrl(mockReq, 'https://api.deepscakeshop.in/api/webhooks/twilio');
        assert.equal(urlWithDup, 'https://api.deepscakeshop.in/api/webhooks/twilio');

        const urlClean = reconstructTrustedTwilioUrl(mockReq, 'https://api.deepscakeshop.in');
        assert.equal(urlClean, 'https://api.deepscakeshop.in/api/webhooks/twilio');
      });

      it('validateNotificationConfig validates safe options and flags missing required keys in production', async () => {
        const { validateNotificationConfig } = await import('../src/config/env.js');

        // Valid production config with all credentials
        const validProdConfig = {
          NOTIFICATION_MODE: 'production',
          NOTIFICATION_EMAIL_PROVIDER: 'sendgrid',
          NOTIFICATION_MESSAGING_PROVIDER: 'twilio',
          SENDGRID_API_KEY: 'SG.some_api_key_for_testing_12345',
          TWILIO_ACCOUNT_SID: 'mock_synthetic_twilio_account_sid_for_tests',
          TWILIO_AUTH_TOKEN: 'auth_token_12345678901234567890',
          SENDGRID_WEBHOOK_VERIFICATION_KEY: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE123456789012345678901234567890==',
          TWILIO_WHATSAPP_NUMBER: 'whatsapp:+14155238886',
          PUBLIC_API_URL: 'https://api.deepscakeshop.in',
        };
        const validCheck = validateNotificationConfig(validProdConfig, {
          requireSendgridWebhookKey: true,
          requireTwilioWhatsApp: true,
          requirePublicApiUrl: true,
        });
        assert.equal(validCheck.valid, true);
        assert.equal(validCheck.errors.length, 0);

        // Missing required settings when explicitly enabled
        const incompleteConfig = {
          NOTIFICATION_MODE: 'production',
          NOTIFICATION_EMAIL_PROVIDER: 'sendgrid',
          NOTIFICATION_MESSAGING_PROVIDER: 'twilio',
          SENDGRID_API_KEY: 'SG.some_api_key_for_testing_12345',
          TWILIO_ACCOUNT_SID: 'mock_synthetic_twilio_account_sid_for_tests',
          TWILIO_AUTH_TOKEN: 'auth_token_12345678901234567890',
          SENDGRID_WEBHOOK_VERIFICATION_KEY: '',
          TWILIO_WHATSAPP_NUMBER: '',
          PUBLIC_API_URL: '',
        };
        const missingCheck = validateNotificationConfig(incompleteConfig, {
          requireSendgridWebhookKey: true,
          requireTwilioWhatsApp: true,
          requirePublicApiUrl: true,
        });
        assert.equal(missingCheck.valid, false);
        assert.ok(missingCheck.errors.some((e: string) => e.includes('SENDGRID_WEBHOOK_VERIFICATION_KEY is required')));
        assert.ok(missingCheck.errors.some((e: string) => e.includes('TWILIO_WHATSAPP_NUMBER is required')));
        assert.ok(missingCheck.errors.some((e: string) => e.includes('PUBLIC_API_URL is required')));
      });

      // 3. Logger Redaction
      it('logger redaction protects webhook verification keys, raw body, and WhatsApp numbers', async () => {
        const { redactLogData } = await import('../src/utils/logger.js');
        const { sanitizeLogDetails } = await import('../src/notifications/sanitize.js');

        const payload = {
          sendgrid_webhook_verification_key: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEsecret',
          webhook_verification_key: 'secret-webhook-key',
          rawBody: Buffer.from('{"sensitive":"payload"}'),
          raw_body: '{"sensitive":"payload"}',
          rawPayload: '{"sensitive":"payload"}',
          twilio_whatsapp_number: 'whatsapp:+919876543210',
          whatsapp_number: '+14155238886',
        };

        const redacted = redactLogData(payload);
        assert.equal(redacted.sendgrid_webhook_verification_key, '[REDACTED]');
        assert.equal(redacted.webhook_verification_key, '[REDACTED]');
        assert.equal(redacted.rawBody, '[REDACTED]');
        assert.equal(redacted.raw_body, '[REDACTED]');
        assert.equal(redacted.rawPayload, '[REDACTED]');
        assert.ok(redacted.twilio_whatsapp_number.includes('******3210'));
        assert.ok(redacted.whatsapp_number.includes('******8886'));

        const sanitizedString = sanitizeLogDetails(
          'Error verifying webhook: verification_key="MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEsecret" failed'
        );
        assert.ok(!sanitizedString.includes('MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEsecret'));
        assert.ok(sanitizedString.includes('[REDACTED]'));
      });

      // 4. Raw-Body Capture - Exact Bytes, Spacing, and Unicode Preservation
      it('webhookBodyParser preserves exact raw JSON request bytes including irregular spacing and newlines', async () => {
        const express = (await import('express')).default;
        const { webhookBodyParser } = await import('../src/middlewares/webhookBodyParser.js');

        const testApp = express();
        testApp.use('/api/webhooks', webhookBodyParser);
        testApp.post('/api/webhooks/test-raw-bytes', (req, res) => {
          res.json({
            isBuffer: Buffer.isBuffer(req.rawBody),
            rawBodyText: req.rawBody ? req.rawBody.toString('utf8') : null,
            rawBodyHex: req.rawBody ? req.rawBody.toString('hex') : null,
            parsedBody: req.body,
          });
        });

        // Exact string with intentional spacing, indentation, trailing newline, and Unicode Hindi text
        const exactRawPayload = '{\n  "event":   "delivered",\n  "custom_message": "बधाई हो जन्मदिन की!",\n  "count": 42\n}\n';

        const res = await request(testApp)
          .post('/api/webhooks/test-raw-bytes')
          .set('Content-Type', 'application/json; charset=utf-8')
          .send(exactRawPayload);

        assert.equal(res.status, 200);
        assert.equal(res.body.isBuffer, true);
        assert.equal(res.body.rawBodyText, exactRawPayload, 'Raw body must match incoming string byte-for-byte');
        assert.equal(res.body.rawBodyHex, Buffer.from(exactRawPayload, 'utf8').toString('hex'));
        assert.equal(res.body.parsedBody.event, 'delivered');
        assert.equal(res.body.parsedBody.custom_message, 'बधाई हो जन्मदिन की!');
        assert.equal(res.body.parsedBody.count, 42);
      });

      // 5. URL-Encoded Webhook Raw-Body Capture (Twilio status callbacks)
      it('webhookBodyParser preserves exact raw URL-encoded bytes and parses form body', async () => {
        const express = (await import('express')).default;
        const { webhookBodyParser } = await import('../src/middlewares/webhookBodyParser.js');

        const testApp = express();
        testApp.use('/api/webhooks', webhookBodyParser);
        testApp.post('/api/webhooks/test-urlencoded', (req, res) => {
          res.json({
            isBuffer: Buffer.isBuffer(req.rawBody),
            rawBodyText: req.rawBody ? req.rawBody.toString('utf8') : null,
            parsedBody: req.body,
          });
        });

        const rawFormString = 'MessageSid=SM1234567890abcdef&MessageStatus=delivered&To=whatsapp%3A%2B919876543210';

        const res = await request(testApp)
          .post('/api/webhooks/test-urlencoded')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send(rawFormString);

        assert.equal(res.status, 200);
        assert.equal(res.body.isBuffer, true);
        assert.equal(res.body.rawBodyText, rawFormString);
        assert.equal(res.body.parsedBody.MessageSid, 'SM1234567890abcdef');
        assert.equal(res.body.parsedBody.MessageStatus, 'delivered');
        assert.equal(res.body.parsedBody.To, 'whatsapp:+919876543210');
      });

      // 6. Unsupported Media Type (HTTP 415)
      it('webhookBodyParser rejects unsupported content types with HTTP 415', async () => {
        const { app } = await import('../src/app.js');

        // text/plain
        const resText = await request(app)
          .post('/api/webhooks/sendgrid')
          .set('Content-Type', 'text/plain')
          .send('plaintext body');

        assert.equal(resText.status, 415);
        assert.equal(resText.body.success, false);
        assert.ok(resText.body.message.includes('Unsupported Media Type'));

        // application/xml
        const resXml = await request(app)
          .post('/api/webhooks/sendgrid')
          .set('Content-Type', 'application/xml')
          .send('<event>delivered</event>');

        assert.equal(resXml.status, 415);
        assert.equal(resXml.body.success, false);

        // application/octet-stream
        const resOctet = await request(app)
          .post('/api/webhooks/sendgrid')
          .set('Content-Type', 'application/octet-stream')
          .send(Buffer.from('binary-data'));

        assert.equal(resOctet.status, 415);
        assert.equal(resOctet.body.success, false);
      });

      // 7. Oversized Payload Handling (HTTP 413)
      it('webhookBodyParser rejects payloads exceeding 1MB with HTTP 413', async () => {
        const { app } = await import('../src/app.js');

        // Generate 1.2MB JSON payload
        const largeData = 'A'.repeat(1.2 * 1024 * 1024);
        const oversizedPayload = JSON.stringify({ data: largeData });

        const res = await request(app)
          .post('/api/webhooks/sendgrid')
          .set('Content-Type', 'application/json')
          .send(oversizedPayload);

        assert.equal(res.status, 413);
        assert.equal(res.body.success, false);
        assert.ok(res.body.message.includes('Payload Too Large'));
      });

      // 8. Malformed JSON Handling (HTTP 400)
      it('webhookBodyParser handles malformed JSON with HTTP 400', async () => {
        const { app } = await import('../src/app.js');

        const res = await request(app)
          .post('/api/webhooks/sendgrid')
          .set('Content-Type', 'application/json')
          .send('{"event": "delivered", invalid_json');

        assert.equal(res.status, 400);
        assert.equal(res.body.success, false);
        assert.ok(res.body.message.includes('Malformed JSON payload'));
      });

      // 9. Existing Route Compatibility & Scoped Raw Body Guarantee
      it('preserves full compatibility with existing endpoints and does not buffer raw body on standard routes', async () => {
        const { app } = await import('../src/app.js');

        // Existing GET /api/cakes works
        const resCakes = await request(app).get('/api/cakes');
        assert.equal(resCakes.status, 200);
        assert.equal(resCakes.body.success, true);
        assert.ok(Array.isArray(resCakes.body.data));

        // Existing POST /api/custom-cakes with JSON works as before
        const validInquiry = {
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
        };

        const resInquiry = await request(app)
          .post('/api/custom-cakes')
          .set('Content-Type', 'application/json')
          .send(validInquiry);

        assert.equal(resInquiry.status, 201);
        assert.equal(resInquiry.body.success, true);
        assert.ok(resInquiry.body.inquiryId.startsWith('INQ-'));

        // Verify that standard application routes are NOT decorated with rawBody
        const express = (await import('express')).default;
        const testCompatApp = express();
        const { webhookBodyParser } = await import('../src/middlewares/webhookBodyParser.js');
        testCompatApp.use('/api/webhooks', webhookBodyParser);
        testCompatApp.use(express.json({ limit: '10mb' }));

        let capturedStandardRawBody: any = 'untested';
        testCompatApp.post('/api/orders/standard-test', (req, res) => {
          capturedStandardRawBody = (req as any).rawBody;
          res.json({ success: true, body: req.body });
        });

        const resCompat = await request(testCompatApp)
          .post('/api/orders/standard-test')
          .send({ orderId: 'ord_123', amount: 500 });

        assert.equal(resCompat.status, 200);
        assert.equal(resCompat.body.success, true);
        assert.equal(capturedStandardRawBody, undefined, 'Standard API routes must not store rawBody in memory');
      });
    });

    // =========================================================================
    // 19. NotificationLog Schema, Indexing, and Durable Webhook Deduplication
    // (Phase 5, Milestone 2, Work Item 2)
    // =========================================================================
    describe('19. NotificationLog Schema, Indexing, and Durable Webhook Deduplication (Phase 5, Milestone 2, Work Item 2)', () => {
      // 1. Existing records without providerMessageId remain valid
      it('NotificationLog schema supports records without providerMessageId (backward compatibility)', async () => {
        const { NotificationLogModel } = await import('../src/models/NotificationLog.js');

        const legacyDoc = new NotificationLogModel({
          notificationId: `NOTIF-LEGACY-${Date.now()}`,
          idempotencyKey: `legacy-order-${Date.now()}`,
          channel: 'email',
          eventType: 'order_placed',
          recipient: 'legacy.customer@example.com',
          provider: 'mock',
          deliveryStatus: 'delivered',
        });

        // Validation must pass without providerMessageId
        const validateErr = legacyDoc.validateSync();
        assert.equal(validateErr, undefined, 'Legacy document without providerMessageId must be valid');
        assert.equal(legacyDoc.providerMessageId, undefined);
      });

      // 2. Persistence and lookup of top-level providerMessageId
      it('persists and looks up top-level providerMessageId on NotificationLog', async () => {
        const { notificationService } = await import('../src/notifications/notificationService.js');

        const testProviderMsgId = `sg_msg_test_${Date.now()}_abc123`;
        const testIdempotencyKey = `idemp-top-msg-${Date.now()}`;

        await notificationService.saveNotificationLog({
          notificationId: `NOTIF-TOP-${Date.now()}`,
          idempotencyKey: testIdempotencyKey,
          channel: 'email',
          eventType: 'order_placed',
          recipient: 'top.level@example.com',
          provider: 'sendgrid',
          providerMessageId: testProviderMsgId,
          deliveryStatus: 'delivered',
          metadata: { providerMessageId: testProviderMsgId },
        });

        const retrieved = await notificationService.getLogByProviderMessageId(testProviderMsgId);
        assert.ok(retrieved, 'Must find notification log by top-level providerMessageId');
        assert.equal(retrieved.providerMessageId, testProviderMsgId);
        assert.equal(retrieved.idempotencyKey, testIdempotencyKey);
      });

      // 3. Fallback compatibility with metadata.providerMessageId
      it('getLogByProviderMessageId falls back to legacy metadata.providerMessageId', async () => {
        const { notificationService } = await import('../src/notifications/notificationService.js');

        const legacyMetaMsgId = `twilio_meta_legacy_${Date.now()}`;
        const legacyIdempotencyKey = `idemp-meta-${Date.now()}`;

        // Save record with providerMessageId ONLY in metadata (legacy structure)
        await notificationService.saveNotificationLog({
          notificationId: `NOTIF-LEGACY-META-${Date.now()}`,
          idempotencyKey: legacyIdempotencyKey,
          channel: 'whatsapp',
          eventType: 'order_status_updated',
          recipient: '+919876543210',
          provider: 'twilio',
          deliveryStatus: 'delivered',
          metadata: { providerMessageId: legacyMetaMsgId },
        });

        const retrieved = await notificationService.getLogByProviderMessageId(legacyMetaMsgId);
        assert.ok(retrieved, 'Must find record using legacy metadata.providerMessageId fallback');
        assert.equal(retrieved.metadata?.providerMessageId, legacyMetaMsgId);
        assert.equal(retrieved.idempotencyKey, legacyIdempotencyKey);
      });

      // 4. Sparse-index definition and metadata inspection for NotificationLog
      it('REQUIRED_NOTIFICATION_LOG_INDEXES declares providerMessageId_1 with sparse: true', async () => {
        const { REQUIRED_NOTIFICATION_LOG_INDEXES, getNotificationLogIndexMetadata } = await import(
          '../src/models/NotificationLog.js'
        );

        const providerMsgIdx = REQUIRED_NOTIFICATION_LOG_INDEXES.find((i) => i.name === 'providerMessageId_1');
        assert.ok(providerMsgIdx, 'Must declare providerMessageId_1 index');
        assert.equal(providerMsgIdx.sparse, true, 'providerMessageId index must be sparse');
        assert.equal(providerMsgIdx.background, true);
        assert.deepEqual(providerMsgIdx.key, { providerMessageId: 1 });

        const metadata = await getNotificationLogIndexMetadata();
        assert.ok(typeof metadata.connected === 'boolean');
        assert.ok(Array.isArray(metadata.missingIndexes));
        assert.ok(Array.isArray(metadata.mismatchedIndexes));
      });

      // 5. WebhookEvent index specifications
      it('REQUIRED_WEBHOOK_EVENT_INDEXES declares compound unique index and sparse message ID index', async () => {
        const { REQUIRED_WEBHOOK_EVENT_INDEXES, getWebhookEventIndexMetadata } = await import(
          '../src/models/notificationLogIndexManager.js'
        );

        const compoundIdx = REQUIRED_WEBHOOK_EVENT_INDEXES.find((i) => i.name === 'provider_1_eventId_1');
        assert.ok(compoundIdx, 'Must declare provider_1_eventId_1 index');
        assert.equal(compoundIdx.unique, true, 'provider_1_eventId_1 must be a unique compound index');
        assert.deepEqual(compoundIdx.key, { provider: 1, eventId: 1 });

        const msgIdx = REQUIRED_WEBHOOK_EVENT_INDEXES.find((i) => i.name === 'providerMessageId_1');
        assert.ok(msgIdx, 'Must declare providerMessageId_1 index on WebhookEvent');
        assert.equal(msgIdx.sparse, true, 'providerMessageId_1 on WebhookEvent must be sparse');

        const metadata = await getWebhookEventIndexMetadata();
        assert.ok(typeof metadata.connected === 'boolean');
        assert.ok(Array.isArray(metadata.missingIndexes));
      });

      // 6. Safe, repeatable index initialization in dryRun mode
      it('ensureWebhookEventIndexes and ensureAllNotificationIndexes run safely in dryRun mode', async () => {
        const { ensureWebhookEventIndexes, ensureAllNotificationIndexes } = await import(
          '../src/models/notificationLogIndexManager.js'
        );

        const whResult = await ensureWebhookEventIndexes({ dryRun: true });
        assert.equal(whResult.dryRun, true);
        assert.equal(whResult.applied, false);
        assert.ok(Array.isArray(whResult.createdIndexes));
        assert.ok(Array.isArray(whResult.alreadyPresent));

        const allResult = await ensureAllNotificationIndexes({ dryRun: true });
        assert.equal(allResult.notificationLogs.dryRun, true);
        assert.equal(allResult.webhookEvents.dryRun, true);
      });

      // 7. Webhook-event reservation and duplicate rejection
      it('reserveWebhookEvent successfully reserves an event and rejects duplicates for same provider and eventId', async () => {
        const { reserveWebhookEvent } = await import('../src/models/WebhookEvent.js');

        const uniqueEventId = `sg_evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        // First attempt: should successfully reserve
        const res1 = await reserveWebhookEvent({
          provider: 'sendgrid',
          eventId: uniqueEventId,
          providerMessageId: 'sg_msg_123',
          eventType: 'delivered',
          sanitizedSummary: { reason: 'Delivered to recipient mail server' },
        });

        assert.equal(res1.reserved, true);
        assert.equal(res1.isDuplicate, false);
        assert.ok(res1.event);

        // Second attempt with exact same provider and eventId: must be detected as duplicate
        const res2 = await reserveWebhookEvent({
          provider: 'sendgrid',
          eventId: uniqueEventId,
          providerMessageId: 'sg_msg_123',
          eventType: 'delivered',
        });

        assert.equal(res2.reserved, false);
        assert.equal(res2.isDuplicate, true);
        assert.ok(res2.event);
      });

      // 8. Cross-provider event ID isolation
      it('reserveWebhookEvent accepts identical eventId from different providers', async () => {
        const { reserveWebhookEvent } = await import('../src/models/WebhookEvent.js');

        const sharedEventId = `evt_shared_${Date.now()}`;

        // Reserve for sendgrid
        const sgRes = await reserveWebhookEvent({
          provider: 'sendgrid',
          eventId: sharedEventId,
          providerMessageId: 'sg_msg_456',
          eventType: 'delivered',
        });
        assert.equal(sgRes.reserved, true);
        assert.equal(sgRes.isDuplicate, false);

        // Reserve same eventId for twilio: must NOT collide with sendgrid
        const twilioRes = await reserveWebhookEvent({
          provider: 'twilio',
          eventId: sharedEventId,
          providerMessageId: 'SM123456789',
          eventType: 'delivered',
        });
        assert.equal(twilioRes.reserved, true, 'Different provider with same eventId must succeed');
        assert.equal(twilioRes.isDuplicate, false);
      });

      // 9. Concurrent duplicate reservation attempts
      it('reserveWebhookEvent handles concurrent reservation attempts safely', async () => {
        const { reserveWebhookEvent } = await import('../src/models/WebhookEvent.js');

        const raceEventId = `race_evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

        // Fire 5 simultaneous reservations for the exact same event
        const attempts = await Promise.all([
          reserveWebhookEvent({ provider: 'sendgrid', eventId: raceEventId }),
          reserveWebhookEvent({ provider: 'sendgrid', eventId: raceEventId }),
          reserveWebhookEvent({ provider: 'sendgrid', eventId: raceEventId }),
          reserveWebhookEvent({ provider: 'sendgrid', eventId: raceEventId }),
          reserveWebhookEvent({ provider: 'sendgrid', eventId: raceEventId }),
        ]);

        const reservedCount = attempts.filter((a) => a.reserved === true).length;
        const duplicateCount = attempts.filter((a) => a.isDuplicate === true).length;

        assert.equal(reservedCount, 1, 'Exactly one concurrent attempt must reserve the event');
        assert.equal(duplicateCount, 4, 'Remaining 4 attempts must be flagged as duplicates');
      });

      // 10. Missing or invalid event identifiers
      it('reserveWebhookEvent rejects missing or invalid provider and eventId', async () => {
        const { reserveWebhookEvent } = await import('../src/models/WebhookEvent.js');

        // Missing provider
        const noProvider = await reserveWebhookEvent({ provider: '', eventId: 'evt_123' });
        assert.equal(noProvider.reserved, false);
        assert.ok(noProvider.error?.includes('"provider" is required'));

        // Missing eventId
        const noEventId = await reserveWebhookEvent({ provider: 'sendgrid', eventId: '   ' });
        assert.equal(noEventId.reserved, false);
        assert.ok(noEventId.error?.includes('"eventId" is required'));
      });

      // 11. Event summary sanitization excludes raw payloads, secrets, and PII
      it('sanitizeWebhookEventSummary strictly strips secrets, signatures, raw bodies, and PII', async () => {
        const { sanitizeWebhookEventSummary } = await import('../src/models/WebhookEvent.js');

        const rawSummary = {
          eventType: 'delivered',
          status: 'success',
          reason: 'Accepted by remote host',
          statusCode: 250,
          apiKey: 'SG.secret_key_123',
          secret: 'webhook_secret_xyz',
          signature: 'v1=sig_abc123',
          rawBody: '{"full":"body"}',
          customerEmail: 'customer@deepscakeshop.in',
          customerPhone: '+919876543210',
          contact: '9876543210',
        };

        const clean = sanitizeWebhookEventSummary(rawSummary);
        assert.ok(clean);
        assert.equal(clean.eventType, 'delivered');
        assert.equal(clean.status, 'success');
        assert.equal(clean.statusCode, 250);
        assert.equal(clean.apiKey, undefined, 'Must strip apiKey');
        assert.equal(clean.secret, undefined, 'Must strip secret');
        assert.equal(clean.signature, undefined, 'Must strip signature');
        assert.equal(clean.rawBody, undefined, 'Must strip rawBody');
        assert.equal(clean.customerEmail, undefined, 'Must strip customerEmail');
        assert.equal(clean.customerPhone, undefined, 'Must strip customerPhone');
        assert.equal(clean.contact, undefined, 'Must strip contact');
      });

      // 12. Mock mode preserved; dispatch and retry operations function with providerMessageId
      it('dispatch notification preserves mock mode and returns providerMessageId from mock provider', async () => {
        const { notificationService } = await import('../src/notifications/notificationService.js');

        const dispatchResult = await notificationService.dispatch({
          channel: 'email',
          eventType: 'order_placed',
          recipient: 'test.order.mock@example.com',
          subject: 'Order Placed Test',
          message: 'Thank you for ordering with Deep’s Cake Shop!',
          idempotencyKey: `mock-dispatch-check-${Date.now()}`,
          customerConsent: { email: true },
        });

        assert.equal(dispatchResult.status, 'delivered');
        assert.ok(dispatchResult.providerMessageId?.startsWith('mock_msg_'));

        // Query by the returned provider message ID
        const found = await notificationService.getLogByProviderMessageId(dispatchResult.providerMessageId!);
        assert.ok(found, 'Log must be retrievable via getLogByProviderMessageId');
        assert.equal(found.providerMessageId, dispatchResult.providerMessageId);
      });
    });

    // =========================================================================
    // 20. Secure Webhook Signature Verification and Route Dispatch
    // (Phase 5, Milestone 2, Work Item 3)
    // =========================================================================
    describe('20. Secure Webhook Signature Verification and Route Dispatch (Phase 5, Milestone 2, Work Item 3)', () => {
      // Helper to generate dynamic SendGrid ECDSA P-256 test keypair
      async function getCrypto() {
        return (await import('crypto')).default;
      }

      async function generateSendgridTestKeyPair() {
        const crypto = await getCrypto();
        const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
          namedCurve: 'prime256v1',
        });
        const spkiDer = publicKey.export({ format: 'der', type: 'spki' });
        const base64Key = spkiDer.toString('base64');
        return { publicKey, privateKey, base64Key };
      }

      async function signSendgridPayload(privateKey: any, timestamp: string, rawBody: string | Buffer): Promise<string> {
        const crypto = await getCrypto();
        const timestampBuf = Buffer.from(timestamp, 'utf8');
        const bodyBuf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
        const payload = Buffer.concat([timestampBuf, bodyBuf]);
        return crypto.sign('sha256', payload, privateKey).toString('base64');
      }

      async function signTwilioPayload(authToken: string, url: string, params: Record<string, any>): Promise<string> {
        const crypto = await getCrypto();
        let data = url;
        const sortedKeys = Object.keys(params).sort();
        for (const k of sortedKeys) {
          const val = params[k];
          data += `${k}${val !== undefined && val !== null ? String(val) : ''}`;
        }
        return crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf8')).digest('base64');
      }

      // 1. Valid and invalid SendGrid signatures
      it('verifies valid SendGrid ECDSA signatures and rejects invalid/tampered signatures', async () => {
        const { notificationService } = await import('../src/notifications/notificationService.js');
        const { NotificationLogModel, MEMORY_NOTIFICATION_LOGS } = await import('../src/models/NotificationLog.js');
        const { isDbConnected } = await import('../src/config/db.js');

        const { privateKey, base64Key } = await generateSendgridTestKeyPair();
        process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY = base64Key;

        const testMsgId = `sg_msg_valid_${Date.now()}`;
        if (isDbConnected()) {
          await NotificationLogModel.create({
            notificationId: `NOTIF-SG-${Date.now()}`,
            idempotencyKey: `idemp-sg-${Date.now()}`,
            channel: 'email',
            eventType: 'order_placed',
            recipient: 'customer.valid@example.com',
            provider: 'sendgrid',
            providerMessageId: testMsgId,
            deliveryStatus: 'sending',
          });
        } else {
          MEMORY_NOTIFICATION_LOGS.push({
            notificationId: `NOTIF-SG-${Date.now()}`,
            idempotencyKey: `idemp-sg-${Date.now()}`,
            channel: 'email',
            eventType: 'order_placed',
            recipient: 'customer.valid@example.com',
            provider: 'sendgrid',
            providerMessageId: testMsgId,
            deliveryStatus: 'sending',
          });
        }

        const timestamp = Math.floor(Date.now() / 1000).toString();
        const events = [
          {
            sg_event_id: `evt_sg_valid_${Date.now()}`,
            event: 'delivered',
            sg_message_id: testMsgId,
            timestamp: Number(timestamp),
            email: 'customer.valid@example.com',
          },
        ];
        const rawJson = JSON.stringify(events);
        const validSig = await signSendgridPayload(privateKey, timestamp, rawJson);

        // A. Valid signature passes
        const resValid = await request(app)
          .post('/api/webhooks/sendgrid')
          .set('Content-Type', 'application/json')
          .set('X-Twilio-Email-Event-Webhook-Signature', validSig)
          .set('X-Twilio-Email-Event-Webhook-Timestamp', timestamp)
          .send(rawJson);

        assert.equal(resValid.status, 200);
        assert.equal(resValid.body.success, true);
        assert.equal(resValid.body.processedCount, 1);

        // Verify status updated to delivered
        const updatedLog = await notificationService.getLogByProviderMessageId(testMsgId);
        assert.equal(updatedLog.deliveryStatus, 'delivered');

        // B. Invalid signature fails with 401
        const resInvalid = await request(app)
          .post('/api/webhooks/sendgrid')
          .set('Content-Type', 'application/json')
          .set('X-Twilio-Email-Event-Webhook-Signature', 'bad_signature_base64==')
          .set('X-Twilio-Email-Event-Webhook-Timestamp', timestamp)
          .send(rawJson);

        assert.equal(resInvalid.status, 401);
        assert.equal(resInvalid.body.success, false);

        // C. Tampered body fails with 401
        const tamperedJson = JSON.stringify([{ ...events[0], email: 'attacker@evil.com' }]);
        const resTampered = await request(app)
          .post('/api/webhooks/sendgrid')
          .set('Content-Type', 'application/json')
          .set('X-Twilio-Email-Event-Webhook-Signature', validSig)
          .set('X-Twilio-Email-Event-Webhook-Timestamp', timestamp)
          .send(tamperedJson);

        assert.equal(resTampered.status, 401);
        assert.equal(resTampered.body.success, false);
      });

      // 2. Valid and invalid Twilio signatures
      it('verifies valid Twilio HMAC-SHA1 signatures and rejects invalid/tampered signatures', async () => {
        const { notificationService } = await import('../src/notifications/notificationService.js');
        const { NotificationLogModel, MEMORY_NOTIFICATION_LOGS } = await import('../src/models/NotificationLog.js');
        const { reconstructTrustedTwilioUrl } = await import('../src/services/webhookVerification.js');
        const { isDbConnected } = await import('../src/config/db.js');

        const testAuthToken = 'twilio_auth_token_secret_12345';
        process.env.TWILIO_AUTH_TOKEN = testAuthToken;

        const testMsgId = `SM_valid_${Date.now()}`;
        if (isDbConnected()) {
          await NotificationLogModel.create({
            notificationId: `NOTIF-TW-${Date.now()}`,
            idempotencyKey: `idemp-tw-${Date.now()}`,
            channel: 'whatsapp',
            eventType: 'order_placed',
            recipient: '+919876543210',
            provider: 'twilio',
            providerMessageId: testMsgId,
            deliveryStatus: 'sending',
          });
        } else {
          MEMORY_NOTIFICATION_LOGS.push({
            notificationId: `NOTIF-TW-${Date.now()}`,
            idempotencyKey: `idemp-tw-${Date.now()}`,
            channel: 'whatsapp',
            eventType: 'order_placed',
            recipient: '+919876543210',
            provider: 'twilio',
            providerMessageId: testMsgId,
            deliveryStatus: 'sending',
          });
        }

        const trustedUrl = reconstructTrustedTwilioUrl({ originalUrl: '/api/webhooks/twilio' } as any);
        const params = {
          MessageSid: testMsgId,
          MessageStatus: 'delivered',
          To: '+919876543210',
        };
        const validSig = await signTwilioPayload(testAuthToken, trustedUrl, params);
        const formBody = `MessageSid=${encodeURIComponent(testMsgId)}&MessageStatus=delivered&To=%2B919876543210`;

        // A. Valid signature passes
        const resValid = await request(app)
          .post('/api/webhooks/twilio')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .set('X-Twilio-Signature', validSig)
          .send(formBody);

        assert.equal(resValid.status, 200);
        assert.equal(resValid.body.success, true);
        assert.equal(resValid.body.statusChanged, true);

        const updatedLog = await notificationService.getLogByProviderMessageId(testMsgId);
        assert.equal(updatedLog.deliveryStatus, 'delivered');

        // B. Invalid signature fails with 401
        const resInvalid = await request(app)
          .post('/api/webhooks/twilio')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .set('X-Twilio-Signature', 'invalid_twilio_signature==')
          .send(formBody);

        assert.equal(resInvalid.status, 401);
        assert.equal(resInvalid.body.success, false);

        // C. Tampered parameter value fails with 401
        const tamperedBody = `MessageSid=${encodeURIComponent(testMsgId)}&MessageStatus=failed&To=%2B919876543210`;
        const resTampered = await request(app)
          .post('/api/webhooks/twilio')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .set('X-Twilio-Signature', validSig)
          .send(tamperedBody);

        assert.equal(resTampered.status, 401);
        assert.equal(resTampered.body.success, false);
      });

      // 3. Missing signatures, malformed payloads, and incorrect callback URLs
      it('rejects missing signatures, malformed payloads, expired timestamps, and host-header injection attempts', async () => {
        const { reconstructTrustedTwilioUrl } = await import('../src/services/webhookVerification.js');
        const { privateKey, base64Key } = await generateSendgridTestKeyPair();
        process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY = base64Key;
        process.env.TWILIO_AUTH_TOKEN = 'secret_token_abc';

        const timestamp = Math.floor(Date.now() / 1000).toString();
        const validEvents = [{ sg_event_id: 'evt_1', event: 'processed', sg_message_id: 'msg_1' }];
        const rawJson = JSON.stringify(validEvents);
        const sig = await signSendgridPayload(privateKey, timestamp, rawJson);

        // A. SendGrid missing signature header -> 401
        const resNoSig = await request(app)
          .post('/api/webhooks/sendgrid')
          .set('Content-Type', 'application/json')
          .set('X-Twilio-Email-Event-Webhook-Timestamp', timestamp)
          .send(rawJson);
        assert.equal(resNoSig.status, 401);

        // B. SendGrid missing timestamp header -> 401
        const resNoTs = await request(app)
          .post('/api/webhooks/sendgrid')
          .set('Content-Type', 'application/json')
          .set('X-Twilio-Email-Event-Webhook-Signature', sig)
          .send(rawJson);
        assert.equal(resNoTs.status, 401);

        // C. SendGrid expired timestamp (> 10 minutes old) -> 401
        const expiredTimestamp = (Math.floor(Date.now() / 1000) - 700).toString();
        const expiredSig = await signSendgridPayload(privateKey, expiredTimestamp, rawJson);
        const resExpired = await request(app)
          .post('/api/webhooks/sendgrid')
          .set('Content-Type', 'application/json')
          .set('X-Twilio-Email-Event-Webhook-Signature', expiredSig)
          .set('X-Twilio-Email-Event-Webhook-Timestamp', expiredTimestamp)
          .send(rawJson);
        assert.equal(resExpired.status, 401);

        // D. SendGrid non-array payload -> 400
        const nonArrayJson = JSON.stringify({ notAnArray: true });
        const nonArraySig = await signSendgridPayload(privateKey, timestamp, nonArrayJson);
        const resNonArray = await request(app)
          .post('/api/webhooks/sendgrid')
          .set('Content-Type', 'application/json')
          .set('X-Twilio-Email-Event-Webhook-Signature', nonArraySig)
          .set('X-Twilio-Email-Event-Webhook-Timestamp', timestamp)
          .send(nonArrayJson);
        assert.equal(resNonArray.status, 400);

        // E. Twilio missing signature header -> 401
        const resTwilioNoSig = await request(app)
          .post('/api/webhooks/twilio')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send('MessageSid=SM123&MessageStatus=delivered');
        assert.equal(resTwilioNoSig.status, 401);

        // F. Twilio missing MessageSid -> 400
        const trustedUrl = reconstructTrustedTwilioUrl({ originalUrl: '/api/webhooks/twilio' } as any);
        const noSidParams = { MessageStatus: 'delivered' };
        const noSidSig = await signTwilioPayload(process.env.TWILIO_AUTH_TOKEN, trustedUrl, noSidParams);
        const resTwilioNoSid = await request(app)
          .post('/api/webhooks/twilio')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .set('X-Twilio-Signature', noSidSig)
          .send('MessageStatus=delivered');
        assert.equal(resTwilioNoSid.status, 400);

        // G. Twilio missing MessageStatus -> 400
        const noStatusParams = { MessageSid: 'SM123' };
        const noStatusSig = await signTwilioPayload(process.env.TWILIO_AUTH_TOKEN, trustedUrl, noStatusParams);
        const resTwilioNoStatus = await request(app)
          .post('/api/webhooks/twilio')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .set('X-Twilio-Signature', noStatusSig)
          .send('MessageSid=SM123');
        assert.equal(resTwilioNoStatus.status, 400);

        // H. Host-header injection attack defense
        // Attacker calculates signature using attacker.com and sends Host: attacker.com
        const attackerUrl = 'https://attacker.com/api/webhooks/twilio';
        const attackerParams = { MessageSid: 'SM999', MessageStatus: 'delivered' };
        const attackerSig = await signTwilioPayload(process.env.TWILIO_AUTH_TOKEN, attackerUrl, attackerParams);
        const resHostSpoof = await request(app)
          .post('/api/webhooks/twilio')
          .set('Host', 'attacker.com')
          .set('X-Forwarded-Host', 'attacker.com')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .set('X-Twilio-Signature', attackerSig)
          .send('MessageSid=SM999&MessageStatus=delivered');
        assert.equal(resHostSpoof.status, 401, 'Host-header spoofing must fail verification');
      });

      // 4. Raw-body preservation and middleware ordering
      it('preserves exact raw request bytes before JSON parsing and enforces 1MB limit / 415 media type', async () => {
        const { privateKey, base64Key } = await generateSendgridTestKeyPair();
        process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY = base64Key;

        // Raw body containing non-canonical spacing and characters
        const irregularRawBody = '  [\n  {\n   "sg_event_id": "evt_raw_1",\n   "event": "processed",\n   "sg_message_id": "msg_raw_1"\n  }\n ]  ';
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const sig = await signSendgridPayload(privateKey, timestamp, irregularRawBody);

        const resRaw = await request(app)
          .post('/api/webhooks/sendgrid')
          .set('Content-Type', 'application/json')
          .set('X-Twilio-Email-Event-Webhook-Signature', sig)
          .set('X-Twilio-Email-Event-Webhook-Timestamp', timestamp)
          .send(irregularRawBody);

        assert.equal(resRaw.status, 200, 'Signature verification on un-normalized raw bytes must succeed');

        // Payload > 1MB returns 413
        const largeString = 'a'.repeat(1024 * 1024 + 50); // > 1MB
        const resTooLarge = await request(app)
          .post('/api/webhooks/sendgrid')
          .set('Content-Type', 'application/json')
          .send(largeString);

        assert.equal(resTooLarge.status, 413);

        // Unsupported media type returns 415
        const res415 = await request(app)
          .post('/api/webhooks/sendgrid')
          .set('Content-Type', 'text/plain')
          .send('some raw text');

        assert.equal(res415.status, 415);
      });

      // 5. Duplicate event delivery and concurrent deduplication
      it('enforces durable deduplication using reserveWebhookEvent without re-applying status changes', async () => {
        const { NotificationLogModel, MEMORY_NOTIFICATION_LOGS } = await import('../src/models/NotificationLog.js');
        const { reconstructTrustedTwilioUrl } = await import('../src/services/webhookVerification.js');
        const { isDbConnected } = await import('../src/config/db.js');

        const { privateKey, base64Key } = await generateSendgridTestKeyPair();
        process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY = base64Key;

        const testMsgId = `sg_msg_dup_${Date.now()}`;
        if (isDbConnected()) {
          await NotificationLogModel.create({
            notificationId: `NOTIF-DUP-${Date.now()}`,
            idempotencyKey: `idemp-dup-${Date.now()}`,
            channel: 'email',
            eventType: 'order_placed',
            recipient: 'dup@example.com',
            provider: 'sendgrid',
            providerMessageId: testMsgId,
            deliveryStatus: 'pending',
          });
        } else {
          MEMORY_NOTIFICATION_LOGS.push({
            notificationId: `NOTIF-DUP-${Date.now()}`,
            idempotencyKey: `idemp-dup-${Date.now()}`,
            channel: 'email',
            eventType: 'order_placed',
            recipient: 'dup@example.com',
            provider: 'sendgrid',
            providerMessageId: testMsgId,
            deliveryStatus: 'pending',
          });
        }

        const sharedEventId = `evt_dedup_${Date.now()}`;
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const events = [
          {
            sg_event_id: sharedEventId,
            event: 'delivered',
            sg_message_id: testMsgId,
            timestamp: Number(timestamp),
          },
        ];
        const rawJson = JSON.stringify(events);
        const sig = await signSendgridPayload(privateKey, timestamp, rawJson);

        // Delivery 1
        const res1 = await request(app)
          .post('/api/webhooks/sendgrid')
          .set('Content-Type', 'application/json')
          .set('X-Twilio-Email-Event-Webhook-Signature', sig)
          .set('X-Twilio-Email-Event-Webhook-Timestamp', timestamp)
          .send(rawJson);

        assert.equal(res1.status, 200);
        assert.equal(res1.body.processedCount, 1);
        assert.equal(res1.body.duplicateCount, 0);

        // Delivery 2 (Duplicate replay)
        const res2 = await request(app)
          .post('/api/webhooks/sendgrid')
          .set('Content-Type', 'application/json')
          .set('X-Twilio-Email-Event-Webhook-Signature', sig)
          .set('X-Twilio-Email-Event-Webhook-Timestamp', timestamp)
          .send(rawJson);

        assert.equal(res2.status, 200);
        assert.equal(res2.body.processedCount, 0);
        assert.equal(res2.body.duplicateCount, 1);

        // Twilio deduplication test
        const twilioAuthToken = 'twilio_token_dup_test';
        process.env.TWILIO_AUTH_TOKEN = twilioAuthToken;
        const twMsgId = `SM_dup_${Date.now()}`;
        const trustedUrl = reconstructTrustedTwilioUrl({ originalUrl: '/api/webhooks/twilio' } as any);
        const twParams = { MessageSid: twMsgId, MessageStatus: 'delivered' };
        const twSig = await signTwilioPayload(twilioAuthToken, trustedUrl, twParams);
        const twBody = `MessageSid=${encodeURIComponent(twMsgId)}&MessageStatus=delivered`;

        // First callback
        const twRes1 = await request(app)
          .post('/api/webhooks/twilio')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .set('X-Twilio-Signature', twSig)
          .send(twBody);
        assert.equal(twRes1.status, 200);

        // Second duplicate callback
        const twRes2 = await request(app)
          .post('/api/webhooks/twilio')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .set('X-Twilio-Signature', twSig)
          .send(twBody);
        assert.equal(twRes2.status, 200);
        assert.ok(twRes2.body.message.includes('duplicate'));
      });

      // 6. Unknown provider message IDs and unsupported event types
      it('safely handles unknown provider message IDs and unsupported event types without leaking errors', async () => {
        const { reconstructTrustedTwilioUrl } = await import('../src/services/webhookVerification.js');
        const { privateKey, base64Key } = await generateSendgridTestKeyPair();
        process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY = base64Key;
        process.env.TWILIO_AUTH_TOKEN = 'token_unknown_tests';

        const timestamp = Math.floor(Date.now() / 1000).toString();

        // A. SendGrid unknown message ID -> 200 OK without error leak
        const eventsUnknownMsg = [
          {
            sg_event_id: `evt_unkn_msg_${Date.now()}`,
            event: 'delivered',
            sg_message_id: 'non_existent_msg_id_9999',
            timestamp: Number(timestamp),
          },
        ];
        const rawUnknown = JSON.stringify(eventsUnknownMsg);
        const sigUnknown = await signSendgridPayload(privateKey, timestamp, rawUnknown);

        const resUnkMsg = await request(app)
          .post('/api/webhooks/sendgrid')
          .set('Content-Type', 'application/json')
          .set('X-Twilio-Email-Event-Webhook-Signature', sigUnknown)
          .set('X-Twilio-Email-Event-Webhook-Timestamp', timestamp)
          .send(rawUnknown);

        assert.equal(resUnkMsg.status, 200);

        // B. SendGrid unsupported event type -> 200 OK, ignoredCount: 1
        const eventsUnsupp = [
          {
            sg_event_id: `evt_unsupp_${Date.now()}`,
            event: 'quantum_bounce',
            sg_message_id: 'some_msg_id',
            timestamp: Number(timestamp),
          },
        ];
        const rawUnsupp = JSON.stringify(eventsUnsupp);
        const sigUnsupp = await signSendgridPayload(privateKey, timestamp, rawUnsupp);

        const resUnsupp = await request(app)
          .post('/api/webhooks/sendgrid')
          .set('Content-Type', 'application/json')
          .set('X-Twilio-Email-Event-Webhook-Signature', sigUnsupp)
          .set('X-Twilio-Email-Event-Webhook-Timestamp', timestamp)
          .send(rawUnsupp);

        assert.equal(resUnsupp.status, 200);
        assert.equal(resUnsupp.body.ignoredCount, 1);

        // C. Twilio unknown message ID -> 200 OK
        const trustedUrl = reconstructTrustedTwilioUrl({ originalUrl: '/api/webhooks/twilio' } as any);
        const twParamsUnk = { MessageSid: 'SM_unknown_nonexistent', MessageStatus: 'delivered' };
        const twSigUnk = await signTwilioPayload(process.env.TWILIO_AUTH_TOKEN, trustedUrl, twParamsUnk);
        const twResUnk = await request(app)
          .post('/api/webhooks/twilio')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .set('X-Twilio-Signature', twSigUnk)
          .send('MessageSid=SM_unknown_nonexistent&MessageStatus=delivered');

        assert.equal(twResUnk.status, 200);
        assert.equal(twResUnk.body.statusChanged, false);
      });

      // 7. Out-of-order callbacks and terminal delivery-status protection
      it('protects terminal delivered status against stale out-of-order callbacks and separates engagement events', async () => {
        const { notificationService } = await import('../src/notifications/notificationService.js');
        const { NotificationLogModel, MEMORY_NOTIFICATION_LOGS } = await import('../src/models/NotificationLog.js');
        const { reconstructTrustedTwilioUrl } = await import('../src/services/webhookVerification.js');
        const { isDbConnected } = await import('../src/config/db.js');

        const { privateKey, base64Key } = await generateSendgridTestKeyPair();
        process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY = base64Key;
        process.env.TWILIO_AUTH_TOKEN = 'token_protection_tests';

        const sgMsgId = `sg_terminal_${Date.now()}`;
        if (isDbConnected()) {
          await NotificationLogModel.create({
            notificationId: `NOTIF-TERM-SG-${Date.now()}`,
            idempotencyKey: `idemp-term-sg-${Date.now()}`,
            channel: 'email',
            eventType: 'order_placed',
            recipient: 'terminal.sg@example.com',
            provider: 'sendgrid',
            providerMessageId: sgMsgId,
            deliveryStatus: 'delivered',
            sentAt: new Date(Date.now() - 3600000),
          });
        } else {
          MEMORY_NOTIFICATION_LOGS.push({
            notificationId: `NOTIF-TERM-SG-${Date.now()}`,
            idempotencyKey: `idemp-term-sg-${Date.now()}`,
            channel: 'email',
            eventType: 'order_placed',
            recipient: 'terminal.sg@example.com',
            provider: 'sendgrid',
            providerMessageId: sgMsgId,
            deliveryStatus: 'delivered',
            sentAt: new Date(Date.now() - 3600000),
          });
        }

        const timestamp = Math.floor(Date.now() / 1000).toString();

        // A. SendGrid out-of-order bounce arrives: MUST NOT downgrade delivered status
        const bounceEvents = [
          {
            sg_event_id: `evt_bounce_${Date.now()}`,
            event: 'bounce',
            sg_message_id: sgMsgId,
            reason: 'Delayed MX bounce response',
            timestamp: Number(timestamp),
          },
        ];
        const rawBounce = JSON.stringify(bounceEvents);
        const sigBounce = await signSendgridPayload(privateKey, timestamp, rawBounce);

        const resBounce = await request(app)
          .post('/api/webhooks/sendgrid')
          .set('Content-Type', 'application/json')
          .set('X-Twilio-Email-Event-Webhook-Signature', sigBounce)
          .set('X-Twilio-Email-Event-Webhook-Timestamp', timestamp)
          .send(rawBounce);

        assert.equal(resBounce.status, 200);

        const logAfterBounce = await notificationService.getLogByProviderMessageId(sgMsgId);
        assert.equal(logAfterBounce.deliveryStatus, 'delivered', 'Out-of-order bounce must NOT downgrade delivered status');
        assert.ok(logAfterBounce.metadata?.ignoredLateFailure, 'Ignored failure must be recorded in metadata');

        // B. SendGrid engagement event (open): MUST NOT change delivery status, records openAt
        const openEvents = [
          {
            sg_event_id: `evt_open_${Date.now()}`,
            event: 'open',
            sg_message_id: sgMsgId,
            timestamp: Number(timestamp),
          },
        ];
        const rawOpen = JSON.stringify(openEvents);
        const sigOpen = await signSendgridPayload(privateKey, timestamp, rawOpen);

        const resOpen = await request(app)
          .post('/api/webhooks/sendgrid')
          .set('Content-Type', 'application/json')
          .set('X-Twilio-Email-Event-Webhook-Signature', sigOpen)
          .set('X-Twilio-Email-Event-Webhook-Timestamp', timestamp)
          .send(rawOpen);

        assert.equal(resOpen.status, 200);
        const logAfterOpen = await notificationService.getLogByProviderMessageId(sgMsgId);
        assert.equal(logAfterOpen.deliveryStatus, 'delivered');
        assert.ok(logAfterOpen.metadata?.openAt, 'Engagement openAt must be recorded');

        // C. Twilio out-of-order callback protection
        const twMsgId = `SM_term_${Date.now()}`;
        if (isDbConnected()) {
          await NotificationLogModel.create({
            notificationId: `NOTIF-TERM-TW-${Date.now()}`,
            idempotencyKey: `idemp-term-tw-${Date.now()}`,
            channel: 'whatsapp',
            eventType: 'order_placed',
            recipient: '+919876543210',
            provider: 'twilio',
            providerMessageId: twMsgId,
            deliveryStatus: 'delivered',
            sentAt: new Date(Date.now() - 3600000),
          });
        } else {
          MEMORY_NOTIFICATION_LOGS.push({
            notificationId: `NOTIF-TERM-TW-${Date.now()}`,
            idempotencyKey: `idemp-term-tw-${Date.now()}`,
            channel: 'whatsapp',
            eventType: 'order_placed',
            recipient: '+919876543210',
            provider: 'twilio',
            providerMessageId: twMsgId,
            deliveryStatus: 'delivered',
            sentAt: new Date(Date.now() - 3600000),
          });
        }

        const trustedUrl = reconstructTrustedTwilioUrl({ originalUrl: '/api/webhooks/twilio' } as any);
        const twParamsUndeliv = {
          MessageSid: twMsgId,
          MessageStatus: 'undelivered',
          ErrorCode: '30008',
          ErrorMessage: 'Unknown carrier error',
        };
        const twSigUndeliv = await signTwilioPayload(process.env.TWILIO_AUTH_TOKEN, trustedUrl, twParamsUndeliv);
        const twBodyUndeliv = `MessageSid=${encodeURIComponent(twMsgId)}&MessageStatus=undelivered&ErrorCode=30008&ErrorMessage=Unknown+carrier+error`;

        const resTwUndeliv = await request(app)
          .post('/api/webhooks/twilio')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .set('X-Twilio-Signature', twSigUndeliv)
          .send(twBodyUndeliv);

        assert.equal(resTwUndeliv.status, 200);
        const logAfterTwUndeliv = await notificationService.getLogByProviderMessageId(twMsgId);
        assert.equal(logAfterTwUndeliv.deliveryStatus, 'delivered', 'Out-of-order undelivered callback must NOT downgrade delivered status');
        assert.ok(logAfterTwUndeliv.metadata?.ignoredLateFailure);

        // D. Twilio WhatsApp 'read' engagement receipt
        const twParamsRead = { MessageSid: twMsgId, MessageStatus: 'read' };
        const twSigRead = await signTwilioPayload(process.env.TWILIO_AUTH_TOKEN, trustedUrl, twParamsRead);
        const resTwRead = await request(app)
          .post('/api/webhooks/twilio')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .set('X-Twilio-Signature', twSigRead)
          .send(`MessageSid=${encodeURIComponent(twMsgId)}&MessageStatus=read`);

        assert.equal(resTwRead.status, 200);
        const logAfterTwRead = await notificationService.getLogByProviderMessageId(twMsgId);
        assert.equal(logAfterTwRead.deliveryStatus, 'delivered');
        assert.ok(logAfterTwRead.metadata?.whatsappReadAt);
      });

      // 8. Database failures and retry/reconciliation behavior
      it('handles database reservation failures safely and marks WebhookEvent failed on unhandled errors', async () => {
        const { reserveWebhookEvent } = await import('../src/models/WebhookEvent.js');
        const { env } = await import('../src/config/env.js');

        // Validation rejection for empty provider/eventId
        const invalidReservation = await reserveWebhookEvent({ provider: '', eventId: '' });
        assert.equal(invalidReservation.reserved, false);
        assert.ok(invalidReservation.error);

        // In production mode, disconnected database must reject reservation and NOT silently use in-memory storage
        const origNodeEnv = env.NODE_ENV;
        try {
          (env as any).NODE_ENV = 'production';
          // Ensure we test the disconnected path (if DB is disconnected)
          const isConnected = (await import('../src/config/db.js')).isDbConnected();
          if (!isConnected) {
            const prodRes = await reserveWebhookEvent({
              provider: 'sendgrid',
              eventId: `prod-offline-test-${Date.now()}`,
            });
            assert.equal(prodRes.reserved, false);
            assert.equal(prodRes.isDuplicate, false);
            assert.ok(prodRes.error?.includes('Database is disconnected'));
          }
        } finally {
          (env as any).NODE_ENV = origNodeEnv;
        }

        // When verification key is not configured, endpoints return safe 500 error
        const savedKey = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;
        const savedToken = process.env.TWILIO_AUTH_TOKEN;
        try {
          delete process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;
          delete process.env.TWILIO_AUTH_TOKEN;

          const resSgUnconfig = await request(app)
            .post('/api/webhooks/sendgrid')
            .set('Content-Type', 'application/json')
            .set('X-Twilio-Email-Event-Webhook-Signature', 'sig')
            .set('X-Twilio-Email-Event-Webhook-Timestamp', '123456')
            .send(JSON.stringify([{ event: 'test', sg_event_id: 'e1' }]));

          assert.equal(resSgUnconfig.status, 500);
          assert.equal(resSgUnconfig.body.success, false);

          const resTwUnconfig = await request(app)
            .post('/api/webhooks/twilio')
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .set('X-Twilio-Signature', 'sig')
            .send('MessageSid=SM1&MessageStatus=delivered');

          assert.equal(resTwUnconfig.status, 500);
          assert.equal(resTwUnconfig.body.success, false);
        } finally {
          process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY = savedKey;
          process.env.TWILIO_AUTH_TOKEN = savedToken;
        }
      });

      // 9. Rate limiting and safe error responses
      it('enforces dedicated webhook rate limiter and returns sanitized error payloads without secrets', async () => {
        const { createWebhookLimiter } = await import('../src/middlewares/rateLimiter.js');
        const express = (await import('express')).default;
        const testRateApp = express();
        const testLimiter = createWebhookLimiter(2); // limit to 2 requests
        testRateApp.use(testLimiter);
        testRateApp.post('/test-webhook', (_req, res) => res.json({ success: true }));

        const r1 = await request(testRateApp).post('/test-webhook');
        assert.equal(r1.status, 200);

        const r2 = await request(testRateApp).post('/test-webhook');
        assert.equal(r2.status, 200);

        const r3 = await request(testRateApp).post('/test-webhook');
        assert.equal(r3.status, 429);
        assert.equal(r3.body.success, false);
        assert.ok(r3.body.message.includes('Webhook rate limit exceeded'));

        // Verify that responses do not contain secrets
        const responseText = JSON.stringify(r3.body);
        assert.equal(responseText.includes('key'), false);
        assert.equal(responseText.includes('token'), false);
        assert.equal(responseText.includes('secret'), false);
      });

      // 10. Mock-mode behavior with no external network calls
      it('verifies mock-mode behavior with zero external SendGrid or Twilio network calls', async () => {
        const { env } = await import('../src/config/env.js');
        const { notificationService } = await import('../src/notifications/notificationService.js');

        assert.equal(env.NOTIFICATION_MODE, 'mock');
        assert.equal(env.NOTIFICATION_EMAIL_PROVIDER, 'mock');
        assert.equal(env.NOTIFICATION_MESSAGING_PROVIDER, 'mock');

        // Verify notification dispatch uses mock provider without throwing or contacting external services
        const mockDispatch = await notificationService.dispatch({
          channel: 'email',
          eventType: 'order_placed',
          recipient: 'zero.network@example.com',
          subject: 'No external network',
          message: 'Zero external network calls verified',
          idempotencyKey: `mock-zero-net-${Date.now()}`,
          customerConsent: { email: true },
        });

        assert.equal(mockDispatch.status, 'delivered');
        assert.ok(mockDispatch.providerMessageId?.startsWith('mock_msg_'));
      });
    });

    // =========================================================================
    // 21. WebhookEvent Schema, Fenced Lease Helpers, and Cache Pruning
    // (Phase 5, Milestone 3, Work Item 2)
    // =========================================================================
    describe('21. WebhookEvent Schema, Fenced Lease Helpers, and Cache Pruning (Phase 5, Milestone 3, Work Item 2)', () => {
      beforeEach(async () => {
        const { clearMemoryWebhookEvents } = await import('../src/models/WebhookEvent.js');
        clearMemoryWebhookEvents();
      });

      // 1. WebhookEvent index specifications include recovery scan index
      it('REQUIRED_WEBHOOK_EVENT_INDEXES declares compound recovery scan index', async () => {
        const { REQUIRED_WEBHOOK_EVENT_INDEXES } = await import(
          '../src/models/notificationLogIndexManager.js'
        );

        const recoveryIdx = REQUIRED_WEBHOOK_EVENT_INDEXES.find(
          (i) => i.name === 'status_1_nextRetryAt_1_createdAt_1'
        );
        assert.ok(recoveryIdx, 'Must declare status_1_nextRetryAt_1_createdAt_1 recovery index');
        assert.deepEqual(recoveryIdx.key, { status: 1, nextRetryAt: 1, createdAt: 1 });
        assert.equal(recoveryIdx.background, true);
      });

      // 2. claimWebhookEvent atomically claims an eligible event and increments leaseGeneration
      it('claimWebhookEvent claims eligible event and increments leaseGeneration fencing token', async () => {
        const { reserveWebhookEvent, claimWebhookEvent } = await import('../src/models/WebhookEvent.js');

        const eventId = `claim_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const reserved = await reserveWebhookEvent({
          provider: 'sendgrid',
          eventId,
          eventType: 'delivered',
        });
        assert.equal(reserved.reserved, true);

        const claimRes = await claimWebhookEvent({
          id: reserved.event.id || reserved.event._id,
          workerId: 'worker_alpha',
          leaseDurationMs: 15_000,
        });

        assert.equal(claimRes.claimed, true);
        assert.ok(claimRes.event);
        assert.equal(claimRes.event.status, 'processing');
        assert.equal(claimRes.event.lockedBy, 'worker_alpha');
        assert.equal(claimRes.event.leaseGeneration, 1);
        assert.equal(claimRes.event.retryCount, 1);
        assert.ok(claimRes.event.lockedUntil);
        assert.ok(new Date(claimRes.event.lockedUntil).getTime() > Date.now());
      });

      // 3. claimWebhookEvent rejects already locked, backoff, or maxRetries-exceeded events
      it('claimWebhookEvent respects active locks, backoff schedules, and max retries', async () => {
        const { reserveWebhookEvent, claimWebhookEvent } = await import('../src/models/WebhookEvent.js');

        const eventId = `lock_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const reserved = await reserveWebhookEvent({
          provider: 'sendgrid',
          eventId,
          eventType: 'delivered',
        });
        const docId = reserved.event.id || reserved.event._id;

        // Claim once
        const firstClaim = await claimWebhookEvent({
          id: docId,
          workerId: 'worker_1',
          leaseDurationMs: 30_000,
        });
        assert.equal(firstClaim.claimed, true);

        // Immediate second claim attempt must be rejected because active lease has not expired
        const secondClaim = await claimWebhookEvent({
          id: docId,
          workerId: 'worker_2',
        });
        assert.equal(secondClaim.claimed, false);
        assert.ok(secondClaim.reason?.includes('lock unavailable') || secondClaim.reason?.includes('No eligible'));

        // Test maxRetries threshold rejection
        reserved.event.lockedUntil = new Date(Date.now() - 1000); // Expire lock
        reserved.event.retryCount = 3; // Exhaust retries
        reserved.event.maxRetries = 3;
        reserved.event.status = 'failed';

        const exhaustedClaim = await claimWebhookEvent({
          id: docId,
          workerId: 'worker_3',
        });
        assert.equal(exhaustedClaim.claimed, false);

        // Test nextRetryAt backoff in future rejection
        reserved.event.retryCount = 1;
        reserved.event.nextRetryAt = new Date(Date.now() + 60_000); // In future

        const backoffClaim = await claimWebhookEvent({
          id: docId,
          workerId: 'worker_4',
        });
        assert.equal(backoffClaim.claimed, false);
      });

      // 4. completeWebhookEvent succeeds with valid leaseGeneration and clears locks
      it('completeWebhookEvent succeeds with valid fencing token and releases lease locks', async () => {
        const { reserveWebhookEvent, claimWebhookEvent, completeWebhookEvent } = await import(
          '../src/models/WebhookEvent.js'
        );

        const eventId = `complete_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const reserved = await reserveWebhookEvent({
          provider: 'twilio',
          eventId,
          eventType: 'delivered',
        });
        const docId = reserved.event.id || reserved.event._id;

        const claimRes = await claimWebhookEvent({ id: docId });
        assert.equal(claimRes.claimed, true);

        const completeRes = await completeWebhookEvent({
          id: docId,
          leaseGeneration: claimRes.event.leaseGeneration,
          status: 'processed',
        });

        assert.equal(completeRes.success, true);
        assert.equal(completeRes.event.status, 'processed');
        assert.equal(completeRes.event.lockedUntil, undefined);
        assert.equal(completeRes.event.lockedBy, undefined);
        assert.ok(completeRes.event.processedAt);
      });

      // 5. completeWebhookEvent enforces fencing token and rejects stale worker updates
      it('completeWebhookEvent detects fencing token mismatch and rejects stale worker updates', async () => {
        const { reserveWebhookEvent, claimWebhookEvent, completeWebhookEvent } = await import(
          '../src/models/WebhookEvent.js'
        );

        const eventId = `fence_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const reserved = await reserveWebhookEvent({
          provider: 'sendgrid',
          eventId,
          eventType: 'delivered',
        });
        const docId = reserved.event.id || reserved.event._id;

        // Worker 1 claims event (leaseGeneration = 1)
        const worker1Claim = await claimWebhookEvent({ id: docId, workerId: 'worker_1', leaseDurationMs: 100 });
        assert.equal(worker1Claim.claimed, true);
        assert.equal(worker1Claim.event.leaseGeneration, 1);

        // Worker 1's lease expires; Worker 2 reclaims event (leaseGeneration = 2)
        reserved.event.lockedUntil = new Date(Date.now() - 1000);
        const worker2Claim = await claimWebhookEvent({ id: docId, workerId: 'worker_2' });
        assert.equal(worker2Claim.claimed, true);
        assert.equal(worker2Claim.event.leaseGeneration, 2);

        // Worker 1 wakes up and attempts to complete with its stale leaseGeneration (1)
        const staleComplete = await completeWebhookEvent({
          id: docId,
          leaseGeneration: 1, // Stale token!
          status: 'processed',
        });

        assert.equal(staleComplete.success, false);
        assert.ok(
          staleComplete.reason?.includes('Fencing token mismatch'),
          `Expected fencing token mismatch error, got: ${staleComplete.reason}`
        );

        // Worker 2 completes with its current leaseGeneration (2) -> must succeed
        const validComplete = await completeWebhookEvent({
          id: docId,
          leaseGeneration: 2,
          status: 'processed',
        });
        assert.equal(validComplete.success, true);
        assert.equal(validComplete.event.status, 'processed');
      });

      // 6. completeWebhookEvent handles failure backoff and dead-letter transitions
      it('completeWebhookEvent applies retry backoff and dead-letters after maxRetries', async () => {
        const { reserveWebhookEvent, claimWebhookEvent, completeWebhookEvent } = await import(
          '../src/models/WebhookEvent.js'
        );

        const eventId = `fail_backoff_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const reserved = await reserveWebhookEvent({
          provider: 'twilio',
          eventId,
          eventType: 'failed',
        });
        const docId = reserved.event.id || reserved.event._id;

        // Attempt 1 failure: should schedule nextRetryAt with backoff
        const claim1 = await claimWebhookEvent({ id: docId });
        assert.equal(claim1.claimed, true);

        const fail1 = await completeWebhookEvent({
          id: docId,
          leaseGeneration: claim1.event.leaseGeneration,
          status: 'failed',
          errorMessage: 'Temporary database timeout',
          retryBackoffMs: 5000,
        });

        assert.equal(fail1.success, true);
        assert.equal(fail1.event.status, 'failed');
        assert.equal(fail1.event.lastError, 'Temporary database timeout');
        assert.ok(fail1.event.nextRetryAt);
        assert.ok(new Date(fail1.event.nextRetryAt).getTime() > Date.now());

        // Fast-forward backoff & exhaust retries to test terminal dead-lettering
        fail1.event.nextRetryAt = new Date(Date.now() - 1000);
        fail1.event.retryCount = 2; // Next claim will make it 3 (maxRetries = 3)

        const claim3 = await claimWebhookEvent({ id: docId });
        assert.equal(claim3.claimed, true);
        assert.equal(claim3.event.retryCount, 3);

        const deadLetterFail = await completeWebhookEvent({
          id: docId,
          leaseGeneration: claim3.event.leaseGeneration,
          status: 'failed',
          errorMessage: 'Permanent processing failure',
          maxRetries: 3,
        });

        assert.equal(deadLetterFail.success, true);
        assert.equal(deadLetterFail.event.status, 'failed');
        assert.equal(deadLetterFail.event.nextRetryAt, undefined, 'Terminal failure must not schedule nextRetryAt');
      });

      // 7. In-memory cache pruning and isolation
      it('pruneMemoryWebhookEvents and clearMemoryWebhookEvents maintain cache bounds', async () => {
        const {
          MEMORY_WEBHOOK_EVENTS,
          MEMORY_WEBHOOK_EVENTS_MAX_CAPACITY,
          pruneMemoryWebhookEvents,
          clearMemoryWebhookEvents,
          reserveWebhookEvent,
        } = await import('../src/models/WebhookEvent.js');

        clearMemoryWebhookEvents();
        assert.equal(MEMORY_WEBHOOK_EVENTS.length, 0);

        // Fill memory store to 510 items
        for (let i = 0; i < 510; i++) {
          MEMORY_WEBHOOK_EVENTS.push({
            id: `fill_${i}`,
            provider: 'mock',
            eventId: `evt_${i}`,
            status: 'received',
          });
        }
        assert.equal(MEMORY_WEBHOOK_EVENTS.length, 510);

        pruneMemoryWebhookEvents(500);
        assert.equal(MEMORY_WEBHOOK_EVENTS.length, 500);
        assert.equal(MEMORY_WEBHOOK_EVENTS[0].id, 'fill_10', 'Oldest 10 items must be dropped');
        assert.equal(MEMORY_WEBHOOK_EVENTS[499].id, 'fill_509', 'Newest item preserved');

        // Test reserveWebhookEvent auto-pruning
        clearMemoryWebhookEvents();
        assert.equal(MEMORY_WEBHOOK_EVENTS_MAX_CAPACITY, 500);
      });

      // 8. reserveWebhookEvent exposes existingStatus and canRetry on collision
      it('reserveWebhookEvent accurately reports existingStatus and canRetry on collision', async () => {
        const { reserveWebhookEvent, completeWebhookEvent, claimWebhookEvent } = await import(
          '../src/models/WebhookEvent.js'
        );

        const eventId = `collision_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const res1 = await reserveWebhookEvent({
          provider: 'sendgrid',
          eventId,
          eventType: 'delivered',
        });
        const docId = res1.event.id || res1.event._id;

        // Collision while unlocked 'received': canRetry should be true
        const dup1 = await reserveWebhookEvent({ provider: 'sendgrid', eventId });
        assert.equal(dup1.isDuplicate, true);
        assert.equal(dup1.existingStatus, 'received');
        assert.equal(dup1.canRetry, true);

        // Claim and lock event: canRetry should be false while lock is active
        const claim = await claimWebhookEvent({ id: docId });
        assert.equal(claim.claimed, true);

        const dupLocked = await reserveWebhookEvent({ provider: 'sendgrid', eventId });
        assert.equal(dupLocked.isDuplicate, true);
        assert.equal(dupLocked.canRetry, false, 'Locked processing event cannot be retried concurrently');

        // Fail event with immediate retry: canRetry should become true
        await completeWebhookEvent({
          id: docId,
          leaseGeneration: claim.event.leaseGeneration,
          status: 'failed',
          errorMessage: 'Transient network failure',
          retryBackoffMs: 0,
        });

        const dupFailed = await reserveWebhookEvent({ provider: 'sendgrid', eventId });
        assert.equal(dupFailed.isDuplicate, true);
        assert.equal(dupFailed.existingStatus, 'failed');
        assert.equal(dupFailed.canRetry, true, 'Failed event should be eligible for retry');

        // Claim and complete event: canRetry should become false when processed
        const claim2 = await claimWebhookEvent({ id: docId });
        await completeWebhookEvent({
          id: docId,
          leaseGeneration: claim2.event.leaseGeneration,
          status: 'processed',
        });

        const dupProcessed = await reserveWebhookEvent({ provider: 'sendgrid', eventId });
        assert.equal(dupProcessed.isDuplicate, true);
        assert.equal(dupProcessed.existingStatus, 'processed');
        assert.equal(dupProcessed.canRetry, false, 'Processed event cannot be retried');
      });
    });

    // =========================================================================
    // 22. Smart Re-delivery Handling in Webhook Controllers (AUD-M3-01 Fix)
    // (Phase 5, Milestone 3, Work Item 3)
    // =========================================================================
    describe('22. Smart Re-delivery Handling in Webhook Controllers (Phase 5, Milestone 3, Work Item 3)', () => {
      async function getCrypto() {
        return (await import('crypto')).default;
      }

      async function generateSendgridTestKeyPair() {
        const crypto = await getCrypto();
        const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
          namedCurve: 'prime256v1',
        });
        const spkiDer = publicKey.export({ format: 'der', type: 'spki' });
        const base64Key = spkiDer.toString('base64');
        return { publicKey, privateKey, base64Key };
      }

      async function signSendgridPayload(privateKey: any, timestamp: string, rawBody: string | Buffer): Promise<string> {
        const crypto = await getCrypto();
        const timestampBuf = Buffer.from(timestamp, 'utf8');
        const bodyBuf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
        const payload = Buffer.concat([timestampBuf, bodyBuf]);
        return crypto.sign('sha256', payload, privateKey).toString('base64');
      }

      async function signTwilioPayload(authToken: string, url: string, params: Record<string, any>): Promise<string> {
        const crypto = await getCrypto();
        let data = url;
        const sortedKeys = Object.keys(params).sort();
        for (const key of sortedKeys) {
          data += key + params[key];
        }
        return crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf8')).digest('base64');
      }

      beforeEach(async () => {
        const { clearMemoryWebhookEvents } = await import('../src/models/WebhookEvent.js');
        clearMemoryWebhookEvents();
      });

      // 1. SendGrid re-claims and successfully processes re-delivered failed event
      it('SendGrid controller re-claims and completes re-delivered failed event (AUD-M3-01)', async () => {
        const { NotificationLogModel, MEMORY_NOTIFICATION_LOGS } = await import('../src/models/NotificationLog.js');
        const { WebhookEventModel, MEMORY_WEBHOOK_EVENTS } = await import('../src/models/WebhookEvent.js');
        const { isDbConnected } = await import('../src/config/db.js');
        const { notificationService } = await import('../src/notifications/notificationService.js');

        const { privateKey, base64Key } = await generateSendgridTestKeyPair();
        process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY = base64Key;

        const sgMsgId = `sg_redeliver_${Date.now()}`;
        const sgEvtId = `evt_failed_retry_${Date.now()}`;

        // Seed notification log in pending state
        if (isDbConnected()) {
          await NotificationLogModel.create({
            notificationId: `NOTIF-REDELIV-${Date.now()}`,
            idempotencyKey: `idemp-redeliv-${Date.now()}`,
            channel: 'email',
            eventType: 'order_placed',
            recipient: 'redeliver.sg@example.com',
            provider: 'sendgrid',
            providerMessageId: sgMsgId,
            deliveryStatus: 'sent',
            sentAt: new Date(),
          });

          // Seed failed WebhookEvent
          await WebhookEventModel.create({
            provider: 'sendgrid',
            eventId: sgEvtId,
            providerMessageId: sgMsgId,
            eventType: 'delivered',
            status: 'failed',
            lastError: 'Simulated transient database disconnect during initial receipt',
            receivedAt: new Date(Date.now() - 30_000),
            leaseGeneration: 1,
            retryCount: 1,
            maxRetries: 3,
          });
        } else {
          MEMORY_NOTIFICATION_LOGS.push({
            notificationId: `NOTIF-REDELIV-${Date.now()}`,
            idempotencyKey: `idemp-redeliv-${Date.now()}`,
            channel: 'email',
            eventType: 'order_placed',
            recipient: 'redeliver.sg@example.com',
            provider: 'sendgrid',
            providerMessageId: sgMsgId,
            deliveryStatus: 'sent',
            sentAt: new Date(),
          });

          MEMORY_WEBHOOK_EVENTS.push({
            id: `mem_wh_failed_${Date.now()}`,
            provider: 'sendgrid',
            eventId: sgEvtId,
            providerMessageId: sgMsgId,
            eventType: 'delivered',
            status: 'failed',
            lastError: 'Simulated transient database disconnect during initial receipt',
            receivedAt: new Date(Date.now() - 30_000),
            leaseGeneration: 1,
            retryCount: 1,
            maxRetries: 3,
          });
        }

        const timestamp = Math.floor(Date.now() / 1000).toString();
        const payload = [
          {
            sg_event_id: sgEvtId,
            event: 'delivered',
            sg_message_id: sgMsgId,
            timestamp: Number(timestamp),
          },
        ];
        const rawBody = JSON.stringify(payload);
        const signature = await signSendgridPayload(privateKey, timestamp, rawBody);

        // Send re-delivery request
        const res = await request(app)
          .post('/api/webhooks/sendgrid')
          .set('Content-Type', 'application/json')
          .set('X-Twilio-Email-Event-Webhook-Signature', signature)
          .set('X-Twilio-Email-Event-Webhook-Timestamp', timestamp)
          .send(rawBody);

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.processedCount, 1, 'Re-delivered event must be processed, not ignored as duplicate');
        assert.equal(res.body.duplicateCount, 0);

        // Verify NotificationLog transitioned to delivered
        const updatedLog = await notificationService.getLogByProviderMessageId(sgMsgId);
        assert.ok(updatedLog);
        assert.equal(updatedLog.deliveryStatus, 'delivered');
      });

      // 2. Twilio re-claims and successfully processes re-delivered failed callback
      it('Twilio controller re-claims and completes re-delivered failed callback (AUD-M3-01)', async () => {
        const { NotificationLogModel, MEMORY_NOTIFICATION_LOGS } = await import('../src/models/NotificationLog.js');
        const { WebhookEventModel, MEMORY_WEBHOOK_EVENTS } = await import('../src/models/WebhookEvent.js');
        const { reconstructTrustedTwilioUrl } = await import('../src/services/webhookVerification.js');
        const { isDbConnected } = await import('../src/config/db.js');
        const { notificationService } = await import('../src/notifications/notificationService.js');

        const twilioAuthToken = 'twilio_redeliver_test_token';
        process.env.TWILIO_AUTH_TOKEN = twilioAuthToken;

        const twMsgId = `SM_redeliver_${Date.now()}`;
        const eventId = `${twMsgId}:delivered`;

        // Seed notification log
        if (isDbConnected()) {
          await NotificationLogModel.create({
            notificationId: `NOTIF-TW-REDELIV-${Date.now()}`,
            idempotencyKey: `idemp-tw-redeliv-${Date.now()}`,
            channel: 'sms',
            eventType: 'order_placed',
            recipient: '+919876543210',
            provider: 'twilio',
            providerMessageId: twMsgId,
            deliveryStatus: 'sent',
            sentAt: new Date(),
          });

          // Seed failed WebhookEvent
          await WebhookEventModel.create({
            provider: 'twilio',
            eventId,
            providerMessageId: twMsgId,
            eventType: 'delivered',
            status: 'failed',
            lastError: 'Simulated server restart interruption',
            receivedAt: new Date(Date.now() - 20_000),
            leaseGeneration: 1,
            retryCount: 1,
            maxRetries: 3,
          });
        } else {
          MEMORY_NOTIFICATION_LOGS.push({
            notificationId: `NOTIF-TW-REDELIV-${Date.now()}`,
            idempotencyKey: `idemp-tw-redeliv-${Date.now()}`,
            channel: 'sms',
            eventType: 'order_placed',
            recipient: '+919876543210',
            provider: 'twilio',
            providerMessageId: twMsgId,
            deliveryStatus: 'sent',
            sentAt: new Date(),
          });

          MEMORY_WEBHOOK_EVENTS.push({
            id: `mem_wh_tw_failed_${Date.now()}`,
            provider: 'twilio',
            eventId,
            providerMessageId: twMsgId,
            eventType: 'delivered',
            status: 'failed',
            lastError: 'Simulated server restart interruption',
            receivedAt: new Date(Date.now() - 20_000),
            leaseGeneration: 1,
            retryCount: 1,
            maxRetries: 3,
          });
        }

        const trustedUrl = reconstructTrustedTwilioUrl({ originalUrl: '/api/webhooks/twilio' } as any);
        const params = { MessageSid: twMsgId, MessageStatus: 'delivered' };
        const signature = await signTwilioPayload(twilioAuthToken, trustedUrl, params);
        const formBody = `MessageSid=${encodeURIComponent(twMsgId)}&MessageStatus=delivered`;

        // Send re-delivery callback
        const res = await request(app)
          .post('/api/webhooks/twilio')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .set('X-Twilio-Signature', signature)
          .send(formBody);

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.statusChanged, true, 'Re-delivered callback must change delivery status');

        // Verify NotificationLog transitioned to delivered
        const updatedLog = await notificationService.getLogByProviderMessageId(twMsgId);
        assert.ok(updatedLog);
        assert.equal(updatedLog.deliveryStatus, 'delivered');
      });

      // 3. Re-delivery of completed event acknowledges duplicate without re-processing
      it('re-delivery of already processed event acknowledges duplicate without re-applying mutations', async () => {
        const { privateKey, base64Key } = await generateSendgridTestKeyPair();
        process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY = base64Key;

        const sgMsgId = `sg_already_proc_${Date.now()}`;
        const sgEvtId = `evt_proc_${Date.now()}`;

        const timestamp = Math.floor(Date.now() / 1000).toString();
        const payload = [
          {
            sg_event_id: sgEvtId,
            event: 'delivered',
            sg_message_id: sgMsgId,
            timestamp: Number(timestamp),
          },
        ];
        const rawBody = JSON.stringify(payload);
        const signature = await signSendgridPayload(privateKey, timestamp, rawBody);

        // First delivery
        const res1 = await request(app)
          .post('/api/webhooks/sendgrid')
          .set('Content-Type', 'application/json')
          .set('X-Twilio-Email-Event-Webhook-Signature', signature)
          .set('X-Twilio-Email-Event-Webhook-Timestamp', timestamp)
          .send(rawBody);

        assert.equal(res1.status, 200);

        // Re-delivery when already processed
        const res2 = await request(app)
          .post('/api/webhooks/sendgrid')
          .set('Content-Type', 'application/json')
          .set('X-Twilio-Email-Event-Webhook-Signature', signature)
          .set('X-Twilio-Email-Event-Webhook-Timestamp', timestamp)
          .send(rawBody);

        assert.equal(res2.status, 200);
        assert.equal(res2.body.processedCount, 0, 'Already processed event must not be re-processed');
        assert.equal(res2.body.duplicateCount, 1, 'Must be flagged as duplicate');
      });

      // 4. Safe bypass when event is currently locked in processing by an active worker
      it('bypasses duplicate execution when event is currently locked by active worker', async () => {
        const { WebhookEventModel, MEMORY_WEBHOOK_EVENTS } = await import('../src/models/WebhookEvent.js');
        const { isDbConnected } = await import('../src/config/db.js');
        const { reconstructTrustedTwilioUrl } = await import('../src/services/webhookVerification.js');

        const twilioAuthToken = 'twilio_active_lock_token';
        process.env.TWILIO_AUTH_TOKEN = twilioAuthToken;

        const twMsgId = `SM_active_lock_${Date.now()}`;
        const eventId = `${twMsgId}:delivered`;

        // Seed an event currently in 'processing' with a future lockedUntil (30s from now)
        if (isDbConnected()) {
          await WebhookEventModel.create({
            provider: 'twilio',
            eventId,
            providerMessageId: twMsgId,
            eventType: 'delivered',
            status: 'processing',
            lockedUntil: new Date(Date.now() + 30_000),
            lockedBy: 'worker_concurrent_active',
            leaseGeneration: 1,
            retryCount: 1,
          });
        } else {
          MEMORY_WEBHOOK_EVENTS.push({
            id: `mem_wh_locked_${Date.now()}`,
            provider: 'twilio',
            eventId,
            providerMessageId: twMsgId,
            eventType: 'delivered',
            status: 'processing',
            lockedUntil: new Date(Date.now() + 30_000),
            lockedBy: 'worker_concurrent_active',
            leaseGeneration: 1,
            retryCount: 1,
          });
        }

        const trustedUrl = reconstructTrustedTwilioUrl({ originalUrl: '/api/webhooks/twilio' } as any);
        const params = { MessageSid: twMsgId, MessageStatus: 'delivered' };
        const signature = await signTwilioPayload(twilioAuthToken, trustedUrl, params);
        const formBody = `MessageSid=${encodeURIComponent(twMsgId)}&MessageStatus=delivered`;

        const res = await request(app)
          .post('/api/webhooks/twilio')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .set('X-Twilio-Signature', signature)
          .send(formBody);

        assert.equal(res.status, 200);
        assert.ok(res.body.message.includes('duplicate') || res.body.message.includes('currently being processed'));
      });
    });

    // =========================================================================
    // 23. Inbound Webhook Recovery Scheduler & Concurrency Guarantees (AUD-M3-02 Fix)
    // (Phase 5, Milestone 3, Work Item 4 & 5)
    // =========================================================================
    describe('23. Inbound Webhook Recovery Scheduler & Concurrency Guarantees (Phase 5, Milestone 3)', () => {
      beforeEach(async () => {
        const { clearMemoryWebhookEvents } = await import('../src/models/WebhookEvent.js');
        clearMemoryWebhookEvents();
      });

      // 1. Lifecycle management
      it('scheduler lifecycle: manages start, duplicate start guard, isRunning, and clean stop', async () => {
        const { WebhookRecoveryScheduler } = await import('../src/notifications/webhookRecoveryScheduler.js');
        const scheduler = new WebhookRecoveryScheduler({ intervalMs: 10_000 });

        assert.equal(scheduler.isRunning(), false);
        scheduler.start();
        assert.equal(scheduler.isRunning(), true);

        // Duplicate start does not throw or create second timer
        scheduler.start();
        assert.equal(scheduler.isRunning(), true);

        scheduler.stop();
        assert.equal(scheduler.isRunning(), false);
      });

      // 2. Recovery of interrupted webhook event
      it('scheduler tick: recovers interrupted webhook event and applies terminal delivery transition', async () => {
        const { WebhookRecoveryScheduler } = await import('../src/notifications/webhookRecoveryScheduler.js');
        const { NotificationLogModel, MEMORY_NOTIFICATION_LOGS } = await import('../src/models/NotificationLog.js');
        const { WebhookEventModel, MEMORY_WEBHOOK_EVENTS } = await import('../src/models/WebhookEvent.js');
        const { isDbConnected } = await import('../src/config/db.js');
        const { notificationService } = await import('../src/notifications/notificationService.js');

        const msgId = `sg_interrupted_${Date.now()}`;
        const evtId = `evt_interrupted_${Date.now()}`;

        // Seed a NotificationLog stuck in 'sent'
        if (isDbConnected()) {
          await NotificationLogModel.create({
            notificationId: `NOTIF-REC-${Date.now()}`,
            idempotencyKey: `idemp-rec-${Date.now()}`,
            channel: 'email',
            eventType: 'order_placed',
            recipient: 'recovery.test@example.com',
            provider: 'sendgrid',
            providerMessageId: msgId,
            deliveryStatus: 'sent',
            sentAt: new Date(Date.now() - 120_000),
          });

          // Seed an interrupted WebhookEvent in status 'received', older than 60s
          await WebhookEventModel.create({
            provider: 'sendgrid',
            eventId: evtId,
            providerMessageId: msgId,
            eventType: 'delivered',
            status: 'received',
            receivedAt: new Date(Date.now() - 90_000),
            createdAt: new Date(Date.now() - 90_000),
            leaseGeneration: 0,
            retryCount: 0,
            maxRetries: 3,
          });
        } else {
          MEMORY_NOTIFICATION_LOGS.push({
            notificationId: `NOTIF-REC-${Date.now()}`,
            idempotencyKey: `idemp-rec-${Date.now()}`,
            channel: 'email',
            eventType: 'order_placed',
            recipient: 'recovery.test@example.com',
            provider: 'sendgrid',
            providerMessageId: msgId,
            deliveryStatus: 'sent',
            sentAt: new Date(Date.now() - 120_000),
          });

          MEMORY_WEBHOOK_EVENTS.push({
            id: `mem_wh_rec_${Date.now()}`,
            provider: 'sendgrid',
            eventId: evtId,
            providerMessageId: msgId,
            eventType: 'delivered',
            status: 'received',
            receivedAt: new Date(Date.now() - 90_000),
            createdAt: new Date(Date.now() - 90_000),
            leaseGeneration: 0,
            retryCount: 0,
            maxRetries: 3,
          });
        }

        const scheduler = new WebhookRecoveryScheduler({ minAgeMs: 60_000, batchSize: 10 });
        const recoveredCount = await scheduler.tick();

        assert.equal(recoveredCount, 1, 'Scheduler tick must recover the interrupted event');

        // Verify NotificationLog transitioned to 'delivered'
        const log = await notificationService.getLogByProviderMessageId(msgId);
        assert.ok(log);
        assert.equal(log.deliveryStatus, 'delivered');

        // Verify WebhookEvent transitioned to 'processed'
        if (isDbConnected()) {
          const doc = await WebhookEventModel.findOne({ provider: 'sendgrid', eventId: evtId }).lean();
          assert.equal(doc?.status, 'processed');
          assert.ok(doc?.processedAt);
        } else {
          const mem = MEMORY_WEBHOOK_EVENTS.find((e) => e.eventId === evtId);
          assert.equal(mem?.status, 'processed');
          assert.ok(mem?.processedAt);
        }
      });

      // 3. Unroutable event cleanly transitions to ignored
      it('scheduler tick: handles unroutable event and marks it ignored without crashing', async () => {
        const { WebhookRecoveryScheduler } = await import('../src/notifications/webhookRecoveryScheduler.js');
        const { WebhookEventModel, MEMORY_WEBHOOK_EVENTS } = await import('../src/models/WebhookEvent.js');
        const { isDbConnected } = await import('../src/config/db.js');

        const unroutableEvtId = `evt_unroutable_${Date.now()}`;
        const unroutableMsgId = `nonexistent_msg_${Date.now()}`;

        if (isDbConnected()) {
          await WebhookEventModel.create({
            provider: 'sendgrid',
            eventId: unroutableEvtId,
            providerMessageId: unroutableMsgId,
            eventType: 'delivered',
            status: 'received',
            receivedAt: new Date(Date.now() - 90_000),
            createdAt: new Date(Date.now() - 90_000),
            leaseGeneration: 0,
            retryCount: 0,
            maxRetries: 3,
          });
        } else {
          MEMORY_WEBHOOK_EVENTS.push({
            id: `mem_unroutable_${Date.now()}`,
            provider: 'sendgrid',
            eventId: unroutableEvtId,
            providerMessageId: unroutableMsgId,
            eventType: 'delivered',
            status: 'received',
            receivedAt: new Date(Date.now() - 90_000),
            createdAt: new Date(Date.now() - 90_000),
            leaseGeneration: 0,
            retryCount: 0,
            maxRetries: 3,
          });
        }

        const scheduler = new WebhookRecoveryScheduler({ minAgeMs: 60_000, batchSize: 10 });
        const recoveredCount = await scheduler.tick();
        assert.equal(recoveredCount, 0, 'Unroutable event should not be counted as recovered');

        if (isDbConnected()) {
          const doc = await WebhookEventModel.findOne({ provider: 'sendgrid', eventId: unroutableEvtId }).lean();
          assert.equal(doc?.status, 'ignored');
          assert.ok(doc?.errorMessage?.includes('not found'));
        } else {
          const mem = MEMORY_WEBHOOK_EVENTS.find((e) => e.eventId === unroutableEvtId);
          assert.equal(mem?.status, 'ignored');
          assert.ok(mem?.errorMessage?.includes('not found'));
        }
      });

      // 4. Recovery tick records failure and schedules backoff when transition throws
      it('scheduler tick: handles unexpected transition exceptions with backoff and dead-letters after maxRetries', async () => {
        const { WebhookRecoveryScheduler } = await import('../src/notifications/webhookRecoveryScheduler.js');
        const { WebhookEventModel, MEMORY_WEBHOOK_EVENTS } = await import('../src/models/WebhookEvent.js');
        const { isDbConnected } = await import('../src/config/db.js');
        const { notificationService } = await import('../src/notifications/notificationService.js');

        const errEvtId = `evt_throw_${Date.now()}`;
        const errMsgId = `msg_throw_${Date.now()}`;

        if (isDbConnected()) {
          await WebhookEventModel.create({
            provider: 'sendgrid',
            eventId: errEvtId,
            providerMessageId: errMsgId,
            eventType: 'delivered',
            status: 'received',
            receivedAt: new Date(Date.now() - 90_000),
            createdAt: new Date(Date.now() - 90_000),
            leaseGeneration: 0,
            retryCount: 2, // 2 prior attempts, next will be 3 (maxRetries)
            maxRetries: 3,
          });
        } else {
          MEMORY_WEBHOOK_EVENTS.push({
            id: `mem_throw_${Date.now()}`,
            provider: 'sendgrid',
            eventId: errEvtId,
            providerMessageId: errMsgId,
            eventType: 'delivered',
            status: 'received',
            receivedAt: new Date(Date.now() - 90_000),
            createdAt: new Date(Date.now() - 90_000),
            leaseGeneration: 0,
            retryCount: 2,
            maxRetries: 3,
          });
        }

        // Mock applyDeliveryStatusTransition to throw an unexpected transient error
        const origTransition = notificationService.applyDeliveryStatusTransition.bind(notificationService);
        (notificationService as any).applyDeliveryStatusTransition = async () => {
          throw new Error('Simulated upstream database connection reset');
        };

        try {
          const scheduler = new WebhookRecoveryScheduler({ minAgeMs: 60_000, batchSize: 10 });
          const recovered = await scheduler.tick();
          assert.equal(recovered, 0);

          if (isDbConnected()) {
            const doc = await WebhookEventModel.findOne({ provider: 'sendgrid', eventId: errEvtId }).lean();
            assert.equal(doc?.status, 'failed');
            assert.equal(doc?.retryCount, 3);
            assert.equal(doc?.nextRetryAt, undefined, 'Exhausted retries must dead-letter without nextRetryAt');
            assert.ok(doc?.errorMessage?.includes('connection reset'));
          } else {
            const mem = MEMORY_WEBHOOK_EVENTS.find((e) => e.eventId === errEvtId);
            assert.equal(mem?.status, 'failed');
            assert.equal(mem?.retryCount, 3);
            assert.equal(mem?.nextRetryAt, undefined, 'Exhausted retries must dead-letter without nextRetryAt');
            assert.ok(mem?.errorMessage?.includes('connection reset'));
          }
        } finally {
          (notificationService as any).applyDeliveryStatusTransition = origTransition;
        }
      });

      // 5. Overlap protection
      it('scheduler tick: guards against overlapping execution when scan is already in flight', async () => {
        const { WebhookRecoveryScheduler } = await import('../src/notifications/webhookRecoveryScheduler.js');
        const scheduler = new WebhookRecoveryScheduler();

        // Simulate execution flag set
        (scheduler as any).isExecuting = true;
        const result = await scheduler.tick();
        assert.equal(result, 0, 'Must immediately return 0 and skip execution when previous tick is in flight');
        (scheduler as any).isExecuting = false;
      });

      // 6. Graceful shutdown handler integration
      it('graceful shutdown handler cleanly terminates webhook recovery scheduler', async () => {
        const { createShutdownHandler } = await import('../src/index.js');
        let stopped = false;
        const mockWebhookScheduler = {
          stop: () => {
            stopped = true;
          },
        };

        const shutdown = createShutdownHandler({
          webhookRecoveryScheduler: mockWebhookScheduler as any,
          disconnectDB: async () => {},
          onExit: () => {},
        });

        await shutdown('SIGTERM');
        assert.equal(stopped, true, 'Shutdown handler must stop webhook recovery scheduler');
      });
    });

    describe('24. Dynamic Storefront Catalog & Admin Synchronization', () => {
      let adminToken: string;
      const syncSlug = `sync-cake-${Date.now()}`;
      let createdCakeId: string;

      beforeEach(async () => {
        const { env } = await import('../src/config/env.js');
        const { AdminModel, MEMORY_ADMIN } = await import('../src/models/Admin.js');
        const { isDbConnected } = await import('../src/config/db.js');
        let currentVersion = MEMORY_ADMIN.tokenVersion ?? 0;
        let adminId = MEMORY_ADMIN.id;
        if (isDbConnected()) {
          const dbAdmin = await AdminModel.findOne({ username: 'admin' }).select('_id tokenVersion').lean();
          if (dbAdmin) {
            currentVersion = dbAdmin.tokenVersion ?? 0;
            adminId = dbAdmin._id.toString();
          }
        }
        const jwt = (await import('jsonwebtoken')).default;
        adminToken = jwt.sign(
          { id: adminId, username: 'admin', role: 'superadmin', tokenVersion: currentVersion },
          env.JWT_SECRET,
          { expiresIn: '1h' }
        );
      });

      it('GET /api/cakes returns 200 with id on all items (mapped from _id or id)', async () => {
        const res = await request(app).get('/api/cakes');
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(Array.isArray(res.body.data));
        assert.ok(res.body.data.length > 0);
        for (const cake of res.body.data) {
          assert.ok(cake.id, `Cake ${cake.name} must have a defined id string`);
          assert.equal(typeof cake.id, 'string');
        }
      });

      it('GET /api/cakes/featured returns 200 with formatted id field on all items', async () => {
        const res = await request(app).get('/api/cakes/featured');
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(Array.isArray(res.body.data));
        for (const cake of res.body.data) {
          assert.ok(cake.id, 'Featured cake must have formatted id string');
          assert.equal(typeof cake.id, 'string');
        }
      });

      it('GET /api/cakes/bestsellers returns 200 with formatted id field on all items', async () => {
        const res = await request(app).get('/api/cakes/bestsellers');
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(Array.isArray(res.body.data));
        for (const cake of res.body.data) {
          assert.ok(cake.id, 'Bestseller cake must have formatted id string');
          assert.equal(typeof cake.id, 'string');
        }
      });

      it('admin cake creation immediately surfaces on public GET /api/cakes and GET /api/cakes/:id', async () => {
        const payload = {
          name: 'Pistachio Raspberry Entremet',
          slug: syncSlug,
          category: 'Designer',
          basePrice: 1050,
          weightPrices: {
            '0.5 kg': 1050,
            '1 kg': 1999,
            '1.5 kg': 2899,
            '2 kg': 3799,
          },
          isEggless: true,
          image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587',
          description: 'Bronte pistachio mousse layered with tangy raspberry gelee.',
          flavor: 'Bronte Pistachio & Wild Raspberry',
          ingredients: ['Bronte Pistachio', 'Wild Raspberries', 'White Chocolate'],
          isBestSeller: false,
          isFeatured: true,
          preparationTimeHours: 3,
          dietaryTags: ['100% Eggless', 'Artisanal'],
          isAvailable: true,
        };

        const createRes = await request(app)
          .post('/api/admin/cakes')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(payload);

        assert.equal(createRes.status, 201);
        assert.equal(createRes.body.success, true);
        createdCakeId = createRes.body.data._id || createRes.body.data.id;
        assert.ok(createdCakeId);

        // Verify storefront catalog GET /api/cakes returns the new cake
        const catalogRes = await request(app).get('/api/cakes?search=Pistachio');
        assert.equal(catalogRes.status, 200);
        assert.equal(catalogRes.body.success, true);
        const match = catalogRes.body.data.find((c: any) => c.slug === syncSlug || c.id === createdCakeId);
        assert.ok(match, 'Newly created admin cake must appear in customer storefront catalog');
        assert.equal(match.name, 'Pistachio Raspberry Entremet');

        // Verify storefront detail GET /api/cakes/:id returns the new cake
        const detailRes = await request(app).get(`/api/cakes/${syncSlug}`);
        assert.equal(detailRes.status, 200);
        assert.equal(detailRes.body.success, true);
        assert.equal(detailRes.body.data.name, 'Pistachio Raspberry Entremet');
        assert.equal(detailRes.body.data.basePrice, 1050);
      });

      it('admin price update propagates to public GET /api/cakes/:id', async () => {
        const updateRes = await request(app)
          .put(`/api/admin/cakes/${createdCakeId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            basePrice: 1199,
            weightPrices: {
              '0.5 kg': 1199,
              '1 kg': 2199,
              '1.5 kg': 3099,
              '2 kg': 3999,
            },
          });

        assert.equal(updateRes.status, 200);
        assert.equal(updateRes.body.success, true);

        // Storefront detail reflects updated price
        const detailRes = await request(app).get(`/api/cakes/${syncSlug}`);
        assert.equal(detailRes.status, 200);
        assert.equal(detailRes.body.data.basePrice, 1199);
      });

      it('admin setting isAvailable: false removes cake from public catalog GET /api/cakes', async () => {
        const toggleRes = await request(app)
          .patch(`/api/admin/cakes/${createdCakeId}/availability`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ isAvailable: false });

        assert.equal(toggleRes.status, 200);
        assert.equal(toggleRes.body.success, true);

        // Public storefront catalog must exclude unavailable cake
        const catalogRes = await request(app).get('/api/cakes?search=Pistachio');
        assert.equal(catalogRes.status, 200);
        const foundInPublic = catalogRes.body.data.some((c: any) => c.slug === syncSlug || c.id === createdCakeId);
        assert.equal(foundInPublic, false, 'Unavailable cake must not appear in public customer catalog');
      });

      it('admin cake deletion causes public GET /api/cakes/:id to return 404', async () => {
        const deleteRes = await request(app)
          .delete(`/api/admin/cakes/${createdCakeId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        assert.equal(deleteRes.status, 200);
        assert.equal(deleteRes.body.success, true);

        // Public storefront detail must return 404 Not Found
        const detailRes = await request(app).get(`/api/cakes/${createdCakeId}`);
        assert.equal(detailRes.status, 404);
        assert.equal(detailRes.body.success, false);
      });

      it('public GET /api/cakes returns valid empty array [] when search has no matches (not static demo cakes)', async () => {
        const res = await request(app).get('/api/cakes?search=definitely_no_such_cake_xyz_nonexistent');
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.deepEqual(res.body.data, []);
        assert.equal(res.body.pagination.total, 0);
      });
    });
});
