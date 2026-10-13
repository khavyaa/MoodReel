import { syncNyt } from "@/lib/books/nyt";
import { adaptationsDue, syncAdaptations } from "@/lib/adaptations/sync";

/*
 * Daily Vercel cron (vercel.json): syncs NYT bestseller lists into the
 * database, the book ↔ film links from Wikidata once a week, and a daily
 * batch of checks on those links' book ids. Vercel sends `Authorization: Bearer $CRON_SECRET`; anything else is
 * refused, and without CRON_SECRET set the route stays closed.
 */

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Not allowed." }, { status: 401 });
  }
  const [report, adaptations] = await Promise.all([
    syncNyt(),
    adaptationsDue()
      .then((wikidata) => syncAdaptations({ wikidata }))
      .catch((error) => ({ errors: [error instanceof Error ? error.message : String(error)] })),
  ]);
  console.info("[moodreel] NYT sync", JSON.stringify(report));
  console.info("[moodreel] adaptations sync", JSON.stringify(adaptations));
  return Response.json({ ...report, adaptations });
}
