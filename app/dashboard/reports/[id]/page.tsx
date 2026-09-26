import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { ArrowLeft } from 'lucide-react';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { PageShell } from '@/components/PageShell';
import { AnalysisReportCard } from '@/components/AnalyzerForm';
import { BlueprintCard } from '@/components/DeepDiveForm';
import { DiagnosisCard } from '@/components/UploadDiagnosticForm';
import { GapAnalysisCard } from '@/components/CompetitorTrackerForm';
import { DiscoveryCard } from '@/components/SiteDiscoveryForm';
import { formatDateTime, REPORT_KINDS, UUID_RE } from '@/lib/report-meta';
import type {
  AuditReportRow,
  CompetitorGapAnalysis,
  GrowthBlueprint,
  SiteDiscoveryResult,
  UploadDiagnosis,
  ViralGapAnalysis,
} from '@/lib/types';

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  // Scoped to the signed-in user: someone else's report id is a 404, not a
  // 403, so ids can't be probed for existence.
  const { data } = await createSupabaseAdminClient()
    .from('audit_reports')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId!)
    .maybeSingle();
  if (!data) notFound();

  const report = data as AuditReportRow;
  const kind = REPORT_KINDS[report.source_type] ?? { label: 'Report', path: '/dashboard/history' };

  let card: React.ReactNode;
  switch (report.source_type) {
    case 'url':
      card = <AnalysisReportCard report={report as AuditReportRow<ViralGapAnalysis>} />;
      break;
    case 'account':
      card = <BlueprintCard report={report as AuditReportRow<GrowthBlueprint>} />;
      break;
    case 'upload':
      card = <DiagnosisCard report={report as AuditReportRow<UploadDiagnosis>} />;
      break;
    case 'competitors':
      card = <GapAnalysisCard report={report as AuditReportRow<CompetitorGapAnalysis>} />;
      break;
    case 'discovery':
      card = <DiscoveryCard report={report as AuditReportRow<SiteDiscoveryResult>} />;
      break;
    default:
      notFound();
  }

  return (
    <PageShell
      eyebrow={kind.label}
      title={report.source_url ?? kind.label}
      description={`Saved ${formatDateTime(report.created_at)}`}
      aside={
        <Link href={kind.path} className="inline-flex items-center min-h-[36px] text-xs font-mono text-amber-400 hover:text-amber-300">
          Run a new one
        </Link>
      }
    >
      <Link href="/dashboard/history" className="inline-flex items-center gap-1 min-h-[36px] text-xs text-neutral-400 hover:text-neutral-200">
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden /> All history
      </Link>
      {card}
    </PageShell>
  );
}
