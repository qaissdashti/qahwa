// Pixel-art coffee-cup brand mark, used everywhere we previously
// rendered the "قهوة ☕" / "Qahwa ☕" text logo.
//
//   <Logo />                     → 32px navbar mark
//   <Logo size={28} />           → custom size
//   <Logo variant="large" />     → detailed mark with قهوة Arabic on the cup
//
// Plain <img> on purpose: the source is a hand-tuned SVG already, and
// running it through next/image gains nothing while adding a config
// dependency (dangerouslyAllowSVG). image-rendering: pixelated keeps the
// pixel-art crisp at any scale.
export default function Logo({
  size = 32,
  variant = 'navbar',
  className = '',
  alt = 'Qahwa',
  style = {},
}) {
  const src = variant === 'large' ? '/qahwa-logo-large.svg' : '/qahwa-logo-navbar.svg';
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{
        imageRendering: 'pixelated',
        display: 'inline-block',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
