import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  ArrowRight,
  MessageSquare,
  ChevronRight,
  History
} from 'lucide-react';
import api from '../services/api';
import { useEnvironment } from '../context/EnvironmentContext';
import type { Ticket } from '../types/index';
import { Card, CardContent } from '../components/ui/Card';
import { Button, Input } from '../components/ui/Input';

const TicketsPage: React.FC = () => {
  const { selectedEnvironment } = useEnvironment();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'>('ALL');

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
          <Button>
            <Plus className="w-4 h-4" />
            Raise Ticket
          </Button>
        </div>
      </div>

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
                      </div>
                      <p className="text-sm text-muted-foreground truncate max-w-2xl">{ticket.description}</p>
                    </div>

                    <div className="flex items-center gap-8 text-xs font-medium text-muted-foreground">
                      <div className="flex flex-col gap-1 items-end">
                         <span className="uppercase tracking-widest text-[9px] font-bold">Priority</span>
                         <span className="text-destructive font-bold">CRITICAL</span>
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
                         onClick={() => updateStatus(ticket.id, ticket.status === 'OPEN' ? 'IN_PROGRESS' : 'RESOLVED')}
                      >
                         {ticket.status === 'RESOLVED' ? 'Reopen' : 'Advance'}
                         <ArrowRight className="w-3.5 h-3.5 ml-2" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9">
                        <MessageSquare className="w-4 h-4" />
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
