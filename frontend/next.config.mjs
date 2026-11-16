/** @type {import('next').NextConfig} */
const isExport = process.env.NEXT_EXPORT === 'true';

const nextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  ...(isExport ? { output: 'export' } : {}),
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  allowedDevOrigins: [
    '192.168.177.131',
    '192.168.177.131:18000',
    'localhost:18000',
    '127.0.0.1:18000',
  ],
  ...(!isExport
    ? {
        async rewrites() {
          return [
            {
              source: '/api/:path*',
              destination: 'http://127.0.0.1:18080/api/:path*',
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
