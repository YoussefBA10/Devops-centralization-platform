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
  const [appInfo, setAppInfo] = useState<any>(null);
  const [metricsData, setMetricsData] = useState<any>({
    latency: [],
    traffic: [],
    errors: [],
    saturation: [],
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
      latency: `histogram_quantile(0.99, sum(rate({__name__=~"http_request_duration_seconds_bucket|http_request_duration_ms_bucket|http_server_requests_seconds_bucket|django_http_requests_latency_seconds_by_view_method_bucket", app_id="${appId}"}[5m])) by (le)) or (sum(rate(http_server_requests_seconds_sum{app_id="${appId}"}[5m])) / sum(rate(http_server_requests_seconds_count{app_id="${appId}"}[5m])))`,
      traffic: `sum(rate({__name__=~"http_requests_total|http_request_total|http_request_count|http_server_requests_seconds_count|django_http_requests_before_middlewares_total", app_id="${appId}"}[5m]))`,
      errors: `(sum(rate({__name__=~"http_requests_total|http_request_total|http_server_requests_seconds_count|django_http_responses_before_middlewares_total", app_id="${appId}", status_code!~"2..|3..", status!~"2..|3.."}[5m])) / sum(rate({__name__=~"http_requests_total|http_request_total|http_server_requests_seconds_count|django_http_responses_before_middlewares_total", app_id="${appId}"}[5m]))) * 100`,
      saturation: `sum(rate({__name__=~"process_cpu_seconds_total|cpu_usage", app_id="${appId}"}[5m])) * 100 or (avg({__name__=~"process_cpu_usage|system_cpu_usage", app_id="${appId}"}) * 100)`
    };

    const newData: any = { latency: [], traffic: [], errors: [], saturation: [], health: { status: 'UNKNOWN', message: '' } };

    try {
      // 1. Check Scrape Health first
      try {
        const healthRes = await api.get(`/applications/${appId}/metrics`, {
          params: { query: `up{app_id="${appId}"}` }
        });

        // healthRes.data is a direct list from queryList
        if (Array.isArray(healthRes.data) && healthRes.data.length > 0) {
          const val = parseFloat(healthRes.data[0].value);
          newData.health = {
            status: val === 1 ? 'UP' : 'DOWN',
            message: val === 1 ? 'Prometheus is successfully scraping this app.' : 'Prometheus cannot reach the metrics endpoint (Check port/firewall).'
          };
        } else {
          // If we have any metrics at all, it means it's discovered
          const anyMetrics = await api.get(`/applications/${appId}/metrics`, {
            params: { query: `count({app_id="${appId}"})` }
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
        newData.errors = newData.traffic.map(d => ({ ...d, y: 0 }));
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
