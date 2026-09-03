import type { AttachmentResponseType } from "@bakbak/contracts";
import {
  clearTokens,
  dedupeRefresh,
  getAccessToken,
  getRefreshToken,
} from "./tokens";

/**
 * Uploads one file to the generic attachment endpoint and returns the record.
 * `filePath` is the durable storage key to persist; `url` is a short-lived
 * signed URL for immediate display.
 */
export async function uploadFile(
  blob: Blob,
  fileName: string,
): Promise<AttachmentResponseType> {
  const form = new FormData();
  form.append("file", blob, fileName);

  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res = await fetch("/api/v1/uploads", {
    method: "POST",
    body: form,
    headers,
  });

  if (res.status === 401 && getRefreshToken()) {
    try {
      headers.Authorization = `Bearer ${await dedupeRefresh()}`;
      res = await fetch("/api/v1/uploads", {
        method: "POST",
        body: form,
        headers,
      });
    } catch {
      clearTokens();
      window.location.href = "/login";
      throw new Error("Session expired");
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.error?.message ?? body.message ?? `Upload failed (${res.status})`,
    );
  }

  const data = (await res.json()) as { attachment: AttachmentResponseType };
  return data.attachment;
}
