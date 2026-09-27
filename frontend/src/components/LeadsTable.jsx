import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  MessageSquare,
  CheckCheck,
  RefreshCw,
} from 'lucide-react';
import { LeadsAPI } from '../api';
import { useSocket } from '../context/SocketContext';

export default function LeadsTable({ campaigns, activeCampaignId, refreshTrigger }) {
  const { lastEvent } = useSocket();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedLead, setSelectedLead] = useState(null);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const data = await LeadsAPI.getAll({
        page,
        limit: 25,
        search,
        status: statusFilter,
        campaignId: activeCampaignId || undefined,
      });
      setLeads(data.leads || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (e) {
      console.error('Failed to load leads:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [page, statusFilter, activeCampaignId, refreshTrigger]);

  // Refresh when real-time socket events affect leads
  useEffect(() => {
    if (lastEvent) {
      fetchLeads();
    }
  }, [lastEvent]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLeads();
  };

  const handleToggleBlacklist = async (lead) => {
    try {
      await LeadsAPI.toggleBlacklist(lead._id, 'Operator manual toggle');
      fetchLeads();
    } catch (e) {
      alert('Failed to update blacklist: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleDeleteLead = async (id) => {
    if (!window.confirm('Delete this lead record permanently?')) return;
    try {
      await LeadsAPI.delete(id);
      fetchLeads();
    } catch (e) {
      alert('Failed to delete lead: ' + (e.response?.data?.error || e.message));
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <CheckCircle className="w-3 h-3" /> Sent
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCheck className="w-3 h-3" /> Delivered
          </span>
        );
      case 'read':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <CheckCheck className="w-3 h-3 text-cyan-400" /> Read
          </span>
        );
      case 'replied':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30">
            <MessageSquare className="w-3 h-3" /> Replied
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
            <Clock className="w-3 h-3 animate-spin" /> Queued
          </span>
        );
      case 'blacklisted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30 font-semibold">
            <ShieldAlert className="w-3 h-3" /> Blacklisted
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20">
            <AlertTriangle className="w-3 h-3" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-wa-card text-wa-muted border border-wa-border">
            Pending
          </span>
        );
    }
  };

  return (
    <div className="glass-card rounded-2xl border border-wa-border p-6 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-wa-border/80">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" /> Leads Directory & Status Pipeline
          </h2>
          <p className="text-xs text-wa-muted">
            Total {total} contacts managed • Anti-ban blacklist protection enforced
          </p>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="Search phone, name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-wa-card border border-wa-border rounded-lg text-xs text-white focus:outline-none focus:border-wa-accent w-44 sm:w-56"
            />
            <Search className="w-3.5 h-3.5 text-wa-muted absolute left-2.5 top-2.5" />
          </form>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-wa-card border border-wa-border rounded-lg text-xs text-white focus:outline-none focus:border-wa-accent"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="queued">Queued</option>
            <option value="sent">Sent</option>
            <option value="delivered">Delivered</option>
            <option value="replied">Replied</option>
            <option value="blacklisted">Blacklisted</option>
            <option value="failed">Failed</option>
          </select>

          <button
            onClick={fetchLeads}
            disabled={loading}
            title="Refresh Leads Table"
            className="p-1.5 bg-wa-card hover:bg-wa-incoming border border-wa-border rounded-lg text-wa-light transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-wa-accent' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-wa-border/80">
        <table className="w-full text-left text-xs">
          <thead className="bg-wa-panel/90 text-wa-muted uppercase tracking-wider font-semibold border-b border-wa-border">
            <tr>
              <th className="px-4 py-3">Phone Number</th>
              <th className="px-4 py-3">Lead Name</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Dispatched At</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-wa-border/50 bg-wa-dark/30">
            {loading && leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-wa-muted">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-wa-accent" />
                  Loading leads pipeline...
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-wa-muted">
                  No leads found. Use the CSV Importer above to load contacts.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead._id} className="hover:bg-wa-panel/50 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-white flex items-center gap-2">
                    <span>+{lead.phone}</span>
                    {lead.status === 'blacklisted' && (
                      <span title="Opted out / Blacklisted">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-wa-light font-medium">
                    {lead.name || <span className="text-wa-muted/60">—</span>}
                  </td>
                  <td className="px-4 py-3 text-wa-muted">
                    {lead.company || <span className="text-wa-muted/60">—</span>}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(lead.status)}</td>
                  <td className="px-4 py-3 text-wa-muted font-mono text-[11px]">
                    {lead.lastMessageSentAt
                      ? new Date(lead.lastMessageSentAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* View Sent / Error Modal Button */}
                      {(lead.sentContent || lead.errorMessage) && (
                        <button
                          onClick={() => setSelectedLead(lead)}
                          title="View Message Preview"
                          className="p-1 rounded text-wa-muted hover:text-cyan-400 hover:bg-wa-card transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Blacklist toggle button */}
                      <button
                        onClick={() => handleToggleBlacklist(lead)}
                        title={
                          lead.status === 'blacklisted'
                            ? 'Remove from Blacklist'
                            : 'Blacklist Phone (Anti-Ban Opt-out)'
                        }
                        className={`p-1 rounded transition-colors ${
                          lead.status === 'blacklisted'
                            ? 'text-rose-400 hover:text-emerald-400'
                            : 'text-wa-muted hover:text-rose-400'
                        }`}
                      >
                        {lead.status === 'blacklisted' ? (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        ) : (
                          <ShieldAlert className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Delete Lead Button */}
                      <button
                        onClick={() => handleDeleteLead(lead._id)}
                        title="Delete Lead"
                        className="p-1 rounded text-wa-muted hover:text-rose-400 hover:bg-wa-card transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 text-xs text-wa-muted">
          <span>
            Page {page} of {totalPages} ({total} items)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 rounded bg-wa-card hover:bg-wa-incoming border border-wa-border disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1 rounded bg-wa-card hover:bg-wa-incoming border border-wa-border disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Lead Message Preview Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-wa-border p-6 shadow-2xl relative">
            <h3 className="text-sm font-bold text-white mb-1">
              Lead Dispatch Details: +{selectedLead.phone}
            </h3>
            <p className="text-xs text-wa-muted mb-4">
              Status: <span className="font-semibold text-wa-light uppercase">{selectedLead.status}</span>
            </p>

            {selectedLead.sentContent && (
              <div className="mb-4">
                <label className="text-[11px] font-semibold text-wa-muted uppercase block mb-1">
                  Spun & Dispatched Content
                </label>
                <div className="p-3 bg-wa-card border border-wa-border rounded-xl text-xs text-wa-light font-sans whitespace-pre-wrap leading-relaxed">
                  {selectedLead.sentContent}
                </div>
              </div>
            )}

            {selectedLead.errorMessage && (
              <div className="mb-4">
                <label className="text-[11px] font-semibold text-rose-400 uppercase block mb-1">
                  Error Details
                </label>
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                  {selectedLead.errorMessage}
                </div>
              </div>
            )}

            {selectedLead.blacklistReason && (
              <div className="mb-4">
                <label className="text-[11px] font-semibold text-rose-400 uppercase block mb-1">
                  Blacklist Trigger Reason
                </label>
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                  {selectedLead.blacklistReason}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-wa-card hover:bg-wa-incoming border border-wa-border text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
