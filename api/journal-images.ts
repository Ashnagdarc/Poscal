import type { VercelRequest, VercelResponse } from "@vercel/node";
import { api, createConvexServerClient } from "./_convex.js";
import { deleteR2Object, headR2Object, presignR2Object } from "./_lib/r2.js";

export const config = { maxDuration: 30 };

const getBearerToken = (req: VercelRequest) => {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const bodyObject = (req: VercelRequest): Record<string, unknown> => {
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body && typeof req.body === "object" ? req.body : {};
};

const errorStatus = (message: string) => {
  const lower = message.toLowerCase();
  if (lower.includes("not authenticated") || lower.includes("missing auth")) return 401;
  if (lower.includes("not found") || lower.includes("ownership")) return 404;
  if (lower.includes("limit") || lower.includes("too large") || lower.includes("unsupported") || lower.includes("invalid")) return 400;
  return 500;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ success: false, message: "Missing auth token" });

  const client = createConvexServerClient(token);

  try {
    if (req.method === "GET") {
      const tradeId = typeof req.query.tradeId === "string" ? req.query.tradeId : "";
      if (!tradeId) return res.status(400).json({ success: false, message: "Missing tradeId" });

      const [rows, quota] = await Promise.all([
        client.query(api.tradeJournalAttachments.listForTrade, { tradeId: tradeId as any }),
        client.query(api.tradeJournalAttachments.getUsageForUser, {}),
      ]);

      const attachments = rows.map((row: any) => ({
        id: row._id,
        role: row.role,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        width: row.width ?? null,
        height: row.height ?? null,
        url: presignR2Object("GET", row.objectKey, 15 * 60),
      }));

      return res.status(200).json({ success: true, attachments, quota });
    }

    if (req.method === "POST") {
      const body = bodyObject(req);
      const action = String(body.action || "");

      if (action === "reserve") {
        const tradeId = String(body.tradeId || "");
        const role = body.role === "before" || body.role === "after" ? body.role : null;
        const mimeType = String(body.mimeType || "").toLowerCase();
        const sizeBytes = Number(body.sizeBytes);
        const width = body.width == null ? null : Number(body.width);
        const height = body.height == null ? null : Number(body.height);

        if (!tradeId || !role) {
          return res.status(400).json({ success: false, message: "Invalid upload request" });
        }

        const reservation = await client.mutation(api.tradeJournalAttachments.reserveUpload, {
          tradeId: tradeId as any,
          role,
          mimeType,
          sizeBytes,
          width: Number.isFinite(width as number) ? width : null,
          height: Number.isFinite(height as number) ? height : null,
        });

        return res.status(200).json({
          success: true,
          reservation,
          uploadUrl: presignR2Object("PUT", reservation.objectKey, 5 * 60),
        });
      }

      if (action === "complete") {
        const attachmentId = String(body.attachmentId || "");
        if (!attachmentId) return res.status(400).json({ success: false, message: "Missing attachmentId" });

        // Read the user's pending rows and identify the reserved object without
        // accepting an arbitrary object key from the browser.
        const tradeId = String(body.tradeId || "");
        if (!tradeId) return res.status(400).json({ success: false, message: "Missing tradeId" });
        const rows = await client.query(api.tradeJournalAttachments.listPendingForTrade, {
          tradeId: tradeId as any,
        });
        const pending = rows.find((row: any) => String(row._id) === attachmentId);
        if (!pending) return res.status(404).json({ success: false, message: "Pending attachment not found" });

        const head = await headR2Object(pending.objectKey);
        const completed = await client.mutation(api.tradeJournalAttachments.completeUpload, {
          attachmentId: attachmentId as any,
          actualSizeBytes: head.size,
          actualMimeType: head.mimeType,
        });

        await Promise.allSettled(
          completed.replacedObjectKeys.map((key: string) => deleteR2Object(key)),
        );

        return res.status(200).json({
          success: true,
          attachment: {
            id: completed.attachmentId,
            role: completed.role,
            mimeType: completed.mimeType,
            sizeBytes: completed.sizeBytes,
            url: presignR2Object("GET", completed.objectKey, 15 * 60),
          },
        });
      }

      if (action === "cancel") {
        const attachmentId = String(body.attachmentId || "");
        if (!attachmentId) return res.status(400).json({ success: false, message: "Missing attachmentId" });
        const cancelled = await client.mutation(api.tradeJournalAttachments.cancelUpload, {
          attachmentId: attachmentId as any,
        });
        if (cancelled?.objectKey) {
          await deleteR2Object(cancelled.objectKey).catch(() => undefined);
        }
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ success: false, message: "Unknown action" });
    }

    if (req.method === "DELETE") {
      const body = bodyObject(req);
      const attachmentId = String(body.attachmentId || "");
      if (!attachmentId) return res.status(400).json({ success: false, message: "Missing attachmentId" });

      const deleted = await client.mutation(api.tradeJournalAttachments.deleteAttachment, {
        attachmentId: attachmentId as any,
      });
      await deleteR2Object(deleted.objectKey).catch((error) => {
        console.error("[journal-images] orphaned R2 object after metadata delete", error);
      });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Journal image request failed";
    console.error("[journal-images]", message);
    return res.status(errorStatus(message)).json({ success: false, message });
  }
}
