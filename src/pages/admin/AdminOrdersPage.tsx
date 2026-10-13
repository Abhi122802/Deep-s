import React, { useState, useEffect, useCallback } from 'react';
import {
  adminService,
  type AdminOrder,
  type OrderStatus,
  type AdminOrdersPagination,
} from '../../services/adminService';
import { useToast } from '../../context/ToastContext';
import {
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  Flame,
  Truck,
  XCircle,
  AlertCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X,
  Package,
  Phone,
  Mail,
  MapPin,
  Tag,
  ArrowRight,
  ShieldAlert,
  Filter,
} from 'lucide-react';

const STATUS_TABS: Array<{ label: string; value: string }> = [
  { label: 'All Orders', value: 'All' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Confirmed', value: 'Confirmed' },
  { label: 'Baking', value: 'Baking' },
  { label: 'Out for Delivery', value: 'Out for Delivery' },
  { label: 'Delivered', value: 'Delivered' },
  { label: 'Cancelled', value: 'Cancelled' },
];

const PERMITTED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Baking', 'Cancelled'],
  Baking: ['Out for Delivery', 'Cancelled'],
  'Out for Delivery': ['Delivered', 'Cancelled'],
  Delivered: [],
  Cancelled: [],
};

export const AdminOrdersPage: React.FC = () => {
  const { showToast } = useToast();

  // Query states
  const [search, setSearch] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'amount-desc' | 'amount-asc'>('newest');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  // Data states
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [pagination, setPagination] = useState<AdminOrdersPagination>({
    page: 1,
    limit: 10,
    totalOrders: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal states
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);

  // Status transition confirmation modal
  const [transitionTarget, setTransitionTarget] = useState<{
    order: AdminOrder;
    targetStatus: OrderStatus;
  } | null>(null);
  const [transitionNote, setTransitionNote] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  // Fetch orders from API
  const fetchOrders = useCallback(async (isBackgroundRefresh = false) => {
    if (isBackgroundRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const response = await adminService.getOrders({
        page,
        limit,
        status: selectedStatus,
        search: search.trim(),
        sortBy,
      });

      if (response.success) {
        setOrders(response.data || []);
        setPagination(response.pagination);
      } else {
        setErrorMessage('Failed to retrieve orders list from the bakery server.');
      }
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Unable to communicate with the orders endpoint. Please check server connectivity.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, limit, selectedStatus, search, sortBy]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Handle status update execution
  const executeStatusUpdate = async () => {
    if (!transitionTarget) return;

    const { order, targetStatus } = transitionTarget;
    setIsUpdatingStatus(true);

    try {
      const orderIdentifier = order._id || order.id || order.orderId;
      const response = await adminService.updateOrderStatus(
        orderIdentifier,
        targetStatus,
        transitionNote.trim() || undefined
      );

      if (response.success && response.data) {
        showToast(
          `Order #${order.orderId} status transitioned to "${targetStatus}".`,
          'success'
        );

        // Update local list
        setOrders((prev) =>
          prev.map((o) => (o.orderId === order.orderId ? { ...o, ...response.data } : o))
        );

        // Update selected order in detail view if open
        if (selectedOrder && selectedOrder.orderId === order.orderId) {
          setSelectedOrder((prev) => (prev ? { ...prev, ...response.data } : null));
        }

        // Close transition modal
        setTransitionTarget(null);
        setTransitionNote('');
      } else {
        showToast(response.message || 'Status transition could not be completed.', 'warning');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update order fulfillment status.', 'warning');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Open detail modal and fetch fresh order data
  const handleViewOrder = async (order: AdminOrder) => {
    setSelectedOrder(order);
    setIsDetailOpen(true);
    try {
      const idToFetch = order._id || order.id || order.orderId;
      const res = await adminService.getOrderById(idToFetch);
      if (res.success && res.data) {
        setSelectedOrder(res.data);
      }
    } catch (err) {
      // Retain already selected order if fresh fetch fails
    }
  };

  // Status badge renderer
  const renderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'Delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Delivered
          </span>
        );
      case 'Baking':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 shadow-2xs">
            <Flame className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
            Baking
          </span>
        );
      case 'Out for Delivery':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 shadow-2xs">
            <Truck className="w-3.5 h-3.5 text-purple-600" />
            Out for Delivery
          </span>
        );
      case 'Confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            Confirmed
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Cancelled
          </span>
        );
      case 'Pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Pending
          </span>
        );
    }
  };

  // Payment badge renderer
  const renderPaymentBadge = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'Paid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Paid
          </span>
        );
      case 'Unpaid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Unpaid
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
            {paymentStatus || 'Pending'}
          </span>
        );
    }
  };

  // Format date helper
  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-7 rounded-3xl border border-[#E8DDD7] shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#C5A059]">
              Fulfillment Operations
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Live API
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#2B1810] mt-1">
            Orders Management
          </h1>
          <p className="text-xs sm:text-sm text-[#7E6355] mt-0.5">
            Track customer cake orders, review custom messages, and advance operational workflow states.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchOrders(true)}
            disabled={isLoading || isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#FAF3E0] hover:bg-[#F5E8C7] text-[#5C3D28] text-xs font-bold border border-[#E8DDD7] transition-all cursor-pointer shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#C5A059]' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh List'}</span>
          </button>
        </div>
      </div>

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-bold block">Orders Error:</strong>
            <p className="text-rose-700">{errorMessage}</p>
          </div>
          <button
            onClick={() => fetchOrders()}
            className="underline font-bold text-rose-900 hover:text-rose-950 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Search, Filter & Sort Controls */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#E8DDD7] shadow-2xs space-y-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <Filter className="w-4 h-4 text-[#7E6355] shrink-0 mr-1" />
          {STATUS_TABS.map((tab) => {
            const isActive = selectedStatus === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => {
                  setSelectedStatus(tab.value);
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

        {/* Search, Sort, Limit Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-[#F4EEE8]">
          {/* Search Box */}
          <div className="sm:col-span-6 lg:col-span-7 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by order ID (ORD-...), customer name, phone, or email..."
              className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] text-xs font-medium text-[#2B1810] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40 focus:border-[#C5A059]"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort By */}
          <div className="sm:col-span-3 lg:col-span-3">
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
                setPage(1);
              }}
              className="w-full py-2.5 px-3 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] text-xs font-semibold text-[#2B1810] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40 cursor-pointer"
            >
              <option value="newest">Newest Orders First</option>
              <option value="oldest">Oldest Orders First</option>
              <option value="amount-desc">Amount: High to Low</option>
              <option value="amount-asc">Amount: Low to High</option>
            </select>
          </div>

          {/* Page Limit */}
          <div className="sm:col-span-3 lg:col-span-2">
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

      {/* Orders Table Container */}
      <div className="bg-white rounded-3xl border border-[#E8DDD7] shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-10 h-10 border-3 border-[#C5A059] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-[#7E6355]">Loading orders registry...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-14 h-14 bg-[#FAF3E0] rounded-3xl flex items-center justify-center mx-auto text-[#C5A059]">
              <Package className="w-7 h-7" />
            </div>
            <h3 className="font-serif text-lg font-bold text-[#2B1810]">No Orders Found</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              {search || selectedStatus !== 'All'
                ? 'No customer orders match your current filter criteria. Try resetting your search or status filter.'
                : 'No customer orders have been placed yet. As customers place orders via checkout, they will appear here.'}
            </p>
            {(search || selectedStatus !== 'All') && (
              <button
                onClick={() => {
                  setSearch('');
                  setSelectedStatus('All');
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
                  <th className="py-3.5 px-4 sm:px-6">Order Reference</th>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Items</th>
                  <th className="py-3.5 px-4">Total</th>
                  <th className="py-3.5 px-4">Payment</th>
                  <th className="py-3.5 px-4">Fulfillment</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4EEE8]">
                {orders.map((order) => {
                  const allowedNextStatuses = PERMITTED_TRANSITIONS[order.status] || [];
                  const isTerminal = allowedNextStatuses.length === 0;

                  return (
                    <tr
                      key={order._id || order.id || order.orderId}
                      className="hover:bg-[#FDFBF7] transition-colors group cursor-pointer"
                      onClick={() => handleViewOrder(order)}
                    >
                      {/* Order Reference */}
                      <td className="py-4 px-4 sm:px-6 font-mono font-bold text-[#2B1810]">
                        <span className="text-[#C5A059] group-hover:underline">
                          {order.orderId}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-4 px-4 text-stone-500 whitespace-nowrap">
                        {formatDate(order.createdAt)}
                      </td>

                      {/* Customer */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-[#2B1810]">{order.customer.name}</div>
                        <div className="text-[11px] text-stone-500 font-mono">
                          {order.customer.phone}
                        </div>
                      </td>

                      {/* Items */}
                      <td className="py-4 px-4 text-[#5C3D28]">
                        <div className="font-semibold">
                          {order.items?.length || 1} cake {order.items?.length === 1 ? 'item' : 'items'}
                        </div>
                        <div className="text-[11px] text-stone-400 truncate max-w-[150px]">
                          {order.items?.[0]?.cakeName}
                          {order.items?.length > 1 ? ` +${order.items.length - 1} more` : ''}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-[#2B1810] font-mono text-sm">
                          ₹{order.grandTotal?.toLocaleString('en-IN')}
                        </div>
                        {order.discountAmount > 0 && (
                          <div className="text-[10px] text-emerald-600 font-medium">
                            -₹{order.discountAmount} discount
                          </div>
                        )}
                      </td>

                      {/* Payment Status */}
                      <td className="py-4 px-4">
                        {renderPaymentBadge(order.paymentStatus)}
                      </td>

                      {/* Fulfillment Status */}
                      <td className="py-4 px-4">
                        {renderStatusBadge(order.status)}
                      </td>

                      {/* Action Buttons */}
                      <td
                        className="py-4 px-4 sm:px-6 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewOrder(order)}
                            className="p-2 rounded-xl bg-[#FAF3E0] hover:bg-[#F5E8C7] text-[#5C3D28] hover:text-[#2B1810] transition-colors cursor-pointer"
                            title="View complete order details"
                            aria-label="View order details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Quick Workflow Action based on state */}
                          {!isTerminal && allowedNextStatuses.length > 0 && (
                            <button
                              onClick={() =>
                                setTransitionTarget({
                                  order,
                                  targetStatus: allowedNextStatuses[0],
                                })
                              }
                              className="px-3 py-1.5 rounded-xl bg-[#2B1810] hover:bg-[#3D2314] text-[#FFFDF9] text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                            >
                              {allowedNextStatuses[0] === 'Confirmed' && 'Confirm'}
                              {allowedNextStatuses[0] === 'Baking' && 'Bake'}
                              {allowedNextStatuses[0] === 'Out for Delivery' && 'Dispatch'}
                              {allowedNextStatuses[0] === 'Delivered' && 'Mark Delivered'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {orders.length > 0 && (
          <div className="bg-[#FAF3E0]/40 border-t border-[#E8DDD7] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#7E6355]">
            <div>
              Showing <span className="font-bold text-[#2B1810]">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
              <span className="font-bold text-[#2B1810]">
                {Math.min(pagination.page * pagination.limit, pagination.totalOrders)}
              </span>{' '}
              of <span className="font-bold text-[#2B1810]">{pagination.totalOrders}</span> orders
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

      {/* ========================================================
          Order Detail Slide-Over / Modal View
         ======================================================== */}
      {isDetailOpen && selectedOrder && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in"
          onClick={() => setIsDetailOpen(false)}
        >
          <div
            className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-[#E8DDD7] overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 bg-[#2B1810] text-[#FFFDF9] flex items-center justify-between border-b border-white/10">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#FFFDF9]">
                    Order #{selectedOrder.orderId}
                  </h2>
                  {renderStatusBadge(selectedOrder.status)}
                </div>
                <p className="text-xs text-[#DFBF77]">
                  Placed on {formatDate(selectedOrder.createdAt)}
                </p>
              </div>

              <button
                onClick={() => setIsDetailOpen(false)}
                className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-[#FFFDF9] transition-colors cursor-pointer"
                aria-label="Close details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-xs text-[#2B1810]">
              {/* Progress Pipeline Tracker */}
              <div className="bg-[#FAF3E0]/70 p-5 rounded-2xl border border-[#E8DDD7] space-y-3">
                <div className="flex justify-between items-center text-[11px] font-bold text-[#7E6355] uppercase tracking-wider">
                  <span>Fulfillment Pipeline</span>
                  <span className="font-mono text-[#2B1810]">
                    Current Status: {selectedOrder.status}
                  </span>
                </div>

                {selectedOrder.status === 'Cancelled' ? (
                  <div className="p-3 bg-rose-100 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span className="font-bold">This order has been cancelled and terminated.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-5 gap-2 text-center text-[10px]">
                    {[
                      { key: 'Pending', label: '1. Pending' },
                      { key: 'Confirmed', label: '2. Confirmed' },
                      { key: 'Baking', label: '3. Baking' },
                      { key: 'Out for Delivery', label: '4. Out for Delivery' },
                      { key: 'Delivered', label: '5. Delivered' },
                    ].map((step, idx) => {
                      const stages = ['Pending', 'Confirmed', 'Baking', 'Out for Delivery', 'Delivered'];
                      const currentIdx = stages.indexOf(selectedOrder.status);
                      const isComplete = idx <= currentIdx;
                      const isCurrent = idx === currentIdx;

                      return (
                        <div
                          key={step.key}
                          className={`p-2 rounded-xl font-bold transition-all ${
                            isCurrent
                              ? 'bg-[#C5A059] text-[#2B1810] shadow-xs'
                              : isComplete
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-white/80 text-stone-400 border border-stone-200'
                          }`}
                        >
                          {step.label}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Two Column Layout: Customer Details & Payment Notice */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Customer Information */}
                <div className="bg-white p-5 rounded-2xl border border-[#E8DDD7] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#7E6355] uppercase tracking-wider">
                    <Phone className="w-3.5 h-3.5 text-[#C5A059]" />
                    <span>Customer Details</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <p className="font-bold text-sm text-[#2B1810]">
                      {selectedOrder.customer.name}
                    </p>
                    <div className="flex items-center gap-2 text-stone-600">
                      <Phone className="w-3.5 h-3.5 text-stone-400" />
                      <span>{selectedOrder.customer.phone}</span>
                    </div>
                    {selectedOrder.customer.email && (
                      <div className="flex items-center gap-2 text-stone-600">
                        <Mail className="w-3.5 h-3.5 text-stone-400" />
                        <span>{selectedOrder.customer.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Delivery Address & Notes */}
                <div className="bg-white p-5 rounded-2xl border border-[#E8DDD7] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#7E6355] uppercase tracking-wider">
                    <MapPin className="w-3.5 h-3.5 text-[#C5A059]" />
                    <span>Delivery Address</span>
                  </div>
                  <p className="text-stone-700 leading-relaxed">
                    {selectedOrder.customer.address}
                  </p>
                  {selectedOrder.deliveryNotes && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                      <strong>Chef / Delivery Notes:</strong> {selectedOrder.deliveryNotes}
                    </div>
                  )}
                </div>
              </div>

              {/* Items List */}
              <div className="bg-white p-5 rounded-2xl border border-[#E8DDD7] space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#7E6355]">
                    Order Items ({selectedOrder.items?.length || 0})
                  </span>
                  <span className="text-[11px] text-stone-400">
                    Pricing & specifications locked at purchase
                  </span>
                </div>

                <div className="divide-y divide-[#F4EEE8]">
                  {selectedOrder.items?.map((item, index) => (
                    <div key={index} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-0.5">
                          <h4 className="font-bold text-sm text-[#2B1810]">
                            {item.cakeName}
                          </h4>
                          <div className="flex items-center gap-3 text-stone-500 text-[11px]">
                            {item.selectedWeight && (
                              <span className="px-2 py-0.5 rounded-md bg-[#FAF3E0] font-medium text-[#5C3D28]">
                                Weight: {item.selectedWeight}
                              </span>
                            )}
                            <span>Qty: <strong className="text-[#2B1810]">{item.quantity}</strong></span>
                            <span>Unit: ₹{item.unitPrice}</span>
                          </div>
                        </div>

                        <div className="font-mono font-bold text-sm text-[#2B1810]">
                          ₹{item.lineTotal?.toLocaleString('en-IN')}
                        </div>
                      </div>

                      {/* Custom Inscription Message */}
                      {item.customMessage && (
                        <div className="p-2.5 rounded-xl bg-[#FAF3E0]/70 border border-[#E8DDD7] text-[11px] text-[#5C3D28] flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                          <span>
                            <strong>Inscription Message:</strong> &ldquo;{item.customMessage}&rdquo;
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Breakdown & Totals */}
              <div className="bg-[#FAF3E0]/50 p-5 rounded-2xl border border-[#E8DDD7] space-y-2.5">
                <div className="flex justify-between text-xs text-stone-600">
                  <span>Subtotal:</span>
                  <span className="font-mono font-semibold text-[#2B1810]">
                    ₹{selectedOrder.subtotal?.toLocaleString('en-IN')}
                  </span>
                </div>

                {selectedOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-xs text-emerald-700">
                    <span>
                      Discount applied {selectedOrder.couponCode ? `(${selectedOrder.couponCode})` : ''}:
                    </span>
                    <span className="font-mono font-semibold">
                      -₹{selectedOrder.discountAmount?.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-xs text-stone-600">
                  <span>Delivery Charge:</span>
                  <span className="font-mono font-semibold text-[#2B1810]">
                    {selectedOrder.deliveryFee === 0 ? 'Free' : `₹${selectedOrder.deliveryFee}`}
                  </span>
                </div>

                <div className="pt-2.5 border-t border-[#E8DDD7] flex justify-between items-center text-sm font-bold text-[#2B1810]">
                  <span>Grand Total:</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-base text-[#2B1810]">
                      ₹{selectedOrder.grandTotal?.toLocaleString('en-IN')}
                    </span>
                    {renderPaymentBadge(selectedOrder.paymentStatus)}
                  </div>
                </div>
              </div>

              {/* Status Transition Action Bar */}
              <div className="pt-4 border-t border-[#F4EEE8] space-y-3">
                <span className="text-xs font-bold text-[#7E6355] uppercase tracking-wider block">
                  Permitted Fulfillment Actions
                </span>

                {PERMITTED_TRANSITIONS[selectedOrder.status]?.length === 0 ? (
                  <div className="p-3 bg-stone-100 rounded-2xl text-stone-600 text-xs">
                    This order is in a terminal status (<strong>{selectedOrder.status}</strong>).
                    No further status transitions are allowed.
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    {PERMITTED_TRANSITIONS[selectedOrder.status]?.map((targetStatus) => (
                      <button
                        key={targetStatus}
                        onClick={() =>
                          setTransitionTarget({
                            order: selectedOrder,
                            targetStatus,
                          })
                        }
                        className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                          targetStatus === 'Cancelled'
                            ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300'
                            : 'bg-[#2B1810] hover:bg-[#3D2314] text-[#FFFDF9]'
                        }`}
                      >
                        Advance to: {targetStatus}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 bg-[#FAF3E0]/60 border-t border-[#E8DDD7] flex justify-end">
              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-5 py-2 rounded-2xl bg-white border border-[#E8DDD7] text-xs font-bold text-[#2B1810] hover:bg-stone-50 transition-colors cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          Status Transition Confirmation Dialog Modal
         ======================================================== */}
      {transitionTarget && (
        <div
          className="fixed inset-0 z-60 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => {
            if (!isUpdatingStatus) setTransitionTarget(null);
          }}
        >
          <div
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-[#E8DDD7] p-6 space-y-5 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  transitionTarget.targetStatus === 'Cancelled'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-[#FAF3E0] text-[#C5A059]'
                }`}
              >
                {transitionTarget.targetStatus === 'Cancelled' ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : (
                  <ArrowRight className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-[#2B1810]">
                  Confirm Status Transition
                </h3>
                <p className="text-xs text-stone-500 font-mono">
                  Order #{transitionTarget.order.orderId}
                </p>
              </div>
            </div>

            {/* Status change representation */}
            <div className="bg-[#FAF3E0]/70 p-4 rounded-2xl border border-[#E8DDD7] space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-stone-500">Current Status:</span>
                <span>{renderStatusBadge(transitionTarget.order.status)}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold pt-2 border-t border-[#E8DDD7]">
                <span className="text-stone-500">New Target Status:</span>
                <span>{renderStatusBadge(transitionTarget.targetStatus)}</span>
              </div>
            </div>

            {/* Warnings and notices */}
            <div className="space-y-2 text-xs text-stone-600">
              <p className="leading-relaxed">
                Payment status will remain preserved as{' '}
                <strong className="text-[#2B1810]">
                  {transitionTarget.order.paymentStatus}
                </strong>
                . Fulfillment status transitions do not alter payment records.
              </p>

              {(transitionTarget.targetStatus === 'Delivered' ||
                transitionTarget.targetStatus === 'Cancelled') && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Terminal Status Notice:</strong> Once marked as{' '}
                    <strong>{transitionTarget.targetStatus}</strong>, this order cannot be reverted or transitioned again.
                  </span>
                </div>
              )}
            </div>

            {/* Optional note input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#7E6355] uppercase tracking-wider block">
                Internal Operational Note (Optional)
              </label>
              <textarea
                value={transitionNote}
                onChange={(e) => setTransitionNote(e.target.value)}
                placeholder="e.g. Dispatched with express courier #12; Customer confirmed receipt..."
                rows={2}
                className="w-full p-3 rounded-2xl bg-[#FDFBF7] border border-[#E8DDD7] text-xs font-medium text-[#2B1810] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTransitionTarget(null)}
                disabled={isUpdatingStatus}
                className="px-4 py-2 rounded-2xl bg-white border border-[#E8DDD7] text-xs font-bold text-[#5C3D28] hover:bg-stone-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={executeStatusUpdate}
                disabled={isUpdatingStatus}
                className={`px-5 py-2 rounded-2xl text-xs font-bold text-white transition-all cursor-pointer shadow-xs disabled:opacity-50 ${
                  transitionTarget.targetStatus === 'Cancelled'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#2B1810] hover:bg-[#3D2314]'
                }`}
              >
                {isUpdatingStatus ? 'Applying Change...' : 'Confirm Transition'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
