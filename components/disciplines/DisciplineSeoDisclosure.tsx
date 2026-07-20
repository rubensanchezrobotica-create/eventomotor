"use client";

import { useId, useState, type ReactNode } from "react";
import zoneStyles from "@/components/zones/ZonePreview.module.css";

type DisciplineSeoDisclosureProps = {
  children: ReactNode;
};

export default function DisciplineSeoDisclosure({ children }: DisciplineSeoDisclosureProps) {
  const contentId = useId();
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <button
        aria-controls={contentId}
        aria-expanded={expanded}
        className={zoneStyles.seoDisclosureToggle}
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        {expanded ? "Ocultar información" : "Leer más sobre esta disciplina"}
      </button>
      <div
        className={`${zoneStyles.seoDisclosureContent} ${
          expanded ? zoneStyles.seoDisclosureContentOpen : ""
        }`}
        id={contentId}
      >
        {children}
      </div>
    </>
  );
}
