import { permanentRedirect } from "next/navigation";
import { PUBLIC_NAVIGATION } from "@/lib/public-navigation";

export default function CalendarPage() {
  permanentRedirect(PUBLIC_NAVIGATION.calendar);
}
