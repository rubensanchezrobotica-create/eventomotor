type EventomotorLogoProps = {
  className?: string;
  compactOnMobile?: boolean;
  iconOnly?: boolean;
  surface?: "dark" | "light";
};

const DARK_HEADER_LOGO = "/brand/eventomotor-logo-horizontal-dark-header.png";
const LIGHT_BG_LOGO = "/brand/eventomotor-logo-horizontal-light-bg.png";
const MARK_LOGO = "/brand/eventomotor-logo-mark-transparent.png";

export default function EventomotorLogo({
  className = "",
  compactOnMobile = false,
  iconOnly = false,
  surface = "dark",
}: EventomotorLogoProps) {
  const horizontalSrc = surface === "light" ? LIGHT_BG_LOGO : DARK_HEADER_LOGO;
  const sizeClassName = iconOnly ? "h-9 w-9" : "h-10 w-auto max-w-[214px]";
  const logoClassName = `block object-contain ${sizeClassName} em-logo ${iconOnly ? "em-logo-mark" : "em-logo-horizontal"} ${className}`.trim();

  if (iconOnly) {
    return (
      <img
        alt="EventoMotor"
        className={logoClassName}
        decoding="async"
        src={MARK_LOGO}
      />
    );
  }

  return (
    <picture>
      {compactOnMobile ? <source media="(max-width: 640px)" srcSet={DARK_HEADER_LOGO} /> : null}
      <img
        alt="EventoMotor"
        className={logoClassName}
        decoding="async"
        src={horizontalSrc}
      />
    </picture>
  );
}
