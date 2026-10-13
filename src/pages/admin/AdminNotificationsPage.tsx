import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Search,
  RefreshCw,
  Mail,
  MessageSquare,
  Smartphone,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  Eye,
  ShieldCheck,
  Copy,
  Check,
  X,
} from 'lucide-react';
import { adminService, type AdminNotificationLog } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

type ChannelFilter = 'all' | 'email' | 'whatsapp' | 'sms';
type EventFilter = 'all' | 'order_placed' | 'order_status_updated' | 'inquiry_quotation_sent';
type StatusFilter = 'all' | 'pending' | 'sending' | 'delivered' | 'failed' | 'skipped';

export const AdminNotificationsPage: React.FC = () => {
  const { showToast } = useToast();

  const [logs, setLogs] = useState<AdminNotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search states
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Inspect detail modal
  const [selectedLog, setSelectedLog] = useState<AdminNotificationLog | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const handleRetry = async (log: AdminNotificationLog) => {
    const id = log.notificationId || log.id;
    try {
      setRetryingId(id);
      const res = await adminService.retryNotification(id);
      if (res.success) {
        showToast('Notification retried successfully!', 'success');
        if (selectedLog && (selectedLog.notificationId === id || selectedLog.id === id)) {
          setSelectedLog(res.data || null);
        }
        await fetchLogs();
      } else {
        showToast(res.message || 'Retry attempt failed', 'warning');
      }
    } catch (err: any) {
      showToast(err?.message || 'Network error during retry attempt', 'warning');
    } finally {
      setRetryingId(null);
    }
  };

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminService.getNotifications({
        page: currentPage,
        limit: 15,
        channel: channelFilter,
        eventType: eventFilter,
        deliveryStatus: statusFilter,
        search: searchQuery.trim() || undefined,
      });

      if (res.success) {
        setLogs(res.data);
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages || 1);
          setTotalCount(res.pagination.total || 0);
        }
      } else {
        setError('Failed to retrieve notification audit records.');
      }
    } catch (err: any) {
      console.error('Failed to load notifications audit logs:', err);
      setError(err?.message || 'Network error while fetching notification logs.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, channelFilter, eventFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Handle Search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchLogs();
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Copied to clipboard', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  /**
   * Safely masks email or phone numbers to prevent accidental shoulder surfing
   */
  const maskRecipient = (recipient: string, channel: string): string => {
    if (!recipient) return 'N/A';
    if (channel === 'email' && recipient.includes('@')) {
      const [name, domain] = recipient.split('@');
      if (name.length <= 2) return `${name}***@${domain}`;
      return `${name[0]}***${name[name.length - 1]}@${domain}`;
    }
    if (channel === 'whatsapp' || channel === 'sms') {
      const clean = recipient.replace(/\D/g, '');
      if (clean.length >= 10) {
        const first = clean.substring(0, 3);
        const last = clean.substring(clean.length - 2);
        return `+${first} **** ${last}`;
      }
    }
    return recipient.length > 8 ? `${recipient.substring(0, 4)}****` : recipient;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Delivered
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Failed
          </span>
        );
      case 'sending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-800 border border-sky-200">
            <RefreshCw className="w-3.5 h-3.5 text-sky-600 animate-spin" />
            Sending
          </span>
        );
      case 'skipped':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-700 border border-stone-200">
            <Info className="w-3.5 h-3.5 text-stone-500" />
            Skipped
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Pending
          </span>
        );
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="w-4 h-4 text-blue-600" />;
      case 'whatsapp':
        return <MessageSquare className="w-4 h-4 text-emerald-600" />;
      case 'sms':
        return <Smartphone className="w-4 h-4 text-purple-600" />;
      default:
        return <Bell className="w-4 h-4 text-stone-600" />;
    }
  };

  const getEventName = (eventType: string) => {
    switch (eventType) {
      case 'order_placed':
        return 'Order Placed Receipt';
      case 'order_status_updated':
        return 'Order Status Update';
      case 'inquiry_quotation_sent':
        return 'Quotation Proposal';
      default:
        return eventType.replace(/_/g, ' ');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E8DFD5]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2B1810]">
              Notifications Audit
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F5EBE1] text-[#8C6239] border border-[#DFBF77]/50">
              <ShieldCheck className="w-3.5 h-3.5 text-[#C5A059]" />
              Safe Mock Sandbox
            </span>
          </div>
          <p className="text-sm text-[#735A4D] mt-1">
            Real-time audit log of customer messaging dispatches, delivery statuses, idempotency keys, and bounded retries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLogs()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium bg-[#FFFDF9] text-[#2B1810] border border-[#E8DFD5] hover:bg-[#F8F4EE] transition-colors shadow-sm disabled:opacity-60"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 text-[#8C6239] ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#FFFDF9] border border-[#E8DFD5] rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search box */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8988C]" />
            <input
              type="text"
              placeholder="Search by recipient, order ID, or notification ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl text-sm bg-[#F8F4EE] border border-[#E8DFD5] text-[#2B1810] placeholder-[#A8988C] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40 focus:border-[#C5A059]"
            />
          </form>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Channel filter */}
            <select
              value={channelFilter}
              onChange={(e) => {
                setChannelFilter(e.target.value as ChannelFilter);
                setCurrentPage(1);
              }}
              className="px-3 py-2 rounded-xl text-xs sm:text-sm font-medium bg-[#F8F4EE] border border-[#E8DFD5] text-[#2B1810] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40"
            >
              <option value="all">All Channels</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
            </select>

            {/* Event filter */}
            <select
              value={eventFilter}
              onChange={(e) => {
                setEventFilter(e.target.value as EventFilter);
                setCurrentPage(1);
              }}
              className="px-3 py-2 rounded-xl text-xs sm:text-sm font-medium bg-[#F8F4EE] border border-[#E8DFD5] text-[#2B1810] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40"
            >
              <option value="all">All Events</option>
              <option value="order_placed">Order Placed</option>
              <option value="order_status_updated">Order Status Update</option>
              <option value="inquiry_quotation_sent">Quotation Proposal</option>
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setCurrentPage(1);
              }}
              className="px-3 py-2 rounded-xl text-xs sm:text-sm font-medium bg-[#F8F4EE] border border-[#E8DFD5] text-[#2B1810] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40"
            >
              <option value="all">All Statuses</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
              <option value="sending">Sending</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Counter Info */}
        <div className="text-xs text-[#8C6239] flex items-center justify-between pt-1 border-t border-[#F5EBE1]">
          <span>
            Showing <strong>{logs.length}</strong> of <strong>{totalCount}</strong> recorded logs
          </span>
          <span>Idempotency-protected & sanitized audit records</span>
        </div>
      </div>

      {/* Main Table / State Views */}
      {loading ? (
        <div className="bg-[#FFFDF9] border border-[#E8DFD5] rounded-2xl p-12 text-center space-y-3 shadow-sm">
          <RefreshCw className="w-8 h-8 text-[#C5A059] animate-spin mx-auto" />
          <p className="text-sm font-medium text-[#735A4D]">Loading audit logs...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <p className="text-base font-semibold text-rose-900">{error}</p>
          <button
            onClick={() => fetchLogs()}
            className="px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-medium hover:bg-rose-700 transition"
          >
            Retry
          </button>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-[#FFFDF9] border border-[#E8DFD5] rounded-2xl p-12 text-center space-y-3 shadow-sm">
          <Bell className="w-10 h-10 text-[#C5A059]/60 mx-auto" />
          <h3 className="text-base font-serif font-bold text-[#2B1810]">No notification logs found</h3>
          <p className="text-sm text-[#735A4D] max-w-md mx-auto">
            {searchQuery || channelFilter !== 'all' || eventFilter !== 'all' || statusFilter !== 'all'
              ? 'No records match your active search or filter criteria. Try clearing filters.'
              : 'Notifications triggered by new orders, fulfillment updates, or bespoke cake quotations will be recorded here.'}
          </p>
        </div>
      ) : (
        <div className="bg-[#FFFDF9] border border-[#E8DFD5] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F8F4EE] border-b border-[#E8DFD5] text-xs font-serif font-bold text-[#2B1810] uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Event & ID</th>
                  <th className="py-3.5 px-4">Channel</th>
                  <th className="py-3.5 px-4">Recipient</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Attempts</th>
                  <th className="py-3.5 px-4">Dispatched At</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DFD5]/60">
                {logs.map((log) => (
                  <tr key={log.id || log.notificationId} className="hover:bg-[#FDFBF7] transition-colors">
                    {/* Event & ID */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-[#2B1810]">{getEventName(log.eventType)}</div>
                      <div className="text-xs text-[#A8988C] font-mono mt-0.5">{log.notificationId}</div>
                    </td>

                    {/* Channel */}
                    <td className="py-3 px-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#F8F4EE] border border-[#E8DFD5]">
                        {getChannelIcon(log.channel)}
                        <span className="capitalize text-[#2B1810]">{log.channel}</span>
                      </div>
                    </td>

                    {/* Recipient */}
                    <td className="py-3 px-4 font-mono text-xs text-[#2B1810]">
                      {maskRecipient(log.recipient, log.channel)}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">{getStatusBadge(log.deliveryStatus)}</td>

                    {/* Attempts */}
                    <td className="py-3 px-4 text-xs text-[#735A4D]">
                      <span className="font-semibold text-[#2B1810]">{log.attempts}</span> / {log.maxAttempts || 3}
                    </td>

                    {/* Dispatched At */}
                    <td className="py-3 px-4 text-xs text-[#735A4D]">
                      {new Date(log.sentAt || log.createdAt || log.queuedAt || Date.now()).toLocaleString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {log.deliveryStatus === 'failed' && (
                          <button
                            onClick={() => handleRetry(log)}
                            disabled={retryingId === (log.id || log.notificationId)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50 cursor-pointer"
                            title="Retry failed notification dispatch"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${retryingId === (log.id || log.notificationId) ? 'animate-spin' : ''}`} />
                            Retry
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#8C6239] bg-[#F8F4EE] hover:bg-[#F5EBE1] border border-[#E8DFD5] transition-colors"
                          title="View audit details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 bg-[#F8F4EE] border-t border-[#E8DFD5] flex items-center justify-between">
              <span className="text-xs text-[#8C6239]">
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({totalCount} total)
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || loading}
                  className="p-1.5 rounded-lg border border-[#E8DFD5] bg-[#FFFDF9] text-[#2B1810] hover:bg-[#F5EBE1] disabled:opacity-40 transition"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || loading}
                  className="p-1.5 rounded-lg border border-[#E8DFD5] bg-[#FFFDF9] text-[#2B1810] hover:bg-[#F5EBE1] disabled:opacity-40 transition"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inspect Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#FFFDF9] border border-[#E8DFD5] rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#E8DFD5]">
              <div>
                <span className="text-xs font-semibold text-[#8C6239] uppercase tracking-wider">
                  Audit Inspection Detail
                </span>
                <h3 className="text-xl font-serif font-bold text-[#2B1810] mt-0.5">
                  {getEventName(selectedLog.eventType)}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-xl hover:bg-[#F8F4EE] text-[#735A4D] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grid Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-[#F8F4EE] p-3 rounded-xl space-y-1">
                <span className="text-[#8C6239] block font-medium">Notification ID</span>
                <div className="flex items-center justify-between font-mono font-bold text-[#2B1810]">
                  <span>{selectedLog.notificationId}</span>
                  <button
                    onClick={() => copyToClipboard(selectedLog.notificationId, 'notifId')}
                    className="p-1 hover:text-[#C5A059]"
                    title="Copy ID"
                  >
                    {copiedId === 'notifId' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="bg-[#F8F4EE] p-3 rounded-xl space-y-1">
                <span className="text-[#8C6239] block font-medium">Idempotency Key</span>
                <div className="flex items-center justify-between font-mono text-[#2B1810] truncate">
                  <span className="truncate" title={selectedLog.idempotencyKey}>
                    {selectedLog.idempotencyKey}
                  </span>
                  <button
                    onClick={() => copyToClipboard(selectedLog.idempotencyKey, 'idemKey')}
                    className="p-1 hover:text-[#C5A059]"
                    title="Copy Key"
                  >
                    {copiedId === 'idemKey' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="bg-[#F8F4EE] p-3 rounded-xl space-y-1">
                <span className="text-[#8C6239] block font-medium">Channel & Provider</span>
                <div className="flex items-center gap-2 text-[#2B1810] font-semibold">
                  {getChannelIcon(selectedLog.channel)}
                  <span className="capitalize">{selectedLog.channel}</span>
                  <span className="text-stone-400">•</span>
                  <span className="font-mono text-xs">{selectedLog.provider || 'mock'}</span>
                </div>
              </div>

              <div className="bg-[#F8F4EE] p-3 rounded-xl space-y-1">
                <span className="text-[#8C6239] block font-medium">Delivery Status</span>
                <div>{getStatusBadge(selectedLog.deliveryStatus)}</div>
              </div>
            </div>

            {/* Recipient and Subject */}
            <div className="space-y-3 text-xs bg-[#F8F4EE] p-4 rounded-xl">
              <div>
                <span className="text-[#8C6239] font-medium block">Masked Recipient Target</span>
                <span className="font-mono font-semibold text-sm text-[#2B1810]">
                  {maskRecipient(selectedLog.recipient, selectedLog.channel)}
                </span>
              </div>

              {selectedLog.subject && (
                <div>
                  <span className="text-[#8C6239] font-medium block">Subject Header</span>
                  <span className="font-medium text-[#2B1810]">{selectedLog.subject}</span>
                </div>
              )}
            </div>

            {/* Message Preview */}
            {selectedLog.messagePreview && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-[#8C6239] uppercase tracking-wider">
                  Dispatched Message Preview
                </span>
                <div className="p-3 bg-[#F8F4EE] rounded-xl text-xs font-mono text-[#2B1810] whitespace-pre-wrap max-h-48 overflow-y-auto border border-[#E8DFD5]">
                  {selectedLog.messagePreview}
                </div>
              </div>
            )}

            {/* Sanitized Error Details (If any) */}
            {selectedLog.sanitizedError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Sanitized Error Audit Trace
                </div>
                <p className="font-mono text-rose-900 break-words">{selectedLog.sanitizedError}</p>
                <p className="text-[11px] text-rose-700 italic">
                  Note: All sensitive secrets, credentials, and tokens were scrubbed before recording.
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="pt-2 border-t border-[#E8DFD5] flex items-center justify-between">
              <div>
                {selectedLog.deliveryStatus === 'failed' && (
                  <button
                    onClick={() => handleRetry(selectedLog)}
                    disabled={retryingId === (selectedLog.notificationId || selectedLog.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${retryingId === (selectedLog.notificationId || selectedLog.id) ? 'animate-spin' : ''}`} />
                    Retry Dispatch Now
                  </button>
                )}
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#2B1810] text-white hover:bg-[#3D2318] transition cursor-pointer"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
