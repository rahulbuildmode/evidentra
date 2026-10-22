import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The demo loader reads the fictional dossier PDFs from disk at runtime; ship them with that route.
  outputFileTracingIncludes: {
    "/api/demo/load": ["./fixtures/demo-dossier/*.pdf"],
    "/api/documents": ["./fixtures/demo-dossier/*.pdf"],
    "/api/analyze": ["./fixtures/demo-dossier/*.pdf"],
    "/api/requirements/map": ["./fixtures/demo-dossier/*.pdf"],
  },
  partialPrefetching: true,
  // The six old pages are now chapters of one experience; keep their URLs working.
  async redirects() {
    return [
      { source: "/workspace", destination: "/#dossier", permanent: false },
      { source: "/documents", destination: "/#dossier", permanent: false },
      { source: "/evidence-matrix", destination: "/#report", permanent: false },
      { source: "/consistency-checks", destination: "/#anomalies", permanent: false },
      { source: "/readiness-report", destination: "/#report", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
