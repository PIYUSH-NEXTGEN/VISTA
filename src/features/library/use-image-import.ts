import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { DEFAULT_JOB_CONCURRENCY } from "@/core/limits";
import { ImageInspectionError } from "@/core/image-import/inspect-image";
import { StorageQuotaError } from "@/core/storage/library-store";
import { DexieLibraryStore } from "@/core/storage/dexie-library-store";
import type { ImageRecord } from "@/core/storage/models";
import { ImageProcessorClient } from "@/core/workers/image-processor-client";
import type {
  ImageProcessProgress,
  ProcessedImage,
} from "@/core/workers/image-processor-types";
import type { JobHandle } from "@/core/workers/job-queue";
import { JobCancelledError, JobQueue } from "@/core/workers/job-queue";
import { encodeThumbnailFallback } from "@/features/library/encode-thumbnail-fallback";

export interface ImportFailure {
  id: string;
  name: string;
  message: string;
}

export interface ImportProgress {
  fileName: string;
  completed: number;
  total: number;
  percent: number;
  stage: string;
}

interface ImageImportState {
  importFiles: (files: FileList | File[]) => Promise<void>;
  cancelImport: () => void;
  importProgress: ImportProgress | undefined;
  importFailures: ImportFailure[];
  notice: string | undefined;
  setNotice: Dispatch<SetStateAction<string | undefined>>;
}

const libraryStore = new DexieLibraryStore();

export function useImageImport(onImported: (image: ImageRecord) => void): ImageImportState {
  const [importProgress, setImportProgress] = useState<ImportProgress | undefined>(
    undefined,
  );
  const [importFailures, setImportFailures] = useState<ImportFailure[]>([]);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const queue = useMemo(() => new JobQueue(DEFAULT_JOB_CONCURRENCY), []);
  const processor = useMemo(() => new ImageProcessorClient(), []);
  const currentJob = useRef<JobHandle<ProcessedImage> | undefined>(undefined);
  const cancelBatch = useRef(false);
  const importing = useRef(false);

  useEffect(
    () => () => {
      currentJob.current?.cancel();
      processor.dispose();
    },
    [processor],
  );

  async function importFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0 || importing.current) return;

    importing.current = true;
    cancelBatch.current = false;
    setImportFailures([]);
    setNotice(undefined);
    let completed = 0;

    try {
      for (const file of files) {
        if (cancelBatch.current) break;
        const workerJobId = crypto.randomUUID();
        setImportProgress({
          fileName: file.name,
          completed,
          total: files.length,
          percent: 0,
          stage: "Waiting",
        });

        const job = queue.enqueue(
          (signal, report) =>
            processor.process(file, workerJobId, signal, (progress: ImageProcessProgress) =>
              report({ stage: progress.stage, percent: progress.percent }),
            ),
          ({ stage, percent }) =>
            setImportProgress({
              fileName: file.name,
              completed,
              total: files.length,
              percent,
              stage,
            }),
        );
        currentJob.current = job;

        try {
          const processed = await job.promise;
          if (cancelBatch.current) {
            if (processed.thumbnail.kind === "bitmap") processed.thumbnail.bitmap.close();
            break;
          }
          const thumbnail = await encodeThumbnailFallback(processed.thumbnail);
          if (cancelBatch.current) break;
          const image: ImageRecord = {
            id: crypto.randomUUID(),
            name: file.name,
            mimeType: processed.mimeType,
            sizeBytes: file.size,
            width: processed.width,
            height: processed.height,
            importedAt: Date.now(),
            contentHash: processed.contentHash,
            ...(processed.takenAt === undefined ? {} : { takenAt: processed.takenAt }),
            ...(processed.orientation === undefined
              ? {}
              : { orientation: processed.orientation }),
            ...(processed.camera === undefined ? {} : { camera: processed.camera }),
          };
          const original = file.slice(0, file.size, processed.mimeType);
          await libraryStore.addImage(image, original, thumbnail);
          onImported(image);
          setNotice(`${file.name} was added to this device.`);
        } catch (error) {
          if (error instanceof JobCancelledError || cancelBatch.current) break;
          const message =
            error instanceof ImageInspectionError || error instanceof StorageQuotaError
              ? error.message
              : error instanceof Error
                ? error.message
                : "This image could not be imported.";
          setImportFailures((current) => [
            ...current,
            { id: crypto.randomUUID(), name: file.name, message },
          ]);
          if (error instanceof StorageQuotaError) break;
        } finally {
          currentJob.current = undefined;
        }

        completed += 1;
        setImportProgress({
          fileName: file.name,
          completed,
          total: files.length,
          percent: 100,
          stage: "Complete",
        });
      }
    } finally {
      currentJob.current = undefined;
      setImportProgress(undefined);
      importing.current = false;
    }

    if (cancelBatch.current)
      setNotice("Import cancelled. Completed images remain in your library.");
    else if (completed > 0)
      setNotice(`${completed} of ${files.length} selected files processed.`);
  }

  function cancelImport() {
    cancelBatch.current = true;
    currentJob.current?.cancel();
  }

  return {
    importFiles,
    cancelImport,
    importProgress,
    importFailures,
    notice,
    setNotice,
  };
}
