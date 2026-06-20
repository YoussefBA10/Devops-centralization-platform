import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import {
  X, Box, HardDrive, Globe, AlertTriangle, ShieldAlert, Bug, Activity, Lightbulb, Loader2,
} from 'lucide-react';
import { getAttackSurfaceNodeDetail } from '../../services/api';
import type { AttackSurfaceNode, AttackSurfaceNodeDetail } from '../../types/security';

interface Props {
  node: AttackSurfaceNode | null;
  clusterId?: number;
  onClose: () => void;
}

const statusStyles: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/30',
  VULNERABLE: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  HEALTHY: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
};

const severityColor: Record<string, string> = {
  CRITICAL: 'text-red-400',
  HIGH: 'text-orange-400',
};

const typeIcon: Record<string, React.ReactNode> = {
  CONTAINER: <Box className="w-6 h-6 text-cyan-400" />,
  DATABASE: <Box className="w-6 h-6 text-purple-400" />,
  DOCKER_HOST: <HardDrive className="w-6 h-6 text-slate-300" />,
  API: <Globe className="w-6 h-6 text-teal-400" />,
};

const AttackSurfaceNodeDrawer: React.FC<Props> = ({ node, clusterId, onClose }) => {
  const [detail, setDetail] = useState<AttackSurfaceNodeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!node) {
      setDetail(null);
      return;
    }
    setLoading(true);
    setError(null);
    getAttackSurfaceNodeDetail(node.id, clusterId)
      .then((res) => setDetail(res.data))
      .catch(() => setError('Failed to load node details'))
      .finally(() => setLoading(false));
  }, [node, clusterId]);

  const displayNode = detail?.node ?? node;
  if (!displayNode) return null;

  const title = displayNode.serviceName || displayNode.label.split(' → ')[0]?.split(' [')[0] || displayNode.label;

  return (
    <AnimatePresence>
      {node && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative w-full max-w-xl bg-[#0a0a0a] border-l border-white/5 h-full shadow-2xl flex flex-col"
          >
            <div className="p-6 border-b border-white/5 relative bg-gradient-to-br from-primary/10 to-transparent shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="absolute top-5 right-5 p-2 hover:bg-white/5 rounded-full transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-start gap-4 pr-10">
                <div className="p-3 bg-primary/20 rounded-2xl">
                  {typeIcon[displayNode.type] ?? <ShieldAlert className="w-6 h-6 text-primary" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold tracking-tight truncate">{title}</h2>
                  {detail?.applicationName && (
                    <p className="text-sm text-muted-foreground mt-0.5">App: {detail.applicationName}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusStyles[displayNode.status] || statusStyles.HEALTHY}`}>
                      {displayNode.status}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-secondary/50 text-muted-foreground border-white/10">
                      {displayNode.type.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>
              {(displayNode.dockerHost || displayNode.environmentName) && (
                <p className="text-xs text-muted-foreground mt-3 font-mono">
                  {displayNode.dockerHost && `Host: ${displayNode.dockerHost}`}
                  {displayNode.environmentName && ` · Env: ${displayNode.environmentName}`}
                  {displayNode.port ? ` · Port: ${displayNode.port}` : ''}
                </p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {loading && (
                <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading details…
                </div>
              )}
              {error && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>
              )}
              {!loading && detail && (
                <>
                  {/* Risk summary */}
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" /> Why is this flagged?
                    </h3>
                    <ul className="space-y-2">
                      {detail.riskReasons.map((reason) => (
                        <li key={reason} className="text-sm text-foreground/90 flex gap-2">
                          <span className="text-amber-400 shrink-0">•</span>
                          {reason}
                        </li>
                      ))}
                    </ul>
                    {(displayNode.criticalVulns ?? 0) > 0 || (displayNode.highVulns ?? 0) > 0 || (displayNode.falcoEvents24h ?? 0) > 0 ? (
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        <div className="bg-white/[0.03] border border-white/5 rounded-lg p-3 text-center">
                          <p className="text-lg font-bold text-red-400">{displayNode.criticalVulns ?? 0}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">Critical</p>
                        </div>
                        <div className="bg-white/[0.03] border border-white/5 rounded-lg p-3 text-center">
                          <p className="text-lg font-bold text-orange-400">{displayNode.highVulns ?? 0}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">High</p>
                        </div>
                        <div className="bg-white/[0.03] border border-white/5 rounded-lg p-3 text-center">
                          <p className="text-lg font-bold text-amber-400">{displayNode.falcoEvents24h ?? 0}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">Falco 24h</p>
                        </div>
                      </div>
                    ) : null}
                  </section>

                  {/* Host: at-risk children */}
                  {detail.atRiskChildren.length > 0 && (
                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">At-risk containers on this host</h3>
                      <div className="space-y-2">
                        {detail.atRiskChildren.map((child) => (
                          <div key={child.id} className="p-3 rounded-lg bg-white/[0.03] border border-white/5 flex justify-between items-center gap-2">
                            <span className="text-sm truncate">{child.serviceName || child.label}</span>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border shrink-0 ${statusStyles[child.status]}`}>
                              {child.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Vulnerabilities */}
                  {detail.vulnerabilities.length > 0 && (
                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                        <Bug className="w-4 h-4 text-red-400" /> Scan findings ({detail.vulnerabilities.length})
                      </h3>
                      <div className="space-y-2 max-h-[280px] overflow-y-auto">
                        {detail.vulnerabilities.map((v) => (
                          <div key={v.id} className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                            <div className="flex items-start justify-between gap-2">
                              <span className={`text-[10px] font-bold uppercase ${severityColor[v.severity] || ''}`}>{v.severity}</span>
                              <span className="text-[10px] text-muted-foreground">{v.reportType === 'DEPENDENCY_CHECK' ? 'OWASP' : 'SonarQube'}</span>
                            </div>
                            <p className="font-mono text-xs mt-1 text-white">{v.identifier}</p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{v.title}</p>
                            {v.filePath && <p className="text-[10px] text-muted-foreground/80 mt-1 truncate">{v.filePath}</p>}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Falco */}
                  {detail.falcoEvents.length > 0 && (
                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-amber-400" /> Runtime alerts — Falco ({detail.falcoEvents.length})
                      </h3>
                      <div className="space-y-2 max-h-[240px] overflow-y-auto">
                        {detail.falcoEvents.map((e) => (
                          <div key={e.id} className="p-3 rounded-lg bg-white/[0.03] border border-amber-500/20">
                            <div className="flex justify-between gap-2 text-[10px] text-muted-foreground mb-1">
                              <span className="font-bold text-amber-300 uppercase">{e.priority}</span>
                              <span>{e.timestamp ? format(parseISO(String(e.timestamp)), 'MMM d HH:mm') : ''}</span>
                            </div>
                            <p className="text-xs font-medium text-white">{e.ruleName}</p>
                            <p className="text-xs text-muted-foreground mt-1 whitespace-normal break-words">{e.output}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Remediation */}
                  {detail.remediationHints.length > 0 && (
                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-emerald-400" /> Suggested actions
                      </h3>
                      <ul className="space-y-2">
                        {detail.remediationHints.map((hint) => (
                          <li key={hint} className="text-sm text-emerald-300/90 flex gap-2">
                            <span className="shrink-0">→</span>
                            {hint}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {detail.vulnerabilities.length === 0 && detail.falcoEvents.length === 0 && detail.atRiskChildren.length === 0
                    && displayNode.status === 'HEALTHY' && (
                    <p className="text-sm text-muted-foreground text-center py-8">No open critical/high findings or runtime alerts for this asset.</p>
                  )}

                  {detail.vulnerabilities.length === 0 && (displayNode.criticalVulns ?? 0) + (displayNode.highVulns ?? 0) > 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Scan summary shows open findings — expand the OWASP &amp; SonarQube table below for the full list.
                    </p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AttackSurfaceNodeDrawer;
