import { describe, expect, it, vi } from "vitest";
import { JobCancelledError, JobQueue } from "@/core/workers/job-queue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("JobQueue", () => {
  it("runs heavy jobs at the configured concurrency and reports progress", async () => {
    const queue = new JobQueue(1);
    const firstStarted = deferred<void>();
    const releaseFirst = deferred<void>();
    const progress: number[] = [];

    const first = queue.enqueue(async () => {
      firstStarted.resolve();
      await releaseFirst.promise;
      return "first";
    });
    const second = queue.enqueue(
      async (_signal, report) => {
        report({ stage: "complete", percent: 100 });
        return "second";
      },
      ({ percent }) => progress.push(percent),
    );

    await firstStarted.promise;
    expect(await Promise.race([second.promise, Promise.resolve("waiting")])).toBe(
      "waiting",
    );

    releaseFirst.resolve();
    await expect(first.promise).resolves.toBe("first");
    await expect(second.promise).resolves.toBe("second");
    expect(progress).toEqual([100]);
  });

  it("rejects a cancelled queued job without starting it", async () => {
    const queue = new JobQueue(1);
    const releaseFirst = deferred<void>();
    const first = queue.enqueue(async () => {
      await releaseFirst.promise;
      return "complete";
    });
    const secondExecutor = vi.fn(async () => "not run");
    const second = queue.enqueue(secondExecutor);

    second.cancel();
    await expect(second.promise).rejects.toBeInstanceOf(JobCancelledError);
    expect(secondExecutor).not.toHaveBeenCalled();

    releaseFirst.resolve();
    await expect(first.promise).resolves.toBe("complete");
  });

  it("converts active cancellation into a typed cancellation error", async () => {
    const queue = new JobQueue(1);
    const started = deferred<void>();
    const job = queue.enqueue(
      (signal) =>
        new Promise<string>((_, reject) => {
          started.resolve();
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("cancelled", "AbortError")),
            { once: true },
          );
        }),
    );

    await started.promise;
    job.cancel();
    await expect(job.promise).rejects.toBeInstanceOf(JobCancelledError);
  });

  it("surfaces task failures to the caller", async () => {
    const queue = new JobQueue();
    const failure = new Error("worker failed");
    const job = queue.enqueue(async () => {
      throw failure;
    });

    await expect(job.promise).rejects.toBe(failure);
  });

  it("rejects invalid concurrency settings", () => {
    expect(() => new JobQueue(0)).toThrow(RangeError);
    expect(() => new JobQueue(1.5)).toThrow(RangeError);
  });
});
