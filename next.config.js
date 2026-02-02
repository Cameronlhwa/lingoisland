/** @type {import('next').NextConfig} */
const nextConfig = {
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

