import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default {
  plugins: [react(), basicSsl()],
  server: {
    host: true,
    allowedHosts: true,
    https: true,
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
