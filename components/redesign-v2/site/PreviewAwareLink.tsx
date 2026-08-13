import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import {
  resolvePreviewNavigationItem,
  type PreviewNavigationId,
} from "./preview-navigation";

type PreviewAwareLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  children?: ReactNode;
  navigationId: PreviewNavigationId;
  prefetch?: LinkProps["prefetch"];
};

export default function PreviewAwareLink({
  children,
  navigationId,
  ...props
}: PreviewAwareLinkProps) {
  const item = resolvePreviewNavigationItem(navigationId);

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
