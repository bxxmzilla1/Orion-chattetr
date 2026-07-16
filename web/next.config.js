/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow large media uploads through server actions / route handlers.
  experimental: {
    serverActions: {
      bodySizeLimit: "60mb",
    },
  },
};

module.exports = nextConfig;
