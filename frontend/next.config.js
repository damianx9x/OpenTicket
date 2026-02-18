/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for Electron embedding
  // NestJS backend will serve the 'out' directory
  output: 'export',
  
  // Disable image optimization since we're doing static export
  // Images will be served as-is from the file system
  images: {
    unoptimized: true,
  },

  // Allow imports from src/
  typescript: {
    // Disable type checking during build to speed up compilation
    // Run 'npm run lint' separately for type checking
    tsconfigPath: './tsconfig.json',
  },
}

module.exports = nextConfig