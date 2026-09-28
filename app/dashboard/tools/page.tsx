import { DashboardNav } from '@/components/DashboardNav';
import { ToolSuiteHub } from '@/components/ToolSuiteHub';

export default function ToolSuitePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:p-8 text-neutral-100 min-h-screen space-y-8">
      <DashboardNav />
      <div className="border-b border-neutral-800 pb-6">
        <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest">
          Creator Tool Suite Hub
        </span>
        <h1 className="text-2xl font-black mt-1">Contextual next steps, not a generic toolbox</h1>
      </div>

      <ToolSuiteHub />
    </div>
  );
}
