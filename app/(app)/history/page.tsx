import { AppFrame } from "@/components/shell/app-frame";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <AppFrame>
      <EmptyState
        eyebrow="History"
        title="No picks yet"
        body="Each night's pick shows up here with the mood you were in, so you can see what worked and rate it after."
      />
    </AppFrame>
  );
}
