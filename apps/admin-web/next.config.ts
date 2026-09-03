import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : null;
  } catch {
    return null;
  }
})();
const externalDataSources = supabaseOrigin ? ` ${supabaseOrigin}` : "";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  `connect-src 'self'${externalDataSources}${isDevelopment ? " ws: wss:" : ""}`,
  `media-src 'self' blob:${externalDataSources}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const diagramContentSecurityPolicy = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' blob: data:",
  "font-src data: https://fonts.gstatic.com",
  "connect-src 'none'",
  "media-src blob:",
  "worker-src blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  transpilePackages: ["@egocapture/core", "@egocapture/ui"],
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "1mb" } },
  serverExternalPackages: ["mediainfo.js"],
  outputFileTracingIncludes: {
    "/api/cron/reconcile": ["./node_modules/mediainfo.js/dist/MediaInfoModule.wasm"],
  },
  async headers() {
    return [
      { source: "/(.*)", headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ] },
      { source: "/system-guide/diagrams/:path*.html", headers: [
        { key: "Content-Security-Policy", value: diagramContentSecurityPolicy },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
      ] },
    ];
  },
};

export default nextConfig;
