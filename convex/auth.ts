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

      const existing = await ctx.db
        .query("profiles")
        .withIndex("by_external_user_id", (q) => q.eq("externalUserId", args.userId))
        .first();

      const payload = {
        externalUserId: args.userId,
        email: user.email,
        fullName: user.fullName ?? user.name ?? null,
        avatarUrl: user.avatarUrl ?? user.image ?? null,
        role: user.role ?? "user",
        paymentStatus: user.paymentStatus ?? "free",
        subscriptionTier: user.subscriptionTier ?? "free",
        subscriptionExpiresAtMs: user.subscriptionExpiresAtMs ?? null,
        updatedAtMs: Date.now(),
      };

      if (existing) {
        await ctx.db.patch(existing._id, payload);
        return;
      }

      await ctx.db.insert("profiles", {
        ...payload,
        createdAtMs: Date.now(),
      });
    },
  },
});
