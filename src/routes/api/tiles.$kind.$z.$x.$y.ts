import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tiles/$kind/$z/$x/$y")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const z = params.z;
        const x = params.x;
        const y = params.y.replace(/\.png$/i, "");
        const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
        const res = await fetch(url, {
          headers: { "User-Agent": "StandLocal/1.0 (https://standlocal.app; farm-stand map)" },
        });
        if (!res.ok) {
          return new Response("tile missing", { status: res.status });
        }
        return new Response(res.body, {
          headers: {
            "content-type": "image/png",
            "cache-control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
