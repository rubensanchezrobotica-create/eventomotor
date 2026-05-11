import { existsSync } from "node:fs";
import { join } from "node:path";
import ConceptHomePage from "@/components/public/concept/ConceptHomePage";

export default function HomePage() {
  const hasHeroImage = existsSync(join(process.cwd(), "public/images/hero/eventomotor-hero-motorsport.png"));

  return <ConceptHomePage hasHeroImage={hasHeroImage} />;
}
