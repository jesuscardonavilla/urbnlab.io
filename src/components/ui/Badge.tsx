interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

const STATUS_CLASSES: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  reviewing: "bg-yellow-100 text-yellow-800",
  planned: "bg-purple-100 text-purple-800",
  in_progress: "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
  closed_not_feasible: "bg-gray-100 text-gray-600",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_CLASSES[status] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function Badge({ children, className = "bg-[#BFF3EC] text-[#1E1E1E]" }: BadgeProps) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${className}`}>
      {children}
    </span>
  );
}
