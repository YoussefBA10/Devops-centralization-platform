import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  ArrowRight,
  History,
  Star,
  Edit,
  Trash2,
  X,
  Eye
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useEnvironment } from '../context/EnvironmentContext';
import { useCluster } from '../context/ClusterContext';
import type { Ticket, Application, TopologyData } from '../types/index';
import { Card, CardContent } from '../components/ui/Card';
import { Button, Input } from '../components/ui/Input';

const TicketsPage: React.FC = () => {
  const { selectedEnvironment } = useEnvironment();
  const { selectedCluster } = useCluster();
  const { permissions, isAdmin } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'>('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState<number | null>(null);
  const [newTicket, setNewTicket] = useState({ title: '', description: '', priority: 'LOW', node: '', applicationId: '' });
  const [applications, setApplications] = useState<Application[]>([]);
  const [topology, setTopology] = useState<TopologyData | null>(null);
  const [favorites, setFavorites] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('monetique_ticket_favs');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [viewingTicket, setViewingTicket] = useState<Ticket | null>(null);

  const canEdit = isAdmin || permissions?.incidents?.edit;
  const canDelete = isAdmin || permissions?.incidents?.delete;
  const canCreate = isAdmin || permissions?.incidents?.create;

  useEffect(() => {
    const fetchFormData = async () => {
      if (!selectedEnvironment) return;
      try {
        const [appRes, nodeRes] = await Promise.all([
          api.get<Application[]>(`/applications?environmentId=${selectedEnvironment.id}`),
          api.get<any[]>(`/environments/${selectedEnvironment.id}/nodes`)
        ]);
        setApplications(appRes.data);
        setTopology({
          nodes: nodeRes.data.map(n => ({
            id: n.ip,
            label: n.nodeName,
            ip: n.ip,
            type: 'node'
          })),
          edges: [],
          clusters: []
        });
      } catch (err) {
        console.error('Failed to fetch form data', err);
      }
    };
    fetchFormData();
  }, [selectedEnvironment]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const url = selectedCluster && selectedEnvironment 
        ? `/tickets?environmentId=${selectedEnvironment.id}` 
        : '/tickets?clusters=all';
      const response = await api.get<Ticket[]>(url);
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
      if (isEditing && editingTicketId) {
        await api.put(`/tickets/${editingTicketId}`, {
          ...newTicket,
          applicationId: newTicket.applicationId ? parseInt(newTicket.applicationId) : null,
          environmentId: selectedEnvironment.id
        });
      } else {
        await api.post('/tickets', {
          title: newTicket.title,
          description: newTicket.description,
          priority: newTicket.priority,
          node: newTicket.node || undefined,
          applicationId: newTicket.applicationId ? parseInt(newTicket.applicationId) : undefined,
          environmentId: selectedEnvironment.id
        });
      }
      setIsModalOpen(false);
      setIsEditing(false);
      setEditingTicketId(null);
      setNewTicket({ title: '', description: '', priority: 'LOW', node: '', applicationId: '' });
      fetchTickets();
    } catch (error) {
      console.error('Failed to save ticket', error);
    }
  };

  const handleEditClick = (ticket: Ticket) => {
    setNewTicket({
      title: ticket.title,
      description: ticket.description || '',
      priority: ticket.priority || 'LOW',
      node: ticket.node || '',
      applicationId: ticket.application?.id?.toString() || ''
    });
    setEditingTicketId(ticket.id);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const confirmDelete = (id: number) => {
    setDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteTicket = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/tickets/${deleteId}`);
      setIsDeleteModalOpen(false);
      setDeleteId(null);
      fetchTickets();
    } catch (error) {
      console.error('Failed to delete ticket', error);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [selectedEnvironment, selectedCluster]);

  const filteredTickets = tickets
    .filter(t => filter === 'ALL' || t.status === filter)
    .sort((a, b) => {
      const aFav = favorites.has(a.id);
      const bFav = favorites.has(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });

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
          <h1 className="text-4xl font-bold tracking-tight">Support & Incident Tickets</h1>
          <p className="text-muted-foreground mt-2 text-lg">Track, triage, and resolve environment-level infrastructure issues.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchTickets} loading={loading}>
            <History className="w-4 h-4" />
          </Button>
          {canCreate && (
            <Button onClick={() => { setIsEditing(false); setIsModalOpen(true); setNewTicket({ title: '', description: '', priority: 'LOW', node: '', applicationId: '' }); }}>
              <Plus className="w-4 h-4" />
              Raise Ticket
            </Button>
          )}
        </div>
      </div>

      {/* Raise Ticket Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="w-full max-w-md bg-card/95 border-primary/20 shadow-2xl">
            <CardContent className="p-6 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold tracking-tight">{isEditing ? 'Edit Incident Ticket' : 'Raise Incident Ticket'}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isEditing ? `Modifying ticket #${editingTicketId}` : `Describe the issue affecting ${selectedEnvironment?.name}.`}
                  </p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
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
                <Button onClick={raiseTicket} disabled={!newTicket.title.trim()}>
                  {isEditing ? 'Save Changes' : 'Submit Ticket'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
 
       {/* View Ticket Modal */}
       {viewingTicket && (
         <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <Card className="w-full max-w-2xl bg-card border-primary/20 shadow-2xl animate-in fade-in duration-200">
             <CardContent className="p-6 space-y-6">
               <div className="flex justify-between items-start">
                 <div>
                   <h3 className="text-2xl font-bold tracking-tight">{viewingTicket.title}</h3>
                   <div className="flex items-center gap-2 mt-2">
                     <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border ${getStatusStyle(viewingTicket.status)}`}>
                       {viewingTicket.status.replace('_', ' ')}
                     </span>
                     {viewingTicket.environment && <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">{viewingTicket.environment.name}</span>}
                     {viewingTicket.node && <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">{viewingTicket.node}</span>}
                     {viewingTicket.application && <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">{viewingTicket.application.name}</span>}
                   </div>
                 </div>
                 <button onClick={() => setViewingTicket(null)} className="text-muted-foreground hover:text-foreground">
                   <X className="w-5 h-5" />
                 </button>
               </div>
               
               <div className="space-y-4">
                 <div>
                   <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-2">Description</label>
                   <div className="bg-secondary/50 p-4 rounded-md text-sm whitespace-pre-wrap break-all max-h-[50vh] overflow-y-auto">
                     {viewingTicket.description || 'No description provided.'}
                   </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4 bg-secondary/30 p-4 rounded-md">
                   <div>
                     <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-1">Priority</label>
                     <span className={`font-bold ${viewingTicket.priority === 'CRITICAL' ? 'text-destructive' : viewingTicket.priority === 'HIGH' ? 'text-amber-500' : 'text-primary'}`}>
                       {viewingTicket.priority || 'LOW'}
                     </span>
                   </div>
                   <div>
                     <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-1">Created At</label>
                     <span className="text-sm">
                       {new Date(viewingTicket.createdAt).toLocaleString()}
                     </span>
                   </div>
                   {viewingTicket.resolvedAt && (
                     <div>
                       <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-1">Resolved At</label>
                       <span className="text-sm">
                         {new Date(viewingTicket.resolvedAt).toLocaleString()}
                       </span>
                     </div>
                   )}
                 </div>
               </div>

               <div className="flex justify-end pt-2 border-t border-border">
                 <Button variant="ghost" onClick={() => setViewingTicket(null)}>Close</Button>
               </div>
             </CardContent>
           </Card>
         </div>
       )}

       {/* Delete Confirmation Modal */}
       {isDeleteModalOpen && (
         <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <Card className="w-full max-w-sm bg-card border-destructive/20 shadow-2xl animate-in zoom-in-95 duration-200">
             <CardContent className="p-6 space-y-6">
               <div className="flex flex-col items-center text-center space-y-4">
                 <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
                   <Trash2 className="w-6 h-6 text-destructive" />
                 </div>
                 <div>
                   <h3 className="text-xl font-bold tracking-tight">Delete Incident?</h3>
                   <p className="text-sm text-muted-foreground mt-2">
                     Are you sure you want to permanently remove ticket #{deleteId}? This action cannot be undone.
                   </p>
                 </div>
               </div>
               
               <div className="flex gap-3 pt-2">
                 <Button variant="ghost" className="flex-1" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
                 <Button variant="destructive" className="flex-1 shadow-lg shadow-destructive/20" onClick={handleDeleteTicket}>
                   Delete
                 </Button>
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
                        <h3 className="text-lg font-bold truncate">{ticket.title.replace(/\s*\([^)]+\)$/, '')}</h3>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border ${getStatusStyle(ticket.status)}`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                        {ticket.environment && <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md ml-2">{ticket.environment.name}</span>}
                        {ticket.node && <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-md ml-1">{ticket.node}</span>}
                        
                        {(() => {
                          const match = ticket.title.match(/\(([^)]+)\)$/);
                          if (match) {
                            return match[1].split(',').map(t => t.trim()).map((tag, idx) => (
                              <span key={idx} className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md ml-1">
                                {tag}
                              </span>
                            ));
                          }
                          return ticket.application ? (
                            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md ml-1">
                              {ticket.application.name}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-3 max-w-4xl mt-1">{ticket.description}</p>
                    </div>

                    <div className="flex items-center gap-8 text-xs font-medium text-muted-foreground">
                      <div className="flex flex-col gap-1 items-end">
                         <span className="uppercase tracking-widest text-[9px] font-bold">Priority</span>
                         <span className={`font-bold ${ticket.priority === 'CRITICAL' ? 'text-destructive' : ticket.priority === 'HIGH' ? 'text-amber-500' : 'text-primary'}`}>
                           {ticket.priority || 'LOW'}
                         </span>
                      </div>
                      <div className="flex flex-col gap-1 items-end min-w-[120px]">
                         <span className="uppercase tracking-widest text-[9px] font-bold">Created</span>
                         <span className="flex items-center gap-1.5 whitespace-nowrap">
                           <Clock className="w-3 h-3" />
                           {new Date(ticket.createdAt).toLocaleString([], { month: 'numeric', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
                          localStorage.setItem('monetique_ticket_favs', JSON.stringify(Array.from(next)));
                        }}
                      >
                        <Star className="w-4 h-4" fill={favorites.has(ticket.id) ? 'currentColor' : 'none'} />
                      </Button>
                      
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 text-muted-foreground hover:text-primary"
                        onClick={() => setViewingTicket(ticket)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>

                      {canEdit && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-muted-foreground hover:text-primary"
                          onClick={() => handleEditClick(ticket)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                      
                      {canDelete && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-muted-foreground hover:text-destructive"
                          onClick={() => confirmDelete(ticket.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
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
