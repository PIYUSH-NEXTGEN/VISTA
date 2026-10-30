import { Suspense, lazy, useState } from "react";
import { AppShell } from "@/app/app-shell";
import type { WorkspaceId } from "@/app/workspaces";
import { PwaUpdatePrompt } from "@/app/pwa-update-prompt";

const HomePage = lazy(() =>
  import("@/features/home/home-page").then(({ HomePage }) => ({ default: HomePage })),
);
const LibraryPage = lazy(() =>
  import("@/features/library/library-page").then(({ LibraryPage }) => ({
    default: LibraryPage,
  })),
);
const EditorPage = lazy(() =>
  import("@/features/editor/editor-page").then(({ EditorPage }) => ({
    default: EditorPage,
  })),
);
const ToolsPage = lazy(() =>
  import("@/features/tools/tools-page").then(({ ToolsPage }) => ({ default: ToolsPage })),
);
const HealthPage = lazy(() =>
  import("@/features/health/health-page").then(({ HealthPage }) => ({
    default: HealthPage,
  })),
);
const CreatePage = lazy(() =>
  import("@/features/create/create-page").then(({ CreatePage }) => ({
    default: CreatePage,
  })),
);
const WorkspacePlaceholder = lazy(() =>
  import("@/features/placeholder/workspace-placeholder").then(
    ({ WorkspacePlaceholder }) => ({
      default: WorkspacePlaceholder,
    }),
  ),
);

export function App() {
  const [active, setActive] = useState<WorkspaceId>("home");

  return (
    <>
      <AppShell active={active} onNavigate={setActive}>
        <Suspense
          fallback={
            <main role="status" className="mx-auto max-w-6xl p-8 text-muted">
              Loading workspace…
            </main>
          }
        >
          {active === "home" ? (
            <HomePage onOpenLibrary={() => setActive("library")} />
          ) : active === "library" ? (
            <LibraryPage />
          ) : active === "editor" ? (
            <EditorPage />
          ) : active === "tools" ? (
            <ToolsPage />
          ) : active === "health" ? (
            <HealthPage />
          ) : active === "create" ? (
            <CreatePage />
          ) : (
            <WorkspacePlaceholder id={active} />
          )}
        </Suspense>
      </AppShell>
      <PwaUpdatePrompt />
    </>
  );
}
