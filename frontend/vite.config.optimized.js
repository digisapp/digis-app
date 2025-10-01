import { defineConfig, splitVendorChunkPlugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { fileURLToPath, URL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Optimize React refresh
      fastRefresh: true,
      babel: {
        // Reduce bundle size by using runtime automatic
        runtime: 'automatic',
      },
    }),
    
    // Split vendor chunks for better caching
    splitVendorChunkPlugin(),
    
    VitePWA({
      registerType: 'autoUpdate',
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3MB
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
          {
            urlPattern: /^https:\/\/download\.agora\.io\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'agora-sdk-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.(js|jsx)$/,
    exclude: [],
    // Minify for production
    legalComments: 'none',
    drop: ['console', 'debugger'],
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
      '@supabase/supabase-js',
      '@stripe/react-stripe-js',
      'socket.io-client',
    ],
    exclude: [
      // Exclude large libraries that should be loaded on demand
      'agora-rtc-sdk-ng',
      'agora-rtm-sdk',
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
    port: 3000,
    open: true,
    host: true,
    hmr: {
      overlay: false,
      host: 'localhost',
      port: 3000,
      protocol: 'ws'
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development',
    
    // Set chunk size warning limit
    chunkSizeWarningLimit: 500, // 500kb
    
    // Enable CSS code splitting
    cssCodeSplit: true,
    
    // Optimize build
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.trace'],
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    
    // Optimize chunks with manual strategy
    rollupOptions: {
      output: {
        // Use content hash for better caching
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
        
        manualChunks: {
          // Core vendor chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          
          // Agora chunks (loaded on-demand)
          'vendor-agora': ['agora-rtc-sdk-ng', 'agora-rtm-sdk'],
          
          // UI and animation libraries
          'vendor-motion': ['framer-motion'],
          'vendor-ui': ['@heroicons/react/24/outline', '@headlessui/react', 'react-hot-toast'],
          
          // Authentication and backend
          'vendor-auth': ['@supabase/supabase-js'],
          'vendor-stripe': ['@stripe/react-stripe-js', '@stripe/stripe-js'],
          'vendor-socket': ['socket.io-client'],
          
          // Utility libraries
          'vendor-utils': ['date-fns', 'lodash-es'],
        },
      },
      
      // External dependencies for CDN loading (optional)
      external: [],
      
      // Tree shaking
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
      },
    },
    
    // Report compressed size
    reportCompressedSize: true,
    
    // Generate build report
    // Uncomment to analyze bundle size
    // visualizer: {
    //   open: true,
    //   filename: 'dist/stats.html',
    // },
  },
  
  // Handle environment variables
  define: {
    'process.env': {},
    __DEV__: process.env.NODE_ENV === 'development',
    __PROD__: process.env.NODE_ENV === 'production',
  },
  
  // CSS processing
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
    postcss: {
      plugins: [
        // Add autoprefixer and other PostCSS plugins here
      ],
    },
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/variables.scss";`,
      },
    },
  },
  
  // Preview server configuration
  preview: {
    port: 3000,
    strictPort: false,
    host: true,
    cors: true,
  },
});