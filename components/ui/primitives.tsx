import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Button({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        "inline-flex min-h-11 items-center justify-center rounded-md bg-[#E10600] px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-white shadow-[0_18px_40px_rgba(225,6,0,0.24)] transition hover:bg-[#ff1710] focus:outline-none focus:ring-2 focus:ring-[#E10600] focus:ring-offset-2 focus:ring-offset-[#0D0D0F] disabled:cursor-not-allowed disabled:opacity-55",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={cx(
        "rounded-lg border border-white/10 bg-[#1A1A1D] shadow-[0_24px_70px_rgba(0,0,0,0.34)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Chip({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#A6A6A6]",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "min-h-11 w-full rounded-md border border-white/10 bg-[#1A1A1D] px-4 text-sm text-white outline-none transition placeholder:text-[#A6A6A6]/70 focus:border-[#E10600] focus:ring-2 focus:ring-[#E10600]/25",
        className,
      )}
      type="search"
      {...props}
    />
  );
}
