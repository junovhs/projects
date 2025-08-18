/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure Node.js runtime for route handlers (needed by JSZip)
  experimental: { serverActions: { allowedOrigins: ['*'] } }
};
export default nextConfig;
