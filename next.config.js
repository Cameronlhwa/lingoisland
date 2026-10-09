/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    localPatterns: [
      { pathname: '/**', search: '' },
      // Progress artwork uses a version query to invalidate cached images.
      { pathname: '/progress-islands/stage-*.png' },
    ],
  },
  turbopack: {
    resolveAlias: {
      segmentit: { browser: 'segmentit/dist/esm/segmentit.js' },
    },
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
  async rewrites() {
    // TODO: Remove these legacy asset paths after cached pages have expired and
    // old URLs are no longer needed by saved links or external references.
    return [
      { source: '/animation-photos/:file*', destination: '/pronunciation/:file*' },
      { source: '/blog/images/:file*', destination: '/blog/:file*' },
      { source: '/Cameron%20Lim%20Profile%20Photo.jpg', destination: '/founder/cameron-lim-profile.jpg' },
      { source: '/Youtube%20Thumbnail.png', destination: '/founder/youtube-thumbnail.png' },
      { source: '/Upgrade-modal.jpg', destination: '/marketing/upgrade-modal.jpg' },
      { source: '/Recording%20of%20Lingoisland2.mov', destination: '/demos/lingoisland-demo.mov' },
      { source: '/base_cappy.png', destination: '/templates/base-cappy.png' },
      { source: '/blank_island.png', destination: '/templates/blank-island.png' },
      { source: '/capybara-face.png', destination: '/characters/capybara-face.png' },
      { source: '/capybara-peek-notch.png', destination: '/characters/capybara-peek-notch.png' },
      { source: '/capybara-profile.png', destination: '/characters/capybara-profile.png' },
      { source: '/capybara-waving.png', destination: '/characters/capybara-waving.png' },
      { source: '/favicon.png', destination: '/brand/favicon.png' },
      { source: '/logo.png', destination: '/brand/logo.png' },
    ]
  },
}

module.exports = nextConfig

