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
import api from '../services/api';
import { useEnvironment } from '../context/EnvironmentContext';
import { Card, CardContent } from '../components/ui/Card';
import { Button, Input } from '../components/ui/Input';

const LogsPage: React.FC = () => {
  const { selectedEnvironment } = useEnvironment();
  const [logs, setLogs] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(50);

  const fetchLogs = async () => {
    if (!selectedEnvironment) return;
    setLoading(true);
    try {
      const response = await api.get('/logs/search', {
        params: { environmentId: selectedEnvironment.id, query, limit }
      });
      setLogs(response.data);
    } catch (error) {
      console.error('Failed to fetch logs', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedEnvironment]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="p-8 h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">System Logs</h1>
          <p className="text-muted-foreground mt-2 text-lg">Centralized telemetry stream across all environment nodes.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Buffer
          </Button>
        </div>
      </div>

      {/* Search Console */}
      <Card className="bg-secondary/30 border-white/5">
        <CardContent className="p-4">
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
            <div className="w-32">
              <select 
                className="w-full h-11 px-3 rounded-lg bg-background border border-border text-xs font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              >
                <option value={50}>50 Lines</option>
                <option value={100}>100 Lines</option>
                <option value={200}>200 Lines</option>
              </select>
            </div>
            <Button type="submit" loading={loading} className="px-8 h-11">
              Search Console
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Terminal View */}
      <Card className="flex-1 overflow-hidden flex flex-col border-white/5 bg-[#050505]">
        <div className="bg-card border-b border-border px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5 border-r border-border pr-4 mr-1">
              <div className="w-3 h-3 rounded-full bg-destructive/50"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500/50"></div>
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5" />
              telemetry_stream.v1
            </span>
            <div className="h-4 w-px bg-border"></div>
            <span className="text-[10px] font-mono text-primary animate-pulse">LIVE</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
             <div className="flex items-center gap-1.5">
               <Filter className="w-3.5 h-3.5" />
               Raw Output
             </div>
             <RefreshCw className={`w-3.5 h-3.5 cursor-pointer hover:text-primary transition-colors ${loading ? 'animate-spin' : ''}`} onClick={fetchLogs} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto font-mono text-sm scroll-smooth">
          {logs.length > 0 ? (
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-[#050505] shadow-md z-10">
                <tr className="text-left text-[10px] text-muted-foreground uppercase tracking-widest border-b border-white/5">
                  <th className="px-6 py-3 font-bold">Timestamp</th>
                  <th className="px-6 py-3 font-bold">Source</th>
                  <th className="px-6 py-3 font-bold">Level</th>
                  <th className="px-6 py-3 font-bold">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log, i) => (
                  <tr key={i} className="group hover:bg-white/[0.02] transition-colors leading-tight">
                    <td className="px-6 py-3 text-muted-foreground whitespace-nowrap align-top">
                      {new Date(log.timestamp || Date.now()).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-3 align-top whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-secondary/50 text-muted-foreground group-hover:text-foreground transition-colors">
                        {log.app || 'system'}
                      </span>
                    </td>
                    <td className="px-6 py-3 align-top">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getSeverityColor(log.message)}`}>
                        {log.message.split(' ')[0].replace(':', '')}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-foreground/80 break-all pr-12">
                      {log.message}
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
               Retention: 30 Days
             </span>
             <span className="flex items-center gap-1.5">
               <Activity className="w-3 h-3 text-emerald-500" />
               Ingest: 14.2k eps
             </span>
           </div>
           <div className="flex items-center gap-2">
             <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><ChevronLeft className="w-4 h-4" /></Button>
             <span className="text-xs font-mono text-muted-foreground px-2">Page 1 / 1</span>
             <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><ChevronRight className="w-4 h-4" /></Button>
           </div>
        </div>
      </Card>
    </div>
  );
};

export default LogsPage;
