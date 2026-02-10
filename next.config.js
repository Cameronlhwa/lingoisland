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
      // www -> non-www (single hop to canonical)
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.lingoisland.com' }],
        destination: 'https://lingoisland.com/:path*',
        permanent: true,
      },
      // http -> https (single hop; host may be www or non-www)
      {
        source: '/:path*',
        has: [{ type: 'header', key: 'x-forwarded-proto', value: 'http' }],
        destination: 'https://lingoisland.com/:path*',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig

