import { useState } from "react";
import { AppShell } from "@/app/app-shell";
import type { WorkspaceId } from "@/app/workspaces";
import { HomePage } from "@/features/home/home-page";
import { WorkspacePlaceholder } from "@/features/placeholder/workspace-placeholder";

export function App() {
  const [active, setActive] = useState<WorkspaceId>("home");

  return (
    <AppShell active={active} onNavigate={setActive}>
      {active === "home" ? <HomePage /> : <WorkspacePlaceholder id={active} />}
    </AppShell>
  );
}
