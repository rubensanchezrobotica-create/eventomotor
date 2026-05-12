"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { currentPagePath, trackEvent } from "@/lib/analytics";

type TrackAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  eventName: string;
  eventParams?: Record<string, string | number | boolean | null | undefined>;
};

export default function TrackAnchor({
  children,
  eventName,
  eventParams,
  onClick,
  ...props
}: TrackAnchorProps) {
  return (
    <a
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
    </a>
  );
}
