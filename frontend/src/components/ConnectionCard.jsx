import React, { useState } from 'react';
import {
  QrCode,
  Smartphone,
  CheckCircle2,
  RefreshCw,
  LogOut,
  Send,
  AlertTriangle,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { WhatsAppAPI } from '../api';

export default function ConnectionCard({ onRefreshStats }) {
  const { waStatus } = useSocket();
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMsg, setTestMsg] = useState('Hey there! This is a test message from WaOutreach Anti-Ban Engine.');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showTestModal, setShowTestModal] = useState(false);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      await WhatsAppAPI.reconnect();
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsReconnecting(false), 2000);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('Are you sure you want to unlink and logout this WhatsApp account?')) return;
    setIsLoggingOut(true);
    try {
      await WhatsAppAPI.logout();
      if (onRefreshStats) onRefreshStats();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleSendTestMessage = async (e) => {
    e.preventDefault();
    if (!testPhone.trim()) return;
    setIsSendingTest(true);
    setTestResult(null);

    try {
      const res = await WhatsAppAPI.testSend(testPhone, testMsg);
      setTestResult({
        success: true,
        message: `Dispatched successfully to ${testPhone} (ID: ${res.data?.messageId || 'OK'})`,
      });
      if (onRefreshStats) onRefreshStats();
    } catch (err) {
      setTestResult({
        success: false,
        message: err.response?.data?.error || err.message,
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const isConnected = waStatus.connectionState === 'connected';
  const isQrReady = waStatus.connectionState === 'qr_ready';

  return (
    <div className="glass-card rounded-2xl border border-wa-border p-6 shadow-xl relative overflow-hidden">
      {/* Background glow circle */}
      <div
        className={`absolute -right-16 -top-16 w-52 h-52 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          isConnected ? 'bg-emerald-500/10' : isQrReady ? 'bg-amber-500/10' : 'bg-rose-500/10'
        }`}
      />

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-wa-card border border-wa-border text-wa-accent">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              WhatsApp Gateway
              {isConnected && (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Baileys Socket Open
                </span>
              )}
            </h2>
            <p className="text-xs text-wa-muted">
              {isConnected
                ? 'Device paired & active'
                : isQrReady
                ? 'Scan QR with WhatsApp > Linked Devices'
                : 'Connecting socket stream...'}
            </p>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2">
          {isConnected && (
            <button
              onClick={() => setShowTestModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-wa-accent hover:bg-wa-accentHover text-black transition-all shadow-glow-accent"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Test Send</span>
            </button>
          )}

          <button
            onClick={handleReconnect}
            disabled={isReconnecting}
            title="Reconnect or generate fresh QR"
            className="p-2 rounded-lg bg-wa-incoming hover:bg-wa-card border border-wa-border text-wa-light transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isReconnecting ? 'animate-spin text-wa-accent' : ''}`} />
          </button>

          {isConnected && (
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              title="Unlink WhatsApp session"
              className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 transition-all disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Body: QR Code View or Connected View */}
      {isConnected ? (
        <div className="p-5 rounded-xl bg-wa-panel/80 border border-wa-border/80 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <div className="text-lg font-bold text-white flex items-center gap-2">
                {waStatus.userName || 'Linked WhatsApp Device'}
              </div>
              <div className="text-xs font-mono text-wa-muted mt-0.5">
                JID: {waStatus.userJid || 'Connected'}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
                  <Shield className="w-3 h-3 text-emerald-400" /> Anti-Ban Throttling Armed
                </span>
                <span className="text-[11px] text-wa-muted">
                  45-90s Jitter • 12-18m Batch Cooldown
                </span>
              </div>
            </div>
          </div>

          <div className="text-right flex flex-col items-center md:items-end gap-1">
            <div className="text-xs text-wa-muted">Active Socket Protocol</div>
            <div className="text-xs font-mono text-wa-accent bg-wa-card px-2.5 py-1 rounded border border-wa-border">
              Baileys MultiFileAuth v6.7
            </div>
          </div>
        </div>
      ) : isQrReady && waStatus.qrCodeDataUrl ? (
        <div className="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-xl bg-wa-panel/90 border border-wa-border">
          <div className="relative group p-2 bg-white rounded-xl shadow-2xl flex-shrink-0">
            <img
              src={waStatus.qrCodeDataUrl}
              alt="WhatsApp Baileys QR Code"
              className="w-48 h-48 rounded-lg"
            />
            <div className="absolute inset-0 border-2 border-wa-accent/40 rounded-xl pointer-events-none group-hover:border-wa-accent transition-colors" />
          </div>

          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 text-xs font-medium border border-amber-500/20">
              <QrCode className="w-3.5 h-3.5" /> Scan with WhatsApp Mobile
            </div>
            <h3 className="text-sm font-semibold text-white">How to link your phone:</h3>
            <ol className="text-xs text-wa-muted space-y-1.5 list-decimal list-inside">
              <li>Open WhatsApp on your mobile phone</li>
              <li>Tap <span className="text-wa-light font-medium">Settings (or Menu)</span> &gt; <span className="text-wa-light font-medium">Linked Devices</span></li>
              <li>Tap <span className="text-wa-accent font-medium">Link a Device</span> and scan this QR code</li>
            </ol>
            <p className="text-[11px] text-wa-muted/80">
              * The QR refreshes automatically. Uses Baileys sockets with no browser bloat.
            </p>
          </div>
        </div>
      ) : (
        <div className="py-10 text-center flex flex-col items-center justify-center p-5 rounded-xl bg-wa-panel/40 border border-dashed border-wa-border">
          <RefreshCw className="w-8 h-8 text-wa-accent animate-spin mb-3" />
          <h3 className="text-sm font-semibold text-white">Initializing WhatsApp Socket...</h3>
          <p className="text-xs text-wa-muted max-w-sm mt-1">
            Establishing secure Baileys session handshake. If QR does not appear shortly, click Reconnect.
          </p>
          <button
            onClick={handleReconnect}
            className="mt-4 px-4 py-1.5 rounded-lg text-xs font-medium bg-wa-card hover:bg-wa-incoming border border-wa-border text-wa-light transition-all"
          >
            Force Reconnect
          </button>
        </div>
      )}

      {/* Test Message Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-wa-border p-6 shadow-2xl relative">
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
              <Send className="w-4 h-4 text-wa-accent" /> Dispatch Test Message
            </h3>
            <p className="text-xs text-wa-muted mb-4">
              Send an instant verification message to test delivery without affecting queue status.
            </p>

            <form onSubmit={handleSendTestMessage} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-wa-light mb-1">
                  Recipient Phone (International format with country code)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 14155552671 or 919876543210"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-wa-card border border-wa-border rounded-lg text-sm text-white focus:outline-none focus:border-wa-accent font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-wa-light mb-1">
                  Message Content
                </label>
                <textarea
                  rows={3}
                  value={testMsg}
                  onChange={(e) => setTestMsg(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-wa-card border border-wa-border rounded-lg text-sm text-white focus:outline-none focus:border-wa-accent"
                />
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-lg text-xs font-medium ${
                    testResult.success
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {testResult.message}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-wa-card hover:bg-wa-incoming border border-wa-border text-wa-light"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSendingTest}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-wa-accent hover:bg-wa-accentHover text-black transition-all disabled:opacity-50"
                >
                  {isSendingTest ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" /> Send Now
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
