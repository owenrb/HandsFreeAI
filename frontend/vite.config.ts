import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'env-js',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url ? new URL(req.url, 'http://localhost').pathname : '';
          if (url === '/env.js') {
            const realtimeUrl = process.env.REALTIME_BFF_URL || "ws://localhost:8080/realtime";
            res.setHeader('Content-Type', 'application/javascript');
            res.end(`window.REALTIME_BFF_URL = "${realtimeUrl}";`);
          } else {
            next();
          }
        });
      }
    }
  ],
})
