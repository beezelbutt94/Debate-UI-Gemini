/** Labels and home pages for each kind of saved report (audit_reports.source_type). */
export const REPORT_KINDS: Record<string, { label: string; path: string }> = {
  url: { label: 'Viral Gap Analysis', path: '/dashboard/analyze' },
  account: { label: 'Account Deep-Dive', path: '/dashboard/deep-dive' },
  upload: { label: 'Upload Diagnostic', path: '/dashboard/upload' },
  competitors: { label: 'Competitor Report', path: '/dashboard/competitors' },
  discovery: { label: 'Web Discovery', path: '/dashboard/discover' },
};

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}
