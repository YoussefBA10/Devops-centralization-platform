You are a senior SRE platform engineer. Fix two confirmed bugs in the Root Cause Intelligence Engine of the Monetique Eye observability platform.

---

## Context

The engine is implemented across three Java files:
- RootCauseIntelligenceService.java  — scoring, ranking, confidence
- ElasticsearchLogClientImpl.java    — log-based signal extraction
- PrometheusClient.java              — metric-based OOM detection

The engine is a Spring @Service singleton. It is invoked once per incident via analyze(...).

---

## Bug 1 — Shared singleton state pollutes every incident analysis

### Symptom
When two incidents are analyzed in the same JVM lifecycle (e.g., OOM followed by disk exhaustion), the root cause of the second incident is wrong. The engine always surfaces the last incident's signals as the dominant result across all incidents.

### Root cause
The scoring map and evidence accumulator inside RootCauseIntelligenceService are declared as instance fields:

  // WRONG — shared across all analyze() calls, never reset
  private Map scores = new HashMap<>();
  private Map> evidence = new HashMap<>();

Because RootCauseIntelligenceService is a Spring @Service singleton, these fields are shared for the entire application lifetime. Each call to analyze() writes into the same maps without clearing them first. Scores from incident 1 remain in memory and compound with scores from incident 2. The final sort reads this accumulated dirty state, so the most recently analyzed incident inflates its score and incorrectly dominates the root cause chain of every incident.

### Fix required

Move ALL scoring structures to local variables inside analyze(), initialized fresh at the top of every call:

  // CORRECT — fully isolated per call, no state leakage
  public List analyze(...) {
      Map scores = new HashMap<>();
      Map> evidence = new HashMap<>();
      // every incident now starts with a clean slate
  }

Rules:
1. Every variable that participates in scoring, evidence accumulation, or intermediate
   signal evaluation must be a local variable inside analyze(), not a class field.
2. If any structure must remain a field (e.g. a config map loaded once at startup),
   it must be strictly read-only during analyze() — never written to.
3. Do not call .clear() on a shared field as an alternative. That is not thread-safe
   and breaks concurrent incident analysis. Use local variables.

### Verification
Call analyze() twice on the same bean instance with different signal sets:
- Call 1: only OOM signals active  → must return MEMORY_OOM as root_cause
- Call 2: only disk signals active  → must return DISK_PRESSURE as root_cause
Neither result may contain evidence strings or scores from the other call.

---

## Bug 2 — Disk pressure is not detected or scored

### Symptom
Incidents caused by disk exhaustion (full disk, inode saturation, log volume overflow)
fall through to the GENERAL APPLICATION ERRORS fallback or are misattributed to
DB_FAILURE or SERVICE_UNREACHABLE.

### Root cause
DISK_PRESSURE has no signal in ElasticsearchLogClientImpl.fetchSreSignals(),
no PromQL query in PrometheusClient, and no scoring entry in RootCauseIntelligenceService.

### Fix required

Step 1 — Add signals in ElasticsearchLogClientImpl.fetchSreSignals()

Add the following aggregation keys to the SRE signal query:

  Signal key        | Query type  | Condition
  ------------------|-------------|------------------------------------------
  disk_full         | match       | message contains "No space left on device"
  disk_usage_high   | range       | disk_usage_pct >= 85
  inode_exhausted   | match       | message contains "No inodes available"

Return them as boolean flags in the signals map, consistent with existing signal keys.

Step 2 — Add a PromQL query in PrometheusClient

Add a method getDiskPressureEvents(appFilter, envFilter) that executes:

  max by (name) (
    (1 - (node_filesystem_avail_bytes{mountpoint="/"}
         / node_filesystem_size_bytes{mountpoint="/"}))
    * 100 > 85
  )

Return a boolean: true if any matched container exceeds the 85% threshold.

Step 3 — Add a scoring rule in RootCauseIntelligenceService

Register DISK_PRESSURE as a new diagnostic category:

  Category:    DISK_PRESSURE
  Priority:    2 (resource saturation tier, same as MEMORY_OOM)
  Base score:  9.0
  Evidence weights:
    disk_full signal detected:              +6.0
    disk_usage_pct >= 85 (log signal):      +3.0
    inode_exhausted signal detected:        +4.0
    Prometheus disk threshold exceeded:     +5.0
  Max score:   27.0
  UI type:     root_cause
  Confidence:  high if score > 6.0 / medium if score > 4.0 / low otherwise

Place DISK_PRESSURE in the priority hierarchy between MEMORY_OOM and BUG_CRASH:

  Resource Saturation → DB_FAILURE, MEMORY_OOM, DISK_PRESSURE
  Application Bug     → BUG_CRASH
  Upstream Failure    → SERVICE_UNREACHABLE, NETWORK_FAILURE
  Traffic Spike       → TRAFFIC_SPIKE

Step 4 — Wire the new signals in the analyze() orchestration

Call getDiskPressureEvents() in parallel with the existing getOomEvents() call.
Pass the result into the DISK_PRESSURE scoring block alongside the log-based signals.

---

## Acceptance criteria

1. Analyzing two consecutive incidents on the same service instance produces
   fully independent, correct root cause chains — each incident reflects only
   its own signals, with zero leakage from any other incident.

2. A disk-full or high-disk-usage incident produces a DISK_PRESSURE root_cause
   rule at high or medium confidence — not a GENERAL APPLICATION ERRORS fallback.

3. No existing heuristic scores, signal keys, or confidence thresholds are modified.
   This is an additive fix (Bug 2) plus a state isolation fix (Bug 1).

4. All new signal keys follow the existing naming convention: snake_case, boolean flags.

5. The top-3 limit and singleton service structure remain unchanged.