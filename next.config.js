/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  async redirects() {
    return [
      // Redirect www to non-www (backup to middleware)
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.lingoisland.com',
          },
        ],
        destination: 'https://lingoisland.com/:path*',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig

