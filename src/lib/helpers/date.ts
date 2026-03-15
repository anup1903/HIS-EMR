import { format, formatDistance, parseISO } from "date-fns";

export function formatShortDate(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMM dd, yyyy");
}

export function formatFullDate(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMMM dd, yyyy");
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return formatDistance(d, new Date(), { addSuffix: true });
}

export function calculateAge(dateOfBirth: Date | string): number {
  const dob = typeof dateOfBirth === "string" ? parseISO(dateOfBirth) : dateOfBirth;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}
