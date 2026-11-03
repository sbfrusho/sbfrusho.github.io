/** Small hand-written primitives shared by every screen. */
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { applyTheme, storedTheme, THEME_ORDER, type ThemeMode } from "../theme";

const ICONS: Record<string, string> = {
  dashboard: "M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0",
  projects: "M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z",
  experience: "M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM9 8V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M4 13h16",
  research: "M10 3h4M11 3v6l-6 10a1.300 1.300 0 0 0 1 2h12a1.300 1.300 0 0 0 1-2L13 9V3M8 15h8",
  education: "m2 9 10-5 10 5-10 5zM6 11.500V16c0 1.500 3 3 6 3s6-1.500 6-3v-4.500",
  skills: "M12 3 4 7.500 12 12l8-4.500zM4 12l8 4.500 8-4.500M4 16.500 12 21l8-4.500",
  achievements: "M8 4h8v6a4 4 0 0 1-8 0zM8 6H4v2a3 3 0 0 0 4 2.800M16 6h4v2a3 3 0 0 1-4 2.800M12 14v4M8 20h8",
  stats: "M5 20v-7M12 20V5M19 20v-11",
  settings: "M4 7h10M18 7h2M4 17h2M10 17h10M16 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4M8 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4",
  media: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1M3 16l5-5 4 4 3-3 6 6M15 9.500a1 1 0 1 0 0-.100",
  history: "M4 12a8 8 0 1 0 2.500-5.800L4 8.500M4 4v4.500h4.500M12 8v4l3 2",
  backup: "M12 4v11M8 11l4 4 4-4M4 19h16",
  menu: "M4 8h16M4 16h16",
  close: "m6 6 12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  up: "M12 19V5M6 11l6-6 6 6",
  down: "M12 5v14M6 13l6 6 6-6",
  grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  check: "m5 13 4 4 10-11",
  alert: "M12 4 2.500 20h19zM12 10v4M12 17h.01",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 11v5M12 8h.01",
  arrow: "M7 17 17 7M8 7h9v9",
  back: "M11 5l-7 7 7 7M4 12h16",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.300-4.300",
  upload: "M12 16V5M8 9l4-4 4 4M4 19h16",
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5",
  sun: "M12 4V2m0 20v-2M4 12H2m20 0h-2M6.300 6.300 4.900 4.900m14.200 14.200-1.400-1.400M6.300 17.700l-1.400 1.400M19.100 4.900l-1.400 1.400M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  moon: "M20.500 14.200A8.500 8.500 0 0 1 9.800 3.500a8.500 8.500 0 1 0 10.700 10.700",
  system: "M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1M9 21h6M12 17v4",
  logout: "M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M15 8l4 4-4 4M19 12H9",
  star: "m12 4 2.500 5.200 5.700.8-4.100 4 1 5.700-5.100-2.700-5.100 2.700 1-5.700-4.100-4 5.700-.8z",
  eyeOff: "M4 4l16 16M10 6.200A9 9 0 0 1 21 12a13 13 0 0 1-2.500 3.300M6.500 7.500A13 13 0 0 0 3 12s3 6 9 6a9 9 0 0 0 4-1",
  eye: "M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  github: "M9 19c-4 1.300-4-2-6-2.500M15 21v-3.500c0-1 .1-1.400-.5-2 2.800-.3 5.500-1.400 5.500-6a4.600 4.600 0 0 0-1.300-3.200 4.200 4.200 0 0 0-.1-3.200s-1.100-.3-3.500 1.300a12 12 0 0 0-6.200 0C6.500 2.800 5.400 3.100 5.400 3.100a4.200 4.200 0 0 0-.1 3.200A4.600 4.600 0 0 0 4 9.500c0 4.600 2.700 5.700 5.500 6-.6.600-.6 1.200-.5 2V21",
  undo: "M9 7 4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2",
  download: "M12 4v11M8 11l4 4 4-4M4 19h16",
};

export function Icon({ name, size = 18, className = "" }: { name: keyof typeof ICONS | string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`flex-none ${className}`}>
      <path d={ICONS[name] ?? ""} />
    </svg>
  );
}

/** The site's name, from content.json at build time (see admin.astro). */
export const siteName = () => document.getElementById("admin-root")?.dataset.siteName ?? "Portfolio";

/** Same mark as the public site's header. */
export function BrandMark() {
  return <span aria-hidden="true" className="relative inline-block size-3.5 flex-none rounded-[2px] border-2 border-accent after:absolute after:left-1/2 after:top-1/2 after:size-1 after:-translate-x-1/2 after:-translate-y-1/2 after:bg-accent" />;
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="flex-none animate-spin motion-reduce:animate-none">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const BTN = "inline-flex items-center justify-center gap-2 min-h-11.5 rounded-lg px-4 py-2 text-[0.9375rem] font-medium leading-tight transition-colors disabled:cursor-not-allowed cursor-pointer";
export const btnVariants = {
  primary: `${BTN} bg-accent text-accent-ink hover:bg-[color-mix(in_oklch,var(--accent)_86%,var(--ink))] disabled:bg-surface-2 disabled:text-ink-2 disabled:hover:bg-surface-2`,
  secondary: `${BTN} border border-ink-3 text-ink hover:border-ink hover:bg-surface-2 disabled:opacity-50`,
  ghost: `${BTN} text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-50`,
  danger: `${BTN} bg-danger text-accent-ink hover:bg-[color-mix(in_oklch,var(--danger)_86%,var(--ink))] disabled:opacity-50`,
  dangerGhost: `${BTN} text-danger hover:bg-[color-mix(in_oklch,var(--danger)_10%,transparent)] disabled:opacity-50`,
};

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof btnVariants;
  icon?: string;
  busy?: boolean;
}

export function Button({ variant = "secondary", icon, busy, children, className = "", disabled, type = "button", ...rest }: BtnProps) {
  return (
    <button type={type} className={`${btnVariants[variant]} ${className}`} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {busy ? <Spinner /> : icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

export function IconButton({ label, icon, className = "", type = "button", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: string }) {
  return (
    <button type={type} aria-label={label} title={label} className={`inline-flex size-11 flex-none items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent cursor-pointer ${className}`} {...rest}>
      <Icon name={icon} />
    </button>
  );
}

export function ExtLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 font-medium text-ink underline decoration-ink-3 decoration-1 underline-offset-4 transition-colors hover:text-accent hover:decoration-current ${className}`}>
      {children}
      <Icon name="arrow" size={14} className="text-ink-3" />
    </a>
  );
}

export function Card({ title, description, actions, children, className = "" }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[var(--r-3)] border border-line bg-surface p-4 sm:p-5 ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            {title && <h2 className="font-display text-lg font-semibold tracking-tight text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-ink-2">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 sm:mb-6">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs tracking-wide text-ink-2">{eyebrow}</p>}
        <h1 ref={ref} tabIndex={-1} data-page-title className="font-display text-3xl font-semibold leading-none tracking-tight text-ink outline-none sm:text-4xl">
          {title}
        </h1>
        {description && <p className="mt-2 max-w-prose text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon = "info", title, children, action }: { icon?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--r-3)] border border-dashed border-line px-6 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-ink-2"><Icon name={icon} /></span>
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      {children && <p className="max-w-sm text-sm text-ink-2">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Note({ kind = "info", children, className = "" }: { kind?: "info" | "warning" | "error" | "success"; children: ReactNode; className?: string }) {
  const tone = {
    info: "border-line bg-surface-2 text-ink-2",
    warning: "border-warning/50 bg-warning/10 text-ink",
    error: "border-danger/50 bg-danger/10 text-ink",
    success: "border-accent/40 bg-accent-soft text-ink",
  }[kind];
  const iconTone = { info: "text-ink-3", warning: "text-warning", error: "text-danger", success: "text-accent" }[kind];
  return (
    <div role={kind === "error" ? "alert" : undefined} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${tone} ${className}`}>
      <Icon name={kind === "success" ? "check" : kind === "info" ? "info" : "alert"} className={`mt-px ${iconTone}`} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "accent" | "warning" | "danger"; children: ReactNode }) {
  const t = {
    neutral: "bg-surface-2 text-ink-2",
    accent: "bg-accent-soft text-ink",
    warning: "bg-warning/15 text-ink",
    danger: "bg-danger/15 text-ink",
  }[tone];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[0.6875rem] leading-4 ${t}`}>{children}</span>;
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 py-6 text-sm text-ink-2">
      <Spinner /> {label}
    </p>
  );
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>("system");
  useEffect(() => setMode(storedTheme()), []);
  const next = THEME_ORDER[(THEME_ORDER.indexOf(mode) + 1) % THEME_ORDER.length] as ThemeMode;
  const name = mode === "system" ? "follows system" : mode;
  return (
    <IconButton
      className={className}
      label={`Theme: ${name}. Switch to ${next}.`}
      icon={mode === "system" ? "system" : mode === "light" ? "sun" : "moon"}
      onClick={() => {
        applyTheme(next);
        setMode(next);
      }}
    />
  );
}

export function useUniqueId(prefix: string) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.round((Date.now() - then) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d > 1 ? "s" : ""} ago`;
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export const firstLine = (s: string) => s.split("\n")[0] ?? "";
