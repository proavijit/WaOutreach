import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  PlusCircle,
  RefreshCw,
  LogOut,
  Trash2,
  CheckCircle2,
  QrCode,
  AlertTriangle,
  Zap,
  Sliders,
  X,
  Shield,
  Layers,
  Flame,
  Activity,
  Play,
  HeartPulse,
  Award,
} from 'lucide-react';
import { AccountsAPI, WarmupAPI } from '../api';
import { useSocket } from '../context/SocketContext';

export default function AccountManager({ onAccountsUpdated }) {
  const { accountsRefreshTrigger } = useSocket();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newDailyLimit, setNewDailyLimit] = useState(20);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeQrModal, setActiveQrModal] = useState(null);
  const [editingAccount, setEditingAccount] = useState(null);

  // Warmup Engine States
  const [warmupStatus, setWarmupStatus] = useState(null);
  const [isTriggeringWarmup, setIsTriggeringWarmup] = useState(false);
  const [warmupFeedback, setWarmupFeedback] = useState(null);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const data = await AccountsAPI.getAll();
      setAccounts(data || []);
      if (onAccountsUpdated) onAccountsUpdated(data);
    } catch (e) {
      console.error('Failed to load accounts:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchWarmupStatus = async () => {
    try {
      const data = await WarmupAPI.getStatus();
      setWarmupStatus(data);
    } catch (e) {
      console.error('Failed to load warmup status:', e);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchWarmupStatus();
  }, [accountsRefreshTrigger]);

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await AccountsAPI.create({
        label: newLabel.trim() || `WhatsApp Account ${accounts.length + 1}`,
        dailyLimit: Number(newDailyLimit) || 20,
      });
      setShowAddModal(false);
      setNewLabel('');
      setNewDailyLimit(20);
      fetchAccounts();

      if (res.sessionId) {
        setTimeout(() => {
          fetchAccounts();
        }, 1500);
      }
    } catch (err) {
      alert('Error creating account: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReconnect = async (sessionId) => {
    try {
      await AccountsAPI.reconnect(sessionId);
      fetchAccounts();
    } catch (err) {
      alert('Error reconnecting: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDisconnect = async (sessionId) => {
    if (!window.confirm(`Unlink and logout session ${sessionId}?`)) return;
    try {
      await AccountsAPI.disconnect(sessionId);
      fetchAccounts();
    } catch (err) {
      alert('Error disconnecting: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDelete = async (sessionId) => {
    if (!window.confirm(`Permanently delete account ${sessionId}? This will purge authentication files.`)) return;
    try {
      await AccountsAPI.delete(sessionId);
      fetchAccounts();
    } catch (err) {
      alert('Error deleting account: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleUpdateAccount = async (e) => {
    e.preventDefault();
    if (!editingAccount) return;
    try {
      await AccountsAPI.update(editingAccount.sessionId, {
        label: editingAccount.label,
        dailyLimit: editingAccount.dailyLimit,
      });
      setEditingAccount(null);
      fetchAccounts();
    } catch (err) {
      alert('Error updating account: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleToggleWarmupScheduler = async () => {
    try {
      const res = await WarmupAPI.toggle(!warmupStatus?.isEnabled);
      setWarmupStatus(res.data);
    } catch (err) {
      alert('Error toggling warmup: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleTriggerManualWarmup = async () => {
    setIsTriggeringWarmup(true);
    setWarmupFeedback(null);
    try {
      const res = await WarmupAPI.trigger({ fastMode: true });
      setWarmupFeedback({
        success: true,
        message: res.message || 'P2P Warm-up dialogue successfully initiated!',
      });
      fetchAccounts();
      fetchWarmupStatus();
    } catch (err) {
      setWarmupFeedback({
        success: false,
        message: err.response?.data?.error || err.message,
      });
    } finally {
      setIsTriggeringWarmup(false);
      setTimeout(() => setWarmupFeedback(null), 7000);
    }
  };

  const getStatusBadge = (acc) => {
    switch (acc.status) {
      case 'CONNECTED':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            CONNECTED
          </span>
        );
      case 'QR_READY':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 animate-pulse">
            <QrCode className="w-3 h-3" />
            SCAN QR
          </span>
        );
      case 'CONNECTING':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <RefreshCw className="w-3 h-3 animate-spin" />
            CONNECTING
          </span>
        );
      case 'BANNED':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/40">
            <AlertTriangle className="w-3 h-3" />
            SUSPENDED
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-wa-card text-wa-muted border border-wa-border">
            DISCONNECTED
          </span>
        );
    }
  };

  const getHealthScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (score >= 50) return 'text-amber-300 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  const totalConnected = accounts.filter((a) => a.status === 'CONNECTED').length;
  const totalCapacity = accounts
    .filter((a) => a.status === 'CONNECTED')
    .reduce((sum, a) => sum + (a.dailyLimit || 20), 0);
  const totalDispatchedToday = accounts.reduce((sum, a) => sum + (a.sentToday || 0), 0);

  return (
    <div className="space-y-6">
      {/* Cluster Overview Banner */}
      <div className="glass-card rounded-2xl border border-wa-border p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-wa-accent to-emerald-600 flex items-center justify-center text-black shadow-glow-accent">
              <Layers className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Multi-Account Distributed Dispatcher
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {totalConnected} of {accounts.length} Active
                </span>
              </h2>
              <p className="text-xs text-wa-muted">
                Anti-ban round-robin load balancer dynamically splits workload across up to 10 isolated Baileys sockets
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-3.5 py-1.5 rounded-xl bg-wa-panel border border-wa-border text-xs">
              <span className="text-wa-muted">Cluster Daily Limit: </span>
              <span className="font-bold text-emerald-400 font-mono">{totalCapacity} msgs/24h</span>
            </div>
            <div className="px-3.5 py-1.5 rounded-xl bg-wa-panel border border-wa-border text-xs">
              <span className="text-wa-muted">Cluster Sent Today: </span>
              <span className="font-bold text-cyan-400 font-mono">{totalDispatchedToday} msgs</span>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              disabled={accounts.length >= 10}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-wa-accent hover:bg-wa-accentHover text-black transition-all shadow-glow-accent disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add WhatsApp Account</span>
            </button>
          </div>
        </div>
      </div>

      {/* Peer-to-Peer WhatsApp Warm-up Engine Strip */}
      <div className="rounded-2xl p-5 bg-gradient-to-r from-amber-950/40 via-wa-card to-emerald-950/40 border border-amber-500/30 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Peer-to-Peer Warm-up Engine
                </h3>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${
                    warmupStatus?.isEnabled
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-wa-card text-wa-muted border-wa-border'
                  }`}
                >
                  {warmupStatus?.isEnabled ? 'Auto Scheduled (9 AM - 9 PM)' : 'Paused'}
                </span>
              </div>
              <p className="text-xs text-wa-muted mt-0.5">
                Simulates natural typing & two-way dialogues between internal accounts every 15–30 mins to build Meta sender trust
              </p>
            </div>
          </div>

          {/* Warmup Controls */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleToggleWarmupScheduler}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-wa-card hover:bg-wa-incoming border border-wa-border text-wa-light transition-colors"
            >
              {warmupStatus?.isEnabled ? 'Pause Auto Warmup' : 'Enable Auto Warmup'}
            </button>

            <button
              onClick={handleTriggerManualWarmup}
              disabled={isTriggeringWarmup || totalConnected < 2}
              title={
                totalConnected < 2
                  ? 'Connect at least 2 accounts to run peer-to-peer warmup'
                  : 'Execute an instant P2P warmup dialogue'
              }
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black transition-all shadow-glow-amber disabled:opacity-50"
            >
              {isTriggeringWarmup ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Simulating Dialogue...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Trigger P2P Warm-up Now</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feedback alert */}
        {warmupFeedback && (
          <div
            className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
              warmupFeedback.success
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
            }`}
          >
            {warmupFeedback.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            )}
            <span>{warmupFeedback.message}</span>
          </div>
        )}
      </div>

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {accounts.map((acc) => {
          const quotaPercent = Math.min(100, Math.round(((acc.sentToday || 0) / (acc.dailyLimit || 20)) * 100));
          const health = acc.healthScore || 65;
          const warmupDays = acc.warmupDays || 1;
          const isMature = warmupDays >= 7;

          return (
            <div
              key={acc.sessionId}
              className={`glass-card rounded-2xl border p-5 transition-all shadow-lg relative flex flex-col justify-between ${
                acc.status === 'CONNECTED'
                  ? 'border-emerald-500/30 hover:border-emerald-500/60'
                  : acc.status === 'QR_READY'
                  ? 'border-amber-500/40 hover:border-amber-500/70'
                  : 'border-wa-border hover:border-wa-border/80'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-xl ${
                        acc.status === 'CONNECTED'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-wa-card text-wa-muted'
                      }`}
                    >
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                        {acc.label}
                      </h3>
                      <div className="text-[11px] font-mono text-wa-muted">
                        ID: {acc.sessionId}
                      </div>
                    </div>
                  </div>

                  <div>{getStatusBadge(acc)}</div>
                </div>

                {/* Account Health & Warmup Status Badge */}
                <div className="p-3 rounded-xl bg-wa-panel border border-wa-border space-y-2 mb-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-wa-light font-medium">
                      <HeartPulse className="w-3.5 h-3.5 text-rose-400" /> Account Health
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${getHealthScoreColor(health)}`}>
                      {health}% Score
                    </span>
                  </div>

                  {/* Health Bar */}
                  <div className="w-full bg-wa-card rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        health >= 80 ? 'bg-emerald-400' : health >= 50 ? 'bg-amber-400' : 'bg-rose-500'
                      }`}
                      style={{ width: `${health}%` }}
                    />
                  </div>

                  {/* Warmup Stage Indicator */}
                  <div className="pt-1 flex items-center justify-between text-[11px]">
                    <span
                      className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded ${
                        isMature
                          ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                          : 'text-amber-300 bg-amber-500/10 border border-amber-500/20'
                      }`}
                    >
                      {isMature ? (
                        <>
                          <Award className="w-3 h-3 text-emerald-400" /> Mature Account (Day {warmupDays})
                        </>
                      ) : (
                        <>
                          <Flame className="w-3 h-3 text-amber-400" /> Warming Up: Day {warmupDays}/7
                        </>
                      )}
                    </span>

                    <span className="text-wa-muted font-mono">
                      {acc.warmupMessagesCount || 0} P2P msgs
                    </span>
                  </div>

                  {/* Tier unlock message */}
                  <p className="text-[10px] text-wa-muted/90 leading-tight">
                    {isMature
                      ? 'Tier 2 Unlocked: High-volume cold outreach active (Up to 100 msgs/day).'
                      : `Tier 1: Safe 20 msgs/day cap. ${7 - warmupDays} day(s) until Tier 2 high-volume unlock.`}
                  </p>
                </div>

                {/* Account Details */}
                <div className="space-y-2 my-4 text-xs">
                  <div className="flex items-center justify-between text-wa-muted">
                    <span>Phone:</span>
                    <span className="font-mono text-white font-medium">
                      {acc.phone ? `+${acc.phone}` : 'Unpaired'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-wa-muted">
                    <span>Daily Quota:</span>
                    <span className="font-mono text-wa-light">
                      <strong className="text-white">{acc.sentToday || 0}</strong> / {acc.dailyLimit || 20} msgs
                    </span>
                  </div>

                  {/* Quota Progress Bar */}
                  <div className="w-full bg-wa-card rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        quotaPercent >= 100
                          ? 'bg-rose-500'
                          : quotaPercent > 70
                          ? 'bg-amber-400'
                          : 'bg-wa-accent'
                      }`}
                      style={{ width: `${quotaPercent}%` }}
                    />
                  </div>
                </div>

                {/* Inline QR View if QR is Ready */}
                {acc.status === 'QR_READY' && acc.qrCodeDataUrl && (
                  <div className="p-3 bg-wa-panel rounded-xl border border-amber-500/30 text-center space-y-2 my-3">
                    <div className="inline-block p-1.5 bg-white rounded-lg">
                      <img
                        src={acc.qrCodeDataUrl}
                        alt={`QR for ${acc.sessionId}`}
                        className="w-36 h-36 mx-auto rounded"
                      />
                    </div>
                    <div className="text-[11px] text-amber-300 font-medium">
                      Scan with WhatsApp &gt; Linked Devices
                    </div>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-wa-border/60 flex items-center justify-between gap-1 text-xs">
                <button
                  onClick={() => setEditingAccount({ ...acc })}
                  title="Configure daily quota"
                  className="px-2.5 py-1 rounded-lg bg-wa-card hover:bg-wa-incoming border border-wa-border text-wa-muted hover:text-white transition-colors flex items-center gap-1"
                >
                  <Sliders className="w-3 h-3" />
                  <span>Limit: {acc.dailyLimit}</span>
                </button>

                <div className="flex items-center gap-1.5">
                  {acc.status === 'QR_READY' && acc.qrCodeDataUrl && (
                    <button
                      onClick={() => setActiveQrModal(acc)}
                      title="Enlarge QR Code"
                      className="p-1.5 rounded-lg bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 transition-colors"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => handleReconnect(acc.sessionId)}
                    title="Reconnect session"
                    className="p-1.5 rounded-lg bg-wa-card hover:bg-wa-incoming border border-wa-border text-wa-light hover:text-wa-accent transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>

                  {acc.status === 'CONNECTED' && (
                    <button
                      onClick={() => handleDisconnect(acc.sessionId)}
                      title="Logout WhatsApp session"
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(acc.sessionId)}
                    title="Delete Account"
                    className="p-1.5 rounded-lg bg-wa-card hover:bg-rose-500/10 border border-wa-border text-wa-muted hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-wa-border p-6 shadow-2xl relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 p-1.5 rounded-lg bg-wa-card text-wa-muted hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
              <PlusCircle className="w-5 h-5 text-wa-accent" /> Add WhatsApp Account
            </h3>
            <p className="text-xs text-wa-muted mb-4">
              Spawn an isolated Baileys socket. A QR code will be generated immediately to link your phone.
            </p>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-wa-light mb-1">
                  Account Label / Nickname
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sales SIM 2 (UK) or Outreach #3"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-wa-card border border-wa-border rounded-lg text-sm text-white focus:outline-none focus:border-wa-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-wa-light mb-1">
                  Daily Safe Dispatch Limit (Anti-Ban Guardrail)
                </label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={newDailyLimit}
                  onChange={(e) => setNewDailyLimit(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-wa-card border border-wa-border rounded-lg text-sm text-white font-mono focus:outline-none focus:border-wa-accent"
                />
                <p className="text-[11px] text-wa-muted mt-1">
                  Recommended: 20–30 messages per account/day for maximum sender longevity.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-wa-card hover:bg-wa-incoming border border-wa-border text-wa-light"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-wa-accent hover:bg-wa-accentHover text-black transition-all shadow-glow-accent disabled:opacity-50"
                >
                  {isSubmitting ? 'Spawning Session...' : 'Create & Generate QR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Quota / Label Modal */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-sm rounded-2xl border border-wa-border p-6 shadow-2xl relative">
            <h3 className="text-base font-bold text-white mb-3">
              Configure {editingAccount.label}
            </h3>

            <form onSubmit={handleUpdateAccount} className="space-y-4">
              <div>
                <label className="block text-xs text-wa-muted mb-1">Account Label</label>
                <input
                  type="text"
                  value={editingAccount.label}
                  onChange={(e) => setEditingAccount({ ...editingAccount, label: e.target.value })}
                  className="w-full px-3 py-2 bg-wa-card border border-wa-border rounded-lg text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-wa-muted mb-1">Daily Cap (Messages)</label>
                <input
                  type="number"
                  min="5"
                  max="150"
                  value={editingAccount.dailyLimit}
                  onChange={(e) => setEditingAccount({ ...editingAccount, dailyLimit: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-wa-card border border-wa-border rounded-lg text-xs text-white font-mono"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-3 py-1.5 rounded-lg text-xs bg-wa-card text-wa-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-wa-accent text-black"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full QR Modal */}
      {activeQrModal && activeQrModal.qrCodeDataUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="glass-panel w-full max-w-sm rounded-2xl border border-wa-border p-6 shadow-2xl relative text-center">
            <button
              onClick={() => setActiveQrModal(null)}
              className="absolute right-4 top-4 p-1.5 rounded-lg bg-wa-card text-wa-muted hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-white mb-1">
              Pair {activeQrModal.label}
            </h3>
            <p className="text-xs text-wa-muted mb-4">
              Open WhatsApp on your phone &gt; Linked Devices &gt; Scan this QR
            </p>

            <div className="p-3 bg-white rounded-xl inline-block shadow-2xl mb-4">
              <img
                src={activeQrModal.qrCodeDataUrl}
                alt="QR Code"
                className="w-64 h-64 mx-auto rounded"
              />
            </div>

            <p className="text-[11px] text-wa-accent font-mono">
              Auto-sync active. This modal will update once linked.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
