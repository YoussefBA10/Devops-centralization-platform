import React, { useState, useEffect } from 'react';
import { getIncidents } from '../services/api';
import { AlertCircle, Clock, User, ShieldAlert, History } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Input';
import IncidentTimeline from '../components/incidents/IncidentTimeline';

const IncidentsPage: React.FC = () => {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    try {
      const res = await getIncidents({ size: 50 });
      setIncidents(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'P1': return 'bg-red-500/20 text-red-500 border-red-500/30';
      case 'P2': return 'bg-orange-500/20 text-orange-500 border-orange-500/30';
      case 'P3': return 'bg-amber-500/20 text-amber-500 border-amber-500/30';
      default: return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-red-500/10 text-red-400';
      case 'INVESTIGATING': return 'bg-amber-500/10 text-amber-400';
      case 'RESOLVED': return 'bg-emerald-500/10 text-emerald-400';
      default: return 'bg-white/10 text-muted-foreground';
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* List Panel */}
      <div className="w-[400px] border-r border-white/10 flex flex-col bg-black/20">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h1 className="text-xl font-bold">Operational Incidents</h1>
          <Button variant="ghost" size="sm" onClick={fetchIncidents} loading={loading}>
             Refresh
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {incidents.map((incident) => (
            <div 
              key={incident.id} 
              onClick={() => setSelectedIncident(incident)}
              className={`p-4 border-b border-white/5 cursor-pointer transition-colors ${selectedIncident?.id === incident.id ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-white/5'}`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${getSeverityStyle(incident.severity)}`}>
                  {incident.severity}
                </span>
                <span className="text-[10px] text-muted-foreground italic">#{incident.id}</span>
              </div>
              <h3 className="text-sm font-bold truncate mb-1">{incident.title}</h3>
              <div className="flex justify-between items-center mt-2">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${getStatusStyle(incident.status)}`}>
                  {incident.status}
                </span>
                <span className="text-[10px] text-muted-foreground flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {new Date(incident.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
          {incidents.length === 0 && !loading && (
             <div className="p-10 text-center text-muted-foreground text-sm">No incidents found.</div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      <div className="flex-1 overflow-y-auto bg-black/40">
        {selectedIncident ? (
          <div className="p-8 max-w-4xl mx-auto space-y-8">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                   <span className={`text-xs px-3 py-1 rounded border font-bold ${getSeverityStyle(selectedIncident.severity)}`}>
                     {selectedIncident.severity}
                   </span>
                   <span className="text-muted-foreground text-sm">Created on {new Date(selectedIncident.createdAt).toLocaleString()}</span>
                </div>
                <h1 className="text-3xl font-bold">{selectedIncident.title}</h1>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Assign</Button>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">Resolve</Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
               <Card className="bg-white/5 border-white/10">
                 <CardContent className="p-4">
                   <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Status</p>
                   <span className={`text-sm font-bold ${getStatusStyle(selectedIncident.status)}`}>{selectedIncident.status}</span>
                 </CardContent>
               </Card>
               <Card className="bg-white/5 border-white/10">
                 <CardContent className="p-4">
                   <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Application</p>
                   <span className="text-sm font-bold text-white">{selectedIncident.applicationName}</span>
                 </CardContent>
               </Card>
               <Card className="bg-white/5 border-white/10">
                 <CardContent className="p-4">
                   <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Owner</p>
                   <span className="text-sm font-bold text-white flex items-center">
                     <User className="w-3 h-3 mr-1" />
                     {selectedIncident.ownerName || 'Unassigned'}
                   </span>
                 </CardContent>
               </Card>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center">
                <ShieldAlert className="w-5 h-5 mr-2 text-primary" />
                AI Analysis & Summary
              </h2>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-5 italic text-sm text-white/90 leading-relaxed shadow-inner">
                {selectedIncident.aiSummary || "No AI summary available for this incident."}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center">
                <History className="w-5 h-5 mr-2 text-primary" />
                Incident Timeline
              </h2>
              <IncidentTimeline incidentId={selectedIncident.id} />
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
            <AlertCircle className="w-16 h-16 opacity-20" />
            <p className="text-lg">Select an incident to view details and timeline.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default IncidentsPage;
