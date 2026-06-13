import express from "express";
import ViteExpress from "vite-express";
import dotenv from "dotenv";
import path from "path";
import { createProxyMiddleware } from "http-proxy-middleware";

// Load .env from current directory or parent directory
dotenv.config();
dotenv.config({ path: path.join(process.cwd(), "..", ".env") });

const app = express();

const port = parseInt(process.env.PORT || "3000");
const backendUrl = process.env.BACKEND_URL || "http://localhost:8080";

console.log(`[Proxy] Target backend: ${backendUrl}`);

// Connectivity test to backend
fetch(`${backendUrl}/auth/me`)
  .then(() => console.log(`[Proxy] ✅ Backend is reachable at ${backendUrl}`))
  .catch((err) => console.error(`[Proxy] ❌ Backend is NOT reachable at ${backendUrl}. Error: ${err.message}`));

// Proxy authentication requests
app.use(createProxyMiddleware({
  pathFilter: (path) => path.startsWith('/auth'),
  target: backendUrl,
  changeOrigin: true,
  on: {
    proxyReq: (proxyReq, req, res) => {
      console.log(`[Proxy] Forwarding ${req.method} ${req.url} -> ${backendUrl}${req.url}`);
    },
    error: (err, req, res) => {
      console.error('[Proxy] Error:', err.message);
    }
  }
}));

// Serves the Google Client ID to the frontend
app.get("/env.js", (req, res) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
  console.log(`[Env] Serving GOOGLE_CLIENT_ID: ${googleClientId ? "Set (length: " + googleClientId.length + ")" : "MISSING"}`);
  res.type("application/javascript");
  res.send(`window.GOOGLE_CLIENT_ID = "${googleClientId}";`);
});

const server = ViteExpress.listen(app, port, () =>
  console.log(`Server is listening on http://localhost:${port}`)
);

// Proxy WebSocket requests (/realtime only)
const wsTarget = backendUrl.replace(/^http/, "ws");
const wsProxy = createProxyMiddleware({
  target: wsTarget,
  changeOrigin: true,
  ws: true,
});

server.on("upgrade", (req, socket, head) => {
  if (req.url === "/realtime") {
    console.log(`[Proxy] Upgrading WebSocket: ${req.url} -> ${wsTarget}${req.url}`);
    wsProxy.upgrade!(req, socket, head);
  }
});
