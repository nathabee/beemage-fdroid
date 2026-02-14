// /apps/android-web/vite.config.ts
import { defineConfig, type Plugin } from "vite";
import path from "node:path";
import fs from "node:fs";

const repoRoot = path.resolve(__dirname, "../.."); // repo root (because __dirname = apps/android-web)

function tracePlatformResolves(): Plugin {
  return {
    name: "app-trace-platform-resolves",
    enforce: "pre",
    async resolveId(source, importer, options) {
      const shouldTrace =
        source.includes("panel/platform/runtime") ||
        source.includes("shared/platform/storage") ||
        source.includes("panel/platform/engineAdapter") ||
        source.includes("platform/runtime") ||
        source.includes("platform/storage") ||
        source.includes("platform/engineAdapter");

      if (shouldTrace) {
        const r = await this.resolve(source, importer, { ...options, skipSelf: true });
        console.log("[app-trace] source   :", source);
        console.log("[app-trace] importer :", importer);
        console.log("[app-trace] resolved :", r?.id);
        console.log("----");
      }

      return null;
    },
  };
}

function seamSwapPlugin(): Plugin {
  const mockRuntimePath = path.resolve(__dirname, "src/mocks/runtime.ts");
  const mockStoragePath = path.resolve(__dirname, "src/mocks/storage.ts");
  const mockEngineAdapterPath = path.resolve(__dirname, "src/mocks/engine/engineAdapter.ts");

  function clean(id: string) {
    return id.split("?")[0].replace(/\\/g, "/");
  }

  function isPanelRuntime(id: string): boolean {
    return (
      id.includes("/src/panel/platform/runtime") ||
      id.endsWith("/src/panel/platform/runtime.ts") ||
      id.endsWith("/src/panel/platform/runtime.js")
    );
  }

  function isSharedStorage(id: string): boolean {
    return (
      id.includes("/src/shared/platform/storage") ||
      id.endsWith("/src/shared/platform/storage.ts") ||
      id.endsWith("/src/shared/platform/storage.js")
    );
  }

  function isEngineAdapter(id: string): boolean {
    return (
      id.includes("/src/panel/platform/engineAdapter") ||
      id.endsWith("/src/panel/platform/engineAdapter.ts") ||
      id.endsWith("/src/panel/platform/engineAdapter.js")
    );
  }

  return {
    name: "app-seam-swap",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!importer) return null;

      const r = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!r?.id) return null;

      const id = clean(r.id);

      if (isPanelRuntime(id)) {
        console.log("[seam] runtime -> mock");
        console.log("       from:", id);
        console.log("       to  :", mockRuntimePath);
        console.log("----");
        return mockRuntimePath;
      }

      if (isSharedStorage(id)) {
        console.log("[seam] storage -> mock");
        return mockStoragePath;
      }

      if (isEngineAdapter(id)) {
        console.log("[seam] engineAdapter -> mock");
        return mockEngineAdapterPath;
      }

      return null;
    },
  };
}

function panelAssetsPlugin(): Plugin {
  const panelHtml = path.resolve(repoRoot, "src/panel/panel.html");
  const panelCss = path.resolve(repoRoot, "src/panel/panel.css");

  function readOrNull(p: string): string | null {
    try {
      return fs.readFileSync(p, "utf8");
    } catch {
      return null;
    }
  }

  function sanitizePanelHtml(html: string): string {
    // Remove extension bundle script
    html = html.replace(
      /<script\s+type=["']module["']\s+src=["'][^"']*panel\.js["']\s*>\s*<\/script>\s*/gi,
      "",
    );

    // Ensure panel.css is referenced relatively
    html = html.replace(/href=["'][^"']*panel\.css["']/gi, 'href="app/panel.css"');

    return html;
  }

  function assertHtml(): string {
    const html = readOrNull(panelHtml);
    if (!html) throw new Error(`Missing panel HTML at: ${panelHtml}`);

    if (!html.includes('id="appRoot"')) {
      throw new Error(`Wrong panel HTML file (no #appRoot): ${panelHtml}`);
    }

    return sanitizePanelHtml(html);
  }

  return {
    name: "app-panel-assets",

    // DEV only: serve assets (production uses the emitted files)
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();

        if (req.url.endsWith("/app/panel.html")) {
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(assertHtml());
          return;
        }

        if (req.url.endsWith("/app/panel.css")) {
          const css = readOrNull(panelCss);
          if (!css) {
            res.statusCode = 404;
            res.end(`Missing panel CSS at: ${panelCss}`);
            return;
          }
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/css; charset=utf-8");
          res.end(css);
          return;
        }

        next();
      });
    },

    // BUILD: emit into dist
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "app/panel.html", source: assertHtml() });

      const css = readOrNull(panelCss);
      if (css) this.emitFile({ type: "asset", fileName: "app/panel.css", source: css });
    },
  };
}

function ensurePipelinesPublicPlugin(): Plugin {
  // Source of truth (repo root)
  const srcDir = path.resolve(repoRoot, "assets/pipelines");

  // Destination that Vite copies verbatim into dist/
  const dstDir = path.resolve(__dirname, "public/assets/pipelines");

  function isReadableDir(p: string): boolean {
    try {
      const st = fs.statSync(p);
      return st.isDirectory();
    } catch {
      return false;
    }
  }

  function listJsonFilesRecursive(dir: string): string[] {
    const out: string[] = [];

    function walk(d: string) {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const e of entries) {
        const abs = path.join(d, e.name);
        if (e.isDirectory()) walk(abs);
        else if (e.isFile() && e.name.toLowerCase().endsWith(".json")) out.push(abs);
      }
    }

    walk(dir);
    return out;
  }

  function readBuf(p: string): Buffer {
    return fs.readFileSync(p);
  }

  function copyIfDifferent(src: string, dst: string): boolean {
    const srcBuf = readBuf(src);

    try {
      const dstBuf = readBuf(dst);
      if (dstBuf.length === srcBuf.length && dstBuf.equals(srcBuf)) return false;
    } catch {
      // dst missing -> copy
    }

    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, srcBuf);
    return true;
  }

  function ensurePipelines(): void {
    if (!isReadableDir(srcDir)) {
      throw new Error(
        [
          "Pipeline JSON assets not found.",
          "Expected directory:",
          `- ${srcDir}`,
          "Create it and place your JSON files there (committed).",
        ].join("\n"),
      );
    }

    fs.mkdirSync(dstDir, { recursive: true });

    const srcFiles = listJsonFilesRecursive(srcDir);

    // Copy/update JSON files
    let changed = 0;
    for (const absSrc of srcFiles) {
      const rel = path.relative(srcDir, absSrc); // keep subfolders if any
      const absDst = path.resolve(dstDir, rel);
      if (copyIfDifferent(absSrc, absDst)) changed++;
    }

    // Cleanup: remove stale json in dst that no longer exists in src
    const dstFiles = isReadableDir(dstDir) ? listJsonFilesRecursive(dstDir) : [];
    const srcRelSet = new Set(srcFiles.map((p) => path.relative(srcDir, p).replace(/\\/g, "/")));
    let removed = 0;

    for (const absDst of dstFiles) {
      const rel = path.relative(dstDir, absDst).replace(/\\/g, "/");
      if (!srcRelSet.has(rel)) {
        fs.unlinkSync(absDst);
        removed++;
      }
    }

    console.log(`[pipelines] ensured public assets (copied=${changed}, removed=${removed}, total=${srcFiles.length})`);
  }

  return {
    name: "app-ensure-pipelines-public",
    enforce: "pre",

    // Build: must run BEFORE Vite copies publicDir
    configResolved() {
      ensurePipelines();
    },

    // Dev: ensure once when server starts
    configureServer() {
      ensurePipelines();
    },
  };
}

export default defineConfig(({ command }) => {
  const isDev = command === "serve";

  return {
    root: __dirname,
    base: "./",
    resolve: {
      alias: {
        "@shared": path.resolve(repoRoot, "src/shared"),
        "@panel": path.resolve(repoRoot, "src/panel"),
        "@src": path.resolve(repoRoot, "src"),
      },
    },

    plugins: [
      ...(isDev ? [tracePlatformResolves()] : []),
      ensurePipelinesPublicPlugin(),
      seamSwapPlugin(),
      panelAssetsPlugin(),
    ],
    server: {
      // Allow reading shared code + assets from repo root
      fs: { allow: [repoRoot, __dirname] },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
