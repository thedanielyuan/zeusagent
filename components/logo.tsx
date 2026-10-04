/** Zeus Z on a black circle, the same mark as app/icon.svg. The Z inherits the text color. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <circle cx="16" cy="16" r="16" className="fill-app" />
      <path
        d="M8 7.5H24V10.5L12.84 21.5H24V24.5H8V21.5L19.16 10.5H8Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1}
        strokeLinejoin="round"
      />
    </svg>
  );
}
