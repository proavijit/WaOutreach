import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Shuffle,
  Send,
  PlusCircle,
  Save,
  Sliders,
  CheckCircle,
  Eye,
  Settings2,
  Copy,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { CampaignsAPI } from '../api';

const DEFAULT_TEMPLATE = `{Hi|Hello|Hey} {{name}},

{Hope you're having a productive week|Hope all is well with you|Quick outreach} at {{company}}!

We help businesses like {{company}} scale their customer engagement with automated multi-channel intelligence. {Would you be open to a 5-minute chat this week?|Are you open to exploring this briefly?|Could we connect for a quick 5-min demo?}

{Best regards|Warmly|Cheers},
WaOutreach Team`;

export default function CampaignComposer({ campaigns, activeCampaign, onCampaignChange, onCampaignSaved }) {
  const [name, setName] = useState('Default Anti-Ban Campaign');
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [selectedId, setSelectedId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Anti-Ban Engine Parameters
  const [config, setConfig] = useState({
    minDelaySeconds: 45,
    maxDelaySeconds: 90,
    batchSize: 15,
    batchCooldownMinutesMin: 12,
    batchCooldownMinutesMax: 18,
    dailyCap: 100,
  });

  // Sample lead data for testing
  const [sampleLead, setSampleLead] = useState({
    name: 'Sarah Connor',
    company: 'Cyberdyne Systems',
  });

  // Spintax variations preview state
  const [variations, setVariations] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Sync when campaigns or activeCampaign change
  useEffect(() => {
    if (activeCampaign) {
      setSelectedId(activeCampaign._id);
      setName(activeCampaign.name);
      setTemplate(activeCampaign.messageTemplate);
      if (activeCampaign.config) {
        setConfig((prev) => ({ ...prev, ...activeCampaign.config }));
      }
    } else if (campaigns && campaigns.length > 0) {
      const first = campaigns[0];
      setSelectedId(first._id);
      setName(first.name);
      setTemplate(first.messageTemplate);
      if (first.config) setConfig((prev) => ({ ...prev, ...first.config }));
    }
  }, [campaigns, activeCampaign]);

  // Generate preview variations whenever template or sampleLead changes
  useEffect(() => {
    const timer = setTimeout(() => {
      handlePreview();
    }, 300);
    return () => clearTimeout(timer);
  }, [template, sampleLead]);

  const handlePreview = async () => {
    if (!template) return;
    setIsGenerating(true);
    try {
      const res = await CampaignsAPI.previewSpintax(template, sampleLead, 4);
      setVariations(res.variations || [res.singlePreview]);
    } catch (e) {
      console.error('Spintax preview error:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectCampaign = (id) => {
    setSelectedId(id);
    if (!id) {
      // New campaign
      setName('New Outreach Campaign');
      setTemplate(DEFAULT_TEMPLATE);
      return;
    }
    const camp = campaigns.find((c) => c._id === id);
    if (camp) {
      setName(camp.name);
      setTemplate(camp.messageTemplate);
      if (camp.config) setConfig((prev) => ({ ...prev, ...camp.config }));
      if (onCampaignChange) onCampaignChange(camp);
    }
  };

  const insertTag = (textToInsert) => {
    setTemplate((prev) => prev + textToInsert);
  };

  const handleSaveCampaign = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      let saved;
      if (selectedId) {
        saved = await CampaignsAPI.update(selectedId, {
          name,
          messageTemplate: template,
          config,
        });
      } else {
        saved = await CampaignsAPI.create({
          name,
          messageTemplate: template,
          config,
        });
        setSelectedId(saved._id);
      }
      setSaveSuccess(true);
      if (onCampaignSaved) onCampaignSaved(saved);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert('Failed saving campaign: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl border border-wa-border p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-wa-border/80">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-wa-accent" /> Campaign Composer & Spintax Engine
          </h2>
          <p className="text-xs text-wa-muted">
            Craft randomized human-like templates to evade WhatsApp spam heuristics
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedId}
            onChange={(e) => handleSelectCampaign(e.target.value)}
            className="flex-1 sm:flex-initial px-3 py-1.5 bg-wa-card border border-wa-border rounded-lg text-xs text-white focus:outline-none focus:border-wa-accent"
          >
            <option value="">+ Create New Campaign</option>
            {campaigns &&
              campaigns.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.status})
                </option>
              ))}
          </select>

          <button
            type="button"
            onClick={() => handleSelectCampaign('')}
            className="p-1.5 rounded-lg bg-wa-card hover:bg-wa-incoming border border-wa-border text-wa-light text-xs flex items-center gap-1"
            title="Create new empty template"
          >
            <PlusCircle className="w-4 h-4 text-wa-accent" />
          </button>
        </div>
      </div>

      <form onSubmit={handleSaveCampaign} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-wa-light mb-1.5">
            Campaign Title
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Q4 SaaS Founders Outreach"
            className="w-full px-3.5 py-2 bg-wa-card border border-wa-border rounded-lg text-sm text-white focus:outline-none focus:border-wa-accent"
          />
        </div>

        {/* Quick Tag Inserters */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-wa-light">
              Message Template (Spintax & Variables)
            </label>
            <span className="text-[11px] text-wa-muted">
              Use <code className="text-wa-accent">{`{A|B|C}`}</code> for Spintax & <code className="text-wa-accent">{`{{name}}`}</code> for variables
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span className="text-[11px] font-mono text-wa-muted mr-1">Insert:</span>
            <button
              type="button"
              onClick={() => insertTag('{{name}}')}
              className="px-2 py-0.5 rounded text-[11px] font-mono bg-wa-card hover:bg-wa-incoming text-emerald-400 border border-emerald-500/30 transition-all"
            >
              + {`{{name}}`}
            </button>
            <button
              type="button"
              onClick={() => insertTag('{{company}}')}
              className="px-2 py-0.5 rounded text-[11px] font-mono bg-wa-card hover:bg-wa-incoming text-cyan-400 border border-cyan-500/30 transition-all"
            >
              + {`{{company}}`}
            </button>
            <button
              type="button"
              onClick={() => insertTag('{Hi|Hello|Hey}')}
              className="px-2 py-0.5 rounded text-[11px] font-mono bg-wa-card hover:bg-wa-incoming text-amber-300 border border-amber-500/30 transition-all"
            >
              + {`{Hi|Hello|Hey}`}
            </button>
            <button
              type="button"
              onClick={() => insertTag('{great|awesome|productive}')}
              className="px-2 py-0.5 rounded text-[11px] font-mono bg-wa-card hover:bg-wa-incoming text-indigo-300 border border-indigo-500/30 transition-all"
            >
              + {`{great|awesome}`}
            </button>
            <button
              type="button"
              onClick={() => insertTag('{{name|there}}')}
              className="px-2 py-0.5 rounded text-[11px] font-mono bg-wa-card hover:bg-wa-incoming text-purple-300 border border-purple-500/30 transition-all"
            >
              + Fallback {`{{name|there}}`}
            </button>
          </div>

          <textarea
            rows={7}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            required
            className="w-full px-3.5 py-2.5 bg-wa-card border border-wa-border rounded-xl text-sm font-sans text-white focus:outline-none focus:border-wa-accent leading-relaxed"
          />
        </div>

        {/* Anti-Ban Safety Parameters Drawer */}
        <div className="rounded-xl border border-wa-border bg-wa-panel/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-wa-light hover:bg-wa-incoming/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-wa-accent" />
              <span>Anti-Ban Safety Guardrails & Throttling Settings</span>
            </div>
            {showConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showConfig && (
            <div className="p-4 border-t border-wa-border space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-wa-muted mb-1">
                    Jitter Delay Min (sec)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={config.minDelaySeconds}
                    onChange={(e) => setConfig({ ...config, minDelaySeconds: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-wa-card border border-wa-border rounded text-white font-mono"
                  />
                  <p className="text-[10px] text-wa-muted mt-0.5">Constraint: 45s safe min</p>
                </div>

                <div>
                  <label className="block text-wa-muted mb-1">
                    Jitter Delay Max (sec)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="300"
                    value={config.maxDelaySeconds}
                    onChange={(e) => setConfig({ ...config, maxDelaySeconds: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-wa-card border border-wa-border rounded text-white font-mono"
                  />
                  <p className="text-[10px] text-wa-muted mt-0.5">Constraint: 90s safe max</p>
                </div>

                <div>
                  <label className="block text-wa-muted mb-1">
                    Batch Size (msgs)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={config.batchSize}
                    onChange={(e) => setConfig({ ...config, batchSize: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-wa-card border border-wa-border rounded text-white font-mono"
                  />
                  <p className="text-[10px] text-wa-muted mt-0.5">Constraint: 15 per batch</p>
                </div>

                <div>
                  <label className="block text-wa-muted mb-1">
                    Batch Cooldown Min (mins)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={config.batchCooldownMinutesMin}
                    onChange={(e) => setConfig({ ...config, batchCooldownMinutesMin: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-wa-card border border-wa-border rounded text-white font-mono"
                  />
                  <p className="text-[10px] text-wa-muted mt-0.5">Constraint: 12 mins</p>
                </div>

                <div>
                  <label className="block text-wa-muted mb-1">
                    Batch Cooldown Max (mins)
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="120"
                    value={config.batchCooldownMinutesMax}
                    onChange={(e) => setConfig({ ...config, batchCooldownMinutesMax: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-wa-card border border-wa-border rounded text-white font-mono"
                  />
                  <p className="text-[10px] text-wa-muted mt-0.5">Constraint: 18 mins</p>
                </div>

                <div>
                  <label className="block text-wa-muted mb-1">
                    24h Hard Cap (msgs)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={config.dailyCap}
                    onChange={(e) => setConfig({ ...config, dailyCap: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-wa-card border border-wa-border rounded text-white font-mono"
                  />
                  <p className="text-[10px] text-wa-muted mt-0.5">Hard limit: 100 msgs/24h</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Spintax Tester Preview Section */}
        <div className="pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Live Spintax Variations Preview
              </h3>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-wa-muted">Test Lead:</span>
              <input
                type="text"
                placeholder="Name"
                value={sampleLead.name}
                onChange={(e) => setSampleLead({ ...sampleLead, name: e.target.value })}
                className="px-2 py-0.5 bg-wa-card border border-wa-border rounded text-white w-24 text-xs font-medium"
              />
              <input
                type="text"
                placeholder="Company"
                value={sampleLead.company}
                onChange={(e) => setSampleLead({ ...sampleLead, company: e.target.value })}
                className="px-2 py-0.5 bg-wa-card border border-wa-border rounded text-white w-32 text-xs font-medium"
              />
              <button
                type="button"
                onClick={handlePreview}
                title="Shuffle variations"
                className="p-1 rounded bg-wa-card hover:bg-wa-incoming border border-wa-border text-wa-accent"
              >
                <Shuffle className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {variations.length > 0 ? (
              variations.map((v, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-wa-panel/80 border border-wa-border relative group hover:border-wa-accent/40 transition-all text-xs"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[10px] text-cyan-400 font-semibold bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
                      Sample Variation #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(v)}
                      title="Copy message preview"
                      className="opacity-0 group-hover:opacity-100 p-1 text-wa-muted hover:text-white transition-opacity"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-wa-light font-sans whitespace-pre-wrap leading-relaxed">
                    {v}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 py-4 text-center text-xs text-wa-muted">
                Type your spintax template above to preview live randomized outputs.
              </div>
            )}
          </div>
        </div>

        {/* Submit / Save Bar */}
        <div className="flex items-center justify-between pt-3 border-t border-wa-border">
          <span className="text-xs text-wa-muted">
            {saveSuccess && (
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Campaign saved successfully!
              </span>
            )}
          </span>

          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-wa-accent hover:bg-wa-accentHover text-black transition-all shadow-glow-accent disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Campaign Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
