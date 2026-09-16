export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-xl w-full text-center space-y-4">
        <h2 className="text-4xl font-black">404</h2>
        <p className="text-neutral-400">This page could not be found.</p>
      </div>
    </div>
  );
}
