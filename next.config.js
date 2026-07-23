/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['pdfkit', '@pdf-lib/fontkit'],
  },
  async headers() {
    // Глобальные security-заголовки.
    // CSP намеренно ограничивает только framing/object/base — без script-src/style-src,
    // чтобы не ломать инлайновые скрипты Next.js и встраивание OnlyOffice (frame-src не задан).
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'off' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      {
        key: 'Content-Security-Policy',
        value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
      },
    ]
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

module.exports = nextConfig
