import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [waStatus, setWaStatus] = useState({
    connectionState: 'connecting',
    userJid: null,
    userName: null,
    hasQr: false,
    qrCodeDataUrl: null,
  });
  const [queueCountdown, setQueueCountdown] = useState(null);
  const [queueState, setQueueState] = useState({
    isRunning: false,
    isPaused: false,
    workerState: 'idle',
    currentCountdown: 0,
    activeBatchCount: 0,
    testMode: false,
  });
  const [liveLogs, setLiveLogs] = useState([]);
  const [lastEvent, setLastEvent] = useState(null);
  const [accountsRefreshTrigger, setAccountsRefreshTrigger] = useState(0);
  const [inboxMessageEvent, setInboxMessageEvent] = useState(null);

  useEffect(() => {
    const s = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });

    s.on('connect', () => {
      setIsConnected(true);
      console.log('[Socket] Connected to server:', s.id);
    });

    s.on('disconnect', () => {
      setIsConnected(false);
      console.log('[Socket] Disconnected from server');
    });

    // Multi-Account Session Events
    s.on('accounts:list', (data) => {
      setAccountsRefreshTrigger((prev) => prev + 1);
      setLastEvent({ type: 'accounts:list', data });
    });

    s.on('session:status', (data) => {
      setAccountsRefreshTrigger((prev) => prev + 1);
      if (data.sessionId) {
        addLiveLog({
          type: data.status === 'CONNECTED' ? 'success' : 'info',
          action: `ACCOUNT: ${data.sessionId}`,
          message: data.message || `Session ${data.sessionId} status: ${data.status}`,
          timestamp: new Date(),
        });
      }
      setLastEvent({ type: 'session:status', data });
    });

    s.on('session:qr', (data) => {
      setAccountsRefreshTrigger((prev) => prev + 1);
      addLiveLog({
        type: 'info',
        action: `QR READY: ${data.sessionId}`,
        message: `New pairing QR generated for ${data.sessionId}`,
        timestamp: new Date(),
      });
      setLastEvent({ type: 'session:qr', data });
    });

    // Universal Inbox Events
    s.on('inbox:new_message', (data) => {
      setInboxMessageEvent(data);
      addLiveLog({
        type: data.message?.direction === 'inbound' ? 'success' : 'info',
        action: `INBOX: ${data.message?.direction?.toUpperCase() || 'MSG'}`,
        message: `${data.message?.direction === 'inbound' ? '📩 From' : '📤 To'} ${data.thread?.leadPhone || data.message?.from}: "${data.message?.text?.slice(0, 45)}..." [Acc: ${data.sessionId}]`,
        timestamp: new Date(),
      });
      setLastEvent({ type: 'inbox:new_message', data });
    });

    s.on('thread:updated', (data) => {
      setLastEvent({ type: 'thread:updated', data });
    });

    // Peer-to-Peer Warmup Engine Events
    s.on('warmup:started', (data) => {
      addLiveLog({
        type: 'info',
        action: 'P2P WARMUP',
        message: `🔥 P2P exchange initiated: [${data.fromLabel}] -> [${data.toLabel}] (Topic: ${data.topic})`,
        timestamp: new Date(),
      });
      setLastEvent({ type: 'warmup:started', data });
    });

    s.on('warmup:message_sent', (data) => {
      setAccountsRefreshTrigger((prev) => prev + 1);
      addLiveLog({
        type: 'success',
        action: 'WARMUP SENT',
        message: `💬 Starter sent via [${data.sessionId}] (Health Score: ${data.healthScore}%)`,
        timestamp: new Date(),
      });
      setLastEvent({ type: 'warmup:message_sent', data });
    });

    s.on('warmup:completed', (data) => {
      setAccountsRefreshTrigger((prev) => prev + 1);
      addLiveLog({
        type: 'success',
        action: 'WARMUP COMPLETE',
        message: `✨ P2P dialogue complete! [${data.fromSession}] replied to [${data.toSession}] (Total: ${data.totalExchanges})`,
        timestamp: new Date(),
      });
      setLastEvent({ type: 'warmup:completed', data });
    });

    s.on('warmup:warning', (data) => {
      addLiveLog({
        type: 'warning',
        action: 'WARMUP STATUS',
        message: `ℹ️ ${data.message}`,
        timestamp: new Date(),
      });
    });

    // Legacy Single-session compatibility events
    s.on('whatsapp:status', (data) => {
      setWaStatus((prev) => ({
        ...prev,
        connectionState: data.status,
        userJid: data.user?.jid || prev.userJid,
        userName: data.user?.name || prev.userName,
      }));
    });

    s.on('whatsapp:optout', (data) => {
      addLiveLog({
        type: 'opt_out',
        action: 'ANTI-BAN: OPT-OUT',
        message: `🛡️ Opt-out detected from ${data.phone}: "${data.message}". Lead automatically blacklisted!`,
        timestamp: new Date(),
      });
      setLastEvent({ type: 'optout', data });
    });

    // Queue Events
    s.on('queue:status', (data) => {
      setQueueState((prev) => ({ ...prev, ...data }));
    });

    s.on('queue:countdown', (data) => {
      setQueueCountdown(data);
      setQueueState((prev) => ({
        ...prev,
        workerState: data.state,
        currentCountdown: data.secondsRemaining,
      }));
    });

    s.on('queue:cooldown_start', (data) => {
      addLiveLog({
        type: 'cooldown',
        action: 'QUEUE: COOLDOWN',
        message: `⏳ ${data.message}`,
        timestamp: new Date(),
      });
    });

    s.on('queue:cooldown_end', (data) => {
      addLiveLog({
        type: 'info',
        action: 'QUEUE: RESUME',
        message: `▶️ ${data.message}`,
        timestamp: new Date(),
      });
    });

    s.on('queue:guardrail', (data) => {
      addLiveLog({
        type: 'guardrail',
        action: 'GUARDRAIL CAP REACHED',
        message: `🛑 ${data.message}`,
        timestamp: new Date(),
      });
      setLastEvent({ type: 'guardrail', data });
    });

    s.on('message:dispatched', (data) => {
      addLiveLog({
        type: 'success',
        action: 'MESSAGE SENT',
        message: `✉️ Sent to ${data.name || data.phone} via [${data.accountLabel || data.sessionId}] (Acc: ${data.accountQuota}, Batch: ${data.batchProgress})`,
        timestamp: new Date(),
      });
      setLastEvent({ type: 'dispatched', data });
    });

    s.on('message:failed', (data) => {
      addLiveLog({
        type: 'error',
        action: 'MESSAGE FAILED',
        message: `⚠️ Send failed to ${data.phone} via [${data.sessionId}]: ${data.error}`,
        timestamp: new Date(),
      });
      setLastEvent({ type: 'failed', data });
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  const addLiveLog = (logItem) => {
    setLiveLogs((prev) => [logItem, ...prev.slice(0, 75)]);
  };

  const clearLiveLogs = () => {
    setLiveLogs([]);
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        waStatus,
        setWaStatus,
        queueCountdown,
        queueState,
        setQueueState,
        liveLogs,
        addLiveLog,
        clearLiveLogs,
        lastEvent,
        accountsRefreshTrigger,
        inboxMessageEvent,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
