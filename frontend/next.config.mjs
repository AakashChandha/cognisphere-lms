/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    // When the browser hits the frontend directly (e.g. localhost:3000),
    // proxy /api requests to the Express backend inside Docker.
    const backendUrl = process.env.INTERNAL_API_URL || 'http://backend:5000';

    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
