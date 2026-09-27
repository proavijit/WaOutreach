import React from 'react';
import { Users, Clock, Send, ShieldAlert, CheckCheck, Layers, Inbox } from 'lucide-react';

export default function StatsOverview({ overview }) {
  const stats = overview || {
    totalLeads: 0,
    pendingCount: 0,
    queuedCount: 0,
    sentTotal: 0,
    sentToday: 0,
    deliveredCount: 0,
    repliedCount: 0,
    blacklistedCount: 0,
    failedCount: 0,
    totalAccounts: 1,
    connectedAccounts: 1,
    clusterDailyLimit: 100,
    unreadInboxCount: 0,
    dailyCap: 100,
  };

  const clusterCap = stats.clusterDailyLimit || stats.dailyCap || 100;
  const capPercentage = Math.min(100, Math.round((stats.sentToday / clusterCap) * 100));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Leads */}
      <div className="glass-card rounded-2xl border border-wa-border p-5 hover:border-wa-border/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-wa-muted uppercase tracking-wider">
            Total Leads
          </span>
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-white tracking-tight">
            {stats.totalLeads.toLocaleString()}
          </span>
          <span className="text-xs text-wa-muted">contacts</span>
        </div>
        <div className="mt-3 pt-3 border-t border-wa-border/60 flex items-center justify-between text-xs text-wa-muted">
          <span>Pending: <strong className="text-wa-light font-mono">{stats.pendingCount}</strong></span>
          <span>Failed: <strong className="text-rose-400 font-mono">{stats.failedCount}</strong></span>
        </div>
      </div>

      {/* 2. Queued */}
      <div className="glass-card rounded-2xl border border-wa-border p-5 hover:border-wa-border/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-wa-muted uppercase tracking-wider">
            Queued For Dispatch
          </span>
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-amber-400 tracking-tight font-mono">
            {(stats.queuedCount + stats.pendingCount).toLocaleString()}
          </span>
          <span className="text-xs text-wa-muted">in pipeline</span>
        </div>
        <div className="mt-3 pt-3 border-t border-wa-border/60 flex items-center justify-between text-xs text-wa-muted">
          <span>Round-Robin Load Balanced</span>
          <span className="text-[11px] text-amber-400 font-mono">45-90s Jitter</span>
        </div>
      </div>

      {/* 3. Sent Today (Cluster Distributed Cap) */}
      <div className="glass-card rounded-2xl border border-wa-border p-5 hover:border-wa-border/80 transition-all relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-wa-muted uppercase tracking-wider">
            Sent Today (Cluster)
          </span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Send className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-emerald-400 tracking-tight font-mono">
            {stats.sentToday}
          </span>
          <span className="text-xs text-wa-muted">/ {clusterCap} cluster cap</span>
        </div>

        {/* Progress Bar towards Cluster Cap */}
        <div className="mt-3">
          <div className="w-full bg-wa-card rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                capPercentage > 85 ? 'bg-rose-500' : capPercentage > 60 ? 'bg-amber-400' : 'bg-wa-accent'
              }`}
              style={{ width: `${capPercentage}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-wa-muted">
            <span>Delivered: <strong className="text-wa-light font-mono">{stats.deliveredCount}</strong></span>
            <span>Replied: <strong className="text-purple-400 font-mono">{stats.repliedCount}</strong></span>
          </div>
        </div>
      </div>

      {/* 4. Multi-Account Cluster & Universal Inbox */}
      <div className="glass-card rounded-2xl border border-wa-border p-5 hover:border-wa-border/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-wa-muted uppercase tracking-wider">
            Connected Sockets
          </span>
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-cyan-400 tracking-tight font-mono">
            {stats.connectedAccounts || 0}
          </span>
          <span className="text-xs text-wa-muted">/ {stats.totalAccounts || 1} online</span>
        </div>
        <div className="mt-3 pt-3 border-t border-wa-border/60 flex items-center justify-between text-xs text-wa-muted">
          <span className="flex items-center gap-1 text-wa-light">
            <Inbox className="w-3.5 h-3.5 text-wa-accent" /> Unread Chats: <strong className="text-white font-mono">{stats.unreadInboxCount || 0}</strong>
          </span>
          <span className="text-[11px] text-rose-400 font-mono">
            {stats.blacklistedCount} Banned
          </span>
        </div>
      </div>
    </div>
  );
}
