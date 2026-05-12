import React, { useEffect, useState } from 'react';
import { getIncidentTimeline } from '../../services/api';
import { History, User, MessageSquare, AlertCircle, CheckCircle } from 'lucide-react';

interface Props {
  incidentId: number;
}

const IncidentTimeline: React.FC<Props> = ({ incidentId }) => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const res = await getIncidentTimeline(incidentId, { page: 0, size: 50 });
        setEntries(res.data.content);
      } catch (err) {
        console.error('Failed to fetch timeline', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTimeline();
  }, [incidentId]);

  if (loading) return <div className="p-4 text-muted-foreground">Loading timeline...</div>;

  const getIcon = (action: string) => {
    switch (action) {
      case 'status_changed': return <History className="w-4 h-4 text-blue-400" />;
      case 'note_added': return <MessageSquare className="w-4 h-4 text-amber-400" />;
      case 'incident_created': return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'resolved': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      default: return <History className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
      {entries.map((entry) => (
        <div key={entry.id} className="relative pl-8">
          <div className="absolute left-0 top-1 p-1 bg-black rounded-full border border-white/10 z-10">
            {getIcon(entry.action)}
          </div>
          <div className="bg-white/5 border border-white/5 rounded p-3">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {entry.action.replace('_', ' ')}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(entry.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {entry.action === 'status_changed' && (
                <p>Status changed from <span className="text-white">{entry.payload.old_status}</span> to <span className="text-white">{entry.payload.new_status}</span></p>
              )}
              {entry.action === 'note_added' && (
                <p className="italic">"{entry.payload.note}"</p>
              )}
              {entry.action === 'incident_created' && (
                <p>Incident created with severity <span className="text-white">{entry.payload.severity}</span></p>
              )}
              {entry.action === 'owner_assigned' && (
                <p>Assigned to <span className="text-white">{entry.payload.new_owner}</span></p>
              )}
            </div>
            {entry.actor && (
              <div className="mt-2 flex items-center text-[10px] text-muted-foreground">
                <User className="w-3 h-3 mr-1" />
                {entry.actor.username}
              </div>
            )}
          </div>
        </div>
      ))}
      {entries.length === 0 && (
        <div className="p-8 text-center text-muted-foreground text-sm">
          No timeline entries found.
        </div>
      )}
    </div>
  );
};

export default IncidentTimeline;
