import { formatMoneyForSpeech, formatMoneyParts, type Money } from "@/domain/money";

interface AmountDisplayProps {
  amount: Money;
  /** Pixel font size of the dollars portion. */
  size?: number;
  className?: string;
}

/**
 * Styled money value: dollars strong, cents smaller and lighter, currency
 * symbol secondary. Always tabular-nums; always screen-reader friendly.
 */
export function AmountDisplay({ amount, size = 20, className }: AmountDisplayProps) {
  const parts = formatMoneyParts(amount);
  return (
    <span
      className={`kv-money ${className ?? ""}`}
      style={{ fontSize: size }}
      data-money
      aria-label={formatMoneyForSpeech(amount)}
    >
      <span aria-hidden="true">
        {parts.sign}
        <span className="kv-money__currency">$</span>
        {parts.dollars}
        <span className="kv-money__cents">.{parts.cents}</span>
      </span>
    </span>
  );
}
