import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  colorMap?: Record<string, string>;
}

const DEFAULT_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800",
  CHECKED_IN: "bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  NO_SHOW: "bg-gray-100 text-gray-800",
  ADMITTED: "bg-blue-100 text-blue-800",
  DISCHARGED: "bg-green-100 text-green-800",
  TRANSFERRED: "bg-yellow-100 text-yellow-800",
  DECEASED: "bg-gray-100 text-gray-800",
  DRAFT: "bg-gray-100 text-gray-800",
  ISSUED: "bg-blue-100 text-blue-800",
  PARTIALLY_PAID: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
  REFUNDED: "bg-purple-100 text-purple-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  AVAILABLE: "bg-green-100 text-green-800",
  OCCUPIED: "bg-red-100 text-red-800",
  MAINTENANCE: "bg-yellow-100 text-yellow-800",
  RESERVED: "bg-blue-100 text-blue-800",
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-800",
  PROCESSED: "bg-blue-100 text-blue-800",
  SUBMITTED: "bg-blue-100 text-blue-800",
  RECEIVED: "bg-green-100 text-green-800",
};

export function StatusBadge({ status, colorMap }: StatusBadgeProps) {
  const colors = colorMap || DEFAULT_COLORS;
  const colorClass = colors[status] || "bg-gray-100 text-gray-800";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        colorClass
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
