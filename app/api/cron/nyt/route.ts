import { syncNyt } from "@/lib/books/nyt";

/*
 * Daily Vercel cron (vercel.json): syncs NYT bestseller lists into the
 * database. Vercel sends `Authorization: Bearer $CRON_SECRET`; anything else is
 * refused, and without CRON_SECRET set the route stays closed.
 */

export const maxDuration = 120;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Not allowed." }, { status: 401 });
  }
  const report = await syncNyt();
  console.info("[moodreel] NYT sync", JSON.stringify(report));
  return Response.json(report);
}
