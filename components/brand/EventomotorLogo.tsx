type EventomotorLogoProps = {
  className?: string;
  compact?: boolean;
  iconOnly?: boolean;
  tone?: "default" | "white";
};

const HORIZONTAL_LOGO = "/brand/eventomotor-logo-horizontal.png";
const HORIZONTAL_WHITE_LOGO = "/brand/eventomotor-logo-horizontal-white.png";
const ICON_LOGO = "/brand/eventomotor-logo-icon.png";

export default function EventomotorLogo({
  className = "",
  compact = false,
  iconOnly = false,
  tone = "default",
}: EventomotorLogoProps) {
  const src = compact || iconOnly ? ICON_LOGO : tone === "white" ? HORIZONTAL_WHITE_LOGO : HORIZONTAL_LOGO;
  const sizeClass = compact || iconOnly ? "h-9 w-9" : "h-9 w-auto sm:h-10";

  return (
    <img
      alt="EventoMotor"
      className={`block object-contain ${sizeClass} ${className}`}
      decoding="async"
      src={src}
    />
  );
}
