import React, { useState } from 'react';
import { Terminal, Trash2, Filter, ShieldAlert, CheckCircle, Flame, Clock } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function LiveLogViewer() {
  const { liveLogs, clearLiveLogs } = useSocket();
  const [filterType, setFilterType] = useState('all');

  const filteredLogs = liveLogs.filter((log) => {
    if (filterType === 'all') return true;
    if (filterType === 'opt_out') return log.type === 'opt_out';
    if (filterType === 'cooldown') return log.type === 'cooldown';
    if (filterType === 'success') return log.type === 'success';
    if (filterType === 'error') return log.type === 'error';
    return true;
  });

  const getLogIcon = (type) => {
    switch (type) {
      case 'opt_out':
        return <ShieldAlert className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />;
      case 'cooldown':
        return <Flame className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />;
      case 'success':
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />;
      case 'guardrail':
        return <Clock className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />;
      default:
        return <Terminal className="w-3.5 h-3.5 text-wa-accent flex-shrink-0" />;
    }
  };

  return (
    <div className="glass-card rounded-2xl border border-wa-border p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-wa-border/80">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-emerald-400" />
          <div>
            <h2 className="text-base font-bold text-white">Live Anti-Ban Event Terminal</h2>
            <p className="text-xs text-wa-muted">Real-time socket stream of outreach events & safety locks</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-2.5 py-1 bg-wa-card border border-wa-border rounded-lg text-xs text-white focus:outline-none"
          >
            <option value="all">All Events</option>
            <option value="opt_out">Opt-Outs & Blacklists</option>
            <option value="cooldown">Cooldowns & Pauses</option>
            <option value="success">Sent Dispatches</option>
            <option value="error">Errors</option>
          </select>

          <button
            onClick={clearLiveLogs}
            title="Clear Terminal Output"
            className="p-1.5 rounded-lg bg-wa-card hover:bg-wa-incoming border border-wa-border text-wa-muted hover:text-rose-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Output */}
      <div className="bg-wa-dark/90 rounded-xl border border-wa-border/80 p-4 font-mono text-xs h-64 overflow-y-auto space-y-2 select-text">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-wa-muted text-xs">
            Waiting for real-time outreach events or incoming replies...
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div
              key={index}
              className={`flex items-start gap-2.5 p-2 rounded transition-colors ${
                log.type === 'opt_out'
                  ? 'bg-rose-950/40 text-rose-300 border-l-2 border-rose-500'
                  : log.type === 'cooldown'
                  ? 'bg-amber-950/40 text-amber-300 border-l-2 border-amber-500'
                  : log.type === 'success'
                  ? 'bg-emerald-950/30 text-emerald-300'
                  : log.type === 'error'
                  ? 'bg-rose-950/30 text-rose-300'
                  : 'text-wa-light hover:bg-wa-panel/40'
              }`}
            >
              <span className="text-wa-muted text-[10px] whitespace-nowrap pt-0.5">
                {new Date(log.timestamp || Date.now()).toLocaleTimeString()}
              </span>
              {getLogIcon(log.type)}
              <div className="flex-1 break-all">
                {log.action && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-wa-muted mr-1.5 font-sans">
                    [{log.action}]
                  </span>
                )}
                <span>{log.message}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
