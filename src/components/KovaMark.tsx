/**
 * The Kova logo mark — a minimal geometric K built from three strokes.
 * The middle stroke sits slightly separated from the stem: a paycheck
 * splitting into planned parts. Vector, so it stays crisp at 16px.
 */
interface KovaMarkProps {
  size?: number;
  /** Stem + upper stroke color. Defaults to the metal token. */
  color?: string;
  /** Lower stroke — the "planned part". Defaults to mint. */
  accent?: string;
  className?: string;
}

export function KovaMark({
  size = 24,
  color = "var(--kova-metal)",
  accent = "var(--kova-progress)",
  className,
}: KovaMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <g strokeWidth={7} strokeLinecap="round">
        <path d="M20 8 V56" stroke={color} />
        <path d="M48 10 L29 28" stroke={color} />
        <path d="M31 36 L48 54" stroke={accent} />
      </g>
    </svg>
  );
}

/** Wordmark: mark + "kova" in the display face, tracked wide. */
export function KovaWordmark({ markSize = 22 }: { markSize?: number }) {
  return (
    <span className="kv-wordmark">
      <KovaMark size={markSize} />
      <span className="kv-wordmark__text">kova</span>
    </span>
  );
}
