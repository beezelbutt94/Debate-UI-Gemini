import { DashboardNav } from '@/components/DashboardNav';

/** Standard dashboard page frame: navigation, page header, content. */
export function PageShell({
  eyebrow,
  title,
  description,
  aside,
  width = 'max-w-4xl',
  children,
}: {
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  aside?: React.ReactNode;
  width?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${width} mx-auto px-4 py-6 sm:p-8 text-neutral-100 min-h-screen space-y-8`}>
      <DashboardNav />
      <header className="border-b border-neutral-800 pb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest">{eyebrow}</span>
          <h1 className="text-2xl font-black mt-1 [overflow-wrap:anywhere]">{title}</h1>
          {description && <div className="text-sm text-neutral-400 mt-2 max-w-2xl">{description}</div>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </header>
      {children}
    </div>
  );
}
