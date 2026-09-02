import { useMemo, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Heart, List, Map as MapIcon, Store, X } from "lucide-react";
import { FollowingFeed } from "@/components/following-feed";
import { OwnerDesk } from "@/components/owner-desk";
import { StandDetail } from "@/components/stand-detail";
import { StandList } from "@/components/stand-list";
import { StandMap } from "@/components/stand-map";
import { Input } from "@/components/ui/input";
import { canRunAds, isFeaturedPlan } from "@/lib/billing/plans";
import { listStands } from "@/lib/stands/server";
import { SLOGAN, TAGLINE, isOpenToday, type FarmStand } from "@/lib/stands/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  loader: () => listStands(),
  component: Home,
});

type Tab = "map" | "list" | "follow" | "desk";

const FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open today" },
  { id: "featured", label: "Featured" },
  { id: "walk-up", label: "Walk-up" },
  { id: "preorder", label: "Preorder" },
  { id: "eggs", label: "Eggs" },
  { id: "bread", label: "Bread" },
  { id: "produce", label: "Produce" },
  { id: "Pasco", label: "Pasco" },
  { id: "Hernando", label: "Hernando" },
  { id: "Pinellas", label: "Pinellas" },
];

function Home() {
  const stands = Route.useLoaderData() as FarmStand[];
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("map");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [requestStandId, setRequestStandId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stands.filter((s) => {
      if (filter === "open" && !isOpenToday(s.hours)) return false;
      if (filter === "featured" && !s.featured && !isFeaturedPlan(s.plan)) return false;
      if (filter === "walk-up" && s.access !== "walk-up") return false;
      if (filter === "preorder" && s.access !== "preorder") return false;
      if (filter === "eggs" && !s.products.some((p) => p.toLowerCase().includes("egg"))) return false;
      if (filter === "bread" && !s.products.some((p) => /bread|bagel|sourdough/i.test(p))) return false;
      if (filter === "produce" && !s.products.some((p) => /produce|berr|fruit|tomato/i.test(p))) return false;
      if (filter === "Pasco" || filter === "Hernando" || filter === "Pinellas") {
        if (s.county !== filter) return false;
      }
      if (!q) return true;
      const blob = [s.name, s.city, s.address, s.products.join(" "), s.notes].filter(Boolean).join(" ").toLowerCase();
      return blob.includes(q);
    });
  }, [stands, query, filter]);

  const selected = stands.find((s) => s.id === selectedId) ?? null;
  const ads = stands.filter((s) => canRunAds(s.plan) || (s.featured && s.plan === "premium"));

  function selectStand(id: string) {
    setSelectedId(id);
    setShowDetail(true);
  }

  async function refresh() {
    await router.invalidate();
  }

  return (
    <main className="flex h-dvh flex-col bg-paper text-ink">
      <header className="relative z-30 border-b border-border bg-paper px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-forest font-display text-lg font-semibold text-paper">S</span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-lg font-semibold leading-none">StandLocal</h1>
            <p className="mt-1 truncate text-xs italic text-forest">{SLOGAN}</p>
          </div>
          {tab === "map" && (
            <button
              type="button"
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-sm text-paper"
              onClick={() => setTab("list")}
            >
              <List className="size-4" /> List
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">{TAGLINE} · {stands.length} on the map</p>
      </header>

      <div className="relative min-h-0 flex-1">
        <div className={cn("absolute inset-0", tab === "map" ? "block" : "hidden")}>
          <StandMap stands={filtered} selectedId={selectedId} onSelect={selectStand} />
        </div>

        {tab === "list" && (
          <div className="flex h-full flex-col overflow-hidden">
            <div className="space-y-3 border-b border-border p-3">
              <Input value={query} placeholder="Search eggs, sourdough…" onChange={(e) => setQuery(e.target.value)} />
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      "h-9 shrink-0 rounded-full px-3 text-xs font-medium",
                      filter === f.id ? "bg-forest text-paper" : "bg-chip text-muted",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {ads[0] && (
              <p className="border-b border-border bg-chip px-3 py-2 text-xs text-muted">
                Featured · {ads[0].name}{ads[0].city ? ` in ${ads[0].city}` : ""}
              </p>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-24">
              <StandList stands={filtered} selectedId={selectedId} onSelect={selectStand} />
            </div>
          </div>
        )}

        {tab === "follow" && (
          <div className="h-full overflow-y-auto p-4 pb-24">
            <FollowingFeed stands={stands} onOpen={selectStand} />
          </div>
        )}

        {tab === "desk" && (
          <div className="h-full overflow-y-auto p-4 pb-24">
            <OwnerDesk
              stands={stands}
              onOpen={selectStand}
              onRefresh={() => void refresh()}
              requestStandId={requestStandId}
              onClearRequest={() => setRequestStandId(null)}
            />
          </div>
        )}

        {showDetail && selected && (
          <div className="absolute inset-0 z-20 overflow-y-auto bg-paper">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-paper px-3 py-2">
              <button type="button" className="inline-flex h-11 items-center gap-1 text-sm" onClick={() => setShowDetail(false)}>
                <X className="size-4" /> Close
              </button>
            </div>
            <div className="mx-auto max-w-lg p-4 pb-28">
              <StandDetail
                stand={selected}
                onAskOwner={() => {
                  setRequestStandId(selected.id);
                  setShowDetail(false);
                  setTab("desk");
                }}
              />
            </div>
          </div>
        )}
      </div>

      <nav className="grid grid-cols-4 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
        <NavBtn icon={MapIcon} label="Map" active={tab === "map"} onClick={() => { setTab("map"); setShowDetail(false); }} />
        <NavBtn icon={List} label="List" active={tab === "list"} onClick={() => { setTab("list"); setShowDetail(false); }} />
        <NavBtn icon={Heart} label="Following" active={tab === "follow"} onClick={() => { setTab("follow"); setShowDetail(false); }} />
        <NavBtn icon={Store} label="My stand" active={tab === "desk"} onClick={() => { setTab("desk"); setShowDetail(false); }} />
      </nav>
    </main>
  );
}

function NavBtn({
  icon: Icon, label, active, onClick,
}: {
  icon: typeof List;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-12 flex-col items-center justify-center gap-0.5 text-xs font-medium",
        active ? "text-forest" : "text-muted",
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}
