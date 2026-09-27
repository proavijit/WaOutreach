Markdown
# Product Requirements Document (PRD)

## 1. Executive Summary & Objective
- **Project Name:** WaOutreach Engine
- **Target Platform:** WhatsApp Web (Unofficial protocol client)
- **Primary Goal:** Provide a controlled, semi-automated cold messaging pipeline for lead generation with zero-cost infrastructure.
- **Core Principle:** Safety-first delivery architecture prioritizing human-like interaction cadence over volume to keep accounts operational within an arbitrary cap of 100 outbound messages per 24-hour cycle.

---

## 2. Technical Stack
- **Backend:** Node.js (v20+ ESM or TypeScript), Express.js
- **Protocol Driver:** `@whiskeysockets/baileys` (Pure WebSocket implementation, no headless browser overhead)
- **Database:** MongoDB (via Mongoose ODM)
- **Real-Time Layer:** Socket.io (for QR broadcasting, device status, and live pipeline monitoring)
- **Frontend:** React.js (Vite), Tailwind CSS, Lucide-React, Axios, Socket.io-client
- **Queue/Worker:** Asynchronous sequential worker (MongoDB status-locked or BullMQ/Redis)

---

## 3. System Architecture & Workflows

┌────────────────────────────────────────────────────────┐
│                      React UI                          │
│  (QR Monitor, Lead Importer, Campaign Controller)      │
└──────────────────────────┬─────────────────────────────┘
│ Socket.io & REST
▼
┌────────────────────────────────────────────────────────┐
│                   Express Backend                      │
├──────────────────────────┬─────────────────────────────┤
│   Baileys Socket Core    │     Queue & Delay Engine    │
│  - Session Auth State    │    - Jitter delay (45-90s)  │
│  - Inbound Message Watch │    - Batch pause (15 items) │
│  - Auto-opt-out Handler  │    - Daily 100-cap cutoff   │
└────────────┬─────────────┴──────────────┬──────────────┘
│                            │
▼                            ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│     WhatsApp Gateway     │  │     MongoDB Database     │
│   (WebSocket Channel)    │  │ (Leads, Campaigns, Logs) │
└──────────────────────────┘  └──────────────────────────┘


---

## 4. Anti-Ban & Compliance Specifications (Safety Rules)

1. **Jitter Delay Interval:**
   - Every individual message dispatch must execute a randomized delay between 45,000 ms and 90,000 ms.
   - Fixed-interval dispatching is strictly disallowed.

2. **Batch Cooldown:**
   - For every 15 consecutively dispatched messages, the queue processor must enter a mandatory sleep state of 12 to 18 minutes before resuming.

3. **Daily Quota Cap:**
   - Hard daily limit set to 100 outbound cold messages per active number.
   - The queue worker must automatically pause operations when `sentToday >= 100` and reschedule execution for the next calendar day.

4. **Dynamic Spintax Processing:**
   - Outbound templates must parse nested Spintax structures (e.g., `{Hi|Hello|Hey}`) alongside dynamic variables (`{{name}}`, `{{company}}`) to ensure content differentiation across messages.

5. **Automated Blacklist / Opt-Out Detection:**
   - The system must inspect inbound messages via the connection listener.
   - If an inbound payload matches keywords such as `STOP`, `UNSUBSCRIBE`, `DON'T TEXT`, or `REMOVE`, the recipient's phone number must immediately switch to `blacklisted` status, permanently blocking future queue operations for that entity.

---

## 5. Database Schema Specifications

### 5.1 `Lead` Model
```typescript
{
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true, index: true }, // Format: +[country_code][number]
  company: { type: String, default: "" },
  tags: [{ type: String }],
  status: {
    type: String,
    enum: ["pending", "queued", "sent", "delivered", "read", "replied", "failed", "blacklisted"],
    default: "pending",
    index: true
  },
  lastSentAt: { type: Date, default: null },
  errorMessage: { type: String, default: null },
  replies: [
    {
      text: { type: String },
      receivedAt: { type: Date, default: Date.now }
    }
  ],
  metadata: { type: Map, of: String }
}
5.2 Campaign Model
TypeScript
{
  name: { type: String, required: true },
  template: { type: String, required: true }, // Contains spintax and dynamic variables
  status: {
    type: String,
    enum: ["draft", "running", "paused", "completed"],
    default: "draft"
  },
  dailyCap: { type: Number, default: 50, max: 100 },
  sentToday: { type: Number, default: 0 },
  lastResetDate: { type: Date, default: Date.now },
  minDelaySeconds: { type: Number, default: 45 },
  maxDelaySeconds: { type: Number, default: 90 },
  batchSize: { type: Number, default: 15 },
  batchCooldownMinutes: { type: Number, default: 15 }
}
6. Functional Requirements
6.1 Authentication & Session Life Cycle
System uses useMultiFileAuthState to save credentials locally under ./auth_info_baileys/.

Connection updates emit raw QR data or base64 QR to the frontend client via Socket.io.

Disconnections are analyzed: automatically reconnect if standard disconnect; halt and notify user if session credentials are invalidated or logged out.

6.2 Inbound Message & Opt-Out Listener
Register Baileys messages.upsert hook.

Parse text body from conversations or extended text messages.

If text matches /^(stop|unsubscribe|remove|dont text|no)$/i:

Mark matching lead record as blacklisted.

Abort any scheduled pending messages to this phone number.

Otherwise, record incoming text to lead.replies and switch lead status to replied.

6.3 Queue Processor Loop
Read active campaign parameters.

Query candidates: status: 'pending', phone: { $ne: null }, excluding blacklisted.

For each lead:

Generate distinct copy using parseSpintax(template, lead).

Validate WhatsApp presence via sock.onWhatsApp(jid). If unregistered, mark failed.

Dispatch message: sock.sendMessage(jid, { text }).

Update lead.status = 'sent', lead.lastSentAt = new Date(), increment campaign.sentToday.

Calculate jitter delay: randomBetween(minDelay, maxDelay) * 1000 ms and await sleep.

If count % batchSize === 0, trigger batch cooldown delay.

Stop if sentToday >= dailyCap.

7. Frontend User Interface Requirements
Dashboard Home:

WhatsApp Connection Card: Live connection state badge (Connected, Connecting, Disconnected) and dynamic QR Code modal/card.

Aggregate KPIs: Total Leads, Processed Today, Queued Leads, Opt-Out Count.

Lead Manager:

CSV / Excel upload widget with column mapping (name, phone, company).

Table viewer supporting search, filtering by status (pending, sent, replied, blacklisted), and manual delete/blacklist buttons.

Campaign Studio:

Textarea for message template input with inline dynamic variable indicators.

Interactive Spintax preview container displaying randomized output in real-time.

Safety configuration controls: Daily Cap slider (max 100), Min Delay (s), Max Delay (s), Batch Cooldown (mins).

Global Queue control toggles: Start Campaign, Pause Queue, Reset Daily Limits.

---

### 8. Automated Peer-to-Peer WhatsApp Warm-up Engine

#### 8.1 Objective
To safely condition and age newly paired WhatsApp accounts, mitigating Meta's heuristic spam flags on virgin numbers by generating organic two-way conversational traffic between internal accounts.

#### 8.2 Operational Constraints & Workflow
1. **Scheduled Interval:** Background cron runs every 15–30 minutes randomly between 9:00 AM and 9:00 PM local time.
2. **Account Selection:** Automatically pairs two connected accounts (`Session A` and `Session B`) from the active cluster pool.
3. **Presence Typing Simulation:** `Session A` dispatches `sock.sendPresenceUpdate('composing')` for 3–5 seconds before sending.
4. **Dialogue Corpus:** Picks contextual dialogues from a rich corpus of natural conversations (work syncs, document reviews, casual banter, lunch plans).
5. **Humanized Two-Way Reply:** After a stochastic delay of 1 to 4 minutes, `Session B` marks the starter as read (`readMessages`), simulates typing (2–4s), and responds back.
6. **Account Health Progression:**
   - Accounts track `warmupDays` and a dynamic `healthScore` (0–100%).
   - Days 1–6: Labeled as `Warming Up (Day X/7)` with a conservative Tier 1 cold outreach limit (20 msgs/day).
   - Day 7+: Transitions to `Mature Account`, unlocking Tier 2 cold outreach capacity (50–100 msgs/day).