import "server-only";
import { getMovieDetails } from "@/lib/tmdb/movies";
import { pendingCheckIn, pendingFollowUp } from "@/lib/picks/server";
import { getSeriesDetails } from "@/lib/tmdb/series";
import { getOwner } from "@/lib/session";
import { CheckInPrompt, WatchPrompt } from "./watch-prompt";

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

/** "Still watching …?" for the series you've gone longest without being asked about. */
export async function SeriesCheck() {
  const owner = await getOwner();
  if (!owner) return null;
  const pending = await pendingCheckIn(owner.id);
  if (!pending) return null;
  const show = await getSeriesDetails(pending.id).catch(() => null);
  if (!show) return null;
  return (
    <CheckInPrompt
      seriesId={show.id}
      title={show.title}
      posterUrl={show.posterPath ? `https://image.tmdb.org/t/p/w185${show.posterPath}` : null}
    />
  );
}
