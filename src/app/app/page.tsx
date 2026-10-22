"use client";

import { EvidenceInspector } from "@/components/EvidenceInspector";
import { Embers } from "@/components/landing/Embers";
import { Workspace } from "@/components/workspace/Workspace";

/** The working app. Evidentra is one compact workspace: 01 Dossier → 02 Findings → 03 CDSCO readiness. */
export default function Home() {
  return (
    <>
      <Workspace />
      <Embers density={0.3} className="z-[5] opacity-60 print:hidden" />
      <EvidenceInspector />
    </>
  );
}
