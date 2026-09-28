import { Loader2 } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center text-neutral-500" aria-busy="true">
      <Loader2 className="w-6 h-6 animate-spin" aria-label="Loading" />
    </div>
  );
}
