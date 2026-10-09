import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";

/*
 * Data Access Layer: the one place a request's session is verified. The proxy
 * only checks that a cookie exists; anything that reads or writes your data
 * goes through here first. Reading the session is request-time work, so with
 * Cache Components every caller must sit inside a <Suspense> boundary.
 */

export type Owner = { id: string; name: string };

export const getOwner = cache(async (): Promise<Owner | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ? { id: session.user.id, name: session.user.name } : null;
});

export async function requireOwner(): Promise<Owner> {
  const owner = await getOwner();
  if (!owner) redirect("/sign-in");
  return owner;
}
