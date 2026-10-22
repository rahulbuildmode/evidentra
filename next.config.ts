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
