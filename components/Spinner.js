// Tiny circular spinner — uses Tailwind's animate-spin under the hood.
// Default color is currentColor so it inherits from the parent button;
// pass an explicit `color` (e.g. '#C8F55A') for emphasis on dark surfaces.
export default function Spinner({ size = 16, color = 'currentColor', className = '' }) {
  return (
    <svg className={`animate-spin shrink-0 ${className}`}
         width={size} height={size} viewBox="0 0 24 24" fill="none"
         aria-hidden role="presentation">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" opacity="0.25" />
      <path d="M12 2 a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
