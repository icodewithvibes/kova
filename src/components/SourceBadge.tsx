import { AlertTriangle, FileText, PenLine, Calculator, Sparkles } from "lucide-react";
import { sourceLabel } from "@/domain/paycheck";
import type { DataSource } from "@/domain/types";

interface SourceBadgeProps {
  source: DataSource;
  needsReview?: boolean;
}

const ICONS: Record<DataSource, typeof FileText> = {
  paystub: FileText,
  user_entered: PenLine,
  estimated: Calculator,
  kova_suggested: Sparkles,
};

/**
 * Mandatory provenance label. Icon + text — never color alone.
 * "Needs review" renders as an amber attention chip (never shame-red).
 */
export function SourceBadge({ source, needsReview = false }: SourceBadgeProps) {
  if (needsReview) {
    return (
      <span className="kv-chip kv-chip--attention">
        <AlertTriangle size={11} aria-hidden="true" />
        Needs review
      </span>
    );
  }
  const Icon = ICONS[source];
  return (
    <span className="kv-chip">
      <Icon size={11} aria-hidden="true" />
      {sourceLabel(source)}
    </span>
  );
}
