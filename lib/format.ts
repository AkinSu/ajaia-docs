/** Short, human-friendly "last edited" label. */
export function formatRelativeTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  if (seconds < 86_400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  if (seconds < 604_800) {
    const days = Math.floor(seconds / 86_400);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatTime(value: Date): string {
  return value.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
