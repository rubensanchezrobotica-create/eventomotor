import MotoCalendario from "@/components/MotoCalendario";
import UnderConstruction from "@/components/UnderConstruction";
import { isUnderConstruction } from "@/lib/under-construction";

export default function Home() {
  if (isUnderConstruction()) {
    return <UnderConstruction />;
  }

  return <MotoCalendario />;
}
