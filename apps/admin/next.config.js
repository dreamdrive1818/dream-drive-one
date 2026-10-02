/** @type {import('next').NextConfig} */
const API = (process.env.API_PROXY_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000").replace(/\/$/, "");

const nextConfig = {
  reactStrictMode: true,
    experimental: {
      staleTimes: { dynamic: 30, static: 180 },
    },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/cars", destination: "/fleet?view=cars", permanent: false },
      { source: "/vehicles", destination: "/fleet?view=vehicles", permanent: false },
    ];
  },
  async rewrites() {
    return [{ source: "/v1/:path*", destination: `${API}/v1/:path*` }];
  },
};

module.exports = nextConfig;
