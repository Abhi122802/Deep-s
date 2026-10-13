import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Eye,
  Send,
  RefreshCw,
  Copy,
  Check,
  Phone,
  Mail,
  MapPin,
  Cake,
  X,
  Info,
  ExternalLink,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import type {
  AdminInquiry,
  UpdateInquiryStatusPayload,
} from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

type StatusFilter = 'all' | 'pending' | 'reviewed' | 'quoted' | 'confirmed' | 'cancelled';

const STATUS_BADGE_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  pending: {
    label: 'Pending Review',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  reviewed: {
    label: 'Reviewed by Chef',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  quoted: {
    label: 'Quotation Sent',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  confirmed: {
    label: 'Bespoke Confirmed',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  cancelled: {
    label: 'Cancelled / Declined',
    bg: 'bg-stone-100',
    text: 'text-stone-600',
    border: 'border-stone-300',
    dot: 'bg-stone-400',
  },
};

const PERMITTED_TRANSITIONS: Record<string, string[]> = {
  pending: ['reviewed', 'quoted', 'cancelled'],
  reviewed: ['quoted', 'confirmed', 'cancelled'],
  quoted: ['confirmed', 'reviewed', 'cancelled'],
  confirmed: ['cancelled'],
  cancelled: [],
};

export const AdminInquiriesPage: React.FC = () => {
  const { showToast } = useToast();

  const [inquiries, setInquiries] = useState<AdminInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search states
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'preferredDate' | 'estimatedPrice'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals state
  const [inspectInquiry, setInspectInquiry] = useState<AdminInquiry | null>(null);
  const [actionInquiry, setActionInquiry] = useState<AdminInquiry | null>(null);
  const [targetStatus, setTargetStatus] = useState<string>('');
  const [quotedAmount, setQuotedAmount] = useState<string>('');
  const [quoteValidityDays, setQuoteValidityDays] = useState<number>(7);
  const [quoteNotes, setQuoteNotes] = useState<string>('');
  const [internalNotes, setInternalNotes] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [copiedRefId, setCopiedRefId] = useState<string | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);

  const fetchInquiries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminService.getInquiries({
        page: currentPage,
        limit: 10,
        status: statusFilter,
        search: searchQuery.trim() || undefined,
        sortBy,
        sortOrder,
      });

      if (res.success) {
        setInquiries(res.data);
        setTotalPages(res.pagination.totalPages);
        setTotalCount(res.pagination.total);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch inquiries.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, searchQuery, sortBy, sortOrder]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  const handleCopyRef = (refId: string) => {
    navigator.clipboard.writeText(refId);
    setCopiedRefId(refId);
    showToast(`Copied reference #${refId} to clipboard!`, 'info');
    setTimeout(() => setCopiedRefId(null), 2000);
  };

  const openActionModal = (inquiry: AdminInquiry, defaultNextStatus?: string) => {
    setActionInquiry(inquiry);
    const allowed = PERMITTED_TRANSITIONS[inquiry.status] || [];
    const next = defaultNextStatus && allowed.includes(defaultNextStatus) ? defaultNextStatus : allowed[0] || '';
    setTargetStatus(next);
    setQuotedAmount(inquiry.quotedAmount ? String(inquiry.quotedAmount) : String(inquiry.estimatedPrice || 1500));
    setQuoteValidityDays(inquiry.quoteValidityDays || 7);
    setQuoteNotes(inquiry.quoteNotes || '');
    setInternalNotes(inquiry.internalNotes || '');
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionInquiry || !targetStatus) return;

    if (targetStatus === 'quoted') {
      const amount = parseFloat(quotedAmount);
      if (!amount || amount <= 0 || isNaN(amount)) {
        showToast('Please provide a valid quote amount greater than zero.', 'warning');
        return;
      }
    }

    try {
      setSubmittingAction(true);
      const payload: UpdateInquiryStatusPayload = {
        status: targetStatus as any,
        internalNotes: internalNotes.trim() || undefined,
      };

      if (targetStatus === 'quoted') {
        payload.quotedAmount = parseFloat(quotedAmount);
        payload.quoteCurrency = 'INR';
        payload.quoteValidityDays = quoteValidityDays;
        payload.quoteNotes = quoteNotes.trim() || undefined;
      }

      const res = await adminService.updateInquiryStatus(actionInquiry.referenceId, payload);
      if (res.success) {
        showToast(`Inquiry #${actionInquiry.referenceId} updated to "${targetStatus}"!`, 'success');
        setActionInquiry(null);
        if (inspectInquiry && inspectInquiry.referenceId === actionInquiry.referenceId) {
          setInspectInquiry(res.data);
        }
        await fetchInquiries();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update inquiry status.', 'warning');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Status counts for overview tabs
  const pendingCount = inquiries.filter((i) => i.status === 'pending').length;
  const quotedCount = inquiries.filter((i) => i.status === 'quoted').length;
  const confirmedCount = inquiries.filter((i) => i.status === 'confirmed').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#EADBCE] shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#2B1810] text-[#DFBF77] flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif font-bold text-2xl text-[#2B1810]">
                Custom Cake Inquiries
              </h1>
              <p className="text-xs text-[#6B5E55]">
                Manage bespoke designer cake requests, review culinary briefs, and provide formal quotes.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchInquiries()}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#D5C7B8] hover:border-[#C5A059] text-xs font-medium text-[#2B1810] bg-[#FAF8F5] transition-all hover:bg-white disabled:opacity-50"
            title="Refresh Inquiries"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#C5A059] ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#EADBCE] shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#8A7968]">Pending Action</p>
            <p className="text-xl font-bold font-serif text-[#2B1810]">{pendingCount} Inquiries</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#EADBCE] shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#8A7968]">Quoted Proposals</p>
            <p className="text-xl font-bold font-serif text-[#2B1810]">{quotedCount} Active</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#EADBCE] shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#8A7968]">Confirmed Bakes</p>
            <p className="text-xl font-bold font-serif text-[#2B1810]">{confirmedCount} Scheduled</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#EADBCE] shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-[#FAF3E0] text-[#C5A059] flex items-center justify-center shrink-0">
            <Cake className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#8A7968]">Total Volume</p>
            <p className="text-xl font-bold font-serif text-[#2B1810]">{totalCount} Inquiries</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#EADBCE] shadow-sm space-y-4">
        {/* Status Tab Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {(
            [
              { key: 'all', label: 'All Inquiries' },
              { key: 'pending', label: 'Pending Review' },
              { key: 'reviewed', label: 'Reviewed' },
              { key: 'quoted', label: 'Quoted' },
              { key: 'confirmed', label: 'Confirmed' },
              { key: 'cancelled', label: 'Cancelled' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setStatusFilter(tab.key);
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                statusFilter === tab.key
                  ? 'bg-[#2B1810] text-[#FFFDF9] shadow-xs'
                  : 'bg-[#FAF8F5] text-[#6B5E55] hover:bg-[#F3EFEA] hover:text-[#2B1810]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search, Sort and Page Sizing */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-[#F2ECE4]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8A7968] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by customer name, phone, email, or #INQ reference..."
              className="w-full pl-9.5 pr-4 py-2 rounded-xl border border-[#D5C7B8] text-xs text-[#2B1810] placeholder:text-[#9A8D83] focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] bg-[#FAF8F5]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8A7968] hover:text-[#2B1810]"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#D5C7B8] bg-[#FAF8F5] text-xs text-[#6B5E55]">
              <span className="text-[11px] text-[#9A8D83]">Sort:</span>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field as any);
                  setSortOrder(order as any);
                }}
                className="bg-transparent text-xs font-medium text-[#2B1810] focus:outline-none cursor-pointer"
              >
                <option value="createdAt-desc">Submitted (Newest)</option>
                <option value="createdAt-asc">Submitted (Oldest)</option>
                <option value="preferredDate-asc">Event Date (Soonest)</option>
                <option value="estimatedPrice-desc">Estimated Price (High-Low)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table / List */}
      <div className="bg-white rounded-2xl border border-[#EADBCE] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#6B5E55]">
            <RefreshCw className="w-8 h-8 text-[#C5A059] animate-spin" />
            <p className="text-sm font-medium">Fetching bespoke cake inquiries...</p>
          </div>
        ) : error ? (
          <div className="py-16 px-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-600 mb-1">{error}</p>
            <button
              onClick={() => fetchInquiries()}
              className="text-xs text-[#C5A059] underline hover:text-[#A6833D]"
            >
              Try Again
            </button>
          </div>
        ) : inquiries.length === 0 ? (
          <div className="py-20 px-6 text-center">
            <Cake className="w-12 h-12 text-[#C5A059]/40 mx-auto mb-3" />
            <h3 className="font-serif font-bold text-lg text-[#2B1810] mb-1">No Custom Inquiries Found</h3>
            <p className="text-xs text-[#8A7968] max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all'
                ? 'No inquiries match your current filters. Try resetting your search terms.'
                : 'Custom inquiries submitted through the customer storefront will appear here.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#EADBCE] text-[#8A7968] font-medium uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Reference & Client</th>
                  <th className="py-3.5 px-4">Occasion & Cake Specs</th>
                  <th className="py-3.5 px-4">Celebration Date</th>
                  <th className="py-3.5 px-4">Pricing</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECE4]">
                {inquiries.map((inq) => {
                  const badge = STATUS_BADGE_CONFIG[inq.status] || STATUS_BADGE_CONFIG.pending;
                  const isCopied = copiedRefId === inq.referenceId;
                  const allowedTransitions = PERMITTED_TRANSITIONS[inq.status] || [];

                  return (
                    <tr
                      key={inq.referenceId}
                      className="hover:bg-[#FCFBF8] transition-colors group"
                    >
                      {/* Reference & Customer */}
                      <td className="py-4 px-4">
                        <div className="flex items-start gap-2.5">
                          {inq.referenceImageUrl ? (
                            <img
                              src={inq.referenceImageUrl}
                              alt="Ref"
                              onClick={() => setSelectedImagePreview(inq.referenceImageUrl || null)}
                              className="w-10 h-10 rounded-lg object-cover border border-[#EADBCE] shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                              title="Click to view full reference"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-[#FAF3E0] border border-[#EADBCE] flex items-center justify-center shrink-0 text-[#C5A059]">
                              <Cake className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-xs text-[#2B1810]">
                                #{inq.referenceId}
                              </span>
                              <button
                                onClick={() => handleCopyRef(inq.referenceId)}
                                className="text-[#A09386] hover:text-[#2B1810] transition-colors p-0.5"
                                title="Copy Reference ID"
                              >
                                {isCopied ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            <p className="font-medium text-[#2B1810] mt-0.5">{inq.customerName}</p>
                            <div className="flex items-center gap-2 text-[11px] text-[#8A7968]">
                              <span>{inq.phone}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Cake Specs */}
                      <td className="py-4 px-4">
                        <p className="font-medium text-[#2B1810] line-clamp-1">{inq.occasion}</p>
                        <p className="text-[11px] text-[#6B5E55] line-clamp-1">{inq.flavor}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-1.5 py-0.5 rounded bg-[#FAF3E0] text-[10px] font-semibold text-[#8C6D28]">
                            {inq.weight} • {inq.tierCount}
                          </span>
                          {inq.isEggless && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-[10px] font-semibold text-emerald-700">
                              Eggless
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Celebration Date */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 text-xs text-[#2B1810] font-medium">
                          <Calendar className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                          <span>{inq.preferredDate}</span>
                        </div>
                        <p className="text-[10px] text-[#8A7968] mt-0.5">{inq.deliveryTimeSlot}</p>
                      </td>

                      {/* Pricing */}
                      <td className="py-4 px-4">
                        {inq.quotedAmount ? (
                          <div>
                            <div className="text-[11px] text-[#8A7968]">Quoted:</div>
                            <span className="font-bold text-sm text-[#2B1810]">
                              ₹{inq.quotedAmount.toLocaleString('en-IN')}
                            </span>
                            <div className="text-[10px] text-[#A09386] line-through">
                              Est: ₹{inq.estimatedPrice.toLocaleString('en-IN')}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-[11px] text-[#8A7968]">Estimated:</div>
                            <span className="font-semibold text-xs text-[#6B5E55]">
                              ₹{inq.estimatedPrice.toLocaleString('en-IN')}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          {badge.label}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="py-4 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setInspectInquiry(inq)}
                          className="px-2.5 py-1.5 rounded-lg border border-[#D5C7B8] hover:border-[#C5A059] hover:bg-[#FAF8F5] text-xs font-medium text-[#2B1810] transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3 text-[#C5A059]" />
                          Inspect
                        </button>

                        {allowedTransitions.length > 0 && (
                          <button
                            onClick={() => openActionModal(inq)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#2B1810] hover:bg-[#3E2419] text-xs font-medium text-[#FFFDF9] transition-colors inline-flex items-center gap-1"
                          >
                            <Send className="w-3 h-3 text-[#DFBF77]" />
                            {inq.status === 'pending' || inq.status === 'reviewed' ? 'Quote / Update' : 'Update Status'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-[#EADBCE] bg-[#FAF8F5] flex items-center justify-between text-xs text-[#6B5E55]">
            <p>
              Page <span className="font-semibold text-[#2B1810]">{currentPage}</span> of{' '}
              <span className="font-semibold text-[#2B1810]">{totalPages}</span> ({totalCount} total inquiries)
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-[#D5C7B8] bg-white hover:bg-[#F3EFEA] disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-[#2B1810]" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-[#D5C7B8] bg-white hover:bg-[#F3EFEA] disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-[#2B1810]" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* INSPECT INQUIRY DETAIL MODAL */}
      {inspectInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#EADBCE] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-[#EADBCE] flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-xs z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2B1810] text-[#DFBF77] flex items-center justify-center shrink-0">
                  <Cake className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif font-bold text-lg text-[#2B1810]">
                      Inquiry #{inspectInquiry.referenceId}
                    </h2>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                        STATUS_BADGE_CONFIG[inspectInquiry.status]?.bg || 'bg-stone-100'
                      } ${STATUS_BADGE_CONFIG[inspectInquiry.status]?.text || 'text-stone-800'} ${
                        STATUS_BADGE_CONFIG[inspectInquiry.status]?.border || 'border-stone-200'
                      }`}
                    >
                      {STATUS_BADGE_CONFIG[inspectInquiry.status]?.label || inspectInquiry.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#8A7968]">
                    Submitted on {new Date(inspectInquiry.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectInquiry(null)}
                className="p-2 rounded-xl text-[#8A7968] hover:bg-[#FAF8F5] hover:text-[#2B1810] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Reference Image Banner if Available */}
              {inspectInquiry.referenceImageUrl && (
                <div className="rounded-2xl border border-[#EADBCE] overflow-hidden bg-[#FAF8F5]">
                  <div className="p-3 bg-[#FAF3E0] border-b border-[#EADBCE] flex items-center justify-between text-xs text-[#8C6D28] font-medium">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Customer Reference Design Image
                    </span>
                    <a
                      href={inspectInquiry.referenceImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] underline hover:text-[#2B1810]"
                    >
                      Open Full Size <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="p-4 flex justify-center bg-stone-900/5">
                    <img
                      src={inspectInquiry.referenceImageUrl}
                      alt="Customer Reference"
                      className="max-h-64 rounded-xl object-contain shadow-sm cursor-pointer"
                      onClick={() => setSelectedImagePreview(inspectInquiry.referenceImageUrl || null)}
                    />
                  </div>
                </div>
              )}

              {/* Customer Profile & Logistics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EADBCE]">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8A7968] mb-3 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#C5A059]" /> Client Details
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <p className="font-semibold text-sm text-[#2B1810]">{inspectInquiry.customerName}</p>
                    <p className="text-[#6B5E55] flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-[#A09386]" />
                      <a href={`tel:${inspectInquiry.phone}`} className="hover:underline text-[#2B1810]">
                        {inspectInquiry.phone}
                      </a>
                    </p>
                    <p className="text-[#6B5E55] flex items-center gap-1.5">
                      <Mail className="w-3 h-3 text-[#A09386]" />
                      <a href={`mailto:${inspectInquiry.email}`} className="hover:underline text-[#2B1810]">
                        {inspectInquiry.email}
                      </a>
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EADBCE]">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8A7968] mb-3 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#C5A059]" /> Celebration & Delivery
                  </h4>
                  <div className="space-y-1.5 text-xs text-[#2B1810]">
                    <p>
                      <span className="text-[#8A7968]">Target Date:</span>{' '}
                      <span className="font-bold">{inspectInquiry.preferredDate}</span>
                    </p>
                    <p>
                      <span className="text-[#8A7968]">Time Slot:</span>{' '}
                      <span className="font-medium">{inspectInquiry.deliveryTimeSlot}</span>
                    </p>
                    {inspectInquiry.deliveryAddress && (
                      <p className="text-[11px] text-[#6B5E55] flex items-start gap-1 pt-1">
                        <MapPin className="w-3.5 h-3.5 text-[#A09386] shrink-0 mt-0.5" />
                        <span>{inspectInquiry.deliveryAddress}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Bespoke Cake Specifications */}
              <div className="p-4 rounded-2xl bg-white border border-[#EADBCE] space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8A7968] flex items-center gap-1.5">
                  <Cake className="w-3.5 h-3.5 text-[#C5A059]" /> Cake Specifications
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#FAF8F5]">
                    <span className="text-[10px] text-[#8A7968] block">Occasion</span>
                    <span className="font-bold text-[#2B1810]">{inspectInquiry.occasion}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#FAF8F5]">
                    <span className="text-[10px] text-[#8A7968] block">Weight</span>
                    <span className="font-bold text-[#2B1810]">{inspectInquiry.weight}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#FAF8F5]">
                    <span className="text-[10px] text-[#8A7968] block">Structure</span>
                    <span className="font-bold text-[#2B1810]">{inspectInquiry.tierCount}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#FAF8F5]">
                    <span className="text-[10px] text-[#8A7968] block">Dietary</span>
                    <span className="font-bold text-[#2B1810]">
                      {inspectInquiry.isEggless ? '100% Eggless' : 'Contains Egg'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 text-xs space-y-2">
                  <p>
                    <span className="text-[#8A7968] font-medium">Flavor Profile:</span>{' '}
                    <span className="font-semibold text-[#2B1810]">{inspectInquiry.flavor}</span>
                  </p>
                  {inspectInquiry.messageOnCake && (
                    <p className="bg-[#FAF3E0] p-2.5 rounded-xl text-[#8C6D28]">
                      <span className="font-semibold">Message on Cake:</span> "{inspectInquiry.messageOnCake}"
                    </p>
                  )}
                  {inspectInquiry.specialInstructions && (
                    <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#EADBCE]">
                      <span className="text-[11px] font-semibold text-[#8A7968] block mb-1">
                        Special Instructions / Dietary Directives:
                      </span>
                      <p className="text-xs text-[#2B1810] leading-relaxed">
                        {inspectInquiry.specialInstructions}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quotation Details (if Available) */}
              {inspectInquiry.quotedAmount && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-[#FAF3E0] to-[#F3E7CA] border border-[#D5C198] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#8C6D28] uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4" /> Bespoke Quotation Proposal
                    </span>
                    <span className="text-lg font-serif font-black text-[#2B1810]">
                      ₹{inspectInquiry.quotedAmount.toLocaleString('en-IN')} {inspectInquiry.quoteCurrency}
                    </span>
                  </div>
                  {inspectInquiry.quoteValidUntil && (
                    <p className="text-[11px] text-[#6B5E55]">
                      Valid until:{' '}
                      <span className="font-medium text-[#2B1810]">
                        {new Date(inspectInquiry.quoteValidUntil).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>{' '}
                      ({inspectInquiry.quoteValidityDays || 7} days proposal guarantee)
                    </p>
                  )}
                  {inspectInquiry.quoteNotes && (
                    <p className="text-xs text-[#4A3D34] bg-white/70 p-2.5 rounded-xl mt-1">
                      {inspectInquiry.quoteNotes}
                    </p>
                  )}
                </div>
              )}

              {/* Internal Bakery Notes */}
              {inspectInquiry.internalNotes && (
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs text-[#6B5E55]">
                  <span className="font-semibold text-stone-800 block mb-0.5">Chef / Internal Notes:</span>
                  <p>{inspectInquiry.internalNotes}</p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-6 border-t border-[#EADBCE] bg-[#FAF8F5] flex items-center justify-between">
              <button
                onClick={() => setInspectInquiry(null)}
                className="px-4 py-2 rounded-xl border border-[#D5C7B8] text-xs font-medium text-[#6B5E55] hover:bg-white"
              >
                Close Inspector
              </button>

              {(PERMITTED_TRANSITIONS[inspectInquiry.status] || []).length > 0 && (
                <button
                  onClick={() => {
                    const inq = inspectInquiry;
                    setInspectInquiry(null);
                    openActionModal(inq);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#2B1810] text-[#FFFDF9] hover:bg-[#3E2419] text-xs font-semibold flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5 text-[#DFBF77]" />
                  Update Status / Quotation
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* UPDATE STATUS & QUOTATION MODAL */}
      {actionInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#EADBCE] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-[#EADBCE] flex items-center justify-between bg-[#FAF8F5]">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#2B1810]">
                  Update Inquiry #{actionInquiry.referenceId}
                </h3>
                <p className="text-xs text-[#6B5E55]">
                  Client: {actionInquiry.customerName} • {actionInquiry.flavor}
                </p>
              </div>
              <button
                onClick={() => setActionInquiry(null)}
                className="p-1.5 rounded-lg text-[#8A7968] hover:bg-[#EADBCE]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStatusSubmit} className="p-6 space-y-4">
              {/* Target Status Selector */}
              <div>
                <label className="block text-xs font-semibold text-[#2B1810] mb-1.5">
                  Next Status State
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(PERMITTED_TRANSITIONS[actionInquiry.status] || []).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setTargetStatus(st)}
                      className={`p-2.5 rounded-xl border text-xs font-medium text-left capitalize transition-all ${
                        targetStatus === st
                          ? 'border-[#C5A059] bg-[#FAF3E0] text-[#2B1810] font-bold shadow-xs'
                          : 'border-[#EADBCE] bg-[#FAF8F5] text-[#6B5E55] hover:bg-white'
                      }`}
                    >
                      {STATUS_BADGE_CONFIG[st]?.label || st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quotation Specific Fields */}
              {targetStatus === 'quoted' && (
                <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EADBCE] space-y-3.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#8C6D28]">
                    <DollarSign className="w-4 h-4" /> Bespoke Price Quotation
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[#6B5E55] mb-1">
                        Quoted Amount (₹) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={quotedAmount}
                        onChange={(e) => setQuotedAmount(e.target.value)}
                        placeholder="e.g. 2800"
                        className="w-full px-3 py-2 rounded-xl border border-[#D5C7B8] text-xs font-bold text-[#2B1810] focus:outline-none focus:border-[#C5A059] bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-[#6B5E55] mb-1">
                        Validity Period
                      </label>
                      <select
                        value={quoteValidityDays}
                        onChange={(e) => setQuoteValidityDays(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-[#D5C7B8] text-xs font-medium text-[#2B1810] focus:outline-none focus:border-[#C5A059] bg-white"
                      >
                        <option value={7}>7 Days Guarantee</option>
                        <option value={14}>14 Days Guarantee</option>
                        <option value={30}>30 Days Guarantee</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#6B5E55] mb-1">
                      Chef Quotation Notes / Scope Description
                    </label>
                    <textarea
                      rows={2}
                      value={quoteNotes}
                      onChange={(e) => setQuoteNotes(e.target.value)}
                      placeholder="e.g., Includes edible gold leaf accents, premium acrylic box, and chilled delivery..."
                      className="w-full px-3 py-2 rounded-xl border border-[#D5C7B8] text-xs text-[#2B1810] placeholder:text-[#9A8D83] focus:outline-none focus:border-[#C5A059] bg-white resize-none"
                    />
                  </div>

                  <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-2 text-[11px] text-amber-800">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      A quotation is an official custom price proposal. It does not automatically create or confirm an order.
                    </span>
                  </div>
                </div>
              )}

              {/* Internal / Administrative Notes */}
              <div>
                <label className="block text-xs font-semibold text-[#2B1810] mb-1">
                  Internal / Kitchen Audit Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Notes for kitchen staff or reasoning for transition..."
                  className="w-full px-3 py-2 rounded-xl border border-[#D5C7B8] text-xs text-[#2B1810] placeholder:text-[#9A8D83] focus:outline-none focus:border-[#C5A059] bg-[#FAF8F5] resize-none"
                />
              </div>

              {/* Confirmation Notice */}
              <div className="text-[11px] text-[#8A7968] bg-[#FAF8F5] p-3 rounded-xl border border-[#EADBCE]">
                Customer-submitted requirements (flavor, weight, tier structure, message) will be securely preserved.
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setActionInquiry(null)}
                  disabled={submittingAction}
                  className="px-4 py-2 rounded-xl border border-[#D5C7B8] text-xs font-medium text-[#6B5E55] hover:bg-[#FAF8F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-5 py-2 rounded-xl bg-[#2B1810] hover:bg-[#3E2419] text-xs font-bold text-[#FFFDF9] flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                >
                  {submittingAction && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Transition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULLSIZE IMAGE PREVIEW MODAL */}
      {selectedImagePreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedImagePreview(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img
              src={selectedImagePreview}
              alt="Full Preview"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
            <button
              onClick={() => setSelectedImagePreview(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-[#2B1810] flex items-center justify-center shadow-lg font-bold"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
