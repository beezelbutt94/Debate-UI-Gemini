'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { PlatformServiceNotice } from '@/components/PlatformServiceNotice';
import { platformApiFetch } from '@/lib/platform-api';
import {
  Globe,
  ShieldCheck,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Trash2,
} from 'lucide-react';

interface CertificateCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
}

interface DomainStatusResponse {
  configured: boolean;
  domain?: string;
  dns_verified?: boolean;
  ssl_ready?: boolean;
  /**
   * `ssl_ready: false` alone is ambiguous — it covers both "still issuing"
   * and "we could not ask the cluster". The backend now reports which.
   */
  ssl_state?: 'ready' | 'provisioning' | 'not_provisioned' | 'unknown';
  ssl_error?: string | null;
  conditions?: CertificateCondition[];
}

const PLATFORM_CNAME_TARGET = process.env.NEXT_PUBLIC_PLATFORM_CNAME_TARGET || 'cname.example.com';

export default function WorkspaceDomainSettingsPage() {
  const [domainInput, setDomainInput] = useState('');
  const [statusData, setStatusData] = useState<DomainStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);

  // Older backends don't send ssl_state; infer the previous two-way meaning
  // so this page keeps working against them.
  const sslState =
    statusData?.ssl_state ?? (statusData?.ssl_ready ? 'ready' : 'provisioning');

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fetchDomainStatus = useCallback(async (showIndicator = false) => {
    if (showIndicator) setPolling(true);

    const result = await platformApiFetch<DomainStatusResponse>(
      '/api/v1/workspace/domain/status',
      { cache: 'no-store' }
    );

    if (result.state === 'ok') {
      setStatusData(result.data);
      setServiceUnavailable(false);
      setErrorMessage(null);
    } else if (result.state === 'unavailable') {
      setServiceUnavailable(true);
    } else if (result.state === 'not_found') {
      // Not the same as "no domain configured" — that is a 200 with
      // configured:false. A 404 here means the endpoint itself is missing.
      setErrorMessage(
        'The domain status endpoint is missing from this backend. It may be running an older version.'
      );
    } else if (result.state === 'unreachable') {
      setErrorMessage(`Could not reach the domain service: ${result.message}`);
    } else {
      setErrorMessage(result.message);
    }

    setLoading(false);
    if (showIndicator) setPolling(false);
  }, []);

  useEffect(() => {
    fetchDomainStatus();
  }, [fetchDomainStatus]);

  useEffect(() => {
    if (!statusData?.configured) return;
    if (statusData.dns_verified && statusData.ssl_ready) return;
    // Polling only makes sense while something is still in flight. If the
    // certificate was never requested, or the backend can't reach the
    // cluster to find out, re-asking every 6s forever just hides the
    // problem behind a spinner.
    if (statusData.ssl_state === 'not_provisioned' || statusData.ssl_state === 'unknown') return;

    const interval = setInterval(() => fetchDomainStatus(), 6000);
    return () => clearInterval(interval);
  }, [statusData, fetchDomainStatus]);

  const handleBindDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput.trim()) return;

    setSubmitting(true);
    setErrorMessage(null);

    const result = await platformApiFetch('/api/v1/workspace/domain/bind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ custom_domain: domainInput.trim().toLowerCase() }),
    });

    if (result.state === 'ok') {
      setDomainInput('');
      await fetchDomainStatus(true);
    } else if (result.state === 'unavailable') {
      setServiceUnavailable(true);
    } else if (result.state === 'unreachable') {
      setErrorMessage(`Could not reach the domain service: ${result.message}`);
    } else if (result.state === 'not_found') {
      setErrorMessage('The domain bind endpoint is missing from this backend.');
    } else {
      // The backend's detail names the actual problem ("DNS CNAME record not
      // detected. Point x at y."), which a generic "Failed to bind domain"
      // threw away.
      setErrorMessage(result.message);
    }

    setSubmitting(false);
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect your custom domain? Active video links and white-label portals will stop resolving.')) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const result = await platformApiFetch<{ status?: string; detail?: string }>(
      '/api/v1/workspace/domain/unbind',
      { method: 'DELETE' }
    );

    if (result.state === 'ok') {
      setStatusData({ configured: false });
      // The backend returns 'partial' when the domain was unbound in the
      // database but its cluster resources survived — the old domain can
      // still serve traffic, so that cannot be reported as a clean success.
      if (result.data?.status === 'partial') {
        setErrorMessage(
          result.data.detail ??
            'The domain was disconnected, but its cluster resources could not be removed.'
        );
      }
    } else if (result.state === 'unavailable') {
      setServiceUnavailable(true);
    } else {
      // Previously every failure here was swallowed: the button spun, the
      // domain stayed connected, and nothing on screen changed.
      setErrorMessage(
        result.state === 'not_found'
          ? 'The domain unbind endpoint is missing from this backend.'
          : `Could not disconnect the domain: ${result.message}`
      );
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-xs text-neutral-500 font-mono">
        <Loader2 className="w-5 h-5 animate-spin text-amber-500 mr-2" /> Inspecting workspace ingress...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8 text-neutral-100 min-h-screen space-y-8">
      <div>
        <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest flex items-center gap-1">
          <Globe className="w-3.5 h-3.5" /> White-Label Infrastructure
        </span>
        <h1 className="text-3xl font-black mt-1">Custom Domain &amp; Edge SSL</h1>
        <p className="text-xs text-neutral-400 mt-1">
          Point your brand&apos;s domain at this workspace, with automated Let&apos;s Encrypt certificates.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-950/50 border border-rose-800 rounded-xl flex items-start gap-3 text-xs text-rose-300">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {serviceUnavailable ? (
        <PlatformServiceNotice feature="Custom domains" />
      ) : !statusData?.configured ? (
        <div className="p-6 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-5">
          <div>
            <h3 className="text-base font-bold text-white">Connect Custom Domain</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Enter your subdomain (e.g., <code className="text-neutral-200">video.brand.com</code>).
            </p>
          </div>

          <form onSubmit={handleBindDomain} className="space-y-4">
            <div>
              <label className="text-xs uppercase font-semibold text-neutral-400 block mb-1">Domain Name</label>
              <input
                type="text"
                required
                placeholder="video.yourcompany.com"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-100 font-mono outline-none focus:border-amber-500"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting || !domainInput.trim()}
              className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs px-5 py-2.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying DNS...
                </>
              ) : (
                <>
                  Connect Domain <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="p-6 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
              <div>
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wide block">
                  Active Custom Hostname
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <h2 className="text-xl font-bold font-mono text-white">{statusData.domain}</h2>
                  <a href={`https://${statusData.domain}`} target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-white">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={polling} onClick={() => fetchDomainStatus(true)} className="border-neutral-800 bg-neutral-900 text-neutral-200 text-xs font-mono">
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${polling ? 'animate-spin' : ''}`} />
                  Check Status
                </Button>
                <Button size="sm" variant="outline" onClick={handleDisconnect} className="border-neutral-800 bg-neutral-900 text-rose-400 hover:bg-rose-950/50 hover:text-rose-300 text-xs font-mono">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-200">1. DNS CNAME Record</span>
                  {statusData.dns_verified ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-[10px] font-mono uppercase font-bold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Configured
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800 text-amber-400 text-[10px] font-mono uppercase font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Unverified
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-400">
                  {statusData.dns_verified ? 'Your DNS record points correctly at our edge.' : 'CNAME record not found. Add the record below to finish setup.'}
                </p>
              </div>

              <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-200">2. Let&apos;s Encrypt Edge SSL</span>
                  {statusData.ssl_ready ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-[10px] font-mono uppercase font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Active
                    </span>
                  ) : sslState === 'unknown' || sslState === 'not_provisioned' ? (
                    // A spinner here would promise progress that isn't
                    // happening: nothing is issuing, and waiting won't help.
                    <span className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800 text-rose-400 text-[10px] font-mono uppercase font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {sslState === 'unknown' ? 'Status unknown' : 'Not started'}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800 text-amber-400 text-[10px] font-mono uppercase font-bold flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Issuing
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-400">
                  {statusData.ssl_ready
                    ? 'Valid TLS certificate active with automatic renewal.'
                    : statusData.ssl_error ?? 'ACME challenge in progress.'}
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300">Required DNS Settings</h4>
              <div className="border border-neutral-800 rounded-xl overflow-hidden font-mono text-xs">
                <table className="w-full text-left">
                  <thead className="bg-neutral-900 text-neutral-400 text-[10px] uppercase border-b border-neutral-800">
                    <tr>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Name / Host</th>
                      <th className="py-2.5 px-4">Value / Target</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60 bg-neutral-950">
                    <tr>
                      <td className="py-3 px-4 text-amber-400 font-bold">CNAME</td>
                      <td className="py-3 px-4 text-white">{statusData.domain?.split('.')[0] || 'video'}</td>
                      <td className="py-3 px-4 text-neutral-300 select-all">{PLATFORM_CNAME_TARGET}</td>
                      <td className="py-3 px-4 text-right">
                        <Button size="sm" variant="ghost" onClick={() => copyToClipboard(PLATFORM_CNAME_TARGET, 'target')} className="h-7 px-2 text-neutral-400 hover:text-white">
                          {copiedKey === 'target' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {statusData.conditions && statusData.conditions.length > 0 && (
              <div className="pt-4 border-t border-neutral-800 space-y-2">
                <span className="text-[11px] font-mono text-neutral-500 uppercase block">Certificate Issuer Logs</span>
                <div className="space-y-1.5">
                  {statusData.conditions.map((cond, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] font-mono flex items-start justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={cond.status === 'True' ? 'text-emerald-400' : 'text-amber-400'}>{cond.type}</span>
                          <span className="text-neutral-500">/</span>
                          <span className="text-neutral-300">{cond.reason || 'StatusUpdate'}</span>
                        </div>
                        {cond.message && <p className="text-neutral-400">{cond.message}</p>}
                      </div>
                      {cond.lastTransitionTime && (
                        <span className="text-neutral-500 text-[10px] shrink-0 ml-2">
                          {new Date(cond.lastTransitionTime).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
