import { Plus } from "lucide-react";

export {
  Activity as HealthIcon,
  Album as AlbumIcon,
  FolderUp as FolderImportIcon,
  Home as HomeIcon,
  Image as LibraryIcon,
  ImagePlus as CreateIcon,
  Moon as MoonIcon,
  Settings as SettingsIcon,
  SlidersHorizontal as EditorIcon,
  Sun as SunIcon,
  Wrench as ToolsIcon,
} from "lucide-react";

export function PlusMark({ className = "" }: { className?: string }) {
  return (
    <Plus
      aria-hidden="true"
      className={`pointer-events-none absolute h-5 w-5 select-none text-muted/70 ${className}`}
    />
  );
}
