import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// import { VitePWA } from 'vite-plugin-pwa'; // ❌ Removed: PWA not needed for real-time video/chat app
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';
import { fileURLToPath, URL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  base: '/', // Ensure all assets use absolute paths
  plugins: [
    react(),
    // Bundle analyzer - only run when needed
    process.env.ANALYZE && visualizer({
      open: true,
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
    // ❌ PWA REMOVED: Not suitable for real-time video/chat apps
    // Real-time features require constant network, so offline caching is counterproductive
    // Service worker was causing stale JS bundles to be served after deployments
  ].filter(Boolean),
  esbuild: {
    loader: 'tsx',
    include: /src\/.*\.(js|jsx|ts|tsx)$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
        '.jsx': 'jsx',
        '.ts': 'tsx',
        '.tsx': 'tsx',
      },
    },
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'framer-motion',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@services': path.resolve(__dirname, './src/services'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
    },
  },
  server: {
    port: 3006,
    open: true,
    host: true, // Allow access from network
    hmr: {
      overlay: false, // Disable error overlay in development
      host: 'localhost',
      port: 3006,
      protocol: 'ws'
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:3005',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // Enable sourcemaps in production for better error tracking in Sentry
    // Temporarily set to true for debugging
    sourcemap: true,
    minify: 'terser', // Use terser for better minification
    terserOptions: {
      compress: {
        drop_console: false, // Keep console.error for error boundaries (temporarily)
        drop_debugger: true, // Remove debugger statements
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
      },
      format: {
        comments: false, // Remove all comments
      },
    },
    // Optimize bundle size
    chunkSizeWarningLimit: 500, // Warn if chunk is larger than 500kb
    // Optimize chunks with route-based splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Keep React together in one chunk to avoid module sharing issues
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'agora-vendor': ['agora-rtc-sdk-ng', 'agora-rtm-sdk', 'agora-rtc-react'],
          'ui-vendor': ['framer-motion', '@headlessui/react', 'react-hot-toast'],
        },
        // Use Vite defaults for predictable paths
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    // Additional optimizations
    cssCodeSplit: true, // Split CSS into separate files
    assetsInlineLimit: 4096, // Inline assets smaller than 4kb
  },
  // Handle environment variables
  define: {
    'process.env': {},
  },
});