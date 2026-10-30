import { useState } from "react";
import { AppShell } from "@/app/app-shell";
import type { WorkspaceId } from "@/app/workspaces";
import { HomePage } from "@/features/home/home-page";
import { LibraryPage } from "@/features/library/library-page";
import { WorkspacePlaceholder } from "@/features/placeholder/workspace-placeholder";
import { PwaUpdatePrompt } from "@/app/pwa-update-prompt";

export function App() {
  const [active, setActive] = useState<WorkspaceId>("home");

  return (
    <>
      <AppShell active={active} onNavigate={setActive}>
        {active === "home" ? (
          <HomePage onOpenLibrary={() => setActive("library")} />
        ) : active === "library" ? (
          <LibraryPage />
        ) : (
          <WorkspacePlaceholder id={active} />
        )}
      </AppShell>
      <PwaUpdatePrompt />
    </>
  );
}
