import { SavedList } from "@/components/saved-list";

export const metadata = { title: "Watched" };

export default function WatchedPage() {
  return <SavedList variant="watched" />;
}
