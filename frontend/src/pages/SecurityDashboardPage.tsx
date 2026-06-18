import React, { useEffect, useState } from 'react';
import { getSecuritySummary } from '../services/api';
import { ShieldCheck } from 'lucide-react';

const SecurityDashboardPage: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await getSecuritySummary();
        setSummary(response.data);
      } catch (error) {
        console.error('Failed to fetch security summary', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  if (loading) {
    return <div className="p-6">Loading security data...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-8 h-8 text-primary" />
          Security Dashboard
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-lg shadow border border-border">
          <h3 className="text-sm font-medium text-muted-foreground">Total Critical Vulns</h3>
          <p className="text-3xl font-bold text-destructive mt-2">{summary?.criticalCount || 0}</p>
        </div>
        <div className="bg-card p-4 rounded-lg shadow border border-border">
          <h3 className="text-sm font-medium text-muted-foreground">Total High Vulns</h3>
          <p className="text-3xl font-bold text-orange-500 mt-2">{summary?.highCount || 0}</p>
        </div>
        <div className="bg-card p-4 rounded-lg shadow border border-border">
          <h3 className="text-sm font-medium text-muted-foreground">Falco Events (24h)</h3>
          <p className="text-3xl font-bold text-blue-500 mt-2">{summary?.falcoEventsLast24h || 0}</p>
        </div>
        <div className="bg-card p-4 rounded-lg shadow border border-border">
          <h3 className="text-sm font-medium text-muted-foreground">Trend</h3>
          <p className="text-3xl font-bold text-green-500 mt-2">{summary?.trend || 'STABLE'}</p>
        </div>
      </div>

      <div className="bg-card p-6 rounded-lg shadow border border-border">
        <h2 className="text-xl font-bold mb-4">Under Construction</h2>
        <p className="text-muted-foreground">Detailed vulnerability tables and Falco event charts will go here.</p>
      </div>
    </div>
  );
};

export default SecurityDashboardPage;
