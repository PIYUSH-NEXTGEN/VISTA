import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function icon(props: IconProps): SVGProps<SVGSVGElement> {
  const base: SVGProps<SVGSVGElement> = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  return { ...base, ...props };
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

export function LibraryIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 15.5 8 11l4 3.5L15 11l6 5" />
      <circle cx="9" cy="8" r="1.4" />
    </svg>
  );
}

export function EditorIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M4 8h9M17 8h3M4 16h3M11 16h9" />
      <circle cx="15" cy="8" r="2" />
      <circle cx="9" cy="16" r="2" />
    </svg>
  );
}

export function HealthIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M3 12h4l2-5 4 10 2-5h6" />
    </svg>
  );
}

export function ToolsIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M14.5 6.5a3.5 3.5 0 1 0 4.7 4.1l-3.9 3.9-5.7 5.7a2.1 2.1 0 0 1-3-3l5.7-5.7 3.9-3.9a3.5 3.5 0 0 0-1.7-1.1Z" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" />
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v1.6M12 19.4V21M3 12h1.6M19.4 12H21M5.6 5.6l1.2 1.2M17.2 17.2l1.2 1.2M3 12h1.6M5.6 18.4l1.2-1.2M17.2 6.8l1.2-1.2" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </svg>
  );
}

export function FolderImportIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M3 7.5V6a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5Z" />
      <path d="M12 15.5v-5M9.6 12.9l2.4-2.4 2.4 2.4" />
    </svg>
  );
}

export function PlusMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute select-none font-mono text-muted/70 ${className}`}
    >
      +
    </span>
  );
}
