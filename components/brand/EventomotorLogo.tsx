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
    <div className={`inline-flex items-center gap-3 ${className}`} aria-label="EventoMotor">
      <span
        className={`relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-md border border-white/10 bg-[#1A1A1D] shadow-[0_0_34px_rgba(225,6,0,0.16)] ${markClassName}`}
        aria-hidden="true"
      >
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 44 44" role="img">
          <path
            d="M7 30c2.8-8.7 8-13.1 15.4-13.1 7.1 0 12.1 4.2 14.6 12.8"
            fill="none"
            stroke="#E10600"
            strokeLinecap="round"
            strokeWidth="2.5"
          />
          <path
            d="M22 17l6-8"
            fill="none"
            stroke="#FFD000"
            strokeLinecap="round"
            strokeWidth="2"
          />
          <path
            d="M2 13h13M0 20h10M3 27h8"
            fill="none"
            stroke="rgba(255,255,255,0.32)"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
        <span className="relative text-[0.72rem] font-black tracking-[-0.02em] text-white">
          E<span className="text-[#E10600]">M</span>
        </span>
      </span>

      {compact ? null : (
        <span className="text-lg font-black uppercase tracking-[0.08em] text-white sm:text-xl">
          EVENTO<span className="text-[#E10600]">MOTOR</span>
        </span>
      )}
    </div>
  );
}
