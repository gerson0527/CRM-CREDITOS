/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  // Marcar paquetes de servidor (S3 SDK) como externos para que NO
  // se intenten incluir en el bundle del cliente. El storage solo se usa
  // en API routes (server-side).
  serverExternalPackages: ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner', 'pg'],
};

module.exports = nextConfig;