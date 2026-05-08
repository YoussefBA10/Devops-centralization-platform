import * as api from './api';

export interface TimeSeriesData {
  timestamp: number;
  value: number;
}

export interface MetricResult {
  metric: Record<string, string>;
  values: [number, string][];
}

export interface InstantResult {
  metric: Record<string, string>;
  value: [number, string];
}

/**
 * Auto-derive Prometheus step based on duration
 */
export const getStepForDuration = (durationMs: number): string => {
  const durationSec = durationMs / 1000;
  if (durationSec < 3600) return '15s'; // < 1h
  if (durationSec < 21600) return '60s'; // < 6h
  if (durationSec < 86400) return '300s'; // < 24h
  return '1800s'; // < 7d
};

/**
 * Query Prometheus Range API via Backend Proxy
 */
export const queryRange = async (
  query: string,
  start: number,
  end: number,
  step?: string
): Promise<MetricResult[]> => {
  const calculatedStep = step || getStepForDuration((end - start) * 1000);
  
  try {
    const response = await api.prometheusQueryRange(query, start, end, calculatedStep);

    if (response.data.status !== 'success') {
      throw new Error(response.data.error || 'Prometheus query failed');
    }

    return response.data.data.result;
  } catch (error) {
    console.error(`Prometheus range query failed: ${query}`, error);
    return [];
  }
};

/**
 * Query Prometheus Instant API via Backend Proxy
 */
export const queryInstant = async (query: string): Promise<InstantResult[]> => {
  try {
    const response = await api.prometheusQuery(query);

    if (response.data.status !== 'success') {
      throw new Error(response.data.error || 'Prometheus query failed');
    }

    return response.data.data.result;
  } catch (error) {
    console.error(`Prometheus instant query failed: ${query}`, error);
    return [];
  }
};

/**
 * Format Prometheus results for Recharts
 */
export const formatSeries = (results: MetricResult[]): any[] => {
  if (!results.length) return [];
  
  // Combine multiple series if necessary, or just return the first one's values
  // For most of our app-specific queries, we expect a single series
  return results[0].values.map(([ts, val]) => ({
    timestamp: ts * 1000,
    value: parseFloat(val) || 0
  }));
};
