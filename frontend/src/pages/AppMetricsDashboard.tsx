import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import api from '../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Input';
import { ArrowLeft, RefreshCw, Activity, Zap, AlertTriangle, Cpu } from 'lucide-react';

const AppMetricsDashboard: React.FC = () => {
  const { appId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [metricsData, setMetricsData] = useState<any>({
    latency: [],
    traffic: [],
    errors: [],
    saturation: [],
    health: { status: 'UNKNOWN', message: '' }
  });

  const fetchMetrics = async () => {
    if (!appId) return;
    setLoading(true);
    const end = Math.floor(Date.now() / 1000);
    const start = end - 3600; // Last 1 hour
    const step = '60s';

    const queries = {
      latency: `histogram_quantile(0.99, sum(rate({__name__=~"http_request_duration_seconds_bucket|http_request_duration_ms_bucket", app_id="${appId}"}[5m])) by (le))`,
      traffic: `sum(rate({__name__=~"http_requests_total|http_request_total|http_request_count", app_id="${appId}"}[5m]))`,
      errors: `(sum(rate({__name__=~"http_requests_total|http_request_total", app_id="${appId}", status=~"5.."}[5m])) / sum(rate({__name__=~"http_requests_total|http_request_total", app_id="${appId}"}[5m]))) * 100`,
      saturation: `sum(rate({__name__=~"process_cpu_seconds_total|cpu_usage", app_id="${appId}"}[5m])) * 100`
    };

    const newData: any = { latency: [], traffic: [], errors: [], saturation: [], health: { status: 'UNKNOWN', message: '' } };

    try {
      // 1. Check Scrape Health first
      try {
        const healthRes = await api.get(`/applications/${appId}/metrics`, {
          params: { query: `up{app_id="${appId}"}` }
        });
        if (healthRes.data?.result?.length > 0) {
          const val = parseInt(healthRes.data.result[0].value[1]);
          newData.health = { 
            status: val === 1 ? 'UP' : 'DOWN',
            message: val === 1 ? 'Prometheus is successfully scraping this app.' : 'Prometheus cannot reach the metrics endpoint.'
          };
        } else {
          newData.health = { status: 'NOT_FOUND', message: 'Prometheus has not discovered this target yet.' };
        }
      } catch (e) {
        console.error('Failed to fetch health status', e);
      }

      // 2. Fetch all Golden Signals
      await Promise.all(
        Object.entries(queries).map(async ([key, query]) => {
          try {
            const res = await api.get(`/applications/${appId}/metrics`, {
              params: { query, start, end, step }
            });
            if (res.data?.result?.length > 0) {
              newData[key] = res.data.result[0].values.map((v: any) => ({
                x: new Date(v[0] * 1000),
                y: parseFloat(v[1]) || 0
              }));
            }
          } catch (e) {
            console.error(`Failed to fetch ${key} metrics`, e);
          }
        })
      );
      setMetricsData(newData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [appId]);

  const createChartData = (data: any[], label: string, color: string) => ({
    labels: data.map(d => d.x.toLocaleTimeString()),
    datasets: [{
      label,
      data: data.map(d => d.y),
      borderColor: color,
      backgroundColor: `${color}33`,
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointRadius: 0
    }]
  });

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.5)' } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.5)' }, beginAtZero: true }
    }
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto animate-in fade-in duration-500 bg-[#0a0a0b] min-h-full">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" className="p-2 h-10 w-10 rounded-xl border-white/10 hover:bg-white/5" onClick={() => navigate('/observability/apps')}>
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </Button>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white">Golden Signals</h1>
              <p className="text-sm text-muted-foreground mt-1">Application Observability Dashboard</p>
            </div>
          </div>
          <Button variant="outline" className="h-11 px-6 rounded-xl border-white/10 hover:bg-white/5 gap-2" onClick={fetchMetrics} loading={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>

        {/* Scrape Health Status */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between ${
          metricsData.health.status === 'UP' ? 'bg-emerald-500/5 border-emerald-500/20' : 
          metricsData.health.status === 'DOWN' ? 'bg-rose-500/5 border-rose-500/20' : 
          'bg-amber-500/5 border-amber-500/20'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-lg ${
              metricsData.health.status === 'UP' ? 'bg-emerald-500/20 text-emerald-400' : 
              metricsData.health.status === 'DOWN' ? 'bg-rose-500/20 text-rose-400' : 
              'bg-amber-500/20 text-amber-400'
            }`}>
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Scrape Connectivity</p>
              <p className="text-sm font-medium text-white">{metricsData.health.message}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              metricsData.health.status === 'UP' ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
              metricsData.health.status === 'DOWN' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 
              'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
            }`} />
            <span className="text-[10px] font-black uppercase tracking-widest">{metricsData.health.status}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-[#0c0c0e] border-white/5 shadow-xl">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2 uppercase tracking-widest">
                <Activity className="w-4 h-4 text-emerald-400" />
                Traffic (Requests/sec)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 h-72">
              {metricsData.traffic.length > 0 ? (
                <Line data={createChartData(metricsData.traffic, 'Requests/sec', '#34d399')} options={chartOptions} />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground/50 text-sm">No data available</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#0c0c0e] border-white/5 shadow-xl">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2 uppercase tracking-widest">
                <Zap className="w-4 h-4 text-indigo-400" />
                Latency (P99 ms)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 h-72">
              {metricsData.latency.length > 0 ? (
                <Line data={createChartData(metricsData.latency.map((d: any) => ({ ...d, y: d.y * 1000 })), 'Latency (ms)', '#818cf8')} options={chartOptions} />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground/50 text-sm">No data available</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#0c0c0e] border-white/5 shadow-xl">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2 uppercase tracking-widest">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Errors (Error Rate %)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 h-72">
              {metricsData.errors.length > 0 ? (
                <Line data={createChartData(metricsData.errors, 'Error Rate %', '#fb7185')} options={chartOptions} />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground/50 text-sm">No data available</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#0c0c0e] border-white/5 shadow-xl">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2 uppercase tracking-widest">
                <Cpu className="w-4 h-4 text-amber-400" />
                Saturation (CPU Usage)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 h-72">
              {metricsData.saturation.length > 0 ? (
                <Line data={createChartData(metricsData.saturation, 'CPU %', '#fbbf24')} options={chartOptions} />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground/50 text-sm">No data available</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AppMetricsDashboard;
