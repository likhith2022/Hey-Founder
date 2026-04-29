export function Badge({ children, tone = "default", className = "" }: { children: React.ReactNode; tone?: "default" | "green" | "amber" | "red" | "sky"; className?: string }) {
  const toneClass = tone === "green" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" 
    : tone === "amber" ? "border-amber-500/30 bg-amber-500/10 text-amber-300" 
    : tone === "red" ? "border-red-500/30 bg-red-500/10 text-red-300" 
    : tone === "sky" ? "border-sky-500/30 bg-sky-500/10 text-sky-400"
    : "border-slate-600 bg-slate-800 text-slate-300";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${toneClass} ${className}`}>{children}</span>;
}
