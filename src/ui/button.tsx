import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "accent" | "neutral";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

/* Uppercase, wide-tracked CTA buttons, matching the reference. */
export function Button({
  variant = "neutral",
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const styles =
    variant === "accent"
      ? "bg-accent text-accent-ink hover:bg-accent-hover active:translate-y-px"
      : "bg-raised text-ink border border-line hover:border-line-strong";
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2.5 rounded-lg px-6 py-3.5 font-mono text-[13px] font-medium tracking-[0.14em] uppercase transition-colors ${styles} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
