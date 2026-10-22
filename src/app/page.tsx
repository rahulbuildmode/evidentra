"use client";

import { Anomalies } from "@/components/experience/Anomalies";
import { Brief } from "@/components/experience/Brief";
import { Dossier } from "@/components/experience/Dossier";
import { FinalCta } from "@/components/experience/FinalCta";
import { Signal } from "@/components/experience/Signal";
import { TopNav } from "@/components/experience/TopNav";
import { useAppState } from "@/lib/store";

/** One continuous journey: upload documents → find evidence and inconsistencies → readiness brief. */
export default function Home() {
  const { isDemo } = useAppState();
  return (
    <>
      <TopNav isDemo={isDemo} onLight />
      <main>
        <Signal isDemo={isDemo} />
        <Dossier />
        <Anomalies />
        <Brief />
        <FinalCta />
      </main>
    </>
  );
}
