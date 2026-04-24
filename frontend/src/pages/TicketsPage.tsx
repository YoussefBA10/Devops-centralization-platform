import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  ArrowRight,
  History,
  Star
} from 'lucide-react';
import api from '../services/api';
import { useEnvironment } from '../context/EnvironmentContext';
import type { Ticket, Application, TopologyData } from '../types/index';
import { Card, CardContent } from '../components/ui/Card';
import { Button, Input } from '../components/ui/Input';

const TicketsPage: React.FC = () => {
  const { selectedEnvironment } = useEnvironment();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'>('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({ title: '', description: '', priority: 'LOW', node: '', applicationId: '' });
  const [applications, setApplications] = useState<Application[]>([]);
  const [topology, setTopology] = useState<TopologyData | null>(null);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  useEffect(() => {
    const fetchFormData = async () => {
      if (!selectedEnvironment) return;
      try {
        const [appRes, topRes] = await Promise.all([
          api.get<Application[]>(`/applications?environmentId=${selectedEnvironment.id}`),
          api.get<TopologyData>(`/infrastructure/global/topology?environmentId=${selectedEnvironment.id}`)
        ]);
        setApplications(appRes.data);
        setTopology(topRes.data);
      } catch (err) {
        console.error('Failed to fetch form data', err);
      }
    };
    fetchFormData();
  }, [selectedEnvironment]);

  const fetchTickets = async () => {
    if (!selectedEnvironment) return;
    setLoading(true);
    try {
      const response = await api.get<Ticket[]>(`/tickets?environmentId=${selectedEnvironment.id}`);
      setTickets(response.data);
    } catch (error) {
      console.error('Failed to fetch tickets', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (ticketId: number, status: string) => {
    try {
      await api.put(`/tickets/${ticketId}/status`, null, { params: { status } });
      fetchTickets();
    } catch (error) {
      console.error('Failed to update ticket status', error);
    }
  };

  const raiseTicket = async () => {
    if (!selectedEnvironment || !newTicket.title.trim()) return;
    try {
      await api.post('/tickets', {
        title: newTicket.title,
        description: newTicket.description,
        priority: newTicket.priority,
        node: newTicket.node || undefined,
        applicationId: newTicket.applicationId ? parseInt(newTicket.applicationId) : undefined,
        environmentId: selectedEnvironment.id
      });
      setIsModalOpen(false);
      setNewTicket({ title: '', description: '', priority: 'LOW', node: '', applicationId: '' });
      fetchTickets();
    } catch (error) {
      console.error('Failed to raise ticket', error);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [selectedEnvironment]);

  const filteredTickets = tickets.filter(t => filter === 'ALL' || t.status === filter);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'IN_PROGRESS': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'RESOLVED': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default: return 'bg-secondary text-muted-foreground';
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Incident Management</h1>
          <p className="text-muted-foreground mt-2 text-lg">Track, triage, and resolve environment-level infrastructure issues.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchTickets} loading={loading}>
            <History className="w-4 h-4" />
          </Button>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4" />
            Raise Ticket
          </Button>
        </div>
      </div>

      {/* Raise Ticket Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="w-full max-w-md bg-card/95 border-primary/20 shadow-2xl">
            <CardContent className="p-6 space-y-6">
              <div>
                <h3 className="text-xl font-bold tracking-tight">Raise Incident Ticket</h3>
                <p className="text-sm text-muted-foreground mt-1">Describe the issue affecting {selectedEnvironment?.name}.</p>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Title</label>
                  <Input 
                    placeholder="e.g., Database connection timeout" 
                    value={newTicket.title}
                    onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Description</label>
                  <textarea 
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Provide details about the incident..."
                    value={newTicket.description}
                    onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Priority</label>
                    <select 
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={newTicket.priority}
                      onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                    >
                      <option value="LOW" className="bg-background">Low</option>
                      <option value="MEDIUM" className="bg-background">Medium</option>
                      <option value="HIGH" className="bg-background">High</option>
                      <option value="CRITICAL" className="bg-background text-destructive">Critical</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Application</label>
                    <select 
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={newTicket.applicationId}
                      onChange={(e) => setNewTicket({ ...newTicket, applicationId: e.target.value })}
                    >
                      <option value="" className="bg-background">General (No App)</option>
                      {applications.map(app => (
                        <option key={app.id} value={app.id} className="bg-background">{app.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Target Node</label>
                  <select 
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={newTicket.node}
                    onChange={(e) => setNewTicket({ ...newTicket, node: e.target.value })}
                  >
                    <option value="" className="bg-background">Cluster-wide (No specific node)</option>
                    {topology?.nodes.map(node => (
                      <option key={node.id} value={node.label} className="bg-background">{node.label} ({node.ip})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-border">
                <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button onClick={raiseTicket} disabled={!newTicket.title.trim()}>Submit Ticket</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Kanban/List Layout */}
      <div className="flex flex-col gap-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-2 bg-secondary/50 rounded-xl border border-border">
          <div className="flex items-center gap-1">
            {(['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  filter === s ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 pr-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Search incidents..." className="h-9 w-64 pl-9 bg-background border-none shadow-none text-xs" />
            </div>
            <Button variant="ghost" size="sm">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Tickets List */}
        <div className="grid grid-cols-1 gap-4">
          {filteredTickets.length > 0 ? (
            filteredTickets.map((ticket) => (
              <Card key={ticket.id} className="group hover:border-primary/30 transition-all">
                <CardContent className="p-0">
                  <div className="flex items-center p-6 gap-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary font-bold text-lg text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      {ticket.id}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold truncate">{ticket.title}</h3>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border ${getStatusStyle(ticket.status)}`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                        {ticket.node && <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-md ml-2">{ticket.node}</span>}
                        {ticket.application && <span className="text-xs text-muted-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-md ml-1">{ticket.application.name}</span>}
                      </div>
                      <p className="text-sm text-muted-foreground truncate max-w-2xl">{ticket.description}</p>
                    </div>

                    <div className="flex items-center gap-8 text-xs font-medium text-muted-foreground">
                      <div className="flex flex-col gap-1 items-end">
                         <span className="uppercase tracking-widest text-[9px] font-bold">Priority</span>
                         <span className={`font-bold ${ticket.priority === 'CRITICAL' ? 'text-destructive' : ticket.priority === 'HIGH' ? 'text-amber-500' : 'text-primary'}`}>
                           {ticket.priority || 'LOW'}
                         </span>
                      </div>
                      <div className="flex flex-col gap-1 items-end min-w-[100px]">
                         <span className="uppercase tracking-widest text-[9px] font-bold">Created</span>
                         <span className="flex items-center gap-1.5 whitespace-nowrap">
                           <Clock className="w-3 h-3" />
                           {new Date(ticket.createdAt).toLocaleDateString()}
                         </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pl-4 border-l border-border h-12">
                      <Button 
                         variant="secondary" 
                         size="sm" 
                         className="h-9 px-3"
                         onClick={() => updateStatus(ticket.id, ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status === 'IN_PROGRESS' ? 'RESOLVED' : 'OPEN')}
                      >
                         {ticket.status === 'RESOLVED' ? 'Reopen' : 'Advance'}
                         <ArrowRight className="w-3.5 h-3.5 ml-2" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className={`h-9 w-9 ${favorites.has(ticket.id) ? 'text-amber-500' : 'text-muted-foreground'}`}
                        onClick={() => {
                          const next = new Set(favorites);
                          if (next.has(ticket.id)) next.delete(ticket.id);
                          else next.add(ticket.id);
                          setFavorites(next);
                        }}
                      >
                        <Star className="w-4 h-4" fill={favorites.has(ticket.id) ? 'currentColor' : 'none'} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
                <Plus className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Zero Active Incidents</h3>
                <p className="text-muted-foreground">The current environment is operating within stability thresholds.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketsPage;
