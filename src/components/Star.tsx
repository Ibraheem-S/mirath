/** Eight-pointed star (khatam) divider motif, drawn in code — no imagery. */
export function Star({ className = "", size = 18 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="5.2" y="5.2" width="13.6" height="13.6" stroke="currentColor" strokeWidth="1.4" />
      <rect
        x="5.2"
        y="5.2"
        width="13.6"
        height="13.6"
        stroke="currentColor"
        strokeWidth="1.4"
        transform="rotate(45 12 12)"
      />
      <circle cx="12" cy="12" r="2.1" fill="currentColor" />
    </svg>
  );
}

/** Rule line with centered star — manuscript section divider. */
export function StarDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden="true">
      <span className="h-px flex-1 bg-ink/20" />
      <Star className="text-gilt" size={14} />
      <span className="h-px flex-1 bg-ink/20" />
    </div>
  );
}
