import type { IconPropsSubset } from "@/shared/ui-types";
import {
  HomeIcon,
  LibraryIcon,
  EditorIcon,
  HealthIcon,
  ToolsIcon,
  SettingsIcon,
} from "@/ui/icons";

export type WorkspaceId =
  "home" | "library" | "editor" | "health" | "tools" | "create" | "settings";

interface Workspace {
  id: WorkspaceId;
  label: string;
  phase: string;
}

export const WORKSPACES: readonly Workspace[] = [
  { id: "home", label: "Home", phase: "UI preview" },
  { id: "library", label: "Library", phase: "Phase 1" },
  { id: "editor", label: "Editor", phase: "Phase 3" },
  { id: "health", label: "Health", phase: "Phase 5" },
  { id: "tools", label: "Tools", phase: "Phase 4" },
  { id: "create", label: "Create", phase: "Phase 6" },
  { id: "settings", label: "Settings", phase: "Phase 8" },
];

export function workspaceIcon(id: WorkspaceId, props: IconPropsSubset) {
  switch (id) {
    case "home":
      return <HomeIcon {...props} />;
    case "library":
      return <LibraryIcon {...props} />;
    case "editor":
      return <EditorIcon {...props} />;
    case "health":
      return <HealthIcon {...props} />;
    case "tools":
      return <ToolsIcon {...props} />;
    case "create":
      return <ToolsIcon {...props} />;
    case "settings":
      return <SettingsIcon {...props} />;
  }
}
