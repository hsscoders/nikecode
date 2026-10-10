/** @type {import('next').NextConfig} */
const nextConfig = {
  /* Assets are served under the /admin/_next/* prefix so they also load correctly
     through the Client (:3000) /admin/* proxy rewrite (single-port preview) */
  assetPrefix: "/admin",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:3030/api/:path*",
      },
      {
        source: "/admin/_next/:path*",
        destination: "/_next/:path*",
      },
      {
        source: "/banners/:path*",
        destination: "http://127.0.0.1:3030/banners/:path*",
      },
    ];
  },
};

export default nextConfig;
