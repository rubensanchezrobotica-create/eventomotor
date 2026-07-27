"use client";

import type { ComponentPropsWithoutRef } from "react";
import { currentPagePath, trackEvent } from "@/lib/analytics";

type RegionalTrackedDetailsProps = ComponentPropsWithoutRef<"details"> & {
  region: string;
};

export default function RegionalTrackedDetails({
  children,
  onToggle,
  region,
  ...props
}: RegionalTrackedDetailsProps) {
  return (
    <details
      {...props}
      onToggle={(event) => {
        if (event.currentTarget.open) {
          trackEvent("open_region_history", {
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
