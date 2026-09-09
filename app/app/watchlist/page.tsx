import { SavedList } from "@/components/saved-list";

export const metadata = { title: "Watchlist" };

export default function WatchlistPage() {
  return <SavedList variant="watchlist" />;
}
