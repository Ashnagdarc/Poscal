import { getConvexAuthTokenMirror } from "@/lib/authTokenStore";

export type JournalImageRole = "before" | "after";

export type JournalAttachment = {
  id: string;
  role: JournalImageRole;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  url: string;
};

export type JournalImageQuota = {
  usedBytes: number;
  attachmentCount: number;
  reservedBytes: number;
  reservedCount: number;
  limitBytes: number;
  limitCount: number;
};

type PreparedImage = {
  blob: Blob;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
};

const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const TARGET_BYTES = 1024 * 1024;
const MAX_SERVER_BYTES = 2 * 1024 * 1024;
const MAX_WIDTH = 2560;
const MAX_HEIGHT = 1440;
const ALLOWED_SOURCE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const authHeaders = (json = false): HeadersInit => {
  const token = getConvexAuthTokenMirror();
  if (!token) throw new Error("Your session is not ready. Please try again.");
  return {
    Authorization: `Bearer ${token}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
};

const apiJson = async <T>(input: RequestInfo | URL, init: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  const payload = await response.json().catch(() => null) as { message?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.message || `Journal image request failed (${response.status})`);
  }
  return payload as T;
};

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: "image/webp" | "image/jpeg",
  quality: number,
) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Could not compress image")),
      type,
      quality,
    );
  });

const loadImage = async (file: File) => {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx: CanvasRenderingContext2D, width: number, height: number) =>
        ctx.drawImage(bitmap, 0, 0, width, height),
      close: () => bitmap.close(),
    };
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await image.decode();
  return {
    width: image.naturalWidth,
    height: image.naturalHeight,
    draw: (ctx: CanvasRenderingContext2D, width: number, height: number) =>
      ctx.drawImage(image, 0, 0, width, height),
    close: () => URL.revokeObjectURL(url),
  };
};

export const prepareJournalImage = async (file: File): Promise<PreparedImage> => {
  if (!ALLOWED_SOURCE_TYPES.has(file.type)) {
    throw new Error("Use a PNG, JPEG, or WebP chart image.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Chart images must be 5 MB or smaller before compression.");
  }

  const source = await loadImage(file);
  try {
    let scale = Math.min(1, MAX_WIDTH / source.width, MAX_HEIGHT / source.height);
    let width = Math.max(1, Math.round(source.width * scale));
    let height = Math.max(1, Math.round(source.height * scale));

    for (let resizePass = 0; resizePass < 4; resizePass += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("Image processing is unavailable on this device.");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      source.draw(ctx, width, height);

      for (const quality of [0.92, 0.86, 0.8, 0.74, 0.68]) {
        let blob: Blob;
        try {
          blob = await canvasToBlob(canvas, "image/webp", quality);
        } catch {
          blob = await canvasToBlob(canvas, "image/jpeg", quality);
        }

        if (blob.size <= TARGET_BYTES) {
          return {
            blob,
            mimeType: blob.type || "image/webp",
            sizeBytes: blob.size,
            width,
            height,
          };
        }

        if (quality === 0.68 && blob.size <= MAX_SERVER_BYTES) {
          return {
            blob,
            mimeType: blob.type || "image/webp",
            sizeBytes: blob.size,
            width,
            height,
          };
        }
      }

      width = Math.max(1, Math.round(width * 0.82));
      height = Math.max(1, Math.round(height * 0.82));
    }

    throw new Error("This chart could not be compressed below the 2 MB upload limit.");
  } finally {
    source.close();
  }
};

export const listJournalImages = async (tradeId: string) => {
  return apiJson<{
    success: true;
    attachments: JournalAttachment[];
    quota: JournalImageQuota;
  }>(`/api/journal-images?tradeId=${encodeURIComponent(tradeId)}`, {
    method: "GET",
    headers: authHeaders(),
    cache: "no-store",
  });
};

export const uploadJournalImage = async (
  tradeId: string,
  role: JournalImageRole,
  file: File,
) => {
  const prepared = await prepareJournalImage(file);

  const reserved = await apiJson<{
    success: true;
    reservation: { attachmentId: string; objectKey: string };
    uploadUrl: string;
  }>("/api/journal-images", {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify({
      action: "reserve",
      tradeId,
      role,
      mimeType: prepared.mimeType,
      sizeBytes: prepared.sizeBytes,
      width: prepared.width,
      height: prepared.height,
    }),
  });

  try {
    const upload = await fetch(reserved.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": prepared.mimeType },
      body: prepared.blob,
    });
    if (!upload.ok) throw new Error(`R2 upload failed (${upload.status})`);

    return await apiJson<{
      success: true;
      attachment: JournalAttachment;
    }>("/api/journal-images", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({
        action: "complete",
        tradeId,
        attachmentId: reserved.reservation.attachmentId,
      }),
    });
  } catch (error) {
    await fetch("/api/journal-images", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({
        action: "cancel",
        attachmentId: reserved.reservation.attachmentId,
      }),
    }).catch(() => undefined);
    throw error;
  }
};

export const deleteJournalImage = async (attachmentId: string) => {
  await apiJson<{ success: true }>("/api/journal-images", {
    method: "DELETE",
    headers: authHeaders(true),
    body: JSON.stringify({ attachmentId }),
  });
};
