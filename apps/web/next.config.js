/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // CRA CSS + image imports live under src/; allow them.
  transpilePackages: [],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
  // Keep react-router client navigation working with Next catch-all.
  async rewrites() {
    return [];
  },
};

module.exports = nextConfig;
