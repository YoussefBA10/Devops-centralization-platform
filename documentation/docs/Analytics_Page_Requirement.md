# Master Prompt — Log Analytics Dashboard Agent

## Role

You are a senior observability engineer and Frontend developer. Your task is to build a production-grade **Log Analytics Dashboard** that surfaces actionable root-cause intelligence from Loki, Prometheus, node-exporter, cAdvisor, and Blackbox Exporter. The dashboard must help engineers answer one question instantly: **"Why is my service down, and where did the problem originate?"**

---

## Stack & Data Sources

| Source | What it provides |
|---|---|
| **Loki** | Raw log streams — error messages, stack traces, DB pool events |
| **Prometheus** | Metrics — request rate, DB pool active/max, HTTP status codes |
| **node-exporter** | Host-level signals — CPU, memory, load average |
| **cAdvisor** | Container-level signals — per-container memory, CPU, GC pressure |
| **Blackbox Exporter** | Endpoint probe success rate — external reachability |

You query all five sources and correlate their signals to build a unified view.

---

## Page Layout & Sections

Build the page in this exact order, top to bottom.

### 1. Filter Bar (always visible, sticky)
- Time range buttons: `1h` · `6h` · `24h` · `7d` — default `6h`
- Service dropdown: populated from Loki label `{app="..."}` — options: All services + each distinct app label
- Free-text search input: filters the live log stream in real-time (client-side, no re-fetch)
- Live indicator: shows last refresh timestamp + auto-refresh interval (default 30s)
- On time range or service change: re-fetch all data sources and re-render all sections

---

### 2. Signal Summary (metric cards, single row)
Five cards in a responsive grid. Each card shows: label, current value, delta badge vs previous window, source tag.

| Card | Query | Source |
|---|---|---|
| Error rate | `count_over_time({app=~".+"} \|= "error" [5m])` | Loki |
| Request rate | `rate(http_requests_total[5m])` | Prometheus |
| DB pool usage | `db_pool_active / db_pool_max * 100` | Prometheus |
| Backend memory | `container_memory_usage_bytes / container_spec_memory_limit_bytes * 100` | cAdvisor |
| Blackbox probe | `probe_success{job="blackbox"}` averaged across targets | Blackbox |

Color rules:
- Value ≥ 90%: danger red
- Value 70–89%: warning amber
- Value < 70%: neutral
- Delta badge: red if worsened, green if improved

---

### 3. Traffic & Error Correlation Chart
A single multi-axis line chart. Time on X axis. Three series:

1. **req/s** — `rate(http_requests_total[1m])` from Prometheus (blue, solid)
2. **errors/min** — `count_over_time({app=~".+"} |= "error" [1m])` from Loki (red, solid with fill)
3. **DB pool %** — `db_pool_active / db_pool_max * 100` from Prometheus (amber, dashed)

Render as Chart.js. Tooltip shows all three values on hover. No legend inside canvas — render custom HTML legend below the chart with color squares and source labels.

**Key behaviour:** if errors/min spikes while req/s also rises, annotate the chart with a vertical line labeled "traffic spike" at that timestamp.

---

### 4. Blackbox Probe Success Chart
Isolated line chart. Single series: `probe_success * 100` per target endpoint over time. Color: teal above 80%, amber 50–79%, red below 50%. Add a horizontal reference line at 80% (SLO threshold). Annotate when circuit-breaker opened (probe drops below 50%).

---

### 5. Top Errors by Endpoint
Table/list of the top 10 error patterns, ranked by count descending. For each entry show:

- Endpoint path (monospace)
- Error message excerpt (first 80 chars of the log line)
- HTTP status code badge (500 = red, 4xx = amber, other = gray)
- Count (large, red)
- Mini sparkbar (9 buckets across the selected time window)
- Source tag (loki)
- Time range of first and last occurrence

Data query: LogQL aggregation
```
topk(10,
  sum by (endpoint, status) (
    count_over_time(
      {app=~".+"} | json | status >= 400 [selected_window]
    )
  )
)
```

Add an "Ask Claude ↗" button per row that calls `sendPrompt()` with the error message pre-filled for deeper analysis.

---

### 6. Container Resource Pressure
Source: cAdvisor. For each container, show:
- Memory usage bar (red if > 85%, amber if > 70%)
- CPU usage bar
- A plain-text callout if memory > 85%: explain the likely GC pressure → connection leak → pool exhaustion chain

Data query:
```
container_memory_usage_bytes{name=~".+"} / container_spec_memory_limit_bytes{name=~".+"} * 100
container_cpu_usage_seconds_total{name=~".+"}
```

---

### 7. Automated Root Cause Chain
**This is the most important section.** It must answer: *"My frontend is showing a blank page — where did the problem come from?"*

Algorithm — run this logic client-side after fetching all signals:

```
1. IF probe_success drops below 50%
   → flag: "Endpoint unreachable — circuit-breaker candidate"

2. IF http_5xx rate spikes AND db_pool_usage >= 95%
   → flag: "500 cascade likely caused by DB pool exhaustion, not a code bug"

3. IF db_pool_usage >= 95% AND container_memory > 85%
   → flag: "GC pressure holding connections — root cause is memory, not traffic"

4. IF req/s increased > 15% before pool exhaustion
   → flag: "Traffic spike was the trigger, not the root cause"

5. IF loki contains NullPointerException AND db_pool was exhausted N minutes prior
   → flag: "Null session object = downstream symptom of pool exhaustion"
```

Render each fired rule as a numbered row with:
- Label badge: `trigger` (amber) / `root cause` (red) / `cascade` (red) / `impact` (blue)
- Title (one sentence)
- Description (2–3 sentences explaining the signal correlation)
- Source tags for every data source that contributed

Include a "Remediation plan ↗" button that calls `sendPrompt()` with full context.

---

### 8. Live Log Stream
Tabbed by severity: All · Errors · Warnings · Info

Each log line shows:
- Timestamp (monospace)
- Service badge (from Loki label `app`)
- Log message (truncated at 120 chars, expandable on click)
- Background color: red tint for error, amber tint for warn, neutral for info

Behaviour:
- Filter bar search filters this stream in real-time (no re-fetch, client-side)
- New lines prepend at top when auto-refresh fires
- Max 200 lines rendered (virtual scroll or slice)

Loki query:
```
{app=~"selected_service"} | line_format "{{.message}}" | limit 200
```

---

## Data Fetching Architecture

```
fetchAll(timeRange, service)
  ├── fetchLoki(logql, start, end)        → /loki/api/v1/query_range
  ├── fetchPrometheus(promql, start, end) → /api/v1/query_range
  ├── fetchCAdvisor(promql, start, end)   → /api/v1/query_range  (same Prometheus endpoint)
  └── fetchBlackbox(promql, start, end)   → /api/v1/query_range  (same Prometheus endpoint)

Promise.all([...]) → parse → correlate → render
```

All fetches are parallel. On error per-source: show a muted "source unavailable" badge on the affected cards/charts — do not block the rest of the page.

Config object at top of file (easy to edit):
```js
const CONFIG = {
  lokiUrl: 'http://localhost:3100',
  prometheusUrl: 'http://localhost:9090',
  refreshInterval: 30000,  // ms
  maxLogLines: 200,
  sloProbeThreshold: 80,   // %
  poolExhaustionThreshold: 95,
  memoryPressureThreshold: 85,
};
```

---

## Design Rules

- **Enterprise, clean.**
- Spacing: generous whitespace, 1rem–1.5rem between sections.
- Metric cards: muted background, 13px label above, 22px value below.
- Charts: Chart.js, no legend inside canvas, custom HTML legend below.
- Badges: small (11px), color-coded by severity — never use color as the only differentiator (add a text label).
- Status bars: thin (4px height), color-coded with label and percentage inline.
- All numbers on screen go through `Math.round()` or `.toFixed(1)` — no float artifacts.
- Responsive grid: `repeat(auto-fit, minmax(140px, 1fr))`.
- No tabs that hide content during initial render — use JS-driven tab switching after load.

---

## Output Format

Deliver a **single self-contained HTML file**:
- All CSS in a `<style>` block in `<head>`
- All JS in a `<script>` block before `</body>`
- Chart.js loaded from CDN: `https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js`
- No external dependencies beyond Chart.js
- The `CONFIG` object at the very top of the script block

---

## Acceptance Criteria

The finished page must satisfy all of the following:

- [ ] All five data sources are queried and displayed
- [ ] Time range selector re-fetches and re-renders everything
- [ ] Service filter scopes all charts and the log stream
- [ ] Log search filters the stream client-side in real-time
- [ ] Root cause chain fires correctly for the DB pool → NullPointerException → blank page scenario
- [ ] Container memory bar turns red when cAdvisor reports > 85%
- [ ] Blackbox probe chart annotates when probe drops below 50%
- [ ] Traffic spike annotation appears on the correlation chart when req/s rises > 15%
- [ ] Every "Ask Claude ↗" and "Remediation plan ↗" button passes meaningful context to `sendPrompt()`
- [ ] Page renders correctly with no data (empty state per section)
- [ ] Page renders correctly in dark mode
- [ ] No layout overflow or horizontal scroll on 1280px viewport