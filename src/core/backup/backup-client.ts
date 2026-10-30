import * as Comlink from "comlink";

interface BackupApi {
  exportLibrary(): Promise<ArrayBuffer>;
  importLibrary(buffer: ArrayBuffer): Promise<{ imported: number; skipped: number }>;
}

export class BackupClient {
  private worker: Worker | undefined;
  private remote: Comlink.Remote<BackupApi> | undefined;

  async exportLibrary(): Promise<Blob> {
    const bytes = await this.getRemote().exportLibrary();
    return new Blob([bytes], { type: "application/zip" });
  }

  async importLibrary(file: File): Promise<{ imported: number; skipped: number }> {
    const bytes = await file.arrayBuffer();
    return this.getRemote().importLibrary(bytes);
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = undefined;
    this.remote = undefined;
  }

  private getRemote(): Comlink.Remote<BackupApi> {
    if (!this.worker) {
      this.worker = new Worker(new URL("./backup.worker.ts", import.meta.url), {
        type: "module",
        name: "vista-backup",
      });
      this.remote = Comlink.wrap<BackupApi>(this.worker);
    }
    if (!this.remote) throw new Error("The backup worker could not be started.");
    return this.remote;
  }
}
