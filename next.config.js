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
}

module.exports = nextConfig
