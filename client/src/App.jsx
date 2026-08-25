import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ShieldCheck, ShieldAlert, Clock, Ban, TrendingUp, 
  RotateCcw, Download, Plus, DollarSign, Activity, AlertTriangle, CheckCircle, XCircle
} from 'lucide-react';

export default function App() {
  const [passports, setPassports] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [adjustingCapId, setAdjustingCapId] = useState(null);
  const [newCapValue, setNewCapValue] = useState('');
  const [resolvingId, setResolvingId] = useState(null);

  // Fetch Passports and Audit Logs
  const fetchData = async () => {
    try {
      const [passRes, auditRes] = await Promise.all([
        axios.get('/passports'),
        axios.get('/audit-log')
      ]);
      setPassports(passRes.data);
      setAuditLogs(auditRes.data);
    } catch (err) {
      console.error('Error fetching console data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Poll every 2.5 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2500);
    return () => clearInterval(interval);
  }, []);

  // Quick Seed DB for demo
  const handleSeedDemo = async () => {
    try {
      setLoading(true);
      await axios.post('/api/seed');
      await fetchData();
    } catch (err) {
      alert('Failed to seed demo data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Trigger a needs-approval transaction for demoing
  const handleTriggerNeedsApproval = async () => {
    try {
      await axios.post('/transaction-request', {
        agentId: passports[0]?.agentId || 'agent-alpha',
        sku: 'SKU-GADGET-HIGHVAL',
        amount: 1800,
        category: 'gadgets',
        flagNeedsApproval: true
      });
      fetchData();
    } catch (err) {
      alert('Failed to trigger approval request: ' + err.message);
    }
  };

  // Revoke Passport
  const handleRevoke = async (id) => {
    try {
      await axios.patch(`/passports/${id}`, { status: 'revoked' });
      fetchData();
    } catch (err) {
      alert('Failed to revoke passport: ' + err.message);
    }
  };

  // Reactivate Passport
  const handleReactivate = async (id) => {
    try {
      await axios.patch(`/passports/${id}`, { status: 'active' });
      fetchData();
    } catch (err) {
      alert('Failed to reactivate passport: ' + err.message);
    }
  };

  // Adjust Spend Cap
  const handleAdjustCap = async (id) => {
    const val = Number(newCapValue);
    if (isNaN(val) || val < 0) return alert('Please enter a valid positive amount.');
    try {
      await axios.patch(`/passports/${id}`, { spendCap: val });
      setAdjustingCapId(null);
      setNewCapValue('');
      fetchData();
    } catch (err) {
      alert('Failed to update spend cap: ' + err.message);
    }
  };

  // Resolve pending "needs-approval" log
  const handleResolveDecision = async (logId, action) => {
    try {
      setResolvingId(logId);
      await axios.patch(`/audit-log/${logId}/resolve`, { action });
      await fetchData();
    } catch (err) {
      alert('Failed to resolve decision: ' + (err.response?.data?.error || err.message));
    } finally {
      setResolvingId(null);
    }
  };

  // Export Audit Logs as CSV
  const exportCSV = () => {
    if (!auditLogs.length) return alert('No logs available to export.');
    const headers = ['Timestamp', 'Agent ID', 'Decision', 'Amount (INR)', 'SKU', 'Reason', 'Razorpay Order ID'];
    const rows = auditLogs.map(log => [
      new Date(log.timestamp).toLocaleString(),
      log.agentId,
      log.decision.toUpperCase(),
      log.request?.amount || 0,
      log.request?.sku || 'N/A',
      `"${log.reason.replace(/"/g, '""')}"`,
      log.razorpayOrderId || 'N/A'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `agentpass_audit_log_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter logs by selected agent
  const filteredLogs = selectedAgent === 'all' 
    ? auditLogs 
    : auditLogs.filter(l => l.agentId === selectedAgent);

  // Compute analytics
  const totalDecisions = auditLogs.length;
  const totalAllowed = auditLogs.filter(l => l.decision === 'allow').length;
  const totalDenied = auditLogs.filter(l => l.decision === 'deny').length;
  const pendingApprovals = auditLogs.filter(l => l.decision === 'needs-approval').length;
  const denialRate = totalDecisions > 0 ? ((totalDenied / totalDecisions) * 100).toFixed(1) : 0;
  const totalVolume = auditLogs
    .filter(l => l.decision === 'allow')
    .reduce((sum, l) => sum + (l.request?.amount || 0), 0);

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Header Bar */}
      <header className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                AgentPass <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-widest ml-2">Merchant Console</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">Scoped Identity &amp; Consent Layer for Autonomous AI Commerce</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-live"></span>
            <span>Live Polling (2.5s)</span>
          </div>

          <button 
            onClick={handleTriggerNeedsApproval}
            className="flex items-center space-x-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            title="Simulate a flagged request requiring manual approval"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Simulate Approval Request</span>
          </button>

          <button 
            onClick={handleSeedDemo} 
            className="flex items-center space-x-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Seed</span>
          </button>

          <button 
            onClick={exportCSV} 
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto mt-6 space-y-6">

        {/* Analytics Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Active Passports</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-100">
              {passports.filter(p => p.status === 'active').length} <span className="text-xs text-slate-500 font-normal">/ {passports.length} Total</span>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Approved Volume</span>
              <TrendingUp className="w-4 h-4 text-blue-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-400">
              ₹{totalVolume.toLocaleString()}
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Pending Approvals</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-400">
              {pendingApprovals} <span className="text-xs text-slate-500 font-normal">Requires Action</span>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Denial Rate</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-rose-400">
              {denialRate}% <span className="text-xs text-slate-500 font-normal">({totalDenied} Blocked)</span>
            </div>
          </div>
        </div>

        {/* Section Grid: Passports + Live Audit Log */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column: Active Passports (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center space-x-2">
                <span>Agent Passports &amp; Permissions</span>
                <span className="text-xs font-normal bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{passports.length}</span>
              </h2>
            </div>

            {loading && passports.length === 0 ? (
              <div className="glass-panel p-8 text-center rounded-xl text-slate-500 animate-pulse">
                Loading Agent Passports...
              </div>
            ) : passports.length === 0 ? (
              <div className="glass-panel p-8 text-center rounded-xl border border-dashed border-slate-800">
                <p className="text-slate-400 text-sm">No passports active.</p>
                <button onClick={handleSeedDemo} className="mt-3 bg-blue-600 text-white text-xs px-4 py-2 rounded-lg font-medium">
                  Seed Demo Passport
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {passports.map((passport) => {
                  const percentSpent = Math.min(100, Math.round((passport.spentSoFar / passport.spendCap) * 100) || 0);
                  const isRevoked = passport.status === 'revoked';

                  return (
                    <div 
                      key={passport._id} 
                      className={`glass-panel p-5 rounded-2xl border transition-all ${
                        isRevoked ? 'border-rose-900/40 bg-slate-900/40 opacity-75' : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-100 text-base">{passport.agentId}</span>
                            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                              isRevoked 
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {passport.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">Acting for: <strong className="text-slate-300 font-medium">{passport.actingFor}</strong></p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center space-x-2">
                          {isRevoked ? (
                            <button
                              onClick={() => handleReactivate(passport._id)}
                              className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-lg text-xs font-medium transition"
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRevoke(passport._id)}
                              className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 px-3 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
                            >
                              <Ban className="w-3 h-3" />
                              <span>Revoke</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setAdjustingCapId(passport._id);
                              setNewCapValue(passport.spendCap);
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1 rounded-lg text-xs font-medium transition"
                          >
                            Adjust Cap
                          </button>
                        </div>
                      </div>

                      {/* Cap Adjust Form */}
                      {adjustingCapId === passport._id && (
                        <div className="mt-4 p-3 bg-slate-900/90 rounded-xl border border-blue-500/30 flex items-center space-x-2 animate-fadeIn">
                          <span className="text-xs text-slate-400">New Cap (₹):</span>
                          <input 
                            type="number" 
                            value={newCapValue} 
                            onChange={(e) => setNewCapValue(e.target.value)}
                            className="bg-slate-950 text-white text-xs px-3 py-1.5 rounded-lg border border-slate-700 w-32 focus:outline-none focus:border-blue-500"
                          />
                          <button 
                            onClick={() => handleAdjustCap(passport._id)}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                          >
                            Save Cap
                          </button>
                          <button 
                            onClick={() => setAdjustingCapId(null)}
                            className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1.5"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {/* Spend Progress Bar */}
                      <div className="mt-4 space-y-1.5">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-slate-400">Spend Cap Usage</span>
                          <span className="text-slate-200 font-mono">
                            ₹{passport.spentSoFar.toLocaleString()} / <strong className="text-white">₹{passport.spendCap.toLocaleString()}</strong> ({percentSpent}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-800">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              percentSpent >= 100 
                                ? 'bg-rose-500' 
                                : percentSpent > 75 
                                ? 'bg-amber-500' 
                                : 'bg-gradient-to-r from-blue-500 to-emerald-400'
                            }`}
                            style={{ width: `${percentSpent}%` }}
                          />
                        </div>
                      </div>

                      {/* Scope & Details Tags */}
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs border-t border-slate-800/80 pt-3">
                        <div>
                          <span className="text-slate-500 text-[11px] block">Allowed Categories</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {passport.allowedCategories?.length ? (
                              passport.allowedCategories.map((c, i) => (
                                <span key={i} className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[11px] font-mono border border-slate-700">
                                  {c}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-500 font-mono">All</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <span className="text-slate-500 text-[11px] block">Allowed SKUs</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {passport.allowedSkus?.length ? (
                              passport.allowedSkus.map((s, i) => (
                                <span key={i} className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[11px] font-mono border border-slate-700">
                                  {s}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-500 font-mono">All</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Live Audit Trail Timeline (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center space-x-2">
                <span>Live Audit Trail</span>
                <span className="text-xs font-normal bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{filteredLogs.length}</span>
              </h2>

              {/* Agent Filter Selector */}
              <select 
                value={selectedAgent} 
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="bg-slate-900 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Agents</option>
                {[...new Set(auditLogs.map(l => l.agentId))].map(agentId => (
                  <option key={agentId} value={agentId}>{agentId}</option>
                ))}
              </select>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800 max-h-[640px] overflow-y-auto space-y-3">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  No decision log entries recorded yet.
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const isAllow = log.decision === 'allow';
                  const isDeny = log.decision === 'deny';
                  const isPending = log.decision === 'needs-approval';

                  return (
                    <div 
                      key={log._id} 
                      className={`p-3.5 rounded-xl border transition-all text-xs space-y-2 ${
                        isAllow 
                          ? 'bg-emerald-950/20 border-emerald-900/30 hover:border-emerald-800/50' 
                          : isDeny 
                          ? 'bg-rose-950/20 border-rose-900/30 hover:border-rose-800/50' 
                          : 'bg-amber-950/30 border-amber-500/40 shadow-lg shadow-amber-500/5'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px] ${
                            isAllow ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : isDeny ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                          }`}>
                            {log.decision}
                          </span>
                          <span className="font-semibold text-slate-200">{log.agentId}</span>
                        </div>
                        <span className="text-slate-500 text-[11px] font-mono">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>

                      {/* Request Summary */}
                      <div className="flex justify-between items-center text-slate-300 font-mono">
                        <span>SKU: {log.request?.sku || 'N/A'}</span>
                        <span className="font-bold text-white">₹{log.request?.amount}</span>
                      </div>

                      {/* Plain Language Reason */}
                      <p className="text-slate-400 text-xs italic bg-slate-950/50 p-2 rounded-lg border border-slate-900/80">
                        "{log.reason}"
                      </p>

                      {/* Needs Approval Action Buttons */}
                      {isPending && (
                        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-amber-500/20">
                          <button
                            disabled={resolvingId === log._id}
                            onClick={() => handleResolveDecision(log._id, 'deny')}
                            className="flex items-center space-x-1 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 px-3 py-1 rounded-lg font-semibold transition"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject Request</span>
                          </button>
                          <button
                            disabled={resolvingId === log._id}
                            onClick={() => handleResolveDecision(log._id, 'approve')}
                            className="flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1 rounded-lg transition"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Approve Purchase</span>
                          </button>
                        </div>
                      )}

                      {/* Razorpay Order ID if present */}
                      {log.razorpayOrderId && (
                        <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400/90 pt-1 border-t border-emerald-900/30">
                          <span>Razorpay Order ID:</span>
                          <span className="font-bold">{log.razorpayOrderId}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
