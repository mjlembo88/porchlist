import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { isFeaturedPlan } from "@/lib/billing/plans";
import type { FarmStand } from "@/lib/stands/types";

const SPRING_HILL: [number, number] = [28.4635, -82.5364];

type Props = {
  stands: FarmStand[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

function isUsableMap(map: import("leaflet").Map) {
  const size = map.getSize();
  return size.x > 2 && size.y > 2;
}

export function StandMap({ stands, selectedId, onSelect }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const standsRef = useRef(stands);
  standsRef.current = stands;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  function panToSelected(animate: boolean) {
    const map = mapRef.current;
    if (!map || !isUsableMap(map)) return;
    const stand = standsRef.current.find((s) => s.id === selectedRef.current);
    if (stand?.lat == null || stand?.lng == null) return;
    if (!Number.isFinite(stand.lat) || !Number.isFinite(stand.lng)) return;
    const zoom = Math.max(map.getZoom() || 10, 12);
    try {
      if (animate) map.flyTo([stand.lat, stand.lng], zoom, { duration: 0.4 });
      else map.setView([stand.lat, stand.lng], zoom, { animate: false });
    } catch {
      // Hidden or zero-size map — skip until the pane is visible.
    }
  }

  function syncMarkers(L: typeof import("leaflet"), map: import("leaflet").Map) {
    for (const marker of markersRef.current.values()) marker.remove();
    markersRef.current.clear();
    for (const stand of standsRef.current) {
      if (stand.lat == null || stand.lng == null) continue;
      if (!Number.isFinite(stand.lat) || !Number.isFinite(stand.lng)) continue;
      const featured = isFeaturedPlan(stand.plan) || stand.featured;
      const active = stand.id === selectedRef.current;
      const icon = L.divIcon({
        className: "stand-pin",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        html: `<div class="stand-pin-dot${featured ? " is-featured" : ""}${active ? " is-active" : ""}" aria-hidden="true"></div>`,
      });
      const marker = L.marker([stand.lat, stand.lng], { icon, title: stand.name, zIndexOffset: featured ? 200 : 0 }).addTo(map);
      marker.on("click", () => {
        const id = stand.id;
        queueMicrotask(() => onSelectRef.current(id));
      });
      markersRef.current.set(stand.id, marker);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const el = elRef.current;
    if (!el) return;
    let lastArea = 0;
    const ro = new ResizeObserver(() => {
      const map = mapRef.current;
      if (!map) return;
      map.invalidateSize();
      const size = map.getSize();
      const area = size.x * size.y;
      if (lastArea === 0 && area > 4) panToSelected(false);
      lastArea = area;
    });
    ro.observe(el);

    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !elRef.current) return;
      const map = L.map(el, {
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: true,
      }).setView(SPRING_HILL, 10);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("/api/tiles/osm/{z}/{x}/{y}", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      setTimeout(() => {
        map.invalidateSize();
        syncMarkers(L, map);
      }, 80);
    })();

    return () => {
      cancelled = true;
      ro.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    void import("leaflet").then((L) => {
      if (mapRef.current !== map) return;
      syncMarkers(L, map);
    });
  }, [stands]);

  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      const dot = marker.getElement()?.querySelector(".stand-pin-dot");
      if (dot) dot.classList.toggle("is-active", id === selectedId);
    }
    panToSelected(true);
  }, [selectedId]);

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden">
      <div ref={elRef} className="h-full w-full" aria-label="Map" role="region" />
    </div>
  );
}
