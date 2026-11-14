/** @type {import('next').NextConfig} */
const isExport = process.env.NEXT_EXPORT === 'true';

const nextConfig = {
  ...(isExport ? { output: 'export' } : {}),
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
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
