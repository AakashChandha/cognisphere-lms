import { format, formatDistanceToNow } from "date-fns";

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${exponent === 0 ? value : value.toFixed(1)} ${units[exponent]}`;
}

export function formatDate(value: string | Date, pattern = "MMM d, yyyy"): string {
  return format(new Date(value), pattern);
}

export function formatDateTime(value: string | Date): string {
  return format(new Date(value), "MMM d, yyyy 'at' h:mm a");
}

export function formatRelativeTime(value: string | Date): string {
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
