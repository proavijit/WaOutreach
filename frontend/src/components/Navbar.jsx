import React from 'react';
import { ShieldCheck, Wifi, WifiOff, Smartphone, HelpCircle, Zap, Layers } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function Navbar({ overviewData, onOpenRulesModal, activeTab, onSelectTab }) {
  const { isConnected } = useSocket();

  const connectedAccounts = overviewData?.connectedAccounts || 0;
  const totalAccounts = overviewData?.totalAccounts || 1;
  const clusterLimit = overviewData?.clusterDailyLimit || 100;
  const sentToday = overviewData?.sentToday || 0;
  const unreadCount = overviewData?.unreadInboxCount || 0;

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-wa-border/80 px-6 py-3.5 shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-wa-accent to-emerald-600 flex items-center justify-center shadow-glow-accent">
            <ShieldCheck className="w-6 h-6 text-black stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                WaOutreach
                <span className="text-xs tracking-normal uppercase px-2 py-0.5 rounded bg-wa-accent/20 text-wa-accent font-mono font-semibold border border-wa-accent/40">
                  v2.0 Multi-Account
                </span>
              </h1>
            </div>
            <p className="text-xs text-wa-muted hidden sm:block">
              Distributed Anti-Ban Dispatcher & Universal Shared Inbox
            </p>
          </div>
        </div>

        {/* Right Badges & Controls */}
        <div className="flex items-center flex-wrap gap-3">
          {/* Socket Indicator */}
          <div
            title={isConnected ? 'Backend real-time streaming active' : 'Disconnected from backend'}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-wa-card border border-wa-border text-wa-muted"
          >
            {isConnected ? (
              <Wifi className="w-3.5 h-3.5 text-wa-accent" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span>{isConnected ? 'LIVE CLUSTER' : 'OFFLINE'}</span>
          </div>

          {/* Connected Accounts Cluster Badge */}
          <button
            onClick={() => onSelectTab && onSelectTab('accounts')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
              connectedAccounts > 0
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>
              {connectedAccounts} / {totalAccounts} Accounts Online
            </span>
          </button>

          {/* Cluster Daily Cap Progress */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-wa-card border border-wa-border rounded-lg text-xs">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-wa-muted">24h Cluster Dispatched:</span>
            <span className="font-semibold text-white font-mono">
              {sentToday} / {clusterLimit}
            </span>
          </div>

          {/* Universal Inbox Unread Pill */}
          {unreadCount > 0 && (
            <button
              onClick={() => onSelectTab && onSelectTab('inbox')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-wa-accent text-black animate-pulse shadow-glow-accent"
            >
              <span>{unreadCount} Unread Inbound</span>
            </button>
          )}

          {/* Anti-Ban Specs Guide Button */}
          <button
            onClick={onOpenRulesModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-wa-card hover:bg-wa-incoming border border-wa-border text-wa-light transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5 text-wa-accent" />
            <span>Anti-Ban Rules</span>
          </button>
        </div>
      </div>
    </header>
  );
}
