import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import api from '../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Input';
import { ArrowLeft, RefreshCw, Activity, Zap, Cpu } from 'lucide-react';

const AppMetricsDashboard: React.FC = () => {
  const { appId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [appInfo, setAppInfo] = useState<any>(null);
  const [metricsData, setMetricsData] = useState<any>({
    cpu: [],
    memory: [],
    network: [],
    disk: [],
    health: { status: 'UNKNOWN', message: '' }
  });

  const fetchAppInfo = async () => {
    if (!appId) return;
    try {
      const res = await api.get(`/applications/${appId}`);
      setAppInfo(res.data);
    } catch (e) {
      console.error('Failed to fetch app info', e);
    }
  };

  const fetchMetrics = async () => {
    if (!appId) return;
    setLoading(true);
    const end = Math.floor(Date.now() / 1000);
    const start = end - 3600; // Last 1 hour
    const step = '60s';

    const queries = {
      cpu: `sum(rate(container_cpu_usage_seconds_total{container_label_com_monetique_app_id="${appId}"}[5m])) * 100`,
      memory: `sum(container_memory_usage_bytes{container_label_com_monetique_app_id="${appId}"}) / 1024 / 1024`,
      network: `sum(rate(container_network_receive_bytes_total{container_label_com_monetique_app_id="${appId}"}[5m])) / 1024`,
      disk: `sum(container_fs_usage_bytes{container_label_com_monetique_app_id="${appId}"}) / 1024 / 1024`
    };

    const newData: any = { cpu: [], memory: [], network: [], disk: [], health: { status: 'UNKNOWN', message: '' } };

    try {
      // 1. Check Scrape Health first
      try {
        const healthRes = await api.get(`/applications/${appId}/metrics`, {
          params: { query: `container_last_seen{container_label_com_monetique_app_id="${appId}"}` }
        });

        // healthRes.data is a direct list from queryList
        if (Array.isArray(healthRes.data) && healthRes.data.length > 0) {
          const val = parseFloat(healthRes.data[0].value);
          newData.health = {
            status: val > 0 ? 'UP' : 'DOWN',
            message: val > 0 ? 'Container is currently active and reporting to cAdvisor.' : 'Container is not currently visible to cAdvisor.'
          };
        } else {
          // If we have any metrics at all, it means it's discovered
          const anyMetrics = await api.get(`/applications/${appId}/metrics`, {
            params: { query: `count({container_label_com_monetique_app_id="${appId}"})` }
          });
          if (Array.isArray(anyMetrics.data) && anyMetrics.data.length > 0) {
            newData.health = { status: 'UP', message: 'Prometheus is scraping, but the health signal is still stabilizing.' };
          } else {
            newData.health = { status: 'NOT_FOUND', message: 'Prometheus has not discovered this target yet.' };
          }
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
            } else if (key === 'errors' || key === 'traffic') {
              // For errors/traffic, if the result is empty but the app is UP, it's 0
              newData[key] = [];
            }
          } catch (e) {
            console.error(`Failed to fetch ${key} metrics`, e);
          }
        })
      );

      // Final polish: If we have traffic but no errors, errors = 0
      if (newData.traffic.length > 0 && newData.errors.length === 0) {
        newData.errors = newData.traffic.map((d: any) => ({ ...d, y: 0 }));
      }

      setMetricsData(newData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppInfo();
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [appId]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: { size: 12, weight: 'bold' as const },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: {
          color: 'rgba(255,255,255,0.4)',
          font: { size: 10 },
          callback: (value: any) => value.toLocaleString()
        },
        beginAtZero: true
      }
    }
  };

  const createChartData = (data: any[], label: string, color: string) => ({
    labels: data.map(d => d.x.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
    datasets: [{
      label,
      data: data.map(d => d.y),
      borderColor: color,
      backgroundColor: (context: any) => {
        const ctx = context.chart.ctx;
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, `${color}44`);
        gradient.addColorStop(1, 'transparent');
        return gradient;
      },
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointRadius: 2,
      pointHoverRadius: 5,
      pointBackgroundColor: color,
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
    }]
  });

  return (
    <div className="flex-1 p-8 overflow-y-auto animate-in fade-in duration-500 bg-[#0a0a0b] min-h-full">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" className="p-2 h-10 w-10 rounded-xl border-white/10 hover:bg-white/5" onClick={() => navigate('/observability/apps')}>
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </Button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-black tracking-tight text-white">Golden Signals<span className="ml-2 text-[10px] font-black uppercase tracking-widest text-indigo-400">.</span></h1>
                {appInfo && (
                  <div className="flex items-center gap-2 ml-4 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">{appInfo.environmentName}</span>
                    <div className="w-1 h-1 rounded-full bg-indigo-500/30" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">{appInfo.name}</span>
                    <div className="w-1 h-1 rounded-full bg-indigo-500/30" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">{appInfo.targetNode}</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">Application Observability Dashboard</p>
            </div>
          </div>
          <Button variant="outline" className="h-11 px-6 rounded-xl border-white/10 hover:bg-white/5 gap-2" onClick={fetchMetrics} loading={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>

        {/* Scrape Health Status */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between ${metricsData.health.status === 'UP' ? 'bg-emerald-500/5 border-emerald-500/20' :
          metricsData.health.status === 'DOWN' ? 'bg-rose-500/5 border-rose-500/20' :
            'bg-amber-500/5 border-amber-500/20'
          }`}>
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-lg ${metricsData.health.status === 'UP' ? 'bg-emerald-500/20 text-emerald-400' :
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
            <div className={`w-2 h-2 rounded-full ${metricsData.health.status === 'UP' ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
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
                <Cpu className="w-4 h-4 text-emerald-400" />
                CPU Usage (%)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 h-72">
              {metricsData.cpu.length > 0 ? (
                <Line data={createChartData(metricsData.cpu, 'CPU %', '#34d399')} options={chartOptions} />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground/50 text-sm">No data available</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#0c0c0e] border-white/5 shadow-xl">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2 uppercase tracking-widest">
                <Zap className="w-4 h-4 text-indigo-400" />
                Memory Usage (MB)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 h-72">
              {metricsData.memory.length > 0 ? (
                <Line data={createChartData(metricsData.memory, 'Memory MB', '#818cf8')} options={chartOptions} />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground/50 text-sm">No data available</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#0c0c0e] border-white/5 shadow-xl">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2 uppercase tracking-widest">
                <Activity className="w-4 h-4 text-rose-400" />
                Network RX (KB/s)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 h-72">
              {metricsData.network.length > 0 ? (
                <Line data={createChartData(metricsData.network, 'Network KB/s', '#fb7185')} options={chartOptions} />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground/50 text-sm">No data available</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#0c0c0e] border-white/5 shadow-xl">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2 uppercase tracking-widest">
                <Cpu className="w-4 h-4 text-amber-400" />
                Disk Usage (MB)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 h-72">
              {metricsData.disk.length > 0 ? (
                <Line data={createChartData(metricsData.disk, 'Disk MB', '#fbbf24')} options={chartOptions} />
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
