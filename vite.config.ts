import react from '@vitejs/plugin-react';

export default {
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true,
    // HMR is OFF on purpose. Its WebSocket disconnects whenever the WebView is backgrounded, and on
    // return the Vite client does a full location.reload() — which looked like the app "reopening
    // fresh" every time you left it for a second. With no HMR socket there's nothing to reconnect,
    // so a quick trip out of the app no longer restarts it. Trade-off: edits don't auto-refresh —
    // pull-to-refresh (or reload in Expo) to see new changes. Files are still served uncached.
    hmr: false,
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'mapbox': ['mapbox-gl'],
        },
      },
    },
  },
};