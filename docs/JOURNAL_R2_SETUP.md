# Trading Notebook R2 setup

The Trading Notebook keeps chart images in a private Cloudflare R2 bucket. Convex stores only
attachment metadata, ownership and quota counters.

## Required Vercel environment variables

Server-only. Do not prefix these with `VITE_`.

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME=poscal-journal`
- `R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`

The R2 credential should have Object Read & Write access only to `poscal-journal`.

## Bucket privacy

Keep Public Access disabled. Image reads and writes use short-lived AWS SigV4 presigned URLs.

## R2 CORS policy

Cloudflare Dashboard → R2 → `poscal-journal` → Settings → CORS Policy → Add CORS policy.

Use:

```json
[
  {
    "AllowedOrigins": [
      "https://www.poscalfx.com",
      "https://poscalfx.com",
      "https://*.vercel.app",
      "http://localhost:5173"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Range"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

The wildcard preview origin is useful while Notebook is being tested on Vercel previews. It can
be removed later if previews no longer need direct R2 uploads.

## Free-plan limits

- 50 MB of ready journal images per user.
- 50 ready journal images per user.
- One before-trade and one after-trade chart per trade.
- Source file maximum: 5 MB.
- Browser compresses/re-encodes images before upload.
- Server accepts a maximum of 2 MB after compression.
- Preferred target is approximately 1 MB or less.

## Upload security flow

1. Browser re-encodes the selected PNG/JPEG/WebP.
2. Authenticated Poscal API requests a Convex reservation.
3. Convex verifies trade ownership and quota atomically.
4. API returns a five-minute R2 PUT URL for that exact object key.
5. Browser uploads directly to private R2.
6. API HEADs the object and reads its first bytes.
7. Server verifies size, MIME type and PNG/JPEG/WebP magic bytes.
8. Convex marks the attachment ready and updates quota.
9. Any previous image for the same trade/role is retired and removed from R2.
10. Reads use a 15-minute signed GET URL.

Abandoned reservations are reclaimed after 30 minutes when the user next starts an upload.
