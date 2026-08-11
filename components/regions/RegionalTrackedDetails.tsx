"use client";

import type { ComponentPropsWithoutRef } from "react";
import { currentPagePath, trackEvent } from "@/lib/analytics";

type RegionalTrackedDetailsProps = ComponentPropsWithoutRef<"details"> & {
  eventName?: string;
  region: string;
};

export default function RegionalTrackedDetails({
  children,
  eventName = "open_region_history",
  onToggle,
  region,
  ...props
}: RegionalTrackedDetailsProps) {
  return (
    <details
      {...props}
      onToggle={(event) => {
        if (event.currentTarget.open) {
          trackEvent(eventName, {
            page_path: currentPagePath(),
            region,
          });
        }
        onToggle?.(event);
      }}
    >
      {children}
    </details>
  );
}
