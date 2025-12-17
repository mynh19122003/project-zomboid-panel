/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Không dùng output: 'export' để giữ lại API routes
  // output: 'standalone' để tối ưu cho production
  output: 'standalone',
}

module.exports = nextConfig

