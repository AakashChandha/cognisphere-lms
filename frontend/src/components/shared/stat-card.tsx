import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  className?: string;
  accent?: "default" | "success" | "warning" | "danger";
}

const ACCENT_CLASSES: Record<NonNullable<StatCardProps["accent"]>, string> = {
  default: "bg-primary/10 text-primary ring-primary/15",
  success: "bg-success/10 text-success ring-success/15",
  warning: "bg-warning/10 text-warning ring-warning/15",
  danger: "bg-destructive/10 text-destructive ring-destructive/15",
};

export function StatCard({ label, value, icon: Icon, description, className, accent = "default" }: StatCardProps) {
  return (
    <Card className={cn("gap-3", className)}>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="font-heading text-3xl font-semibold tabular-nums text-foreground">{value}</p>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        <div className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1",
            ACCENT_CLASSES[accent],
          )}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}
