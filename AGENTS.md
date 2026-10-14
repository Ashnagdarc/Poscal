<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

For changes to storage, journal queries, analytics, caching, uploads or service
boundaries, read `docs/BETA_ARCHITECTURE_RULES.md`. Preserve live user data and
distinguish proposed improvements from deployed behavior.

## Hosting (critical)

- Frontend: Vercel and/or Openship **Poscal** project.
- Backend + database: **self-hosted Convex on Openship VPS**
  (`https://convex.poscalfx.com` / `https://convex-http.poscalfx.com`).
- To push Convex functions, use self-hosted CLI env (not cloud):
  `CONVEX_SELF_HOSTED_URL` + `CONVEX_SELF_HOSTED_ADMIN_KEY`, then `npx convex deploy`.
- Never deploy with cloud `CONVEX_DEPLOY_KEY` / `*.convex.cloud`.
