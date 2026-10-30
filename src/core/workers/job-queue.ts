import { DEFAULT_JOB_CONCURRENCY } from "@/core/limits";

export interface JobProgress {
  stage: string;
  percent: number;
}

export type JobExecutor<T> = (
  signal: AbortSignal,
  reportProgress: (progress: JobProgress) => void,
) => Promise<T>;

export interface JobHandle<T> {
  id: string;
  promise: Promise<T>;
  cancel: () => void;
}

export class JobCancelledError extends Error {
  constructor() {
    super("The job was cancelled.");
    this.name = "JobCancelledError";
  }
}

interface PendingJob {
  id: string;
  signal: AbortSignal;
  execute: () => Promise<void>;
  reject: (error: unknown) => void;
}

export class JobQueue {
  private readonly pending: PendingJob[] = [];
  private running = 0;

  constructor(private readonly concurrency = DEFAULT_JOB_CONCURRENCY) {
    if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
      throw new RangeError("Job concurrency must be a positive integer.");
    }
  }

  enqueue<T>(
    executor: JobExecutor<T>,
    reportProgress: (progress: JobProgress) => void = () => undefined,
  ): JobHandle<T> {
    const id = crypto.randomUUID();
    const controller = new AbortController();
    let rejectJob: (error: unknown) => void = () => undefined;
    const promise = new Promise<T>((resolve, reject) => {
      rejectJob = reject;
      this.pending.push({
        id,
        signal: controller.signal,
        reject,
        execute: async () => {
          try {
            const value = await executor(controller.signal, reportProgress);
            if (controller.signal.aborted) {
              reject(new JobCancelledError());
            } else {
              resolve(value);
            }
          } catch (error) {
            reject(controller.signal.aborted ? new JobCancelledError() : error);
          }
        },
      });
    });

    this.pump();
    return {
      id,
      promise,
      cancel: () => {
        if (!controller.signal.aborted) {
          controller.abort();
          const pendingIndex = this.pending.findIndex((job) => job.id === id);
          if (pendingIndex !== -1) {
            this.pending.splice(pendingIndex, 1);
            rejectJob(new JobCancelledError());
            this.pump();
          }
        }
      },
    };
  }

  private pump(): void {
    while (this.running < this.concurrency && this.pending.length > 0) {
      const job = this.pending.shift();
      if (!job) return;
      if (job.signal.aborted) {
        job.reject(new JobCancelledError());
        continue;
      }

      this.running += 1;
      void job.execute().finally(() => {
        this.running -= 1;
        this.pump();
      });
    }
  }
}
