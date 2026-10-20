import { syncNyt } from "@/lib/books/nyt";
import { adaptationsDue, syncAdaptations } from "@/lib/adaptations/sync";
import { listsDue, syncLists } from "@/lib/lists/sync";

/*
 * Daily Vercel cron (vercel.json): syncs NYT bestseller lists into the
 * database, the book ↔ film links from Wikidata once a week, and a daily
 * batch of checks on those links' book ids; then, once a week, the award
 * lists from Wikidata (after the links, so Wikidata isn't asked twice at
 * once). Vercel sends `Authorization: Bearer $CRON_SECRET`; anything else is
 * refused, and without CRON_SECRET set the route stays closed.
 */

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Not allowed." }, { status: 401 });
  }
  const failed = (error: unknown) => ({ errors: [error instanceof Error ? error.message : String(error)] });
  const [report, [adaptations, lists]] = await Promise.all([
    syncNyt(),
    (async () => {
      const links = await adaptationsDue()
        .then((wikidata) => syncAdaptations({ wikidata }))
        .catch(failed);
      const awards = await listsDue()
        .then((due) => (due ? syncLists() : null))
        .catch(failed);
      return [links, awards] as const;
    })(),
  ]);
  console.info("[moodreel] NYT sync", JSON.stringify(report));
  console.info("[moodreel] adaptations sync", JSON.stringify(adaptations));
  if (lists) console.info("[moodreel] lists sync", JSON.stringify(lists));
  return Response.json({ ...report, adaptations, lists });
}
