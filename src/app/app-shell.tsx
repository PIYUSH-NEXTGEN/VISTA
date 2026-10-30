import type { ReactElement } from "react";
import { workspaceIcon, WORKSPACES, type WorkspaceId } from "@/app/workspaces";
import { ThemeToggle } from "@/ui/theme-toggle";

interface AppShellProps {
  active: WorkspaceId;
  onNavigate: (id: WorkspaceId) => void;
  children: ReactElement;
}

function Logo() {
  return (
    <div className="flex items-center gap-2 sm:gap-2.5">
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink"
      >
        <span className="h-2.5 w-2.5 rounded-[3px] bg-accent" />
      </span>
      <span className="font-display text-[15px] leading-none text-ink sm:text-[16px]">
        VISTA_
      </span>
      <span className="sr-only">VISTA — private photo workbench</span>
    </div>
  );
}

export function AppShell({ active, onNavigate, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-nav-bg">
        <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6">
          <div>
            <Logo />
          </div>
          <nav aria-label="Workspaces" className="min-w-0 max-sm:hidden">
            <ul className="flex items-center gap-0.5 whitespace-nowrap sm:gap-1">
              {WORKSPACES.map((w) => {
                const current = w.id === active;
                return (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate(w.id)}
                      aria-current={current ? "page" : undefined}
                      aria-label={w.label}
                      title={w.label}
                      className={`flex items-center gap-2 rounded-md px-2 py-2 font-mono text-[12px] font-medium tracking-[0.12em] uppercase transition-colors sm:px-3 lg:tracking-[0.12em] ${
                        current
                          ? "bg-nav-active-bg text-nav-active-ink"
                          : "text-nav-muted hover:text-nav-ink"
                      }`}
                    >
                      {workspaceIcon(w.id, { className: "h-3.5 w-3.5 shrink-0" })}
                      <span className="hidden lg:inline">{w.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="flex justify-end items-center gap-1.5 sm:gap-2">
            <nav aria-label="Workspaces (compact)" className="sm:hidden">
              <ul className="flex items-center gap-0.5">
                {WORKSPACES.map((w) => {
                  const current = w.id === active;
                  return (
                    <li key={w.id}>
                      <button
                        type="button"
                        onClick={() => onNavigate(w.id)}
                        aria-current={current ? "page" : undefined}
                        aria-label={w.label}
                        title={w.label}
                        className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                          current
                            ? "bg-nav-active-bg text-nav-active-ink"
                            : "text-nav-muted hover:text-nav-ink"
                        }`}
                      >
                        {workspaceIcon(w.id, { className: "h-3.5 w-3.5" })}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex-1">{children}</div>
    </div>
  );
}
