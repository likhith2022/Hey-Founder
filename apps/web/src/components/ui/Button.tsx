import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger"; size?: "sm" | "md" | "lg" }) {
  const sizeClasses: Record<string, string> = {
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-4 text-sm",
    lg: "h-10 px-6 text-base"
  };
  return <button className={clsx("inline-flex items-center justify-center gap-2 rounded-md font-medium transition disabled:opacity-50", sizeClasses[size as string], variant === "primary" && "bg-sky-300 text-slate-950 hover:bg-sky-200", variant === "secondary" && "border border-line bg-panel text-slate-200 hover:bg-slate-800", variant === "danger" && "bg-red-500 text-white hover:bg-red-400", className)} {...props} />;
}
