import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminService, type AdminDashboardStats } from '../../services/adminService';
import {
  DollarSign,
  ShoppingBag,
  Cake,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Clock,
  TrendingUp,
  Inbox,
  CheckCircle2,
  AlertCircle,
  Truck,
  Flame,
  XCircle,
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchStats = useCallback(async () => {
    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      const response = await adminService.getDashboardStats();
      if (response.success && response.stats) {
        setStats(response.stats);
        setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } else {
        setErrorMessage('Failed to parse dashboard statistics from the server response.');
      }
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Unable to retrieve statistics from the backend. Ensure server is online.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Status badge styling helper
  const renderOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'Delivered':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Delivered
          </span>
        );
      case 'Baking':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Flame className="w-3 h-3 text-indigo-600" />
            Baking
          </span>
        );
      case 'Out for Delivery':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <Truck className="w-3 h-3 text-purple-600" />
            Out for Delivery
          </span>
        );
      case 'Confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            Confirmed
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            Cancelled
          </span>
        );
      case 'Pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Pending
          </span>
        );
    }
  };

  // Inquiry badge styling helper
  const renderInquiryStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
            Confirmed
          </span>
        );
      case 'reviewed':
      case 'quoted':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 capitalize">
            {status}
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
            Cancelled
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
            Pending Review
          </span>
        );
    }
  };

  // Loading Skeleton State
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-stone-200 rounded-xl w-64" />
          <div className="h-8 bg-stone-200 rounded-xl w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 bg-white rounded-3xl border border-[#E8DDD7] p-6 space-y-3" />
          ))}
        </div>
        <div className="h-64 bg-white rounded-3xl border border-[#E8DDD7]" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-white rounded-3xl border border-[#E8DDD7]" />
          <div className="h-80 bg-white rounded-3xl border border-[#E8DDD7]" />
        </div>
      </div>
    );
  }

  // Error State
  if (errorMessage && !stats) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white rounded-3xl p-8 border border-rose-200 shadow-lg text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="font-serif text-2xl font-bold text-[#2B1810]">
          Unable to Load Dashboard
        </h3>
        <p className="text-xs text-[#7E6355] leading-relaxed max-w-md mx-auto">
          {errorMessage}
        </p>
        <button
          onClick={fetchStats}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2B1810] text-[#FFFDF9] text-xs font-bold hover:bg-[#3D2314] transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-8">
      {/* Top Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#2B1810]">
            Bakery Overview
          </h1>
          <p className="text-xs text-[#7E6355] mt-1">
            Real-time operations, inventory counters, and order fulfillment status
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[11px] text-stone-500 hidden sm:inline">
              Last synced: <strong>{lastUpdated}</strong>
            </span>
          )}
          <button
            onClick={fetchStats}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-stone-50 text-[#5C3D28] text-xs font-bold border border-[#E8DDD7] shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#C5A059] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Stats'}</span>
          </button>
        </div>
      </div>

      {/* Security Warning Notice for default seeded credentials */}
      {stats.security.isDefaultCredentials && (
        <div className="p-4 sm:p-5 rounded-3xl bg-amber-50 border border-amber-300 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-200 text-amber-800 shrink-0 mt-0.5 sm:mt-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-amber-900">
                Production Security Advisory
              </h4>
              <p className="text-xs text-amber-900/90 mt-0.5 leading-relaxed">
                You are currently signed in with the seeded administrator account (<code>admin</code>). For production security, ensure this default password is changed before public deployment.
              </p>
            </div>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full bg-amber-200/80 text-amber-900 border border-amber-300 shrink-0">
            Action Recommended
          </span>
        </div>
      )}

      {/* 4 Primary KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Eligible Revenue */}
        <div className="bg-white p-6 rounded-3xl border border-[#E8DDD7] shadow-2xs space-y-4 hover:border-[#C5A059]/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7E6355]">
              Eligible Revenue
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div>
            <div className="font-serif text-3xl font-bold text-[#2B1810]">
              ₹{stats.revenue.total.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-stone-500 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>{stats.revenue.eligibleOrdersCount} non-cancelled orders</span>
            </p>
          </div>

          <div className="pt-2 border-t border-[#F4EEE8] text-[11px] text-[#7E6355] space-y-1">
            <div className="flex justify-between">
              <span>Delivered:</span>
              <span className="font-bold text-[#2B1810]">₹{stats.revenue.delivered.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span>In Fulfillment:</span>
              <span className="font-bold text-indigo-700">₹{stats.revenue.inProgress.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span>Pending Orders:</span>
              <span className="font-bold text-amber-700">₹{stats.revenue.pending.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Orders */}
        <div className="bg-white p-6 rounded-3xl border border-[#E8DDD7] shadow-2xs space-y-4 hover:border-[#C5A059]/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7E6355]">
              Total Customer Orders
            </span>
            <div className="w-10 h-10 rounded-2xl bg-[#FFF0F3] text-[#D86A7F] flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>

          <div>
            <div className="font-serif text-3xl font-bold text-[#2B1810]">
              {stats.orders.total}
            </div>
            <p className="text-[11px] text-stone-500 mt-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>{stats.orders.byStatus.Pending} awaiting preparation</span>
            </p>
          </div>

          <div className="pt-2 border-t border-[#F4EEE8] text-[11px] text-[#7E6355] space-y-1">
            <div className="flex justify-between">
              <span>Active in Kitchen:</span>
              <span className="font-bold text-[#2B1810]">
                {stats.orders.byStatus.Confirmed + stats.orders.byStatus.Baking + stats.orders.byStatus['Out for Delivery']}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Successfully Delivered:</span>
              <span className="font-bold text-emerald-700">{stats.orders.byStatus.Delivered}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Catalog Cakes */}
        <div className="bg-white p-6 rounded-3xl border border-[#E8DDD7] shadow-2xs space-y-4 hover:border-[#C5A059]/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7E6355]">
              Active Cake Catalog
            </span>
            <div className="w-10 h-10 rounded-2xl bg-[#FAF3E0] text-[#C5A059] flex items-center justify-center">
              <Cake className="w-5 h-5" />
            </div>
          </div>

          <div>
            <div className="font-serif text-3xl font-bold text-[#2B1810]">
              {stats.catalog.totalCakes}
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              Handcrafted signature creations
            </p>
          </div>

          <div className="pt-2 border-t border-[#F4EEE8] text-[11px] text-[#7E6355] space-y-1">
            <div className="flex justify-between">
              <span>Available in Store:</span>
              <span className="font-bold text-emerald-700">{stats.catalog.availableCakes} items</span>
            </div>
            <div className="flex justify-between">
              <span>Bakery Collections:</span>
              <span className="font-bold text-[#2B1810]">{stats.catalog.totalCategories} categories</span>
            </div>
          </div>
        </div>

        {/* Card 4: Custom Inquiries */}
        <div className="bg-white p-6 rounded-3xl border border-[#E8DDD7] shadow-2xs space-y-4 hover:border-[#C5A059]/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7E6355]">
              Custom Cake Inquiries
            </span>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>

          <div>
            <div className="font-serif text-3xl font-bold text-[#2B1810]">
              {stats.inquiries.total}
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              Custom designer requests
            </p>
          </div>

          <div className="pt-2 border-t border-[#F4EEE8] text-[11px] text-[#7E6355] space-y-1">
            <div className="flex justify-between">
              <span>Pending Chef Review:</span>
              <span className="font-bold text-amber-700">{stats.inquiries.pendingCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Quotes Provided:</span>
              <span className="font-bold text-blue-700">{stats.inquiries.byStatus.quoted}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Order Status Breakdown Grid */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E8DDD7] shadow-2xs space-y-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#C5A059]">
            Pipeline Tracking
          </span>
          <h3 className="font-serif text-xl font-bold text-[#2B1810]">
            Orders by Operational Status
          </h3>
          <p className="text-xs text-[#7E6355] mt-0.5">
            Real-time distribution across all 6 fulfillment stages
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {[
            { label: 'Pending', count: stats.orders.byStatus.Pending, color: 'bg-amber-500', text: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200' },
            { label: 'Confirmed', count: stats.orders.byStatus.Confirmed, color: 'bg-blue-500', text: 'text-blue-800', bg: 'bg-blue-50', border: 'border-blue-200' },
            { label: 'Baking', count: stats.orders.byStatus.Baking, color: 'bg-indigo-500', text: 'text-indigo-800', bg: 'bg-indigo-50', border: 'border-indigo-200' },
            { label: 'Out for Delivery', count: stats.orders.byStatus['Out for Delivery'], color: 'bg-purple-500', text: 'text-purple-800', bg: 'bg-purple-50', border: 'border-purple-200' },
            { label: 'Delivered', count: stats.orders.byStatus.Delivered, color: 'bg-emerald-500', text: 'text-emerald-800', bg: 'bg-emerald-50', border: 'border-emerald-200' },
            { label: 'Cancelled', count: stats.orders.byStatus.Cancelled, color: 'bg-rose-500', text: 'text-rose-800', bg: 'bg-rose-50', border: 'border-rose-200' },
          ].map((item) => {
            const percentage = stats.orders.total > 0 ? Math.round((item.count / stats.orders.total) * 100) : 0;
            return (
              <div
                key={item.label}
                className={`p-4 rounded-2xl border ${item.border} ${item.bg} flex flex-col justify-between space-y-2`}
              >
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-bold ${item.text}`}>{item.label}</span>
                  <span className="text-xs font-mono font-bold text-stone-500">{percentage}%</span>
                </div>
                <div className="font-serif text-2xl font-bold text-[#2B1810]">
                  {item.count}
                </div>
                <div className="w-full bg-white/60 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${percentage}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two-Column Recent Data Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Recent Orders Table */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-7 rounded-3xl border border-[#E8DDD7] shadow-2xs space-y-5">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#C5A059]">
                Recent Orders
              </span>
              <h3 className="font-serif text-lg font-bold text-[#2B1810]">
                Customer Orders Queue
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-stone-500 hidden sm:inline">
                Latest {stats.orders.recentOrders.length}
              </span>
              <Link
                to="/admin/orders"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#FAF3E0] hover:bg-[#F5E8C7] text-[#5C3D28] text-xs font-bold border border-[#E8DDD7] transition-colors"
              >
                <span>Manage Orders</span>
                <span className="text-[#C5A059]">→</span>
              </Link>
            </div>
          </div>

          {stats.orders.recentOrders.length === 0 ? (
            <div className="p-8 text-center text-stone-400 space-y-2 border border-dashed border-[#E8DDD7] rounded-2xl">
              <Inbox className="w-8 h-8 mx-auto text-stone-300" />
              <p className="text-xs font-medium">No customer orders recorded yet.</p>
              <p className="text-[11px] text-stone-400">Orders placed through storefront checkout will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#F4EEE8] text-stone-400 text-[11px] uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Order ID</th>
                    <th className="pb-3 font-semibold">Customer</th>
                    <th className="pb-3 font-semibold">Amount</th>
                    <th className="pb-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4EEE8]">
                  {stats.orders.recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-[#FDFBF7] transition-colors">
                      <td className="py-3 font-mono font-bold text-[#2B1810]">{order.orderId}</td>
                      <td className="py-3 text-[#5C3D28]">
                        <div className="font-semibold text-[#2B1810]">{order.customerName}</div>
                        <div className="text-[10px] text-stone-400">{order.itemCount} cake items</div>
                      </td>
                      <td className="py-3 font-bold text-[#2B1810]">
                        ₹{order.grandTotal.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3">{renderOrderStatusBadge(order.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Inquiries Table */}
        <div className="lg:col-span-5 bg-white p-6 sm:p-7 rounded-3xl border border-[#E8DDD7] shadow-2xs space-y-5">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#C5A059]">
                Custom Requests
              </span>
              <h3 className="font-serif text-lg font-bold text-[#2B1810]">
                Designer Inquiries
              </h3>
            </div>
            <span className="text-xs text-stone-500">
              Latest {stats.inquiries.recentInquiries.length}
            </span>
          </div>

          {stats.inquiries.recentInquiries.length === 0 ? (
            <div className="p-8 text-center text-stone-400 space-y-2 border border-dashed border-[#E8DDD7] rounded-2xl">
              <Sparkles className="w-8 h-8 mx-auto text-stone-300" />
              <p className="text-xs font-medium">No custom inquiries submitted yet.</p>
              <p className="text-[11px] text-stone-400">Custom cake designs submitted from the website will display here.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F4EEE8]">
              {stats.inquiries.recentInquiries.map((inq) => (
                <div key={inq.id} className="py-3.5 space-y-1.5 first:pt-0 last:pb-0">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-[#2B1810]">{inq.referenceId}</span>
                      <p className="text-xs font-medium text-[#5C3D28]">{inq.customerName}</p>
                    </div>
                    {renderInquiryStatusBadge(inq.status)}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-stone-500">
                    <span className="truncate max-w-[180px]">{inq.occasion} • {inq.flavor}</span>
                    <span className="font-bold text-[#2B1810] font-mono">₹{inq.estimatedPrice}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
