/** @type {import('next').NextConfig} */
const nextConfig = {
  /* Assets /admin/_next/* prefix me serve honge taaki Client (:3000) ke
     /admin/* proxy rewrite se bhi sahi load hon (preview single-port hai) */
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
