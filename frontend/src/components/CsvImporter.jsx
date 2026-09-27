import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, Download, X } from 'lucide-react';
import { LeadsAPI } from '../api';

export default function CsvImporter({ campaigns, activeCampaignId, onImportSuccess }) {
  const [file, setFile] = useState(null);
  const [campaignId, setCampaignId] = useState(activeCampaignId || '');
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv') || droppedFile.type === 'text/csv') {
        setFile(droppedFile);
        setError(null);
      } else {
        setError('Please upload a valid .csv file format');
      }
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please choose a CSV file first');
      return;
    }

    setIsUploading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    if (campaignId) formData.append('campaignId', campaignId);

    try {
      const res = await LeadsAPI.importCsv(formData);
      setResult(res);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (onImportSuccess) onImportSuccess();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const downloadSampleCsv = () => {
    const csvContent =
      'phone,name,company,role\n' +
      '14155552671,Sarah Jenkins,Apex Labs,VP Product\n' +
      '447123456789,Marcus Chen,Quantum Bio,Founder\n' +
      '919876543210,Aarav Patel,FinEdge,Director\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sample_waoutreach_leads.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="glass-card rounded-2xl border border-wa-border p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-wa-border/80">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" /> CSV Lead Importer
          </h2>
          <p className="text-xs text-wa-muted">
            Batch import targeted leads with automatic deduplication & anti-ban blacklist protection
          </p>
        </div>

        <button
          type="button"
          onClick={downloadSampleCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-wa-card hover:bg-wa-incoming border border-wa-border text-wa-light transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-wa-accent" />
          <span>Download Sample CSV</span>
        </button>
      </div>

      <form onSubmit={handleUpload} className="space-y-4">
        {/* Campaign assignment */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-xs font-semibold text-wa-light whitespace-nowrap">
            Assign to Campaign:
          </label>
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-wa-card border border-wa-border rounded-lg text-xs text-white focus:outline-none focus:border-wa-accent"
          >
            <option value="">-- No specific campaign (Global Leads Queue) --</option>
            {campaigns &&
              campaigns.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            file
              ? 'border-wa-accent bg-wa-accent/5'
              : 'border-wa-border hover:border-wa-accent/60 bg-wa-panel/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-wa-card border border-wa-border flex items-center justify-center text-wa-accent">
              <UploadCloud className="w-6 h-6" />
            </div>

            {file ? (
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white flex items-center justify-center gap-2">
                  <span>{file.name}</span>
                  <span className="text-xs text-wa-muted font-mono">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <p className="text-xs text-wa-accent font-medium">
                  File ready for ingestion. Click upload below.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white">
                  Drop your CSV file here, or <span className="text-wa-accent underline">browse</span>
                </div>
                <p className="text-xs text-wa-muted">
                  Supports headers: <code className="text-wa-light">phone, name, company, [any custom]</code>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-lg text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success message */}
        {result && (
          <div className="p-3.5 rounded-lg text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-1">
            <div className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{result.message}</span>
            </div>
            <div className="text-[11px] text-emerald-400/90 pl-6">
              Total Parsed: {result.data?.totalParsed} • Imported: {result.data?.importedCount} • Skipped: {result.data?.skippedCount}
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-end gap-2">
          {file && (
            <button
              type="button"
              onClick={() => {
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-wa-card hover:bg-wa-incoming border border-wa-border text-wa-light"
            >
              Clear
            </button>
          )}

          <button
            type="submit"
            disabled={!file || isUploading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-wa-accent hover:bg-wa-accentHover text-black transition-all shadow-glow-accent disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4" />
            <span>{isUploading ? 'Ingesting Leads...' : 'Import Leads to Queue'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
