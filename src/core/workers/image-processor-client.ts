import * as Comlink from "comlink";
import { MAX_IMAGE_PROCESSING_TIME_MS } from "@/core/limits";
import type {
  ImageProcessorApi,
  ImageProcessProgress,
  ProcessedImage,
} from "@/core/workers/image-processor-types";

export class ImageProcessorClient {
  private worker: Worker | undefined;
  private processor: Comlink.Remote<ImageProcessorApi> | undefined;

  async process(
    file: File,
    jobId: string,
    signal: AbortSignal,
    reportProgress: (progress: ImageProcessProgress) => void,
  ): Promise<ProcessedImage> {
    const cancelWorkerJob = () => {
      const processor = this.processor;
      if (processor) void processor.cancelJob(jobId);
    };
    signal.addEventListener("abort", cancelWorkerJob, { once: true });

    try {
      if (signal.aborted) {
        cancelWorkerJob();
        throw new DOMException("The job was cancelled.", "AbortError");
      }
      const processor = this.getProcessor();
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          this.dispose();
          reject(new Error("Image processing timed out. Try a smaller image."));
        }, MAX_IMAGE_PROCESSING_TIME_MS);
      });
      try {
        return await Promise.race([
          processor.processImage(file, jobId, Comlink.proxy(reportProgress)),
          timeout,
        ]);
      } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
      }
    } finally {
      signal.removeEventListener("abort", cancelWorkerJob);
    }
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = undefined;
    this.processor = undefined;
  }

  private getProcessor(): Comlink.Remote<ImageProcessorApi> {
    if (!this.worker) {
      this.worker = new Worker(new URL("./image-processor.worker.ts", import.meta.url), {
        type: "module",
        name: "vista-image-processor",
      });
      this.processor = Comlink.wrap<ImageProcessorApi>(this.worker);
    }
    if (!this.processor) {
      throw new Error("Image processing worker could not be initialized.");
    }
    return this.processor;
  }
}
