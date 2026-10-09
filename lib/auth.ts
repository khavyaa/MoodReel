import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { passkey } from "@better-auth/passkey";
import { count } from "drizzle-orm";
import { getAppUrl } from "./app-url";
import { getDb } from "./db";
import * as schema from "./db/schema";
import { verifyOwnerGrant } from "./owner";

/*
 * Passkey-only, single owner. There is no email/password and no social sign-in,
 * so the only way to create an account is a passkey registered with a grant from
 * /setup, and the user-create hook refuses a second account outright.
 */

const appUrl = getAppUrl();
const { hostname, origin } = new URL(appUrl);
const secret = process.env.BETTER_AUTH_SECRET;

export const auth = betterAuth({
  appName: "MoodReel",
  baseURL: appUrl,
  secret,
  trustedOrigins: [origin],
  database: drizzleAdapter(getDb(), { provider: "pg", schema }),
  session: {
    // A personal app on your own devices: stay signed in for 90 days, sliding.
    expiresIn: 60 * 60 * 24 * 90,
    updateAge: 60 * 60 * 24,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const [{ total }] = await getDb().select({ total: count() }).from(schema.user);
          if (total > 0) {
            throw new APIError("FORBIDDEN", { message: "MoodReel already has an owner." });
          }
          return { data: user };
        },
      },
    },
  },
  plugins: [
    passkey({
      rpID: hostname,
      rpName: "MoodReel",
      origin,
      registration: {
        // Signed-out registration is allowed only with a grant from /setup.
        requireSession: false,
        resolveUser: async ({ context }) => {
          const grant = verifyOwnerGrant(context, secret ?? "");
          if (!grant) {
            throw new APIError("UNAUTHORIZED", {
              message: "Open /setup with your setup token to add a passkey.",
            });
          }
          const owner = await getDb().query.user.findFirst({
            where: (u, { eq }) => eq(u.id, grant.userId),
          });
          if (!owner) throw new APIError("UNAUTHORIZED", { message: "Owner account not found." });
          return { id: owner.id, name: owner.email, displayName: owner.name };
        },
      },
    }),
    // Must stay last: lets server actions set Better Auth cookies.
    nextCookies(),
  ],
});
