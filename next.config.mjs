/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow dev asset requests when you access the dev server via different hostnames
  // (e.g. localhost vs 127.0.0.1 vs LAN IP)
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.10.118"],
};

export default nextConfig;
