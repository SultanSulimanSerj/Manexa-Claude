/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
  },
  experimental: {
    serverComponentsExternalPackages: ['pdfkit', '@pdf-lib/fontkit'],
  },
}

module.exports = nextConfig
