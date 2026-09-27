import React from 'react';
import { ShieldCheck, X, Shuffle, Clock, Flame, ShieldAlert, Zap } from 'lucide-react';

export default function AntiBanModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn">
      <div className="glass-panel w-full max-w-2xl rounded-2xl border border-wa-border p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-xl bg-wa-card hover:bg-wa-incoming text-wa-muted hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-wa-accent to-emerald-600 flex items-center justify-center shadow-glow-accent">
            <ShieldCheck className="w-7 h-7 text-black stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">WaOutreach Anti-Ban Architecture</h2>
            <p className="text-xs text-wa-muted">
              5-layer defensive framework built strictly to safeguard WhatsApp sender reputation
            </p>
          </div>
        </div>

        <div className="space-y-4 text-xs text-wa-light mt-6">
          {/* 1. Spintax */}
          <div className="p-4 rounded-xl bg-wa-panel border border-wa-border">
            <div className="flex items-center gap-2 font-bold text-white text-sm mb-1 text-emerald-400">
              <Shuffle className="w-4 h-4 text-emerald-400" /> 1. Dynamic Spintax & Personalization
            </div>
            <p className="text-wa-muted leading-relaxed">
              Every message dispatched contains unique wording via recursive nested curly braces like{' '}
              <code className="text-wa-accent bg-wa-card px-1 py-0.5 rounded">{`{Hi|Hello|{Hey|Greetings}}`}</code> and lead tag hydration{' '}
              <code className="text-wa-accent bg-wa-card px-1 py-0.5 rounded">{`{{name}}`}</code>, preventing hash fingerprinting by Meta's spam filters.
            </p>
          </div>

          {/* 2. Jitter Delay */}
          <div className="p-4 rounded-xl bg-wa-panel border border-wa-border">
            <div className="flex items-center gap-2 font-bold text-white text-sm mb-1 text-cyan-400">
              <Clock className="w-4 h-4 text-cyan-400" /> 2. Randomized Jitter Delay (45s - 90s)
            </div>
            <p className="text-wa-muted leading-relaxed">
              Dispatches never run on fixed intervals. The engine introduces stochastic, non-blocking jitter sleep between 45 and 90 seconds between individual messages, mimicking natural human pacing.
            </p>
          </div>

          {/* 3. Batch Cooldown */}
          <div className="p-4 rounded-xl bg-wa-panel border border-wa-border">
            <div className="flex items-center gap-2 font-bold text-white text-sm mb-1 text-amber-400">
              <Flame className="w-4 h-4 text-amber-400" /> 3. Mandatory Batch Cooldown (12m - 18m per 15 msgs)
            </div>
            <p className="text-wa-muted leading-relaxed">
              Dispatched volume is broken into micro-batches of 15 messages. After each batch, the worker enters a mandatory 12 to 18-minute cooldown pause, breaking burst anomalies that trigger carrier threshold flags.
            </p>
          </div>

          {/* 4. Daily Hard Cap */}
          <div className="p-4 rounded-xl bg-wa-panel border border-wa-border">
            <div className="flex items-center gap-2 font-bold text-white text-sm mb-1 text-indigo-400">
              <Zap className="w-4 h-4 text-indigo-400" /> 4. 24-Hour Rolling Guardrail Cap (100 msgs/day)
            </div>
            <p className="text-wa-muted leading-relaxed">
              Enforces a strict 100 messages cap in any rolling 24-hour cycle. When the limit is reached, the queue is automatically locked in a safety pause until the window clears.
            </p>
          </div>

          {/* 5. Auto Blacklist */}
          <div className="p-4 rounded-xl bg-wa-panel border border-wa-border">
            <div className="flex items-center gap-2 font-bold text-white text-sm mb-1 text-rose-400">
              <ShieldAlert className="w-4 h-4 text-rose-400" /> 5. Auto-Blacklist & Regex Opt-Out Engine
            </div>
            <p className="text-wa-muted leading-relaxed">
              Monitors incoming Baileys messages in real time. If any recipient replies with opt-out keywords matching{' '}
              <code className="text-rose-400 bg-wa-card px-1 py-0.5 rounded">/stop|unsubscribe|don't text|remove/i</code>, their number is instantly blacklisted in MongoDB and permanently barred from future outreach.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-wa-accent hover:bg-wa-accentHover text-black transition-all shadow-glow-accent"
          >
            Understood & Armed
          </button>
        </div>
      </div>
    </div>
  );
}
