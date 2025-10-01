# Vite Optimization Guide

This guide explains the optimizations made to the Vite configuration for better bundle size and performance.

## Usage

To use the optimized Vite configuration:

```bash
# Replace the existing vite.config.js with the optimized version
cp frontend/vite.config.optimized.js frontend/vite.config.js

# Install any missing dependencies
cd frontend
npm install

# Build with the optimized configuration
npm run build
```

## Key Optimizations

### 1. Bundle Splitting Strategy

The optimized configuration uses a sophisticated manual chunks strategy:

- **vendor-react**: Core React libraries (react, react-dom, react-router-dom)
- **vendor-agora**: Agora SDKs loaded on-demand (agora-rtc-sdk-ng, agora-rtm-sdk)
- **vendor-motion**: Animation library (framer-motion)
- **vendor-ui**: UI component libraries (@heroicons/react, @headlessui/react, react-hot-toast)
- **vendor-auth**: Authentication (@supabase/supabase-js)
- **vendor-stripe**: Payment processing (@stripe/react-stripe-js, @stripe/stripe-js)
- **vendor-socket**: Real-time communication (socket.io-client)
- **vendor-utils**: Utility libraries (date-fns, lodash-es)

### 2. Build Optimizations

- **Chunk Size Warning**: Set to 500KB to encourage smaller bundles
- **CSS Code Splitting**: Enabled for better performance
- **Terser Minification**: Removes console logs and debugger statements in production
- **Tree Shaking**: Aggressive tree shaking to eliminate dead code
- **Content Hash**: Better caching with content-based file naming

### 3. Performance Features

- **Split Vendor Chunk Plugin**: Automatically splits vendor code for better caching
- **Lazy Loading**: Agora SDKs excluded from initial bundle for on-demand loading
- **Compressed Size Reporting**: Shows gzip sizes for better understanding
- **Source Maps**: Only generated in development mode

### 4. Security Enhancements

- **Drop Console**: Removes console statements in production
- **Legal Comments**: Removes license comments to reduce size
- **Pure Functions**: Marks console methods as pure for better elimination

## Bundle Analysis

To analyze your bundle size:

1. Uncomment the visualizer section in the build configuration
2. Install the visualizer plugin:
   ```bash
   npm install --save-dev rollup-plugin-visualizer
   ```
3. Import it at the top of vite.config.js:
   ```js
   import { visualizer } from 'rollup-plugin-visualizer';
   ```
4. Add it to plugins array:
   ```js
   plugins: [
     // ... other plugins
     visualizer({
       open: true,
       filename: 'dist/stats.html',
     })
   ]
   ```

## Environment-Specific Builds

The configuration supports environment-specific optimizations:

```bash
# Development build (with source maps)
NODE_ENV=development npm run build

# Production build (optimized)
NODE_ENV=production npm run build
```

## Expected Improvements

With these optimizations, you should see:

1. **Smaller Initial Bundle**: 30-50% reduction in initial load
2. **Better Caching**: Vendor code cached separately from app code
3. **Faster Builds**: Optimized dependency pre-bundling
4. **Improved Performance**: Lazy loading of heavy libraries

## Monitoring Bundle Size

After building, check the output for bundle sizes:

```bash
npm run build
```

Look for output like:
```
dist/assets/vendor-react.hash.js    89.5 KB  │ gzip: 28.3 KB
dist/assets/vendor-ui.hash.js       156.2 KB │ gzip: 48.7 KB
dist/assets/index.hash.js           245.8 KB │ gzip: 78.4 KB
```

## Further Optimizations

Consider these additional optimizations:

1. **Dynamic Imports**: Use dynamic imports for route-based code splitting
2. **Image Optimization**: Use `vite-plugin-imagemin` for image compression
3. **PWA Assets**: Generate optimized PWA assets with `vite-plugin-pwa-assets-generator`
4. **Compression**: Enable gzip/brotli with `vite-plugin-compression`

## Troubleshooting

If you encounter issues:

1. **Clear Cache**: `rm -rf node_modules/.vite`
2. **Reinstall Dependencies**: `rm -rf node_modules && npm install`
3. **Check Console**: Look for specific error messages during build
4. **Verify Imports**: Ensure all imports are correctly resolved