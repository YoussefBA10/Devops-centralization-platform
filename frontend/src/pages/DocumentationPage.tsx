import React, { useState } from 'react';
import {
  Book,
  ChevronRight,
  Rocket,
  Layout,
  Settings as SettingsIcon,
  Cpu,
  Terminal,
  ShieldCheck,
  HelpCircle,
  History,
  Info,
  AlertCircle,
  Lightbulb,
  ArrowRight,
  Code,
  Activity
} from 'lucide-react';
import { Card } from '../components/ui/Card';

const DocumentationPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', title: 'Overview & Introduction', icon: Info },
    { id: 'getting-started', title: 'Getting Started', icon: Rocket },
    { id: 'dashboards', title: 'Dashboards & Insights', icon: Layout },
    { id: 'parameters', title: 'Parameters & Configuration', icon: SettingsIcon },
    { id: 'instrumentation', title: 'Application Instrumentation', icon: Code },
    { id: 'operations', title: 'Deployment & Operations', icon: Cpu },
    { id: 'architecture', title: 'How the System Works', icon: Terminal },
    { id: 'advanced', title: 'Advanced Features', icon: Code },
    { id: 'troubleshooting', title: 'Debugging & Troubleshooting', icon: AlertCircle },
    { id: 'security', title: 'Security & Compliance', icon: ShieldCheck },
    { id: 'faq', title: 'FAQs', icon: HelpCircle },
    { id: 'changelog', title: 'Changelog', icon: History },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-4">
              <h1 className="text-4xl font-extrabold tracking-tight">Overview & Introduction</h1>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Monetique Eye is a next-generation Enterprise Observability and GitOps Orchestration platform designed to provide total visibility into distributed fintech infrastructures.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6 bg-primary/5 border-primary/10">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-primary" />
                  Core Value Proposition
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• **Unified Visibility**: Single pane of glass for multi-environment clusters.</li>
                  <li>• **Proactive Intelligence**: AI-driven anomaly detection and log analysis.</li>
                  <li>• **GitOps Native**: Fully automated deployment pipelines via Ansible and Docker.</li>
                  <li>• **Audit & Compliance**: System-wide traceability for every action and change.</li>
                </ul>
              </Card>
              <Card className="p-6 bg-secondary/30 border-white/5">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-primary" />
                  Business Benefits
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• **Reduce MTTR**: Identify and resolve infrastructure issues in minutes.</li>
                  <li>• **Zero-Touch Ops**: Automate repetitive deployment and scaling tasks.</li>
                  <li>• **Enhanced Security**: Granular RBAC and encrypted communication layers.</li>
                </ul>
              </Card>
            </div>

            <div className="space-y-4 pt-4">
              <h2 className="text-2xl font-bold">High-Level Architecture</h2>
              <p className="text-muted-foreground">
                The platform follows a distributed agent-manager architecture. The **Management Node** (Central Node) orchestrates deployments and aggregates telemetry, while **Managed Nodes** run the business applications and telemetry agents (Node Exporter, cAdvisor, Promtail).
              </p>
              <div className="p-8 bg-secondary/20 rounded-2xl border border-white/5 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="flex gap-4 justify-center">
                    <div className="w-32 h-16 bg-primary/20 border border-primary/40 rounded flex items-center justify-center text-xs font-bold uppercase">Prometheus</div>
                    <div className="w-32 h-16 bg-primary/20 border border-primary/40 rounded flex items-center justify-center text-xs font-bold uppercase">Elasticsearch</div>
                  </div>
                  <div className="w-64 h-20 bg-primary border-2 border-primary shadow-[0_0_20px_rgba(59,130,246,0.3)] rounded-xl mx-auto flex items-center justify-center font-bold text-white uppercase tracking-widest">Monetique Eye Core</div>
                  <div className="flex gap-4 justify-center">
                    <div className="w-24 h-12 bg-secondary border border-white/10 rounded flex items-center justify-center text-[10px] font-bold uppercase">Node 01</div>
                    <div className="w-24 h-12 bg-secondary border border-white/10 rounded flex items-center justify-center text-[10px] font-bold uppercase">Node 02</div>
                    <div className="w-24 h-12 bg-secondary border border-white/10 rounded flex items-center justify-center text-[10px] font-bold uppercase">Node 03</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'getting-started':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-extrabold tracking-tight">Getting Started</h1>

            <div className="space-y-6">
              <section className="space-y-3">
                <h2 className="text-2xl font-bold">1. First-Time Setup</h2>
                <p className="text-muted-foreground">When you first access Monetique Eye, you will be greeted by the **Setup Wizard**. This wizard configures the primary Management Node (vmpipe).</p>
                <Card className="p-4 bg-amber-500/5 border-amber-500/20">
                  <p className="text-sm text-amber-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Ensure you have SSH access to the management node before starting the wizard.
                  </p>
                </Card>
              </section>

              <section className="space-y-3">
                <h2 className="text-2xl font-bold">2. Onboarding Nodes</h2>
                <p className="text-muted-foreground">To monitor your infrastructure, you must add managed nodes:</p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-4">
                  <li>Navigate to **Environments**.</li>
                  <li>Select or create an environment (e.g., Pre-Prod).</li>
                  <li>Click **Add Node** and provide the target IP and SSH credentials.</li>
                  <li>The system will automatically deploy the monitoring stack (cAdvisor, Node Exporter).</li>
                </ol>
              </section>

              <section className="space-y-3">
                <h2 className="text-2xl font-bold">3. Navigation Guide</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 border border-white/5 rounded-lg">
                    <h4 className="font-bold mb-1">Global Dashboard</h4>
                    <p className="text-xs text-muted-foreground">Health overview of all environments.</p>
                  </div>
                  <div className="p-4 border border-white/5 rounded-lg">
                    <h4 className="font-bold mb-1">Observability</h4>
                    <p className="text-xs text-muted-foreground">Real-time resource pulse of every container.</p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        );
      case 'dashboards':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-extrabold tracking-tight">Dashboards &amp; Insights</h1>
            <p className="text-xl text-muted-foreground">Monetique Eye provides five interconnected dashboards, each designed for a specific operational concern.</p>

            <div className="space-y-12">
              {/* 1. Main Dashboard */}
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Layout className="w-6 h-6 text-primary" />
                  1. System Overview (Main Dashboard)
                </h2>
                <p className="text-muted-foreground">The central command center. It aggregates data from every environment and presents four KPI cards that auto-refresh every 30 seconds:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-secondary/20 rounded-xl border border-white/5">
                    <h4 className="text-sm font-bold text-primary mb-1">Active Environments</h4>
                    <p className="text-xs text-muted-foreground">Count of all logical clusters registered in the platform (e.g., Dev, Staging, Prod).</p>
                  </div>
                  <div className="p-4 bg-secondary/20 rounded-xl border border-white/5">
                    <h4 className="text-sm font-bold text-primary mb-1">Total Nodes</h4>
                    <p className="text-xs text-muted-foreground">Sum of all physical or virtual machines reporting telemetry via Node Exporter.</p>
                  </div>
                  <div className="p-4 bg-secondary/20 rounded-xl border border-white/5">
                    <h4 className="text-sm font-bold text-primary mb-1">Stability Index</h4>
                    <p className="text-xs text-muted-foreground">A composite score (0-100%) calculated from error z-scores, CPU/RAM saturation, and disk usage. Above 95% = Healthy, 85-95% = Warning, below 85% = Critical.</p>
                  </div>
                  <div className="p-4 bg-secondary/20 rounded-xl border border-white/5">
                    <h4 className="text-sm font-bold text-primary mb-1">Open Tickets</h4>
                    <p className="text-xs text-muted-foreground">Number of unresolved incident tickets across all environments.</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">The dashboard also features a <strong>Health Stream</strong> (real-time terminal feed of system events) and a <strong>Pulse Feed</strong> (chronological audit trail of deployments, incidents, and config changes).</p>
              </div>

              {/* 2. Operational Intelligence */}
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Activity className="w-6 h-6 text-emerald-500" />
                  2. Operational Intelligence
                </h2>
                <p className="text-muted-foreground">An environment-scoped deep-dive into service health, accessible from the sidebar or the "Launch Intelligence Hub" button on the main dashboard.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-secondary/20 rounded-xl border border-white/5">
                    <h4 className="text-sm font-bold text-emerald-500 mb-1">Stability Gauge</h4>
                    <p className="text-xs text-muted-foreground">A radial gauge showing the environment's stability score with trend arrows (+/-%). Calculated using log error z-scores and resource penalties.</p>
                  </div>
                  <div className="p-4 bg-secondary/20 rounded-xl border border-white/5">
                    <h4 className="text-sm font-bold text-emerald-500 mb-1">Node Heatmap</h4>
                    <p className="text-xs text-muted-foreground">A risk-score matrix for every node in the environment. Risk = (CPU×0.4) + (RAM×0.4) + (Critical?+20). Color-coded from green to red.</p>
                  </div>
                  <div className="p-4 bg-secondary/20 rounded-xl border border-white/5">
                    <h4 className="text-sm font-bold text-emerald-500 mb-1">Anomaly Detection</h4>
                    <p className="text-xs text-muted-foreground">Lists containers with abnormal resource patterns. Flags services that are stopped (stale by &gt;120s) or exceeding CPU/RAM thresholds.</p>
                  </div>
                  <div className="p-4 bg-secondary/20 rounded-xl border border-white/5">
                    <h4 className="text-sm font-bold text-emerald-500 mb-1">Live Service Pulse</h4>
                    <p className="text-xs text-muted-foreground">A real-time table of every container in the environment. Shows CPU%, RAM%, Network I/O, Disk I/O, uptime, and status per service. Auto-refreshes every 10 seconds. Click any row for a detailed drawer.</p>
                  </div>
                </div>
              </div>

              {/* 3. Infrastructure Topology */}
              <div className="space-y-4">
                <h2 className="text-2xl font-bold">3. Infrastructure Topology (Cluster Graph)</h2>
                <p className="text-muted-foreground">A spatial visualization of the node hierarchy and network connectivity. Uses real-time Prometheus data.</p>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0"></div>
                    <div><strong>Interactive Nodes</strong>: Click any node to view real-time CPU and RAM utilization.</div>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0"></div>
                    <div><strong>Equilateral Triangle Layout</strong>: Optimized for 3-node clusters (Central + 2 Agents). Automatically arranges nodes with equal distance.</div>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0"></div>
                    <div><strong>Status Colors</strong>: Emerald (Healthy), Amber (Warning: CPU&gt;80%), Crimson (Critical: CPU&gt;90%), Gray (Offline).</div>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0"></div>
                    <div><strong>Summary Panel</strong>: Shows Active Agents count and Network Load in Mbps (calculated from node_network_receive/transmit_bytes_total).</div>
                  </li>
                </ul>
              </div>

              {/* 4. System Logs */}
              <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Terminal className="w-6 h-6 text-primary" />
                  4. System Logs (Centralized Log Console)
                </h2>
                <p className="text-muted-foreground">A terminal-style log viewer powered by the ELK stack (Elasticsearch → Logstash → Kibana pipeline).</p>
                <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-muted-foreground uppercase text-[10px] font-bold tracking-widest">
                      <tr>
                        <th className="px-6 py-3">Feature</th>
                        <th className="px-6 py-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      <tr><td className="px-6 py-3 font-bold text-primary">LIVE Mode</td><td className="px-6 py-3">Auto-polls every 5 seconds for real-time log tailing. Toggle on/off with the LIVE button.</td></tr>
                      <tr><td className="px-6 py-3 font-bold text-primary">Severity Filter</td><td className="px-6 py-3">Filter by DEBUG, INFO, WARN, ERROR, or FATAL levels.</td></tr>
                      <tr><td className="px-6 py-3 font-bold text-primary">Date Range</td><td className="px-6 py-3">From/To datetime pickers for historical log analysis.</td></tr>
                      <tr><td className="px-6 py-3 font-bold text-primary">App Selector</td><td className="px-6 py-3">Logs are scoped per application. Select which app's logs to view.</td></tr>
                      <tr><td className="px-6 py-3 font-bold text-primary">Export CSV</td><td className="px-6 py-3">Download filtered logs as a CSV file for offline analysis.</td></tr>
                      <tr><td className="px-6 py-3 font-bold text-primary">Clear Buffer</td><td className="px-6 py-3">Purge the Logstash buffer for a specific application (admin only).</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 5. Incident Management */}
              <div className="space-y-4">
                <h2 className="text-2xl font-bold">5. Incident Management (Tickets)</h2>
                <p className="text-muted-foreground">A lightweight ticketing system for tracking infrastructure issues, scoped per environment.</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• <strong>Ticket Fields</strong>: Title, Description, Priority (LOW/MEDIUM/HIGH/CRITICAL), Target Node, and linked Application.</li>
                  <li>• <strong>Lifecycle</strong>: OPEN → IN_PROGRESS → RESOLVED. Click "Advance" to move through stages, or "Reopen" a resolved ticket.</li>
                  <li>• <strong>RBAC Controlled</strong>: Create, Edit, and Delete actions are gated by the user's `incidents` permission scope.</li>
                  <li>• <strong>Favorites</strong>: Star tickets for quick access.</li>
                </ul>
              </div>

              {/* 6. Audit Log */}
              <div className="space-y-4">
                <h2 className="text-2xl font-bold">6. Audit Log History</h2>
                <p className="text-muted-foreground">An immutable, system-wide record of every action taken on the platform. Supports filtering by category (Deployment, Infrastructure, Incident, System), keyword search, and date range. Every entry records the user who performed the action, the timestamp, and the affected environment. Exportable as CSV.</p>
              </div>
            </div>
          </div>
        );
      case 'parameters':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-extrabold tracking-tight">Parameters & Configuration</h1>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold">System Configuration (.env)</h2>
              <p className="text-muted-foreground">Core system behavior is controlled via environment variables in the backend root.</p>

              <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-muted-foreground uppercase text-[10px] font-bold tracking-widest">
                    <tr>
                      <th className="px-6 py-4">Parameter</th>
                      <th className="px-6 py-4">Description</th>
                      <th className="px-6 py-4">Default</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    <tr>
                      <td className="px-6 py-4 font-mono text-primary">SERVER_PORT</td>
                      <td className="px-6 py-4">Port the backend API listens on.</td>
                      <td className="px-6 py-4 text-xs italic">8880</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-mono text-primary">DB_URL</td>
                      <td className="px-6 py-4">JDBC connection string for MySQL.</td>
                      <td className="px-6 py-4 text-xs italic">jdbc:mysql://...</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-mono text-primary">DB_USERNAME / PASSWORD</td>
                      <td className="px-6 py-4">Credentials for the primary database.</td>
                      <td className="px-6 py-4 text-xs italic">youss / youss123</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-mono text-primary">JWT_SECRET</td>
                      <td className="px-6 py-4">Base64 encoded secret for JWT signing.</td>
                      <td className="px-6 py-4 text-xs italic">32+ char string</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-mono text-primary">LOGSTASH_HOST / PORT</td>
                      <td className="px-6 py-4">Ingestion point for ELK log pipeline.</td>
                      <td className="px-6 py-4 text-xs italic">192.168.x.x:5044</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-mono text-primary">PROMETHEUS_URL</td>
                      <td className="px-6 py-4">Endpoint for metric aggregation queries.</td>
                      <td className="px-6 py-4 text-xs italic">http://localhost:9090</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-mono text-primary">MONETIQUE_GITOPS_PATH</td>
                      <td className="px-6 py-4">Local filesystem path to the gitops directory.</td>
                      <td className="px-6 py-4 text-xs italic">/data/monetique-eye/gitops</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-mono text-primary">ELASTICSEARCH_URL</td>
                      <td className="px-6 py-4">Elasticsearch endpoint for log storage and search.</td>
                      <td className="px-6 py-4 text-xs italic">http://localhost:9200</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-mono text-primary">JWT_EXPIRATION</td>
                      <td className="px-6 py-4">Token lifetime in seconds before requiring re-authentication.</td>
                      <td className="px-6 py-4 text-xs italic">3600</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-mono text-primary">GROQ_API_KEY</td>
                      <td className="px-6 py-4">API key for the Groq LLM service (powers the AI Assistant).</td>
                      <td className="px-6 py-4 text-xs italic">gsk_...</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-mono text-primary">GROQ_MODEL</td>
                      <td className="px-6 py-4">Model name for the AI chatbot.</td>
                      <td className="px-6 py-4 text-xs italic">llama-3.3-70b-versatile</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-mono text-primary">MONETIQUE_PROJECT_PATH</td>
                      <td className="px-6 py-4">Root path of the Monetique Eye project on the backend host.</td>
                      <td className="px-6 py-4 text-xs italic">/data/monetique</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold">Application Parameters</h2>
              <p className="text-muted-foreground">When deploying containers, you can specify environment variables that will be injected into the container at runtime.</p>
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                <p className="text-sm font-bold mb-2">Precedence Order:</p>
                <ol className="text-xs text-muted-foreground space-y-1">
                  <li>1. Individual Container Env Variables</li>
                  <li>2. Environment-level Overrides</li>
                  <li>3. Global System Defaults</li>
                </ol>
              </div>
            </section>
          </div>
        );
      case 'instrumentation':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-extrabold tracking-tight">Application Instrumentation</h1>
            <p className="text-xl text-muted-foreground">To ensure your applications are fully observable by Monetique Eye, follow these instrumentation guidelines.</p>

            <section className="space-y-6">
              <div className="p-6 bg-secondary/20 rounded-2xl border border-white/5">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-primary" />
                  Log Ingestion (Logstash)
                </h3>
                <p className="text-sm text-muted-foreground mb-4">Apps must send logs in JSON format to the Logstash ingestion port defined in your `.env`.</p>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-[#6db33f]">Spring Boot (Java)</h4>
                  <p className="text-xs text-muted-foreground">Add the Logstash logback encoder to your `pom.xml` and update `logback-spring.xml`:</p>
                  <div className="bg-black/50 p-4 rounded-lg font-mono text-[11px] border border-white/5 whitespace-pre overflow-x-auto text-emerald-400">
                    {`<appender name="LOGSTASH" class="net.logstash.logback.appender.LogstashTcpSocketAppender">\n  <destination>\${LOGSTASH_HOST}:\${LOGSTASH_PORT}</destination>\n  <encoder class="net.logstash.logback.encoder.LogstashEncoder" />\n</appender>`}
                  </div>

                  <h4 className="text-sm font-bold text-[#339933]">Node.js (Winston)</h4>
                  <div className="bg-black/50 p-4 rounded-lg font-mono text-[11px] border border-white/5 whitespace-pre overflow-x-auto text-emerald-400">
                    {`const logstash = new LogstashTransport({ \n  host: process.env.LOGSTASH_HOST, \n  port: process.env.LOGSTASH_PORT \n});\nlogger.add(logstash);`}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-secondary/20 rounded-2xl border border-white/5">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-500" />
                  Metrics (Prometheus)
                </h3>
                <p className="text-sm text-muted-foreground mb-4">Monetique Eye automatically discovers container metrics via `cAdvisor`. For custom application metrics:</p>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li>• **Auto-Discovery**: Monetique Eye scrapes containers by looking for labels or known ports.</li>
                  <li>• **Micrometer**: For Spring Boot, enable `/actuator/prometheus` and set `management.endpoints.web.exposure.include=prometheus`.</li>
                  <li>• **Labeling**: Use `com.monetique.eye.monitor=true` Docker labels to prioritize your containers in the topology view.</li>
                </ul>
              </div>
            </section>
          </div>
        );
      case 'operations':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-extrabold tracking-tight">Deployment &amp; Operations</h1>

            <div className="space-y-6">
              <section className="space-y-3">
                <h2 className="text-2xl font-bold">Deployment Lifecycle</h2>
                <p className="text-muted-foreground">The platform uses <strong>Ansible Playbooks</strong> to manage the lifecycle of applications. Every deployment follows a strict pipeline:</p>
                <div className="flex flex-col md:flex-row gap-4 py-4">
                  {['Validate', 'Build', 'Ship', 'Audit'].map((step, i) => (
                    <React.Fragment key={step}>
                      <div className="flex-1 p-4 bg-secondary/30 border border-white/5 rounded-xl text-center">
                        <span className="text-[10px] font-bold text-primary uppercase block mb-1">Step {i + 1}</span>
                        <span className="font-bold">{step}</span>
                      </div>
                      {i < 3 && <div className="hidden md:flex items-center"><ArrowRight className="w-4 h-4 text-muted-foreground" /></div>}
                    </React.Fragment>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-bold">Application Management</h2>
                <p className="text-muted-foreground">The Applications page is the control plane for all containerized services across your environments.</p>
                <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-muted-foreground uppercase text-[10px] font-bold tracking-widest">
                      <tr>
                        <th className="px-6 py-3">Action</th>
                        <th className="px-6 py-3">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      <tr><td className="px-6 py-3 font-bold text-primary">Deploy</td><td className="px-6 py-3">First-time deployment. Clones the Git repo, builds a Docker image on the target node, and starts the container.</td></tr>
                      <tr><td className="px-6 py-3 font-bold text-primary">Redeploy</td><td className="px-6 py-3">Pulls the latest code from the configured branch, rebuilds the image, and replaces the running container.</td></tr>
                      <tr><td className="px-6 py-3 font-bold text-primary">Restart</td><td className="px-6 py-3">Restarts the existing container without rebuilding the image.</td></tr>
                      <tr><td className="px-6 py-3 font-bold text-primary">Undeploy</td><td className="px-6 py-3">Stops the container, removes the image, and deletes the application record.</td></tr>
                      <tr><td className="px-6 py-3 font-bold text-primary">View Logs</td><td className="px-6 py-3">View Ansible execution logs for the last deployment attempt, including success/failure details.</td></tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-2xl font-bold">GitHub Auto-Analysis</h2>
                <p className="text-muted-foreground">When deploying from a GitHub repository, the backend performs an automated analysis of your codebase:</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Detects the runtime (Java/Maven, Node.js, Python) by scanning for pom.xml, package.json, or requirements.txt.</li>
                  <li>• Generates a Dockerfile if one doesn't exist in the repository.</li>
                  <li>• For frontend apps with Nginx, generates an nginx.conf with proper SPA routing.</li>
                  <li>• Injects build-time environment variables via Docker build args.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-2xl font-bold">Backup &amp; DR</h2>
                <p className="text-muted-foreground">The database (MySQL) and index stores (Elasticsearch) should be backed up daily. The configuration stored in the gitops directory is the source of truth for the entire infrastructure.</p>
              </section>
            </div>
          </div>
        );
      case 'architecture':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-extrabold tracking-tight">How the System Works</h1>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold">Data Flow Architecture</h2>
              <p className="text-muted-foreground">Monetique Eye operates on a pull-based telemetry model with a push-based deployment model.</p>

              <div className="space-y-6">
                <div className="p-6 bg-secondary/10 border border-white/5 rounded-2xl">
                  <h4 className="font-bold mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-500" />
                    Observability Pipeline
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                    <div className="p-3 border border-white/5 rounded bg-black/20 text-[10px]">Managed Node<br /><span className="text-muted-foreground">cAdvisor</span></div>
                    <div className="flex items-center justify-center">→</div>
                    <div className="p-3 border border-white/5 rounded bg-black/20 text-[10px]">Central Node<br /><span className="text-muted-foreground">Prometheus</span></div>
                    <div className="flex items-center justify-center">→</div>
                    <div className="p-3 border border-white/5 rounded bg-primary/10 text-[10px] font-bold">Backend API<br /><span className="text-muted-foreground">Spring Boot</span></div>
                    <div className="flex items-center justify-center">→</div>
                    <div className="p-3 border border-white/5 rounded bg-emerald-500/10 text-[10px] font-bold">Frontend UI<br /><span className="text-muted-foreground">React</span></div>
                  </div>
                </div>

                <div className="p-6 bg-secondary/10 border border-white/5 rounded-2xl">
                  <h4 className="font-bold mb-4 flex items-center gap-2">
                    <Rocket className="w-5 h-5 text-primary" />
                    Deployment Workflow
                  </h4>
                  <ul className="space-y-4 text-sm text-muted-foreground">
                    <li>1. **UI Trigger**: User clicks 'Deploy' in the Applications page.</li>
                    <li>2. **Ansible Orchestration**: Backend generates a dynamic inventory and executes an Ansible Playbook via SSH.</li>
                    <li>3. **Node Execution**: The target node pulls the Docker image and restarts the container with new parameters.</li>
                    <li>4. **Finalization**: Ansible returns the exit status; backend updates the Audit Log and Database.</li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        );
      case 'troubleshooting':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-extrabold tracking-tight">Debugging & Troubleshooting</h1>

            <div className="space-y-8">
              <section className="space-y-4">
                <h2 className="text-2xl font-bold">Common Issues</h2>
                <div className="space-y-4">
                  <Card className="p-4 border-l-4 border-l-destructive">
                    <h4 className="font-bold text-sm mb-1">Ansible Connection Failure (Code 4)</h4>
                    <p className="text-xs text-muted-foreground">This usually indicates an SSH authentication failure or a network timeout.</p>
                    <p className="text-xs font-bold text-primary mt-2">Solution: Verify SSH credentials in Settings and ensure the target node allows port 22 from vmpipe.</p>
                  </Card>
                  <Card className="p-4 border-l-4 border-l-amber-500">
                    <h4 className="font-bold text-sm mb-1">Stale Metrics in Topology</h4>
                    <p className="text-xs text-muted-foreground">Nodes showing 'CRITICAL' or 0% resources when they are actually running.</p>
                    <p className="text-xs font-bold text-primary mt-2">Solution: Check if `cAdvisor` is running on the target node. Run `docker ps` on the node to verify.</p>
                  </Card>
                  <Card className="p-4 border-l-4 border-l-blue-500">
                    <h4 className="font-bold text-sm mb-1">403 Forbidden on API calls</h4>
                    <p className="text-xs text-muted-foreground">Permissions seem correct but the UI shows errors.</p>
                    <p className="text-xs font-bold text-primary mt-2">Solution: Your JWT token may have expired. Clear browser localStorage and log in again.</p>
                  </Card>
                  <Card className="p-4 border-l-4 border-l-purple-500">
                    <h4 className="font-bold text-sm mb-1">Deployment Stuck on "DEPLOYING"</h4>
                    <p className="text-xs text-muted-foreground">The application card shows a spinner indefinitely.</p>
                    <p className="text-xs font-bold text-primary mt-2">Solution: Click "View Logs" on the app card to see Ansible output. Common causes: Docker not installed on target, port already in use, or insufficient disk space.</p>
                  </Card>
                  <Card className="p-4 border-l-4 border-l-emerald-500">
                    <h4 className="font-bold text-sm mb-1">Empty Logs in System Logs Console</h4>
                    <p className="text-xs text-muted-foreground">The log viewer shows "No telemetry matches found".</p>
                    <p className="text-xs font-bold text-primary mt-2">Solution: Verify that your application is sending logs to Logstash. Check LOGSTASH_HOST/PORT in .env. Ensure the Elasticsearch index exists for the app's service_name_keyword.</p>
                  </Card>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-2xl font-bold">Log Analysis</h2>
                <p className="text-sm text-muted-foreground">The application logs are stored in: '/data/monetique/backend/logs/app.log'. For infrastructure issues, check the systemd logs of the backend service.</p>
                <div className="bg-black p-4 rounded-lg font-mono text-xs text-emerald-500">
                  tail -f backend/logs/app.log | grep ERROR
                </div>
              </section>
            </div>
          </div>
        );
      case 'changelog':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-extrabold tracking-tight">Changelog & Release Notes</h1>

            <div className="space-y-8">
              <div className="relative pl-8 border-l-2 border-primary/20 opacity-70">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary/40 border-4 border-background"></div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  v2.0.0 - Future Roadmap
                  <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] uppercase tracking-widest">Incoming</span>
                </h3>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-4">Upcoming Release</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• **Planned**: Horizontal scaling and replica management.</li>
                  <li>• **Planned**: Advanced custom metric dashboards.</li>
                  <li>• **Planned**: Enhanced automated incident response.</li>
                </ul>
              </div>

              <div className="relative pl-8 border-l-2 border-primary/20">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-background shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                <h3 className="text-lg font-bold">v1.0.0 - Current Release</h3>
                <p className="text-[10px] text-primary uppercase font-bold tracking-widest mb-4">April 28, 2026</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• <strong>Core</strong>: Multi-environment observability platform with real-time Prometheus and ELK integration.</li>
                  <li>• <strong>Dashboard</strong>: System Overview with KPI cards, Health Stream, Pulse Feed, and System Load visualization.</li>
                  <li>• <strong>Topology</strong>: Real-time Cluster Graph with equilateral triangle layout and per-node CPU/RAM metrics.</li>
                  <li>• <strong>Operational Intelligence</strong>: Stability Gauge, Node Heatmap, Anomaly Detection, and Live Service Pulse table.</li>
                  <li>• <strong>Deployments</strong>: Ansible-based GitOps engine with Deploy, Redeploy, Restart, and Undeploy lifecycle.</li>
                  <li>• <strong>GitHub</strong>: Private repo integration with auto-analysis, Dockerfile generation, and Nginx config generation.</li>
                  <li>• <strong>Logs</strong>: Centralized log console with LIVE mode, severity filtering, date ranges, and CSV export.</li>
                  <li>• <strong>Incidents</strong>: Ticket management with priority levels, node/app linking, and OPEN→IN_PROGRESS→RESOLVED lifecycle.</li>
                  <li>• <strong>Security</strong>: Dual-layered RBAC (Global roles + Environment scoping) with granular permission matrix.</li>
                  <li>• <strong>Notifications</strong>: Real-time privilege change alerts via bell icon.</li>
                  <li>• <strong>AI Assistant</strong>: Built-in chatbot powered by Groq LLaMA 3.3 70B.</li>
                  <li>• <strong>Audit Log</strong>: Immutable system-wide activity log with filtering, search, and CSV export.</li>
                  <li>• <strong>Documentation</strong>: Enterprise Documentation Hub (this page).</li>
                </ul>
              </div>
            </div>
          </div>
        );
      case 'security':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-extrabold tracking-tight">Security &amp; Compliance</h1>

            <section className="space-y-6">
              <div className="p-6 bg-secondary/20 rounded-2xl border border-white/5">
                <h3 className="text-xl font-bold mb-4">Role-Based Access Control (RBAC)</h3>
                <p className="text-sm text-muted-foreground mb-4">Monetique Eye implements a dual-layered permission model:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-black/30 rounded-xl border border-white/5">
                    <h4 className="text-sm font-bold text-primary mb-2">Global Roles</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• <strong>ADMIN</strong>: Full access to everything, including user management.</li>
                      <li>• <strong>USER</strong>: Access is entirely governed by granular permissions.</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-black/30 rounded-xl border border-white/5">
                    <h4 className="text-sm font-bold text-primary mb-2">Environment Scoping</h4>
                    <p className="text-xs text-muted-foreground">Admins can restrict a user to specific environments. A user can be an operator in "Prod" but have no access to "Dev".</p>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-secondary/20 rounded-2xl border border-white/5">
                <h3 className="text-xl font-bold mb-4">Granular Permission Matrix</h3>
                <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-muted-foreground uppercase text-[10px] font-bold tracking-widest">
                      <tr>
                        <th className="px-6 py-3">Scope</th>
                        <th className="px-6 py-3">Permissions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      <tr><td className="px-6 py-3 font-bold text-primary">Monitoring</td><td className="px-6 py-3">Observability, Logs, Infrastructure Graph (each toggleable)</td></tr>
                      <tr><td className="px-6 py-3 font-bold text-primary">Env Deployment</td><td className="px-6 py-3">View / Create / Edit / Delete environments and nodes</td></tr>
                      <tr><td className="px-6 py-3 font-bold text-primary">App Deployment</td><td className="px-6 py-3">View / Create / Edit / Delete applications</td></tr>
                      <tr><td className="px-6 py-3 font-bold text-primary">Incidents</td><td className="px-6 py-3">View / Create / Edit / Delete tickets</td></tr>
                      <tr><td className="px-6 py-3 font-bold text-primary">AI Chatbot</td><td className="px-6 py-3">Toggle access to the AI Assistant</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-6 bg-secondary/20 rounded-2xl border border-white/5">
                <h3 className="text-xl font-bold mb-4">Authentication &amp; Notifications</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• <strong>JWT Tokens</strong>: Stateless auth with configurable expiration (JWT_EXPIRATION in .env, default 3600s).</li>
                  <li>• <strong>Privilege Change Alerts</strong>: When an admin modifies a user's permissions, the user receives a real-time notification in the top-right bell icon.</li>
                  <li>• <strong>SSH Key Management</strong>: SSH credentials for node deployment are used per-operation and never stored in plaintext.</li>
                </ul>
              </div>
            </section>
          </div>
        );
      case 'advanced':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-extrabold tracking-tight">Advanced Features</h1>

            <section className="space-y-6">
              <div className="p-6 bg-secondary/20 rounded-2xl border border-white/5">
                <h3 className="text-xl font-bold mb-4">AI Assistant (Chatbot)</h3>
                <p className="text-sm text-muted-foreground mb-4">Monetique Eye includes a built-in AI assistant powered by Groq (LLaMA 3.3 70B). Access it from the sidebar or the floating chat widget.</p>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li>• Ask questions about your infrastructure in natural language.</li>
                  <li>• Get AI-generated analysis of anomalies and log patterns.</li>
                  <li>• Access is controlled by the `chatbotAccess` permission flag.</li>
                  <li>• Configured via GROQ_API_KEY and GROQ_MODEL in your backend .env file.</li>
                </ul>
              </div>

              <div className="p-6 bg-secondary/20 rounded-2xl border border-white/5">
                <h3 className="text-xl font-bold mb-4">GitHub Integration &amp; Source Code Management</h3>
                <p className="text-sm text-muted-foreground mb-4">Link private GitHub repositories to enable automated deployments:</p>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li>• <strong>Token Management</strong>: Store GitHub Personal Access Tokens per-user for private repo access.</li>
                  <li>• <strong>Auto-Analyze</strong>: The backend scans your repository to detect the runtime (Java, Node.js, Python), generate a Dockerfile, and produce Nginx configurations for frontend apps automatically.</li>
                  <li>• <strong>Branch Selection</strong>: Choose which branch to deploy from (main, develop, feature branches).</li>
                </ul>
              </div>

              <div className="p-6 bg-secondary/20 rounded-2xl border border-white/5">
                <h3 className="text-xl font-bold mb-4">Environment Management</h3>
                <p className="text-sm text-muted-foreground mb-4">Environments are the core organizational unit in Monetique Eye:</p>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li>• <strong>Create</strong>: Define a name, description, and Prometheus label. The label maps to the `environment` label in your Prometheus scrape configs.</li>
                  <li>• <strong>Node Onboarding</strong>: Deploy monitoring agents (cAdvisor, Node Exporter, Promtail) to a remote node with a single click. Provide the target IP and SSH credentials.</li>
                  <li>• <strong>Node Undeployment</strong>: Remove monitoring agents from a node, cleaning up all containers and SSH keys.</li>
                  <li>• <strong>Node Inventory</strong>: View all nodes reporting to an environment, their status, IP, and running services.</li>
                </ul>
              </div>
            </section>
          </div>
        );
      case 'faq':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-extrabold tracking-tight">Frequently Asked Questions</h1>
            <div className="space-y-4">
              {[
                { q: 'How is the Stability Index calculated?', a: 'It starts at 100% and subtracts penalties: error z-score penalty (avg z-score × 15), CPU overshoot (CPU% above 80 × 2), RAM overshoot (RAM% above 85 × 2), and disk overshoot (Disk% above 90 × 3). The result is clamped between 0 and 100.' },
                { q: 'What ports does Monetique Eye use?', a: 'Backend API: 8880, Frontend: 5173 (dev) or 80 (prod), Prometheus: 9090, Elasticsearch: 9200, Logstash: 5044, Node Exporter: 9100, cAdvisor: 8080.' },
                { q: 'How do I add a new user?', a: 'Navigate to Settings (Admin only). Click "Create User", provide username, password, and role (ADMIN or USER). Then configure their granular permissions.' },
                { q: 'Can I restrict a user to only one environment?', a: 'Yes. In the permission editor, toggle "Environment Access" on and select only the environments the user should see. They will be unable to access any other environment data.' },
                { q: 'What happens when I deploy a node?', a: 'The backend executes an Ansible playbook via SSH that installs Docker (if missing), deploys cAdvisor, Node Exporter, and Promtail containers, and configures Prometheus scrape targets.' },
                { q: 'How do I connect my app logs to Monetique Eye?', a: 'Your application must send JSON-formatted logs to the Logstash endpoint (LOGSTASH_HOST:LOGSTASH_PORT). See the "Application Instrumentation" section for code examples.' },
              ].map((faq, i) => (
                <Card key={i} className="p-6">
                  <h3 className="font-bold mb-2">{faq.q}</h3>
                  <p className="text-sm text-muted-foreground">{faq.a}</p>
                </Card>
              ))}
            </div>
          </div>
        );
      default:
        return <div className="p-12 text-center text-muted-foreground italic">Section content under development...</div>;
    }
  };

  return (
    <div className="flex h-full overflow-hidden bg-[#0a0a0b]">
      {/* Documentation Sidebar */}
      <aside className="w-80 border-r border-white/5 bg-[#0c0c0e]/50 backdrop-blur-xl flex flex-col">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Book className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Documentation</h2>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Enterprise Hub</p>
            </div>
          </div>

          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${activeSection === section.id
                  ? 'bg-primary text-white shadow-lg shadow-primary/20'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <section.icon className={`w-4 h-4 ${activeSection === section.id ? 'text-white' : 'text-muted-foreground group-hover:text-primary'}`} />
                  <span className="text-sm font-medium">{section.title}</span>
                </div>
                {activeSection === section.id && <ChevronRight className="w-4 h-4" />}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-8 pt-0">
          <Card className="p-4 bg-primary/5 border-primary/10">
            <p className="text-[10px] font-bold text-primary uppercase mb-2">Support</p>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">Need help with a complex integration? Our team is available for enterprise support.</p>
            <button className="w-full py-2 bg-primary/10 text-primary text-[10px] font-bold uppercase rounded-lg hover:bg-primary/20 transition-colors">Contact Support</button>
          </Card>
        </div>
      </aside>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto scroll-smooth bg-gradient-to-br from-background to-[#0f0f12]">
        <div className="max-w-4xl mx-auto px-12 py-16">
          {renderContent()}

          <div className="mt-20 pt-10 border-t border-white/5 flex items-center justify-between text-muted-foreground">
            <p className="text-xs">© 2026 Monetique Eye Enterprise. All rights reserved.</p>
            <div className="flex gap-6">
              <button className="text-xs hover:text-foreground transition-colors">Legal</button>
              <button className="text-xs hover:text-foreground transition-colors">Privacy</button>
              <button className="text-xs hover:text-foreground transition-colors">SLA</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DocumentationPage;
