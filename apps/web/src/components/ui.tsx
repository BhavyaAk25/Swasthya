"use client";

import { AnimatePresence, motion, type HTMLMotionProps, type Transition } from "framer-motion";
import { X, type LucideIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { cn } from "@/lib/utils";

/** One shared spring so every movement in the app feels the same: soft, no bounce. */
export const calm: Transition = { type: "spring", stiffness: 260, damping: 32, mass: 0.9 };
export const fade: Transition = { duration: 0.45, ease: [0.22, 1, 0.36, 1] };

export function Card({ className, children, ...rest }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      className={cn("rounded-[28px] border border-line bg-surface p-5 shadow-[var(--shadow-sm)] sm:p-6", className)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

type ButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  children?: React.ReactNode;
  variant?: "primary" | "soft" | "ghost" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  icon?: LucideIcon;
};

export function Button({ variant = "primary", size = "md", icon: Icon, className, children, ...rest }: ButtonProps) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      transition={calm}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold disabled:opacity-40",
        size === "sm" && "h-9 px-4 text-[13px]",
        size === "md" && "h-11 px-5 text-sm",
        size === "lg" && "h-14 px-7 text-[15px]",
        size === "icon" && "h-14 w-14 shrink-0",
        variant === "primary" && "bg-moss text-white shadow-[0_8px_24px_-10px_rgba(61,90,79,0.7)] hover:bg-[#344f45]",
        variant === "soft" && "bg-moss-soft text-moss hover:bg-[#d4dfd7]",
        variant === "ghost" && "text-ink-soft hover:bg-surface-2 hover:text-ink",
        variant === "outline" && "border border-line bg-surface text-ink hover:border-[rgba(29,39,35,0.16)]",
        className,
      )}
      {...rest}
    >
      {Icon ? <Icon className="h-4 w-4" strokeWidth={1.8} /> : null}
      {children}
    </motion.button>
  );
}

export function IconButton({
  icon: Icon,
  label,
  className,
  ...rest
}: HTMLMotionProps<"button"> & { icon: LucideIcon; label: string }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.92 }}
      transition={calm}
      className={cn(
        "grid h-10 w-10 place-items-center rounded-full text-ink-soft hover:bg-surface-2 hover:text-ink",
        className,
      )}
      {...rest}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
    </motion.button>
  );
}

export function Chip({
  active,
  className,
  children,
  ...rest
}: HTMLMotionProps<"button"> & { active?: boolean }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      transition={calm}
      aria-pressed={active}
      className={cn(
        "h-9 shrink-0 rounded-full border px-4 text-[13px] font-medium",
        active ? "border-transparent bg-moss text-white" : "border-line bg-surface text-ink-soft hover:text-ink",
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

const tones = {
  sage: "from-[#dfe7e1] via-[#cfdcd3] to-[#b8cbbf]",
  clay: "from-[#f3e9de] via-[#ead8c6] to-[#dcc0a5]",
  mist: "from-[#e6ecee] via-[#d6e0e4] to-[#c3d1d7]",
  dusk: "from-[#e9e3ea] via-[#ddd3df] to-[#c9bccd]",
};

/** Image area that shows a calm gradient placeholder until a real `src` is provided. */
export function ImageSlot({
  src,
  alt = "",
  tone = "sage",
  label,
  className,
  children,
}: {
  src?: string | null;
  alt?: string;
  tone?: keyof typeof tones;
  label?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const show = src && !failed;
  return (
    <div className={cn("relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br", tones[tone], className)}>
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <>
          <div className="absolute -left-1/4 top-1/4 h-3/4 w-3/4 rounded-full bg-white/30 blur-3xl" />
          <div className="absolute -bottom-1/4 right-0 h-2/3 w-2/3 rounded-full bg-white/20 blur-2xl" />
          <div className="grain absolute inset-0" />
          {label ? (
            <div className="absolute right-4 top-4 rounded-full bg-white/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/50 backdrop-blur">
              {label}
            </div>
          ) : null}
        </>
      )}
      {children ? <div className="relative z-10 h-full">{children}</div> : null}
    </div>
  );
}

/** Animated progress ring. */
export function Ring({
  value,
  size = 120,
  stroke = 8,
  color = "var(--moss)",
  track = "var(--surface-2)",
  children,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Bar({ value, color = "var(--moss)" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

/**
 * Modal surface. Bottom sheet on phones, centred panel on larger screens.
 * Closes on Escape or backdrop click, locks page scroll while open.
 */
export function Sheet({
  open,
  onClose,
  title,
  size = "md",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: "md" | "lg";
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fade}
        >
          <div className="absolute inset-0 bg-[rgba(29,39,35,0.28)] backdrop-blur-[6px]" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? id : undefined}
            initial={{ y: 40, opacity: 0, scale: 0.985 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 28, opacity: 0, scale: 0.985 }}
            transition={calm}
            className={cn(
              "relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[32px] bg-surface shadow-[var(--shadow-md)] sm:rounded-[32px]",
              size === "md" ? "sm:max-w-lg" : "sm:max-w-3xl",
            )}
          >
            <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-ink/10 sm:hidden" />
            <div className="flex shrink-0 items-center justify-between gap-4 px-6 pb-2 pt-4 sm:pt-6">
              {title ? (
                <h2 id={id} className="font-display text-2xl">
                  {title}
                </h2>
              ) : (
                <span />
              )}
              <IconButton icon={X} label="Close" onClick={onClose} className="-mr-2 bg-surface-2" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2">{children}</div>
            {footer ? (
              <div className="shrink-0 border-t border-line px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function Stat({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="font-display text-3xl tabular-nums">{value}</span>
        {unit ? <span className="text-sm text-ink-faint">{unit}</span> : null}
      </div>
    </div>
  );
}

/** Small toast for confirmations; auto-dismisses. */
export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [message, onDone]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 lg:bottom-8">
      <AnimatePresence>
        {message ? (
          <motion.div
            key={message}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={calm}
            className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow-md)]"
          >
            {message}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
