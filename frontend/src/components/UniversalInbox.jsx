import React, { useState, useEffect, useRef } from 'react';
import {
  Inbox,
  Search,
  Filter,
  Send,
  ShieldAlert,
  ShieldCheck,
  Check,
  CheckCheck,
  Smartphone,
  User,
  Building,
  Phone,
  Clock,
  RefreshCw,
  AlertCircle,
  Tag,
  Megaphone,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from 'lucide-react';
import { InboxAPI, AccountsAPI } from '../api';
import { useSocket } from '../context/SocketContext';

export default function UniversalInbox() {
  const { inboxMessageEvent, lastEvent } = useSocket();
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isOutreachExpanded, setIsOutreachExpanded] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedAccountFilter, setSelectedAccountFilter] = useState('all');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const messagesEndRef = useRef(null);

  // Load Accounts list for filter dropdown
  useEffect(() => {
    AccountsAPI.getAll()
      .then((data) => setAccounts(data || []))
      .catch(console.error);
  }, []);

  // Load threads
  const fetchThreads = async () => {
    setLoadingThreads(true);
    try {
      const data = await InboxAPI.getThreads({
        search: search.trim() || undefined,
        sessionId: selectedAccountFilter !== 'all' ? selectedAccountFilter : undefined,
        unreadOnly: unreadOnly ? 'true' : undefined,
      });
      setThreads(data.threads || []);

      // If currently selected thread is updated, update its reference
      if (selectedThread) {
        const updated = (data.threads || []).find((t) => t._id === selectedThread._id);
        if (updated) setSelectedThread(updated);
      } else if (data.threads && data.threads.length > 0) {
        handleSelectThread(data.threads[0]);
      }
    } catch (e) {
      console.error('Failed to load inbox threads:', e);
    } finally {
      setLoadingThreads(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, [selectedAccountFilter, unreadOnly]);

  // Handle incoming socket message
  useEffect(() => {
    if (inboxMessageEvent) {
      const { thread, message } = inboxMessageEvent;
      // If message belongs to active thread, append it
      if (selectedThread && (thread?._id === selectedThread._id || message?.threadId === selectedThread._id)) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === message._id || (m.whatsappMessageId && m.whatsappMessageId === message.whatsappMessageId))) {
            return prev;
          }
          return [...prev, message];
        });
      }
      fetchThreads();
    }
  }, [inboxMessageEvent]);

  // Refresh on other events
  useEffect(() => {
    if (lastEvent?.type === 'thread:updated') {
      fetchThreads();
    }
  }, [lastEvent]);

  // Load messages for a thread
  const handleSelectThread = async (thread) => {
    setSelectedThread(thread);
    setIsOutreachExpanded(false);
    setLoadingMessages(true);
    try {
      const data = await InboxAPI.getMessages(thread._id);
      setMessages(data || []);
      // Optimistically update thread unread count locally
      setThreads((prev) =>
        prev.map((t) => (t._id === thread._id ? { ...t, unreadCount: 0 } : t))
      );
    } catch (e) {
      console.error('Failed to load thread messages:', e);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Extract initial cold outreach dispatch pitch text
  const campaignPitchText = (
    outreachMessage?.text ||
    selectedThread?.initialOutreachMessage?.text ||
    selectedThread?.leadId?.sentContent ||
    (messages.length > 0 && messages[0].direction === 'outbound' ? messages[0].text : '')
  ).trim();

  // Strict filtering for center chat:
  // Filter out any message where message.isOutreach === true or message.direction === 'outbound' && index === 0 (or matching campaign text)
  const chatMessages = messages.filter((msg, index) => {
    // 1. Explicit outreach flag
    if (msg.isOutreach === true || msg.metadata?.isOutreach === true) return false;

    // 2. The very first outbound message in the thread is the cold campaign dispatch
    if (msg.direction === 'outbound' && index === 0) return false;

    // 3. Match against the campaign pitch text
    if (campaignPitchText && msg.direction === 'outbound' && msg.text?.trim() === campaignPitchText) {
      return false;
    }

    return true;
  });

  const hasClientReplies = messages.some((m) => m.direction === 'inbound');

  // Scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Send Reply
  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedThread) return;

    const text = replyText.trim();
    setIsSending(true);

    try {
      const res = await InboxAPI.sendReply(selectedThread._id, text);
      setReplyText('');
      // Reload messages to get updated status
      const updatedMessages = await InboxAPI.getMessages(selectedThread._id);
      setMessages(updatedMessages || []);
      fetchThreads();
    } catch (err) {
      alert('Error sending reply: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSending(false);
    }
  };

  // Toggle Blacklist from right pane
  const handleToggleBlacklist = async () => {
    if (!selectedThread) return;
    try {
      const res = await InboxAPI.toggleBlacklist(selectedThread._id);
      setSelectedThread(res.data);
      fetchThreads();
    } catch (err) {
      alert('Error toggling blacklist: ' + (err.response?.data?.error || err.message));
    }
  };

  const getReceiptIcon = (status) => {
    switch (status) {
      case 'read':
        return <CheckCheck className="w-3.5 h-3.5 text-cyan-400 inline" />;
      case 'delivered':
        return <CheckCheck className="w-3.5 h-3.5 text-wa-muted inline" />;
      case 'sent':
        return <Check className="w-3.5 h-3.5 text-wa-muted inline" />;
      default:
        return null;
    }
  };

  return (
    <div className="glass-card rounded-2xl border border-wa-border overflow-hidden shadow-2xl h-[750px] flex flex-col">
      {/* 3-Pane Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* ========================================================================= */}
        {/* PANE 1: Left Threads Sidebar */}
        {/* ========================================================================= */}
        <div className="w-full sm:w-80 md:w-96 border-r border-wa-border flex flex-col bg-wa-panel/90">
          {/* Header & Controls */}
          <div className="p-3.5 border-b border-wa-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Inbox className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Universal Shared Inbox</h3>
              </div>
              <button
                onClick={fetchThreads}
                title="Refresh Inbox"
                className="p-1 rounded text-wa-muted hover:text-white transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingThreads ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search conversations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchThreads()}
                className="w-full pl-8 pr-3 py-1.5 bg-wa-card border border-wa-border rounded-lg text-xs text-white focus:outline-none focus:border-wa-accent"
              />
              <Search className="w-3.5 h-3.5 text-wa-muted absolute left-2.5 top-2.5" />
            </div>

            {/* Filter Bar: Account Selector & Unread Toggle */}
            <div className="flex items-center gap-2 text-xs">
              <select
                value={selectedAccountFilter}
                onChange={(e) => setSelectedAccountFilter(e.target.value)}
                className="flex-1 px-2 py-1 bg-wa-card border border-wa-border rounded-lg text-xs text-white focus:outline-none truncate"
              >
                <option value="all">All Accounts ({accounts.length})</option>
                {accounts.map((a) => (
                  <option key={a.sessionId} value={a.sessionId}>
                    {a.label || a.sessionId}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setUnreadOnly(!unreadOnly)}
                className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                  unreadOnly
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-wa-card text-wa-muted border-wa-border hover:text-white'
                }`}
              >
                Unread
              </button>
            </div>
          </div>

          {/* Threads List */}
          <div className="flex-1 overflow-y-auto divide-y divide-wa-border/40">
            {loadingThreads && threads.length === 0 ? (
              <div className="p-8 text-center text-xs text-wa-muted">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-wa-accent" />
                Loading conversations...
              </div>
            ) : threads.length === 0 ? (
              <div className="p-8 text-center text-xs text-wa-muted">
                No conversations found.
              </div>
            ) : (
              threads.map((thread) => {
                const isSelected = selectedThread?._id === thread._id;

                return (
                  <div
                    key={thread._id}
                    onClick={() => handleSelectThread(thread)}
                    className={`p-3.5 cursor-pointer transition-colors relative hover:bg-wa-incoming/50 ${
                      isSelected ? 'bg-wa-incoming/80 border-l-2 border-wa-accent' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="font-semibold text-white text-xs truncate flex items-center gap-1.5">
                        <span>{thread.leadName || `+${thread.leadPhone}`}</span>
                        {thread.status === 'blacklisted' && (
                          <span title="Opted Out / Blacklisted">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-wa-muted font-mono whitespace-nowrap">
                        {thread.lastMessageAt
                          ? new Date(thread.lastMessageAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                    </div>

                    {/* Account Origin Badge */}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-wa-card text-cyan-300 border border-cyan-500/30 flex items-center gap-1 truncate max-w-[180px]">
                        <Smartphone className="w-2.5 h-2.5 text-cyan-400 flex-shrink-0" />
                        <span className="truncate">{thread.accountLabel || thread.assignedSessionId}</span>
                      </span>

                      {thread.leadCompany && (
                        <span className="text-[10px] text-wa-muted truncate">
                          • {thread.leadCompany}
                        </span>
                      )}
                    </div>

                    {/* Snippet & Unread Pill */}
                    <div className="flex items-center justify-between gap-2">
                      {(!thread.leadId || thread.leadId.status !== 'replied') && thread.unreadCount === 0 ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300/85 border border-amber-500/20 truncate">
                          Outreach Sent (Awaiting Reply)
                        </span>
                      ) : (
                        <p className="text-xs text-wa-muted truncate font-sans">
                          {thread.lastMessage || 'No messages yet'}
                        </p>
                      )}

                      {thread.unreadCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-wa-accent text-black flex-shrink-0">
                          {thread.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PANE 2: Middle Active Chat Window */}
        {/* ========================================================================= */}
        <div className="flex-1 flex flex-col bg-wa-dark relative">
          {selectedThread ? (
            <>
              {/* Chat Header */}
              <div className="p-3.5 border-b border-wa-border bg-wa-panel flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-wa-incoming border border-wa-border flex items-center justify-center text-wa-accent">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      {selectedThread.leadName || `+${selectedThread.leadPhone}`}
                      {selectedThread.status === 'blacklisted' && (
                        <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                          Blacklisted
                        </span>
                      )}
                    </h4>
                    <div className="text-[11px] text-wa-muted flex items-center gap-2">
                      <span>+{selectedThread.leadPhone}</span>
                      <span>•</span>
                      <span className="text-cyan-300 font-mono">
                        Contacted via: {selectedThread.accountLabel || selectedThread.assignedSessionId}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-wa-muted">
                  <span className="hidden sm:inline">Auto-routing replies to origin account</span>
                </div>
              </div>

              {/* Chat Messages Container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0b141a]/95">
                {loadingMessages ? (
                  <div className="h-full flex items-center justify-center text-xs text-wa-muted">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2 text-wa-accent" />
                    Loading conversation history...
                  </div>
                ) : !hasClientReplies || chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center text-wa-muted select-none">
                    <div className="w-12 h-12 rounded-2xl bg-wa-incoming/80 border border-wa-border flex items-center justify-center text-wa-accent mb-3 shadow-inner">
                      <MessageSquare className="w-6 h-6 text-wa-accent" />
                    </div>
                    <h5 className="text-sm font-semibold text-white">No customer replies yet.</h5>
                    <p className="text-xs text-wa-muted mt-1 max-w-xs leading-relaxed">
                      Waiting for prospect response...
                    </p>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => {
                    const isOutbound = msg.direction === 'outbound';

                    return (
                      <div
                        key={msg._id || idx}
                        className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[75%] p-3 rounded-2xl text-xs leading-relaxed shadow-md ${
                            isOutbound
                              ? 'bg-wa-outgoing text-white rounded-br-none'
                              : 'bg-wa-incoming text-wa-light rounded-bl-none'
                          }`}
                        >
                          <div className="whitespace-pre-wrap font-sans">{msg.text}</div>
                          <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-white/60 font-mono">
                            <span>
                              {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {isOutbound && getReceiptIcon(msg.status)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer or Blacklist Warning */}
              <div className="p-3 border-t border-wa-border bg-wa-panel">
                {selectedThread.status === 'blacklisted' ? (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>
                      This contact is <strong>blacklisted / opted-out</strong>. Replying is disabled to protect WhatsApp account reputation.
                    </span>
                  </div>
                ) : (
                  <form onSubmit={handleSendReply} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={`Reply as [${selectedThread.accountLabel || selectedThread.assignedSessionId}]...`}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-wa-card border border-wa-border rounded-xl text-xs text-white focus:outline-none focus:border-wa-accent"
                    />

                    <button
                      type="submit"
                      disabled={!replyText.trim() || isSending}
                      className="p-2.5 rounded-xl bg-wa-accent hover:bg-wa-accentHover text-black transition-all shadow-glow-accent disabled:opacity-40"
                    >
                      {isSending ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 fill-current" />
                      )}
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-wa-muted">
              <Inbox className="w-12 h-12 text-wa-border mb-3" />
              <h4 className="text-sm font-semibold text-white">No Conversation Selected</h4>
              <p className="text-xs max-w-xs mt-1">
                Select a thread from the left pane to view conversation history and reply directly.
              </p>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* PANE 3: Right Lead Profile Card */}
        {/* ========================================================================= */}
        {selectedThread && (
          <div className="w-80 border-l border-wa-border p-4 bg-wa-panel/80 hidden lg:flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4 text-xs">
              <div className="text-center pb-3 border-b border-wa-border">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-wa-accent/20 to-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto mb-2 shadow-inner">
                  <User className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-white truncate">
                  {selectedThread.leadName || 'Anonymous Contact'}
                </h4>
                <p className="text-xs font-mono text-wa-muted mt-0.5">
                  +{selectedThread.leadPhone}
                </p>
              </div>

              {/* Details List */}
              <div className="space-y-3">
                <div>
                  <span className="text-[10px] font-semibold text-wa-muted uppercase block mb-1">
                    Company / Organization
                  </span>
                  <div className="text-white font-medium flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-wa-muted" />
                    <span>{selectedThread.leadCompany || 'Not provided'}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-wa-muted uppercase block mb-1">
                    Origin WhatsApp Account
                  </span>
                  <div className="p-2 rounded-lg bg-wa-card border border-wa-border text-cyan-300 font-mono text-[11px] flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{selectedThread.accountLabel || selectedThread.assignedSessionId}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-wa-muted uppercase block mb-1">
                    Compliance & Safety Status
                  </span>
                  <div
                    className={`p-2 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 ${
                      selectedThread.status === 'blacklisted'
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    {selectedThread.status === 'blacklisted' ? (
                      <>
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                        <span>Blacklisted (Opted Out)</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Active Eligible Contact</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Sent Outreach Pitch Card (under Compliance & Safety Status) */}
                {campaignPitchText && (
                  <div className="pt-1">
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-[11px]">
                          <Megaphone className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Sent Outreach Pitch</span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          Campaign
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsOutreachExpanded((prev) => !prev)}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-black/40 hover:bg-black/60 border border-wa-border text-[11px] font-medium text-amber-300 flex items-center justify-between transition-colors cursor-pointer select-none"
                      >
                        <span>
                          {isOutreachExpanded ? '[Hide Sent Campaign Message]' : '[Show Sent Campaign Message]'}
                        </span>
                        {isOutreachExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                        )}
                      </button>

                      {isOutreachExpanded && (
                        <div className="max-h-48 overflow-y-auto rounded-lg bg-black/50 border border-wa-border/80 p-2.5 text-xs text-wa-light font-sans leading-relaxed break-words whitespace-pre-wrap select-text">
                          {campaignPitchText}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions Footer */}
            <div className="pt-4 border-t border-wa-border mt-4">
              <button
                onClick={handleToggleBlacklist}
                className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  selectedThread.status === 'blacklisted'
                    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {selectedThread.status === 'blacklisted' ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Un-blacklist Lead</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Blacklist (Block Future Runs)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
