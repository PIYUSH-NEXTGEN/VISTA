import { useEffect, useState } from "react";
import type { ImageRecord } from "@/core/storage/models";
import type { LibraryStore } from "@/core/storage/library-store";

interface ThumbnailCardProps {
  image: ImageRecord;
  selected: boolean;
  store: LibraryStore;
  onSelect: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function ThumbnailCard({ image, selected, store, onSelect }: ThumbnailCardProps) {
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    void store
      .getThumbnail(image.id)
      .then((blob) => {
        if (!blob) {
          setError(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        if (active) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        if (active) setError(true);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image.id, store]);

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${selected ? "Deselect" : "Select"} ${image.name}`}
      onClick={onSelect}
      className={`group flex min-w-0 flex-col overflow-hidden rounded-lg border text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        selected
          ? "border-accent bg-raised"
          : "border-line bg-raised hover:border-line-strong"
      }`}
    >
      <span className="relative block aspect-square w-full overflow-hidden bg-surface">
        {url ? (
          <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center font-mono text-[11px] text-muted"
          >
            {error ? "Preview unavailable" : "Loading preview"}
          </span>
        )}
        {selected && (
          <span
            aria-hidden="true"
            className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[12px] text-accent-ink"
          >
            ✓
          </span>
        )}
      </span>
      <span className="w-full truncate px-2.5 pt-2 font-mono text-[11px] text-ink">
        {image.name}
      </span>
      <span className="px-2.5 pb-2 font-mono text-[10px] text-muted">
        {image.width} × {image.height}
      </span>
    </button>
  );
}
