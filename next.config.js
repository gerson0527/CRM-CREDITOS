/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  // Marcar paquetes de servidor como externos. En Next 13 va en `experimental`.
  experimental: {
    serverComponentsExternalPackages: ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner', 'pg'],
  },
};

module.exports = nextConfig;