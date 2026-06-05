import react from '@vitejs/plugin-react';

export default {
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true,
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