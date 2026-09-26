import { DashboardNav } from '@/components/DashboardNav';
import { ScheduleCalendar } from '@/components/ScheduleCalendar';

export default function SchedulePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:p-8 text-neutral-100 min-h-screen space-y-8">
      <DashboardNav />
      <div className="border-b border-neutral-800 pb-6">
        <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest">
          Algorithmic Scheduling &amp; Publishing Planner
        </span>
        <h1 className="text-2xl font-black mt-1">Your weekly multi-platform content calendar</h1>
      </div>

      <ScheduleCalendar />
    </div>
  );
}
