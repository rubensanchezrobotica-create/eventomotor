"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { currentPagePath, trackEvent } from "@/lib/analytics";

type TrackLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, "onClick"> & {
  children: ReactNode;
  eventName: string;
  eventParams?: Record<string, string | number | boolean | null | undefined>;
  onClick?: ComponentPropsWithoutRef<typeof Link>["onClick"];
};

export default function TrackLink({
  children,
  eventName,
  eventParams,
  onClick,
  ...props
}: TrackLinkProps) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        trackEvent(eventName, {
          page_path: currentPagePath(),
          ...eventParams,
        });
        onClick?.(event);
      }}
    >
      {children}
    </Link>
  );
}
