/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // permite abrir o preview em domínios externos (ex: *.e2b.app) durante o dev
  allowedDevOrigins: ["*.e2b.app", "*.vercel.app", "localhost", "127.0.0.1"],

  images: {
    // Permite thumbnails externas (CDNs, Roblox, imgur...) definidas no admin
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },

  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
