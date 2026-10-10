/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "https", hostname: "**" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:3030/api/:path*",
      },
      {
        source: "/admin/:path*",
        destination: "http://127.0.0.1:3001/admin/:path*",
      },
      {
        source: "/banners/:path*",
        destination: "http://127.0.0.1:3030/banners/:path*",
      },
      {
        source: "/uploads/:path*",
        destination: "http://127.0.0.1:3030/uploads/:path*",
      },
    ];
  },
};

export default nextConfig;
