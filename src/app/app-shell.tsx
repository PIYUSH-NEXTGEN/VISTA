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
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className="h-8 w-8 shrink-0 text-ink"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="m5.8 15.8 3.7-3.7 2.6 2.3 2.5-3.1 3.6 3.6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="15.8" cy="7.8" r="1.5" className="fill-accent" />
      </svg>
      <span className="font-sans text-[17px] font-extrabold leading-none tracking-[0.12em] text-ink sm:text-[18px]">
        VISTA
      </span>
      <span className="sr-only">VISTA — private photo workbench</span>
    </div>
  );
}

export function AppShell({ active, onNavigate, children }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-[var(--outer-bg)] px-2 py-1 sm:px-4 lg:px-6 xl:px-10">
      <div className="mx-auto flex min-h-[calc(100dvh-0.5rem)] w-full flex-col border border-line bg-bg">
        <header className="sticky top-0 z-40 border-b border-line bg-nav-bg">
          <div className="mx-auto grid min-h-16 max-w-6xl grid-cols-[1fr_auto] items-center gap-x-2 px-4 pb-2 pt-2 sm:h-16 sm:grid-cols-[1fr_auto_1fr] sm:gap-4 sm:px-6 sm:py-0">
            <div className="row-start-1">
              <Logo />
            </div>
            <nav
              aria-label="Workspaces"
              className="hidden min-w-0 sm:col-start-2 sm:row-start-1 sm:block sm:justify-self-center"
            >
              <ul className="flex items-center gap-1 whitespace-nowrap rounded-xl border border-line bg-surface p-1">
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
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-semibold transition-colors lg:px-3 ${
                          current
                            ? "bg-nav-active-bg text-nav-active-ink shadow-sm"
                            : "text-nav-muted hover:bg-raised hover:text-nav-ink"
                        }`}
                      >
                        {workspaceIcon(w.id, { className: "h-[18px] w-[18px] shrink-0" })}
                        <span className="hidden lg:inline">{w.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="col-start-2 row-start-1 flex items-center justify-end sm:col-start-3">
              <ThemeToggle />
            </div>
            <nav
              aria-label="Workspaces"
              className="col-span-2 row-start-2 -mx-4 overflow-x-auto px-4 sm:hidden"
            >
              <ul className="mx-auto flex w-max items-center gap-1 rounded-xl border border-line bg-surface p-1">
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
                        className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                          current
                            ? "bg-nav-active-bg text-nav-active-ink shadow-sm"
                            : "text-nav-muted hover:bg-raised hover:text-nav-ink"
                        }`}
                      >
                        {workspaceIcon(w.id, { className: "h-[18px] w-[18px]" })}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </header>

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
