import type { ReactNode } from "react";

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="font-mono text-xs text-zinc-500">{children}</p>;
}

export function ErrorLine({ error }: { error: string | null }) {
  return error ? <p className="font-mono text-xs text-rose-400">{error}</p> : null;
}

const TONES = {
  zinc: "border-zinc-700 bg-zinc-800/60 text-zinc-300",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  sky: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  violet: "border-violet-500/30 bg-violet-500/10 text-violet-300",
} as const;

export type Tone = keyof typeof TONES;

export function Pill({ tone = "zinc", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[11px] ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "ghost",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  type?: "button" | "submit";
}) {
  const styles = {
    primary: "bg-zinc-100 text-zinc-950 hover:bg-white",
    ghost: "border border-zinc-700 text-zinc-200 hover:border-zinc-500",
    danger: "border border-rose-500/40 text-rose-300 hover:bg-rose-500/10",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  );
}
