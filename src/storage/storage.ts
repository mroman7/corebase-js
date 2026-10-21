import type { AxiosInstance } from "axios";
import type { ResolvedConfig } from "../core/config";
import { send } from "../core/http";
import type { Routes } from "../core/routes";

/** Browser File/Blob, or the `{ uri, name, type }` object React Native uses. */
export type UploadableFile = Blob | { uri: string; name: string; type: string };

/** File handling: corebase.storage.* */
export class CorebaseStorage {
  constructor(
    private readonly http: AxiosInstance,
    private readonly routes: Routes,
    private readonly config: ResolvedConfig,
  ) {}

  upload(file: UploadableFile) {
    const form = new FormData();
    form.append("file", file as any);
    form.append("projectId", this.config.projectId);
    return send(this.http, {
      method: "POST",
      url: this.routes.storage.upload,
      data: form,
      headers: { "Content-Type": "multipart/form-data" },
    });
  }

  /** Public URL — use directly in <img src> / <Image source>. No request is made. */
  getUrl(fileId: string) {
    return `${this.config.url}${this.routes.storage.file(fileId)}`;
  }

  /** Downloads the file as a Blob. */
  download(fileId: string) {
    return send<Blob>(this.http, {
      method: "GET",
      url: this.routes.storage.file(fileId),
      responseType: "blob",
    });
  }

  remove(fileId: string) {
    return send(this.http, { method: "DELETE", url: this.routes.storage.file(fileId) });
  }
}
