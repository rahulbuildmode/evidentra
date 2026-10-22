"use client";

import { EvidenceInspector } from "@/components/EvidenceInspector";
import { Workspace } from "@/components/workspace/Workspace";

/** Evidentra is one compact workspace: 01 Dossier → 02 Findings → 03 CDSCO readiness. */
export default function Home() {
  return (
    <>
      <Workspace />
      <EvidenceInspector />
    </>
  );
}
