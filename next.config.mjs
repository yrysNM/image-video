/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep tesseract.js (used for server-side OCR of uploaded screenshots) out of
  // the webpack server bundle so its worker/core assets resolve from node_modules
  // at runtime.
  experimental: {
    serverComponentsExternalPackages: ["tesseract.js", "pdf-parse"],
  },
};

export default nextConfig;
