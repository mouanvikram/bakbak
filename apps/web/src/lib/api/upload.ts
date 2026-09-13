import type { AttachmentResponseType } from "@bakbak/contracts";
import { apiClient } from "./client";

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

  // apiClient leaves Content-Type to the browser for FormData and owns the
  // expired-token refresh + redirect, same as every other call.
  const data = await apiClient<{ attachment: AttachmentResponseType }>(
    "/api/v1/uploads",
    { method: "POST", body: form },
  );
  return data.attachment;
}
