import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Terminal, 
  Download, 
  Trash2, 
  RefreshCw,
  Filter,
  Info,
  ChevronRight,
  ChevronLeft,
  Activity
} from 'lucide-react';

import { useEnvironment } from '../context/EnvironmentContext';
import { Card, CardContent } from '../components/ui/Card';
import { Button, Input } from '../components/ui/Input';
import { getApplications, getSystemLogs, clearSystemLogs, exportSystemLogs } from '../services/api';

const LogsPage: React.FC = () => {
  const { selectedEnvironment } = useEnvironment();
  const [logs, setLogs] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(50);
  const [severity, setSeverity] = useState('ALL');
  const [page, setPage] = useState(0);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');


  const [applications, setApplications] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [metadata, setMetadata] = useState({ total: 0, ingestRate: '0 EPS', retentionDays: 30 });

  useEffect(() => {
    if (!selectedEnvironment) return;
    getApplications(selectedEnvironment.id).then(res => {
      const apps = res.data;
      setApplications(apps);
      if (apps.length > 0) setSelectedApp(apps[0]);
      else {
        setSelectedApp(null);
        setLogs([]);
      }
    });
  }, [selectedEnvironment]);

  const fetchLogs = async (silent = false) => {
    if (!selectedApp) return;
    if (!silent) setLoading(true);
    try {
      const response = await getSystemLogs(selectedApp.id, { 
        q: query, 
        severity: severity === 'ALL' ? undefined : severity, 
        size: limit,
        page: page,
        from: fromDate ? (fromDate.length === 16 ? `${fromDate}:00` : fromDate) : undefined,
        to: toDate ? (toDate.length === 16 ? `${toDate}:00` : toDate) : undefined
      });
      setLogs(response.data.logs || []);
      setMetadata({
        total: response.data.total || 0,
        ingestRate: response.data.ingestRate || '0 EPS',
        retentionDays: response.data.retentionDays || 30
      });
    } catch (error) {
      console.error('Failed to fetch logs', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleClearBuffer = async () => {
    if (!selectedApp) return;
    try {
      if (!confirm(`Are you sure you want to clear the Logstash buffer for ${selectedApp.name}?`)) return;
      await clearSystemLogs(selectedApp.id);
      fetchLogs();
    } catch (err: any) {
      alert(`Failed to clear: ${err.response?.data || err.message}`);
    }
  };

  const handleExportCSV = async () => {
    if (!selectedApp) return;
    try {
      const response = await exportSystemLogs(selectedApp.id, { 
        q: query, 
        severity: severity === 'ALL' ? undefined : severity,
        from: fromDate ? (fromDate.length === 16 ? `${fromDate}:00` : fromDate) : undefined,
        to: toDate ? (toDate.length === 16 ? `${toDate}:00` : toDate) : undefined
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const envName = selectedEnvironment?.name?.toLowerCase().replace(/\s+/g, '-') || 'env';
      const appName = selectedApp.name?.toLowerCase().replace(/\s+/g, '-') || 'app';
      const dateStr = new Date().toISOString().replace(/[:.T]/g, '-').slice(0, 19);
      
      link.setAttribute('download', `logs-${envName}-${appName}-${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export logs', error);
      alert('Failed to export logs. Please try again.');
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedApp, limit, severity, page]);

  useEffect(() => {
    setPage(0);
  }, [query, selectedApp, limit, severity, fromDate, toDate]);

  useEffect(() => {
    let interval: any;
    if (isLive && page === 0 && !fromDate && !toDate) {
      interval = setInterval(() => fetchLogs(true), 5000);
    }
    return () => clearInterval(interval);
  }, [selectedApp, query, limit, isLive, page, fromDate, toDate]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchLogs();
  };

  const getSeverityColor = (message: string) => {
    const msg = message.toUpperCase();
    if (msg.includes('ERROR') || msg.includes('FATAL') || msg.includes('CRITICAL')) return 'text-destructive bg-destructive/10 border-destructive/20';
    if (msg.includes('WARN')) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    if (msg.includes('SUCCESS') || msg.includes('OK')) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    return 'text-primary bg-primary/10 border-primary/20';
  };

  return (
    <div className="p-6 h-full flex flex-col space-y-4 animate-in fade-in duration-500 w-full">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">System Logs</h1>
          <p className="text-muted-foreground mt-2 text-lg">Centralized telemetry stream across all environment nodes.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={handleClearBuffer}>
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Buffer
          </Button>
        </div>
      </div>

      {/* Search Console */}
      <Card className="bg-secondary/30 border-white/5">
        <CardContent className="p-4 space-y-4">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search logs (e.g. 'error', 'database', 'auth')..." 
                className="pl-10 h-11 bg-background"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="w-48">
              <select 
                className="w-full h-11 px-3 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={selectedApp?.id || ''}
                onChange={(e) => setSelectedApp(applications.find(a => a.id === Number(e.target.value)))}
              >
                {applications.length === 0 ? <option value="">No Applications Found</option> : null}
                {applications.map(app => (
                  <option key={app.id} value={app.id}>{app.name}</option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <select 
                className="w-full h-11 px-3 rounded-lg bg-background border border-border text-xs font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              >
                <option value={50}>50 Lines</option>
                <option value={100}>100 Lines</option>
                <option value={200}>200 Lines</option>
                <option value={500}>500 Lines</option>
              </select>
            </div>
            <div className="w-32">
              <select 
                className="w-full h-11 px-3 rounded-lg bg-background border border-border text-xs font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
              >
                <option value="ALL">All Levels</option>
                <option value="DEBUG">DEBUG</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
                <option value="FATAL">FATAL</option>
              </select>
            </div>
            <Button type="submit" loading={loading} className="px-8 h-11">
              Search Console
            </Button>
          </form>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest w-12">From</label>
              <Input 
                type="datetime-local" 
                className="h-9 text-xs bg-background" 
                value={fromDate}
                max={toDate || undefined}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest w-12 text-right">To</label>
              <Input 
                type="datetime-local" 
                className="h-9 text-xs bg-background" 
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <Button variant="ghost" size="sm" className="h-9 text-xs ml-auto" onClick={() => { setFromDate(''); setToDate(''); setPage(0); fetchLogs(); }}>
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Terminal View */}
      <Card className="flex-1 min-h-[650px] overflow-hidden flex flex-col border-white/5 bg-[#050505] shadow-2xl">
        <div className="bg-card border-b border-border px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5 border-r border-border pr-4 mr-1">
              <div className="w-3 h-3 rounded-full bg-destructive/50"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500/50"></div>
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5" />
              {selectedApp ? `app-logs-${selectedApp.id}.v1` : 'telemetry_stream'}
            </span>
            <div className="h-4 w-px bg-border"></div>
            <button 
              type="button"
              onClick={() => setIsLive(!isLive)}
              className={`text-[10px] font-mono transition-colors border px-2 py-0.5 rounded cursor-pointer ${isLive ? 'text-primary border-primary/50 bg-primary/10 animate-pulse' : 'text-muted-foreground border-border hover:bg-white/5'}`}
            >
              LIVE
            </button>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
             <div className="flex items-center gap-1.5">
               <Filter className="w-3.5 h-3.5" />
               Raw Output
             </div>
             <RefreshCw className={`w-3.5 h-3.5 cursor-pointer hover:text-primary transition-colors ${loading ? 'animate-spin' : ''}`} onClick={() => fetchLogs()} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto font-mono text-sm scroll-smooth">
          {logs.length > 0 ? (
            <table className="w-full border-collapse table-fixed">
              <thead className="sticky top-0 bg-[#050505] shadow-md z-10">
                <tr className="text-left text-[10px] text-muted-foreground uppercase tracking-widest border-b border-white/5">
                  <th className="px-6 py-3 font-bold w-[120px]">Timestamp</th>
                  <th className="px-6 py-3 font-bold w-[180px]">Source</th>
                  <th className="px-6 py-3 font-bold w-[100px]">Level</th>
                  <th className="px-6 py-3 font-bold">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log, i) => (
                  <tr key={i} className="group hover:bg-white/[0.02] transition-colors leading-tight">
                    <td className="px-6 py-4 text-muted-foreground whitespace-nowrap align-top text-[11px] font-mono">
                      {new Date(log.timestamp || Date.now()).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="max-w-[150px] truncate" title={log.node || 'system'}>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-secondary/50 text-muted-foreground group-hover:text-foreground transition-colors font-mono">
                          {log.node || 'system'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${getSeverityColor(log.severity || 'INFO')}`}>
                        {log.severity || 'INFO'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-foreground/80">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-bold text-[9px] text-primary/60 uppercase tracking-[0.1em]">[{log.errorType || log.category || 'GENERAL'}]</span>
                        <div className="text-[13px] font-medium leading-[1.5] break-words whitespace-pre-wrap selection:bg-primary/30">
                          {log.normalizedSummary || log.rawMessage}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4 opacity-50">
              <Terminal className="w-12 h-12" />
              <p className="text-sm font-medium">No telemetry matches found in current window.</p>
            </div>
          )}
        </div>

        {/* Console Footer */}
        <div className="bg-card border-t border-border px-6 py-3 flex items-center justify-between">
           <div className="flex items-center gap-6 text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
             <span className="flex items-center gap-1.5">
               <Info className="w-3 h-3 text-primary" />
               Retention: {metadata.retentionDays} Days
             </span>
             <span className="flex items-center gap-1.5">
               <Activity className="w-3 h-3 text-emerald-500" />
               Ingest: {metadata.ingestRate}
             </span>
             <span className="flex items-center gap-1.5">
               Total: {metadata.total}
             </span>
           </div>
            <div className="flex items-center gap-2">
             <Button 
               variant="ghost" 
               size="icon" 
               className="h-8 w-8 text-muted-foreground"
               onClick={() => setPage(p => Math.max(0, p - 1))}
               disabled={page === 0}
             >
               <ChevronLeft className="w-4 h-4" />
             </Button>
             <span className="text-xs font-mono text-muted-foreground px-2">Page {page + 1} / {Math.max(1, Math.ceil(metadata.total / limit))}</span>
             <Button 
               variant="ghost" 
               size="icon" 
               className="h-8 w-8 text-muted-foreground"
               onClick={() => setPage(p => p + 1)}
               disabled={(page + 1) * limit >= metadata.total}
             >
               <ChevronRight className="w-4 h-4" />
             </Button>
           </div>
        </div>
      </Card>
    </div>
  );
};

export default LogsPage;
