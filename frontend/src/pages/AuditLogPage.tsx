import React, { useState, useEffect } from 'react';
import { Search, Filter, Calendar, Clock, Download, RefreshCw, ChevronLeft, ChevronRight, Info, AlertCircle, Box, Server, GitBranch, Terminal } from 'lucide-react';
import { Button, Input } from '../components/ui/Input';
import { format } from 'date-fns';
import api from '../services/api';

interface ActivityLog {
  id: number;
  title: string;
  type: string; // incident, system, deployment, infrastructure
  env: string;
  timestamp: string;
  executedBy?: {
    username: string;
  };
}

const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await api.get('/audit-logs', {
        params: {
          page,
          size: 20,
          search: search || undefined,
          type: type === 'all' ? undefined : type,
          from: fromDate ? `${fromDate}T00:00:00` : undefined,
          to: toDate ? `${toDate}T23:59:59` : undefined
        }
      });
      setLogs(response.data.content);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const handleExport = async () => {
    try {
      const response = await api.get('/audit-logs/export', {
        params: {
          search: search || undefined,
          type: type === 'all' ? undefined : type,
          from: fromDate ? `${fromDate}T00:00:00` : undefined,
          to: toDate ? `${toDate}T23:59:59` : undefined
        },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit_logs_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export audit logs:', error);
    }
  };

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchLogs();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'incident': return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'deployment': return <Box className="w-4 h-4 text-blue-400" />;
      case 'infrastructure': return <Server className="w-4 h-4 text-purple-400" />;
      case 'system': return <Settings2 className="w-4 h-4 text-green-400" />;
      default: return <Info className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'incident': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'deployment': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'infrastructure': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'system': return 'bg-green-500/10 text-green-400 border-green-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Audit Log History
          </h1>
          <p className="text-gray-400 mt-1">Complete immutable record of all system activities and modifications.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => fetchLogs()} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button className="gap-2" onClick={handleExport}>
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-6 border border-white/5 bg-white/[0.02]">
        <form onSubmit={handleFilter} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search activity..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">Category</label>
            <select
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="deployment">Deployments</option>
              <option value="infrastructure">Infrastructure</option>
              <option value="incident">Tickets & Incidents</option>
              <option value="system">System Updates</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">From Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                type="date"
                className="pl-10"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">To Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                type="date"
                className="pl-10"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" className="w-full gap-2">
            <Filter className="w-4 h-4" />
            Apply Filters
          </Button>
        </form>
      </div>

      {/* Logs Table */}
      <div className="glass-card overflow-hidden border border-white/5 bg-white/[0.01]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.03] border-b border-white/5">
                <th className="px-6 py-4 text-sm font-semibold text-gray-300">Timestamp</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-300">Category</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-300">Activity</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-300">Environment</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-300">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-8 h-16 bg-white/[0.01]"></td>
                  </tr>
                ))
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-200">{format(new Date(log.timestamp), 'MMM dd, yyyy')}</span>
                        <span className="text-xs text-gray-500">{format(new Date(log.timestamp), 'HH:mm:ss')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getTypeColor(log.type)}`}>
                        {getIcon(log.type)}
                        {log.type.charAt(0).toUpperCase() + log.type.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white/5 group-hover:bg-primary/10 transition-colors">
                          <Terminal className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
                        </div>
                        <span className="text-sm text-gray-300 font-medium">{log.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-400">{log.env}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] text-primary border border-primary/20">
                          {log.executedBy?.username?.charAt(0).toUpperCase() || 'A'}
                        </div>
                        <span className="text-sm text-gray-400">{log.executedBy?.username || 'Admin'}</span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No activity logs found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between bg-white/[0.01]">
          <span className="text-sm text-gray-500">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || loading}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1 || loading}
              onClick={() => setPage(page + 1)}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Mock icon for missing Settings2
const Settings2 = ({ className }: { className?: string }) => (
  <Terminal className={className} />
);

export default AuditLogPage;
