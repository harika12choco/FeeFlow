import { Loader2, AlertTriangle, Inbox } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes, InputHTMLAttributes } from "react";

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ Button */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent-600 text-white hover:bg-accent-700 focus:ring-accent-200 disabled:bg-accent-300",
  secondary:
    "bg-white text-navy-800 border border-navy-200 hover:bg-navy-50 focus:ring-navy-100",
  ghost: "bg-transparent text-navy-600 hover:bg-navy-50 focus:ring-navy-100",
  danger: "bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-200 disabled:bg-rose-300",
  subtle: "bg-accent-50 text-accent-700 hover:bg-accent-100 focus:ring-accent-200",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2.5 text-sm rounded-xl gap-2",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-semibold transition outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-80",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------- Card */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("ff-card", className)}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-navy-100 px-5 py-4">
      <div>
        <h3 className="text-sm font-bold text-navy-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-navy-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------- Badge */

type Tone = "neutral" | "green" | "amber" | "red" | "indigo" | "slate";

const TONES: Record<Tone, string> = {
  neutral: "bg-navy-50 text-navy-600 ring-navy-100",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  red: "bg-rose-50 text-rose-700 ring-rose-100",
  indigo: "bg-accent-50 text-accent-700 ring-accent-100",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Inputs */

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("ff-input", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("ff-input appearance-none pr-9", props.className)} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="ff-label">{label}</span>
      {children}
    </label>
  );
}

/* --------------------------------------------------------- State displays */

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-navy-400">
      <Loader2 className="h-7 w-7 animate-spin text-accent-500" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  icon,
  action,
}: {
  title: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="rounded-2xl bg-navy-50 p-3 text-navy-300">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <div>
        <h3 className="text-sm font-bold text-navy-800">{title}</h3>
        {message && <p className="mt-1 max-w-sm text-sm text-navy-400">{message}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="rounded-2xl bg-rose-50 p-3 text-rose-500">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-navy-800">Could not load this</h3>
        <p className="mt-1 max-w-sm text-sm text-navy-400">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Convenience wrapper handling the loading / error / empty / data states. */
export function QueryState<T>({
  isLoading,
  isError,
  error,
  data,
  isEmpty,
  onRetry,
  loadingLabel,
  empty,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  error?: string;
  data: T | undefined;
  isEmpty?: (d: T) => boolean;
  onRetry?: () => void;
  loadingLabel?: string;
  empty?: ReactNode;
  children: (d: T) => ReactNode;
}) {
  if (isLoading) return <Spinner label={loadingLabel} />;
  if (isError) return <ErrorState message={error || "Request failed"} onRetry={onRetry} />;
  if (data === undefined) return <Spinner label={loadingLabel} />;
  if (isEmpty && isEmpty(data)) return <>{empty}</>;
  return <>{children(data)}</>;
}
