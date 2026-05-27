/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  experimental: {
    // Don't reuse client-side cached RSC for dynamic routes — always refetch
    // on navigation so dashboard/admin always show the latest data.
    staleTimes: { dynamic: 0, static: 180 },
  },
};

module.exports = nextConfig;
