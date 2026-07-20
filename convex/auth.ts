import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = String(params.email ?? "").trim().toLowerCase();
        const rawName = typeof params.name === "string" ? params.name.trim() : "";

        return {
          email,
          ...(rawName ? { name: rawName, fullName: rawName } : {}),
          role: "user",
          paymentStatus: "free",
          subscriptionTier: "free",
          subscriptionExpiresAtMs: null,
          avatarUrl: null,
          image: null,
        };
      },
    }),
  ],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, args) {
      const user = await ctx.db.get(args.userId);
      if (!user?.email) {
        return;
      }

      const email = user.email.trim().toLowerCase();
      const byUserId = await ctx.db
        .query("profiles")
        .withIndex("by_external_user_id", (q) => q.eq("externalUserId", args.userId))
        .first();
      const byEmail = await ctx.db
        .query("profiles")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();

      // Prefer legacy email-linked profile (may hold uploaded avatar_url from Nest/Postgres).
      const legacy = byEmail && byEmail._id !== byUserId?._id ? byEmail : null;
      const source = legacy ?? byUserId;

      const avatarUrl =
        user.avatarUrl ??
        user.image ??
        source?.avatarUrl ??
        null;

      const payload = {
        externalUserId: args.userId,
        email,
        fullName: user.fullName ?? user.name ?? source?.fullName ?? null,
        avatarUrl,
        role: user.role ?? source?.role ?? "user",
        paymentStatus: user.paymentStatus ?? source?.paymentStatus ?? "free",
        subscriptionTier: user.subscriptionTier ?? source?.subscriptionTier ?? "free",
        subscriptionExpiresAtMs:
          user.subscriptionExpiresAtMs ?? source?.subscriptionExpiresAtMs ?? null,
        updatedAtMs: Date.now(),
      };

      // Keep auth user avatar in sync so viewer() also returns it.
      if (avatarUrl && (user.avatarUrl !== avatarUrl || user.image !== avatarUrl)) {
        await ctx.db.patch(args.userId, {
          avatarUrl,
          image: avatarUrl,
        });
      }

      if (legacy) {
        await ctx.db.patch(legacy._id, payload);
        // Drop empty duplicate created under the new Convex auth id.
        if (byUserId && byUserId._id !== legacy._id) {
          await ctx.db.delete(byUserId._id);
        }
        return;
      }

      if (byUserId) {
        await ctx.db.patch(byUserId._id, {
          ...payload,
          // Never wipe an existing avatar with null on routine auth updates.
          avatarUrl: avatarUrl ?? byUserId.avatarUrl ?? null,
        });
        return;
      }

      await ctx.db.insert("profiles", {
        ...payload,
        createdAtMs: Date.now(),
      });
    },
  },
});
