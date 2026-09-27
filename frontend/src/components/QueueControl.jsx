import React, { useState } from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Zap,
  Clock,
  Shield,
  AlertOctagon,
  Flame,
  CheckCircle,
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { QueueAPI } from '../api';

export default function QueueControl({ activeCampaign, onQueueAction }) {
  const { queueState, queueCountdown, waStatus } = useSocket();
  const [testMode, setTestMode] = useState(false);
  const [isActing, setIsActing] = useState(false);

  const isConnected = waStatus.connectionState === 'connected';

  const handleStart = async () => {
    if (!isConnected) {
      alert('WhatsApp must be connected before starting the dispatch queue. Please scan the QR code first.');
      return;
    }
    setIsActing(true);
    try {
      await QueueAPI.start(activeCampaign?._id || null, testMode);
      if (onQueueAction) onQueueAction();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    } finally {
      setIsActing(false);
    }
  };

  const handlePause = async () => {
    setIsActing(true);
    try {
      await QueueAPI.pause();
      if (onQueueAction) onQueueAction();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    } finally {
      setIsActing(false);
    }
  };

  const handleStop = async () => {
    setIsActing(true);
    try {
      await QueueAPI.stop();
      if (onQueueAction) onQueueAction();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    } finally {
      setIsActing(false);
    }
  };

  const handleResetPending = async () => {
    if (!window.confirm('Reset all failed/queued leads back to pending so they can be dispatched?')) return;
    try {
      const res = await QueueAPI.resetPending(activeCampaign?._id || null, false);
      alert(res.message);
      if (onQueueAction) onQueueAction();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  };

  // State styling helper
  const getWorkerBadge = () => {
    switch (queueState.workerState) {
      case 'processing':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Dispatched & Processing
          </span>
        );
      case 'jitter_delay':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 animate-spin" /> Jitter Delay Active (45-90s)
          </span>
        );
      case 'batch_cooldown':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 animate-bounce">
            <Flame className="w-3.5 h-3.5 text-amber-400" /> Batch Cooldown (12-18m)
          </span>
        );
      case 'daily_cap_reached':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5">
            <AlertOctagon className="w-3.5 h-3.5 text-rose-400" /> Daily Guardrail Hard Cap (100) Reached
          </span>
        );
      case 'paused':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 flex items-center gap-1.5">
            <Pause className="w-3.5 h-3.5" /> Queue Paused
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-wa-card text-wa-muted border border-wa-border flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-wa-muted"></span> Worker Idle
          </span>
        );
    }
  };

  return (
    <div className="glass-card rounded-2xl border border-wa-border p-6 shadow-xl relative overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-wa-border/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-wa-card border border-wa-border text-wa-accent">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Anti-Ban Queue Execution Engine
            </h2>
            <p className="text-xs text-wa-muted">
              Sequential FIFO message dispatcher with non-blocking async sleep & batch throttling
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getWorkerBadge()}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Countdown & Batch Progress Monitor */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-wa-panel/70 border border-wa-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Live Anti-Ban Countdown Timer
              </span>
            </div>

            <div className="text-xs font-mono text-cyan-300">
              {queueState.currentCountdown > 0 ? (
                <span>
                  {Math.floor(queueState.currentCountdown / 60)}m {queueState.currentCountdown % 60}s remaining
                </span>
              ) : (
                <span className="text-wa-muted">Ready</span>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-wa-card rounded-full h-3 p-0.5 border border-wa-border overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                queueState.workerState === 'batch_cooldown'
                  ? 'bg-amber-400'
                  : queueState.workerState === 'jitter_delay'
                  ? 'bg-cyan-400'
                  : 'bg-wa-accent'
              }`}
              style={{
                width:
                  queueCountdown?.totalSeconds && queueCountdown.totalSeconds > 0
                    ? `${Math.max(
                        3,
                        ((queueCountdown.totalSeconds - queueCountdown.secondsRemaining) /
                          queueCountdown.totalSeconds) *
                          100
                      )}%`
                    : queueState.isRunning
                    ? '100%'
                    : '0%',
              }}
            />
          </div>

          {/* Status info bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-1">
            <div className="p-2.5 rounded-lg bg-wa-card border border-wa-border">
              <span className="text-[10px] text-wa-muted uppercase block">Batch Counter</span>
              <span className="font-mono font-bold text-white text-sm">
                {queueState.activeBatchCount || 0} / 15 msgs
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-wa-card border border-wa-border">
              <span className="text-[10px] text-wa-muted uppercase block">Next Cooldown</span>
              <span className="font-mono font-bold text-amber-300 text-sm">
                In {Math.max(0, 15 - (queueState.activeBatchCount || 0))} msgs
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-wa-card border border-wa-border col-span-2 sm:col-span-1">
              <span className="text-[10px] text-wa-muted uppercase block">Target Campaign</span>
              <span className="font-semibold text-wa-light text-sm truncate block">
                {activeCampaign?.name || 'All Pending Leads'}
              </span>
            </div>
          </div>
        </div>

        {/* Dispatch Controls & Fast-Forward Toggle */}
        <div className="p-5 rounded-xl bg-wa-panel/70 border border-wa-border flex flex-col justify-between space-y-4">
          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider mb-2">
              Queue Controls
            </div>

            {/* Test Mode Fast-Forward Toggle */}
            <div className="p-3 rounded-lg bg-wa-card border border-wa-border flex items-center justify-between mb-4">
              <div>
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Test Mode (Demo Speed)
                </div>
                <div className="text-[10px] text-wa-muted">
                  3-6s jitter & 10s cooldown for instant validation
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={testMode}
                  onChange={(e) => setTestMode(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-wa-panel peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            {!queueState.isRunning || queueState.isPaused ? (
              <button
                type="button"
                onClick={handleStart}
                disabled={isActing}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-wa-accent hover:bg-wa-accentHover text-black transition-all shadow-glow-accent disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{queueState.isPaused ? 'Resume Dispatch Queue' : 'Start Anti-Ban Queue'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePause}
                disabled={isActing}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black transition-all disabled:opacity-50"
              >
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause Queue</span>
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleStop}
                disabled={!queueState.isRunning && !queueState.isPaused}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium bg-wa-card hover:bg-wa-incoming border border-wa-border text-rose-400 hover:text-rose-300 disabled:opacity-40"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </button>

              <button
                type="button"
                onClick={handleResetPending}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium bg-wa-card hover:bg-wa-incoming border border-wa-border text-wa-light hover:text-white"
                title="Reset failed or stuck leads back to pending"
              >
                <RotateCcw className="w-3.5 h-3.5 text-wa-accent" />
                <span>Reset Failed</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
