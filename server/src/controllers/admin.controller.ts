import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { OrderModel } from '../models/Order.js';
import { CakeModel } from '../models/Cake.js';
import { CustomCakeInquiryModel } from '../models/CustomCakeInquiry.js';
import { CategoryModel } from '../models/Category.js';
import { isDbConnected } from '../config/db.js';
import { MEMORY_INQUIRIES } from './adminInquiry.controller.js';

export interface AdminDashboardStatsResponse {
  success: boolean;
  timestamp: string;
  stats: {
    orders: {
      total: number;
      byStatus: {
        Pending: number;
        Confirmed: number;
        Baking: number;
        'Out for Delivery': number;
        Delivered: number;
        Cancelled: number;
      };
      recentOrders: Array<{
        id: string;
        orderId: string;
        customerName: string;
        grandTotal: number;
        itemCount: number;
        status: string;
        paymentStatus: string;
        createdAt: string;
      }>;
    };
    revenue: {
      total: number;
      delivered: number;
      inProgress: number;
      pending: number;
      currency: string;
      eligibleOrdersCount: number;
      eligibleCriteria: string;
    };
    catalog: {
      totalCakes: number;
      availableCakes: number;
      totalCategories: number;
    };
    inquiries: {
      total: number;
      pendingCount: number;
      byStatus: {
        pending: number;
        reviewed: number;
        quoted: number;
        confirmed: number;
        cancelled: number;
      };
      recentInquiries: Array<{
        id: string;
        referenceId: string;
        customerName: string;
        occasion: string;
        flavor: string;
        weight: string;
        estimatedPrice: number;
        status: string;
        createdAt: string;
      }>;
    };
    security: {
      adminUsername: string;
      adminRole: string;
      isDefaultCredentials: boolean;
      warningMessage?: string;
    };
  };
}

/**
 * Controller to retrieve aggregate statistics for the Admin Dashboard
 * Secured by requireAdminAuth middleware
 */
export async function getAdminDashboardStats(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminUser = req.user;
    if (!adminUser) {
      res.status(401).json({ success: false, message: 'Administrative authentication required.' });
      return;
    }

    const isDefault = adminUser.username.toLowerCase() === 'admin';

    // If database is currently offline, return a safe structured offline response
    if (!isDbConnected()) {
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        stats: {
          orders: {
            total: 0,
            byStatus: {
              Pending: 0,
              Confirmed: 0,
              Baking: 0,
              'Out for Delivery': 0,
              Delivered: 0,
              Cancelled: 0,
            },
            recentOrders: [],
          },
          revenue: {
            total: 0,
            delivered: 0,
            inProgress: 0,
            pending: 0,
            currency: 'INR',
            eligibleOrdersCount: 0,
            eligibleCriteria: 'Orders with status other than Cancelled',
          },
          catalog: {
            totalCakes: 14,
            availableCakes: 14,
            totalCategories: 7,
          },
          inquiries: {
            total: MEMORY_INQUIRIES.length,
            pendingCount: MEMORY_INQUIRIES.filter((i) => i.status === 'pending').length,
            byStatus: {
              pending: MEMORY_INQUIRIES.filter((i) => i.status === 'pending').length,
              reviewed: MEMORY_INQUIRIES.filter((i) => i.status === 'reviewed').length,
              quoted: MEMORY_INQUIRIES.filter((i) => i.status === 'quoted').length,
              confirmed: MEMORY_INQUIRIES.filter((i) => i.status === 'confirmed').length,
              cancelled: MEMORY_INQUIRIES.filter((i) => i.status === 'cancelled').length,
            },
            recentInquiries: MEMORY_INQUIRIES.slice(0, 5).map((doc) => ({
              id: doc._id?.toString() || doc.id,
              referenceId: doc.referenceId,
              customerName: doc.customerName,
              occasion: doc.occasion,
              flavor: doc.flavor,
              weight: doc.weight,
              estimatedPrice: doc.estimatedPrice,
              status: doc.status,
              createdAt: doc.createdAt,
            })),
          },
          security: {
            adminUsername: adminUser.username,
            adminRole: adminUser.role,
            isDefaultCredentials: isDefault,
            warningMessage: isDefault
              ? 'Warning: Default seeded administrator credentials are active. Please update your credentials before production deployment.'
              : undefined,
          },
        },
      });
      return;
    }

    // 1. Order aggregation & counts
    const [
      totalOrders,
      pendingOrders,
      confirmedOrders,
      bakingOrders,
      outForDeliveryOrders,
      deliveredOrders,
      cancelledOrders,
      recentOrderDocs,
    ] = await Promise.all([
      OrderModel.countDocuments(),
      OrderModel.countDocuments({ status: 'Pending' }),
      OrderModel.countDocuments({ status: 'Confirmed' }),
      OrderModel.countDocuments({ status: 'Baking' }),
      OrderModel.countDocuments({ status: 'Out for Delivery' }),
      OrderModel.countDocuments({ status: 'Delivered' }),
      OrderModel.countDocuments({ status: 'Cancelled' }),
      OrderModel.find().sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    // 2. Revenue calculation by status grouping (Eligible = all non-cancelled orders)
    const revenueAggregation = await OrderModel.aggregate([
      {
        $match: {
          status: { $ne: 'Cancelled' },
        },
      },
      {
        $group: {
          _id: '$status',
          sumGrandTotal: { $sum: '$grandTotal' },
          count: { $sum: 1 },
        },
      },
    ]);

    let totalRevenue = 0;
    let deliveredRevenue = 0;
    let inProgressRevenue = 0;
    let pendingRevenue = 0;
    let eligibleOrdersCount = 0;

    for (const group of revenueAggregation) {
      const amount = group.sumGrandTotal || 0;
      totalRevenue += amount;
      eligibleOrdersCount += group.count || 0;

      if (group._id === 'Delivered') {
        deliveredRevenue += amount;
      } else if (['Confirmed', 'Baking', 'Out for Delivery'].includes(group._id)) {
        inProgressRevenue += amount;
      } else if (group._id === 'Pending') {
        pendingRevenue += amount;
      }
    }

    // 3. Catalog counts
    const [totalCakes, availableCakes, totalCategories] = await Promise.all([
      CakeModel.countDocuments(),
      CakeModel.countDocuments({ isAvailable: true }),
      CategoryModel.countDocuments(),
    ]);

    // 4. Custom cake inquiries counts
    const [
      totalInquiries,
      inquiriesPending,
      inquiriesReviewed,
      inquiriesQuoted,
      inquiriesConfirmed,
      inquiriesCancelled,
      recentInquiryDocs,
    ] = await Promise.all([
      CustomCakeInquiryModel.countDocuments(),
      CustomCakeInquiryModel.countDocuments({ status: 'pending' }),
      CustomCakeInquiryModel.countDocuments({ status: 'reviewed' }),
      CustomCakeInquiryModel.countDocuments({ status: 'quoted' }),
      CustomCakeInquiryModel.countDocuments({ status: 'confirmed' }),
      CustomCakeInquiryModel.countDocuments({ status: 'cancelled' }),
      CustomCakeInquiryModel.find().sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    // Format safe recent orders
    const recentOrders = recentOrderDocs.map((doc: any) => ({
      id: doc._id.toString(),
      orderId: doc.orderId,
      customerName: doc.customer?.name || 'Customer',
      grandTotal: doc.grandTotal,
      itemCount: Array.isArray(doc.items) ? doc.items.length : 0,
      status: doc.status,
      paymentStatus: doc.paymentStatus,
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
    }));

    // Format safe recent inquiries
    const recentInquiries = recentInquiryDocs.map((doc: any) => ({
      id: doc._id.toString(),
      referenceId: doc.referenceId,
      customerName: doc.customerName,
      occasion: doc.occasion,
      flavor: doc.flavor,
      weight: doc.weight,
      estimatedPrice: doc.estimatedPrice,
      status: doc.status,
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
    }));

    const response: AdminDashboardStatsResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        orders: {
          total: totalOrders,
          byStatus: {
            Pending: pendingOrders,
            Confirmed: confirmedOrders,
            Baking: bakingOrders,
            'Out for Delivery': outForDeliveryOrders,
            Delivered: deliveredOrders,
            Cancelled: cancelledOrders,
          },
          recentOrders,
        },
        revenue: {
          total: totalRevenue,
          delivered: deliveredRevenue,
          inProgress: inProgressRevenue,
          pending: pendingRevenue,
          currency: 'INR',
          eligibleOrdersCount,
          eligibleCriteria: 'Orders with status other than Cancelled',
        },
        catalog: {
          totalCakes,
          availableCakes,
          totalCategories,
        },
        inquiries: {
          total: totalInquiries,
          pendingCount: inquiriesPending,
          byStatus: {
            pending: inquiriesPending,
            reviewed: inquiriesReviewed,
            quoted: inquiriesQuoted,
            confirmed: inquiriesConfirmed,
            cancelled: inquiriesCancelled,
          },
          recentInquiries,
        },
        security: {
          adminUsername: adminUser.username,
          adminRole: adminUser.role,
          isDefaultCredentials: isDefault,
          warningMessage: isDefault
            ? 'Warning: Default seeded administrator credentials are active. Please update your credentials before production deployment.'
            : undefined,
        },
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
}
