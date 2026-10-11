"use client";

export function RetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="rounded-full bg-accent px-5 py-3 font-bold text-on-accent hover:opacity-90"
    >
      Try again
    </button>
  );
}
