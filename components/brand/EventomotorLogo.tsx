type EventomotorLogoProps = {
  className?: string;
  markClassName?: string;
  compact?: boolean;
};

export default function EventomotorLogo({
  className = "",
  markClassName = "",
  compact = false,
}: EventomotorLogoProps) {
  return (
    <div className={`inline-flex items-center gap-3.5 ${className}`} aria-label="EventoMotor">
      <span
        className={`relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-[#15161A] shadow-[0_18px_38px_rgba(0,0,0,0.38)] ${markClassName}`}
        aria-hidden="true"
      >
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_75%_18%,rgba(225,6,0,0.26),transparent_34%)]" />
        <span className="absolute right-1.5 top-1.5 h-1.5 w-5 rounded-full bg-[#E10600]" />
        <span className="relative flex items-baseline font-black leading-none tracking-[-0.12em]">
          <span className="text-[1.55rem] text-white">E</span>
          <span className="text-[1.55rem] text-[#E10600]">M</span>
        </span>
        <span className="absolute bottom-2 left-2 h-0.5 w-7 rounded-full bg-[#E10600]" />
      </span>

      {compact ? null : (
        <span className="text-lg font-black uppercase tracking-[0.12em] text-white sm:text-xl">
          EVENTO<span className="text-[#E10600]">MOTOR</span>
        </span>
      )}
    </div>
  );
}
