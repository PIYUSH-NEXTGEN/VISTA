import * as Comlink from "comlink";
import { MAX_IMAGE_PROCESSING_TIME_MS } from "@/core/limits";
import type {
  EncodedImage,
  CanvasOutput,
  CollageOptions,
  ImageAnalysis,
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

  async encode(
    source: Blob,
    mimeType: string,
    quality: number,
    targetBytes: number | undefined,
    signal: AbortSignal,
  ): Promise<EncodedImage> {
    const cancelWorkerJob = () => this.dispose();
    signal.addEventListener("abort", cancelWorkerJob, { once: true });
    try {
      if (signal.aborted) throw new DOMException("The job was cancelled.", "AbortError");
      const remote = this.getProcessor();
      const result = remote.encodeImage(source, mimeType, quality, targetBytes);
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          this.dispose();
          reject(new Error("Image conversion timed out. Try a smaller image."));
        }, MAX_IMAGE_PROCESSING_TIME_MS);
      });
      try {
        return await Promise.race([result, timeout]);
      } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
      }
    } finally {
      signal.removeEventListener("abort", cancelWorkerJob);
    }
  }

  async renderEdits(source: Blob, steps: unknown[], signal: AbortSignal) {
    return this.runCanvasJob(
      (remote) => remote.renderEdits(source, steps),
      signal,
      "Batch edit rendering timed out.",
    );
  }

  async analyze(
    source: Blob,
    width: number,
    height: number,
    signal: AbortSignal,
  ): Promise<ImageAnalysis> {
    const cancelWorkerJob = () => this.dispose();
    signal.addEventListener("abort", cancelWorkerJob, { once: true });
    try {
      if (signal.aborted) throw new DOMException("The job was cancelled.", "AbortError");
      const remote = this.getProcessor();
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          this.dispose();
          reject(new Error("Photo analysis timed out. Try a smaller image."));
        }, MAX_IMAGE_PROCESSING_TIME_MS);
      });
      try {
        return await Promise.race([remote.analyzeImage(source, width, height), timeout]);
      } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
      }
    } finally {
      signal.removeEventListener("abort", cancelWorkerJob);
    }
  }

  async createProfile(
    source: Blob,
    width: number,
    height: number,
    mask: "circle" | "square",
    signal: AbortSignal,
  ): Promise<CanvasOutput> {
    return this.runCanvasJob(
      (remote) => remote.createProfile(source, width, height, mask),
      signal,
      "Profile creation timed out.",
    );
  }

  async createCollage(
    sources: Blob[],
    options: CollageOptions,
    signal: AbortSignal,
  ): Promise<CanvasOutput> {
    return this.runCanvasJob(
      (remote) => remote.createCollage(sources, options),
      signal,
      "Collage creation timed out.",
    );
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = undefined;
    this.processor = undefined;
  }

  private async runCanvasJob<T>(
    operation: (remote: Comlink.Remote<ImageProcessorApi>) => Promise<T>,
    signal: AbortSignal,
    timeoutMessage: string,
  ): Promise<T> {
    const cancelWorkerJob = () => this.dispose();
    signal.addEventListener("abort", cancelWorkerJob, { once: true });
    try {
      if (signal.aborted) throw new DOMException("The job was cancelled.", "AbortError");
      const remote = this.getProcessor();
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          this.dispose();
          reject(new Error(timeoutMessage));
        }, MAX_IMAGE_PROCESSING_TIME_MS);
      });
      try {
        return await Promise.race([operation(remote), timeout]);
      } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
      }
    } finally {
      signal.removeEventListener("abort", cancelWorkerJob);
    }
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
