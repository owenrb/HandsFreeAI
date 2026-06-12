import express from "express";
import ViteExpress from "vite-express";

const app = express();

const port = parseInt(process.env.PORT || "3000");

// This is where we handle the runtime environment variable override.
// We serve a small script that populates window.REALTIME_BFF_URL.
app.get("/env.js", (req, res) => {
  const realtimeUrl = process.env.REALTIME_BFF_URL || "ws://localhost:8080/realtime";
  res.type("application/javascript");
  res.send(`window.REALTIME_BFF_URL = "${realtimeUrl}";`);
});

ViteExpress.listen(app, port, () =>
  console.log(`Server is listening on http://localhost:${port}`)
);
