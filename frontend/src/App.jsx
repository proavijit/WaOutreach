import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import StatsOverview from './components/StatsOverview';
import AccountManager from './components/AccountManager';
import UniversalInbox from './components/UniversalInbox';
import CampaignComposer from './components/CampaignComposer';
import CsvImporter from './components/CsvImporter';
import QueueControl from './components/QueueControl';
import LeadsTable from './components/LeadsTable';
import LiveLogViewer from './components/LiveLogViewer';
import AntiBanModal from './components/AntiBanModal';
import { StatsAPI, CampaignsAPI } from './api';
import { useSocket } from './context/SocketContext';
import {
  Inbox,
  Layers,
  Sparkles,
  FileSpreadsheet,
  Terminal,
  Shield,
  Zap,
} from 'lucide-react';

export default function App() {
  const { lastEvent } = useSocket();
  const [overview, setOverview] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' | 'accounts' | 'campaigns' | 'leads' | 'logs'
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Fetch initial metrics
  const loadStats = async () => {
    try {
      const data = await StatsAPI.getOverview();
      setOverview(data);
    } catch (e) {
      console.error('Failed to load stats overview:', e);
    }
  };

  const loadCampaigns = async () => {
    try {
      const data = await CampaignsAPI.getAll();
      setCampaigns(data);
      if (data.length > 0 && !activeCampaign) {
        setActiveCampaign(data[0]);
      }
    } catch (e) {
      console.error('Failed to load campaigns:', e);
    }
  };

  useEffect(() => {
    loadStats();
    loadCampaigns();

    const interval = setInterval(() => {
      loadStats();
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  // Sync when socket events fire
  useEffect(() => {
    if (lastEvent) {
      loadStats();
      setRefreshTrigger((prev) => prev + 1);
    }
  }, [lastEvent]);

  const handleCampaignSaved = (savedCampaign) => {
    loadCampaigns();
    setActiveCampaign(savedCampaign);
  };

  const handleLeadImportSuccess = () => {
    loadStats();
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-wa-dark text-wa-light flex flex-col font-sans pb-16">
      {/* Top Navigation */}
      <Navbar
        overviewData={overview}
        onOpenRulesModal={() => setShowRulesModal(true)}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
      />

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 mt-6 space-y-6 flex-1">
        {/* Anti-Ban Distributed Cluster Banner */}
        <div className="rounded-2xl p-4 bg-gradient-to-r from-emerald-950/70 via-wa-card to-cyan-950/70 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Distributed Anti-Ban Cluster Active
                <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                  {overview?.connectedAccounts || 1} Accounts Balanced
                </span>
              </h3>
              <p className="text-xs text-wa-muted">
                Round-robin workload dispatching • 45–90s jitter delay • 12–18m batch cooldown • Auto-blacklist regex interceptor
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowRulesModal(true)}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-wa-card hover:bg-wa-incoming border border-wa-border text-wa-accent whitespace-nowrap transition-colors"
          >
            Review Safety Protocol
          </button>
        </div>

        {/* Real-time Metric Cards */}
        <StatsOverview overview={overview} />

        {/* Queue Execution Engine Control Bar */}
        <QueueControl
          activeCampaign={activeCampaign}
          onQueueAction={() => {
            loadStats();
            setRefreshTrigger((prev) => prev + 1);
          }}
        />

        {/* Tabbed Navigation Bar */}
        <div className="flex items-center justify-between border-b border-wa-border pt-2 overflow-x-auto">
          <div className="flex items-center gap-1 sm:gap-3 min-w-max">
            {/* Universal Shared Inbox Tab */}
            <button
              onClick={() => setActiveTab('inbox')}
              className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-semibold transition-all border-b-2 relative ${
                activeTab === 'inbox'
                  ? 'border-wa-accent text-wa-accent'
                  : 'border-transparent text-wa-muted hover:text-white'
              }`}
            >
              <Inbox className="w-4 h-4" />
              <span>Universal Shared Inbox</span>
              {(overview?.unreadInboxCount || 0) > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-wa-accent text-black ml-1">
                  {overview.unreadInboxCount}
                </span>
              )}
            </button>

            {/* Multi-Account Manager Tab */}
            <button
              onClick={() => setActiveTab('accounts')}
              className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'accounts'
                  ? 'border-wa-accent text-wa-accent'
                  : 'border-transparent text-wa-muted hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Accounts Hub</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-wa-card text-cyan-300 border border-cyan-500/20">
                {overview?.connectedAccounts || 0}/{overview?.totalAccounts || 1}
              </span>
            </button>

            {/* Campaign & Spintax Composer Tab */}
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'campaigns'
                  ? 'border-wa-accent text-wa-accent'
                  : 'border-transparent text-wa-muted hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Campaign & Spintax Composer</span>
            </button>

            {/* Leads Directory & Importer Tab */}
            <button
              onClick={() => setActiveTab('leads')}
              className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'leads'
                  ? 'border-wa-accent text-wa-accent'
                  : 'border-transparent text-wa-muted hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Leads Directory & Importer</span>
            </button>

            {/* Live Anti-Ban Terminal Tab */}
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'logs'
                  ? 'border-wa-accent text-wa-accent'
                  : 'border-transparent text-wa-muted hover:text-white'
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>Live Anti-Ban Terminal</span>
            </button>
          </div>
        </div>

        {/* Tab Content Panes */}
        {activeTab === 'inbox' && (
          <div className="space-y-6">
            <UniversalInbox />
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="space-y-6">
            <AccountManager onAccountsUpdated={() => loadStats()} />
          </div>
        )}

        {activeTab === 'campaigns' && (
          <div className="space-y-6">
            <CampaignComposer
              campaigns={campaigns}
              activeCampaign={activeCampaign}
              onCampaignChange={(camp) => setActiveCampaign(camp)}
              onCampaignSaved={handleCampaignSaved}
            />
          </div>
        )}

        {activeTab === 'leads' && (
          <div className="space-y-6">
            <CsvImporter
              campaigns={campaigns}
              activeCampaignId={activeCampaign?._id}
              onImportSuccess={handleLeadImportSuccess}
            />
            <LeadsTable
              campaigns={campaigns}
              activeCampaignId={activeCampaign?._id}
              refreshTrigger={refreshTrigger}
            />
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-6">
            <LiveLogViewer />
          </div>
        )}
      </main>

      {/* Anti-Ban Architecture Modal */}
      <AntiBanModal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} />
    </div>
  );
}
