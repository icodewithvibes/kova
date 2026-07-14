interface ProgressBarProps {
  /** 0–1 */
  fraction: number;
  label: string;
}

/** Mint progress track. Fraction clamped; label feeds the accessible value. */
export function ProgressBar({ fraction, label }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <div
      className="kv-track"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={label}
    >
      <div className="kv-track__fill" style={{ width: `${clamped * 100}%` }} />
    </div>
  );
}
