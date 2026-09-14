import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import {
  resolveInteriorNavigationItem,
  type InteriorNavigationMode,
  type PreviewNavigationId,
} from "./preview-navigation";

type PreviewAwareLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  children?: ReactNode;
  mode?: InteriorNavigationMode;
  navigationId: PreviewNavigationId;
  prefetch?: LinkProps["prefetch"];
};

export default function PreviewAwareLink({
  children,
  mode = "preview",
  navigationId,
  ...props
}: PreviewAwareLinkProps) {
  const item = resolveInteriorNavigationItem(navigationId, mode);

  return (
    <Link
      {...props}
      data-preview-fallback={item.previewFallback}
      href={item.href}
    >
      {children ?? item.label}
    </Link>
  );
}
