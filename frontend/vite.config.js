import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';
import { fileURLToPath, URL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Bundle analyzer - only run when needed
    process.env.ANALYZE && visualizer({
      open: true,
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
    VitePWA({
      registerType: 'autoUpdate',
      cleanupOutdatedCaches: true, // Ensure old caches are cleaned up
      includeAssets: ['favicon.ico', 'digis-logo-black.png', 'digis-logo-white.png'],
      manifest: {
        name: 'Digis Creator Platform',
        short_name: 'Digis',
        description: 'Connect with creators through video calls, live streaming, and more',
        theme_color: '#6B46C1',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'digis-logo-black.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'digis-logo-black.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        clientsClaim: true, // Take control of all pages immediately
        skipWaiting: true, // Activate new service worker immediately
        cleanupOutdatedCaches: true, // Clean up old caches
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB
        // CRITICAL: Never cache API routes (especially auth endpoints)
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // CRITICAL: Explicitly exclude all API routes from caching
          // This prevents stale auth responses during backend outages
          {
            urlPattern: /^.*\/api\/.*/i,
            handler: 'NetworkOnly',
            // Note: NetworkOnly doesn't support networkTimeoutSeconds
            // If network fails, it will fail immediately (no cache fallback)
          }
        ]
      }
    })
  ],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.(js|jsx)$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
        '.jsx': 'jsx',
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
    // Hidden sourcemaps won't be served to users but will be uploaded to Sentry
    sourcemap: 'hidden',
    minify: 'terser', // Use terser for better minification
    terserOptions: {
      compress: {
        drop_console: true, // Remove all console.* statements
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
        // Generate smaller chunks with better naming
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
          return `assets/js/${facadeModuleId}-[hash].js`;
        },
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
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