import "server-only";
import { getMovieDetails } from "@/lib/tmdb/movies";
import { pendingFollowUp } from "@/lib/picks/server";
import { getOwner } from "@/lib/session";
import { WatchPrompt } from "./watch-prompt";

/** Asks about your last pick, a few hours after you made it, until you answer. Renders nothing otherwise. */
export async function WatchCheck() {
  const owner = await getOwner();
  if (!owner) return null;
  const pending = await pendingFollowUp(owner.id);
  if (!pending) return null;
  const movie = await getMovieDetails(pending.movieId).catch(() => null);
  if (!movie) return null;
  return (
    <WatchPrompt
      sessionId={pending.sessionId}
      title={movie.title}
      posterUrl={movie.posterPath ? `https://image.tmdb.org/t/p/w185${movie.posterPath}` : null}
    />
  );
}
