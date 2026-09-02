import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import type { Plugin } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

function pagesExtras(): Plugin {
  return {
    name: "standstrong-pages-extras",
    closeBundle() {
      const out = resolve(__dirname, "docs");
      mkdirSync(out, { recursive: true });
      writeFileSync(resolve(out, ".nojekyll"), "");
      const fav = resolve(__dirname, "public/favicon.svg");
      if (existsSync(fav)) copyFileSync(fav, resolve(out, "favicon.svg"));
      const index = resolve(out, "index.html");
      if (existsSync(index)) {
        copyFileSync(index, resolve(out, "404.html"));
      }
    },
  };
}

export default defineConfig({
  root: resolve(__dirname, "pages-spa"),
  base: "/StandStrong/",
  publicDir: resolve(__dirname, "public"),
  plugins: [tailwindcss(), viteReact(), pagesExtras()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: resolve(__dirname, "docs"),
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    host: "127.0.0.1",
    port: 4177,
  },
});
