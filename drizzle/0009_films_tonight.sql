-- Films now go on a Tonight list when picked, like series (Watching) and books (Reading).
-- Film picks never answered under the old one-off "Did you watch it?" join that list.
UPDATE "title_states" AS ts
SET "watching_since" = p."picked_at", "checked_in_at" = NULL
FROM (
  SELECT "user_id", "pick"->>'externalId' AS "external_id", max("completed_at") AS "picked_at"
  FROM "pick_sessions"
  WHERE "media" = 'movie' AND "status" = 'picked' AND "follow_up" IS NULL AND "pick" IS NOT NULL
  GROUP BY 1, 2
) AS p
WHERE ts."user_id" = p."user_id"
  AND ts."media" = 'movie'
  AND ts."source" = 'tmdb'
  AND ts."external_id" = p."external_id"
  AND NOT ts."seen"
  AND NOT ts."disliked"
  AND ts."watching_since" IS NULL;
