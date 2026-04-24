/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // pdfjs-dist is ESM-only and @napi-rs/canvas loads a .node binary;
    // both must stay external so Next doesn't try to bundle them into
    // the server runtime.
    serverComponentsExternalPackages: ['pdf-to-img', 'pdfjs-dist', '@napi-rs/canvas'],
  },
};

export default nextConfig;
