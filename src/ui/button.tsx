import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "accent" | "neutral";
type Shape = "pill" | "soft";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  shape?: Shape;
  children: ReactNode;
}

/* Shared button styles; callers can add a hover lift or other motion. */
export function Button({
  variant = "neutral",
  shape = "pill",
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
      className={`inline-flex items-center justify-center gap-2.5 ${shape === "soft" ? "rounded-md" : "rounded-full"} px-6 py-3.5 font-mono text-[13px] font-medium tracking-[0.14em] uppercase transition-[transform,box-shadow,background-color,color,border-color] duration-200 ease-out ${styles} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
