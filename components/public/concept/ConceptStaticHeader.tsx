import Link from "next/link";
import TrackLink from "@/components/analytics/TrackLink";
import EventomotorLogo from "@/components/brand/EventomotorLogo";
import PublicNavigationMenu from "@/components/public/concept/PublicNavigationMenu";
import { PUBLIC_NAVIGATION } from "@/lib/public-navigation";

type ConceptStaticHeaderProps = {
  compactActions?: boolean;
};

export default function ConceptStaticHeader({ compactActions = false }: ConceptStaticHeaderProps) {
  return (
    <>
      <div className="emc-topline" />
      <nav className="emc-nav">
        <Link className="emc-brand-logo" href={PUBLIC_NAVIGATION.home} aria-label="EventoMotor inicio">
          <EventomotorLogo compactOnMobile />
        </Link>
        <PublicNavigationMenu />
        <div className="emc-nav-actions">
          {compactActions ? null : (
            <Link className="emc-btn emc-btn-dark" href={PUBLIC_NAVIGATION.calendar}>
              Ver agenda
            </Link>
          )}
          <TrackLink
            className="emc-btn emc-btn-primary"
            eventName="click_publish_event"
            eventParams={{ source: "static_header_cta" }}
            href={PUBLIC_NAVIGATION.publish}
          >
            Publicar
          </TrackLink>
        </div>
      </nav>
    </>
  );
}
