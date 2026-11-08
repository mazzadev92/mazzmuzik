import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { spawn } from "child_process";
import fs from "fs";
import type { IncomingMessage, ServerResponse } from "http";

const streamCache = new Map<string, { url: string; time: number }>();

function resolveStreamWithYtDlp(target: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const candidates = [
      path.resolve(__dirname, "binaries/current/yt-dlp.exe"),
      path.resolve(__dirname, "binaries/yt-dlp-x86_64-pc-windows-msvc.exe"),
      path.resolve(__dirname, "src-tauri/binaries/current/yt-dlp.exe"),
      "yt-dlp",
    ];
    const bin = candidates.find((c) => fs.existsSync(c)) || "yt-dlp";

    const proc = spawn(bin, [
      "-f",
      "bestaudio[ext=m4a]/bestaudio/best",
      "--no-playlist",
      "-g",
      target,
    ]);

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("close", (code) => {
      const url = stdout.trim().split("\n")[0];
      if (code === 0 && url && url.startsWith("http")) {
        resolve(url);
      } else {
        reject(new Error(stderr || "yt-dlp failed"));
      }
    });
  });
}

function fullAudioResolverPlugin() {
  const handler = async (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void
  ) => {
    if (!req.url?.startsWith("/api/resolve")) {
      return next();
    }
    try {
      const reqUrl = new URL(req.url, "http://localhost");
      const videoId = reqUrl.searchParams.get("videoId") || "";
      const artist = reqUrl.searchParams.get("artist") || "";
      const title = reqUrl.searchParams.get("title") || "";
      const q = reqUrl.searchParams.get("q") || "";

      let target = "";
      if (videoId) {
        target = `https://music.youtube.com/watch?v=${videoId}`;
      } else if (artist && title) {
        target = `ytsearch1:${artist} ${title}`;
      } else if (q) {
        target = `ytsearch1:${q}`;
      } else {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end(JSON.stringify({ error: "Paramètres manquants" }));
        return;
      }

      const cached = streamCache.get(target);
      if (cached && Date.now() - cached.time < 3 * 3600 * 1000) {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end(JSON.stringify({ streamUrl: cached.url }));
        return;
      }

      const streamUrl = await resolveStreamWithYtDlp(target);
      streamCache.set(target, { url: streamUrl, time: Date.now() });

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end(JSON.stringify({ streamUrl }));
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end(
        JSON.stringify({ error: err?.message || "Échec résolution stream" })
      );
    }
  };

  return {
    name: "full-audio-resolver",
    configureServer(server: any) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    fullAudioResolverPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api/deezer": {
        target: "https://api.deezer.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/deezer/, ""),
      },
      "/api/ytmusic": {
        target: "https://music.youtube.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/ytmusic/, ""),
        headers: {
          Origin: "https://music.youtube.com",
          Referer: "https://music.youtube.com/",
        },
      },
      "/api/lyrics": {
        target: "https://lrclib.net",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/lyrics/, ""),
      },
    },
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  preview: {
    port: 3000,
    host: "0.0.0.0",
    proxy: {
      "/api/deezer": {
        target: "https://api.deezer.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/deezer/, ""),
      },
      "/api/ytmusic": {
        target: "https://music.youtube.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/ytmusic/, ""),
        headers: {
          Origin: "https://music.youtube.com",
          Referer: "https://music.youtube.com/",
        },
      },
      "/api/lyrics": {
        target: "https://lrclib.net",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/lyrics/, ""),
      },
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: process.env.TAURI_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
