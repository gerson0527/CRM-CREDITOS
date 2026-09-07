/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

// Política CSP. 'unsafe-inline' y 'unsafe-eval' se requieren porque Next.js
// emite estilos y código en línea durante hidratación; en producción ideal
// se sustituyen por nonces calculados por middleware (TODO: implementar
// cuando se actualice a Next 14+ donde el soporte es nativo).
// - img-src/frame-src 'https:' permite que las URLs firmadas de S3
//   y los previews de PDF funcionen sin enumerar el endpoint exacto.
// - object-src 'none' bloquea Flash/Java embebido (legacy attack surface).
// - frame-ancestors 'self' impide clickjacking.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isProd ? '' : "'unsafe-eval'"}`.trim(),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');

const securityHeaders = [
  // Solo HTTPS en producción (los navegadores ignoran HSTS en localhost).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: csp },
];

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  // Marcar paquetes de servidor como externos.
  // Next 13: experimental.serverComponentsExternalPackages
  // Next 14+: serverExternalPackages (top-level)
  serverExternalPackages: ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner', 'pg'],
  async headers() {
    const staticHeaders = isProd
      // Produccion: cache agresivo e inmutable (el nombre del archivo
      // incluye el hash, asi que el contenido es efectivamente inmutable).
      ? [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]
      // Desarrollo: NO cachear. En dev, el mismo URL de chunk puede tener
      // contenido distinto entre recargas del dev server. Sin este header
      // el navegador sirve versiones obsoletas tras recompilaciones y se
      // produce ChunkLoadError. (Next.js usa '?v=' en dev, pero algunos
      // navegadores cachean HTML antes de aplicar el query param.)
      : [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }];

    return [
      // Headers de seguridad globales para todas las rutas.
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      // Caché de assets estaticos de Next.
      {
        source: '/_next/static/:path*',
        headers: staticHeaders,
      },
    ];
  },
};

module.exports = nextConfig;