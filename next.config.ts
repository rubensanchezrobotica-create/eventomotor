import type { NextConfig } from "next";
import { PUBLIC_NAVIGATION } from "./lib/public-navigation";

const legacyRedirect = (source: string, destination: string) => ({
  source,
  destination,
  statusCode: 301,
});

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  async redirects() {
    return [
      legacyRedirect("/calendario", PUBLIC_NAVIGATION.calendar),
      legacyRedirect("/events/:path*", PUBLIC_NAVIGATION.calendar),
      legacyRedirect("/event-organizer/:path*", "/publicar-evento"),
      legacyRedirect("/event-location/osuna", "/zonas/sur"),
      legacyRedirect("/event-location/osuna/", "/zonas/sur"),
      legacyRedirect("/event-location/valencia", "/eventos-motor-valencia"),
      legacyRedirect("/event-location/valencia/", "/eventos-motor-valencia"),
      legacyRedirect("/event-location/girona", "/eventos-motor-cataluna"),
      legacyRedirect("/event-location/girona/", "/eventos-motor-cataluna"),
      legacyRedirect("/event-location/la-baneza", "/zonas/norte"),
      legacyRedirect("/event-location/la-baneza/", "/zonas/norte"),
      legacyRedirect("/event-location/:path*", PUBLIC_NAVIGATION.calendar),
      legacyRedirect("/event-type/hard-enduro", "/disciplinas/offroad"),
      legacyRedirect("/event-type/hard-enduro/", "/disciplinas/offroad"),
      legacyRedirect("/event-type/enduro", "/disciplinas/offroad"),
      legacyRedirect("/event-type/enduro/", "/disciplinas/offroad"),
      legacyRedirect("/event-type/motocross", "/disciplinas/offroad"),
      legacyRedirect("/event-type/motocross/", "/disciplinas/offroad"),
      legacyRedirect("/event-type/trial", "/disciplinas/offroad"),
      legacyRedirect("/event-type/trial/", "/disciplinas/offroad"),
      legacyRedirect("/event-type/rally-raid", "/disciplinas/rallyes"),
      legacyRedirect("/event-type/rally-raid/", "/disciplinas/rallyes"),
      legacyRedirect("/event-type/rally", "/disciplinas/rallyes"),
      legacyRedirect("/event-type/rally/", "/disciplinas/rallyes"),
      legacyRedirect("/event-type/rallyes", "/disciplinas/rallyes"),
      legacyRedirect("/event-type/rallyes/", "/disciplinas/rallyes"),
      legacyRedirect("/event-type/clasicas", "/disciplinas/clasicos"),
      legacyRedirect("/event-type/clasicas/", "/disciplinas/clasicos"),
      legacyRedirect("/event-type/clasicos", "/disciplinas/clasicos"),
      legacyRedirect("/event-type/clasicos/", "/disciplinas/clasicos"),
      legacyRedirect("/event-type/sbk", "/disciplinas/circuito"),
      legacyRedirect("/event-type/sbk/", "/disciplinas/circuito"),
      legacyRedirect("/event-type/superbike", "/disciplinas/circuito"),
      legacyRedirect("/event-type/superbike/", "/disciplinas/circuito"),
      legacyRedirect("/event-type/circuito", "/disciplinas/circuito"),
      legacyRedirect("/event-type/circuito/", "/disciplinas/circuito"),
      legacyRedirect("/event-type/:path*", PUBLIC_NAVIGATION.calendar),
      legacyRedirect("/event-type-2/pais-vasco", "/zonas/norte"),
      legacyRedirect("/event-type-2/pais-vasco/", "/zonas/norte"),
      legacyRedirect("/event-type-2/:path*", PUBLIC_NAVIGATION.calendar),
    ];
  },
};

export default nextConfig;
