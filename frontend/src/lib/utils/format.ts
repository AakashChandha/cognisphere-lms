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

/** "1 lesson", "3 lessons", "No files". */
export function pluralize(count: number, singular: string, plural = `${singular}s`, zero = `No ${plural}`): string {
  if (count === 0) return zero;
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Random, readable temporary password (no ambiguous characters). */
export function generateTemporaryPassword(length = 12): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  let out = "";
  for (let i = 0; i < length; i += 1) out += alphabet[values[i] % alphabet.length];
  // Guarantee a digit so simple "must contain a number" rules pass.
  return `${out.slice(0, -2)}${(values[0] % 90) + 10}`;
}
