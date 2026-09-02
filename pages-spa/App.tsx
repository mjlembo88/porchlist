import { useEffect, useMemo, useState } from "react";
import { Heart, List, Map as MapIcon, Store } from "lucide-react";
import { FollowingFeed } from "@/components/following-feed";
import { StandList } from "@/components/stand-list";
import { PagesStandMap } from "./PagesStandMap";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/sheet";
import { canRunAds, isFeaturedPlan } from "@/lib/billing/plans";
import { useDemoStore } from "@/lib/stands/demo-store";
import { APP_NAME, SLOGAN, TAGLINE, isOpenToday, type FarmStand } from "@/lib/stands/types";
import { cn } from "@/lib/utils";
import { PagesOwnerDesk } from "./PagesOwnerDesk";
import { PagesStandDetail } from "./PagesStandDetail";

type Tab = "list" | "map" | "follow" | "desk";

const FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "featured", label: "Featured" },
  { id: "Pasco", label: "Pasco" },
  { id: "Hernando", label: "Hernando" },
  { id: "Pinellas", label: "Pinellas" },
];

export default function App() {
  const ensureSeed = useDemoStore((s) => s.ensureSeed);
  const listStands = useDemoStore((s) => s.listStands);
  const [stands, setStands] = useState<FarmStand[]>([]);
  const [tab, setTab] = useState<Tab>("list");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  function refresh() {
    ensureSeed();
    setStands(listStands());
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stands.filter((s) => {
      if (filter === "open" && !isOpenToday(s.hours)) return false;
      if (filter === "featured" && !s.featured && !isFeaturedPlan(s.plan)) return false;
      if (filter === "Pasco" || filter === "Hernando" || filter === "Pinellas") {
        if (s.county !== filter) return false;
      }
      if (!q) return true;
      const blob = [s.name, s.city, s.address, s.products.join(" "), s.notes].filter(Boolean).join(" ").toLowerCase();
      return blob.includes(q);
    }).sort((a, b) => {
      const feat = Number(isFeaturedPlan(b.plan) || b.featured) - Number(isFeaturedPlan(a.plan) || a.featured);
      if (feat) return feat;
      if (b.reviewCount !== a.reviewCount && (a.reviewCount === 0 || b.reviewCount === 0)) return b.reviewCount - a.reviewCount;
      const rating = (b.ratingAvg || 0) - (a.ratingAvg || 0);
      if (rating) return rating;
      return a.name.localeCompare(b.name);
    });
  }, [stands, query, filter]);

  const selected = stands.find((s) => s.id === selectedId) ?? null;
  const ads = stands.filter((s) => canRunAds(s.plan) || (s.featured && s.plan === "premium"));

  function selectStand(id: string) {
    setSelectedId(id);
    setShowDetail(true);
  }

  return (
    <main className="flex h-dvh flex-col bg-paper text-ink">
      <header className="sticky top-0 z-30 border-b border-border bg-paper px-4 py-2.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-forest font-display text-lg font-semibold text-paper">S</span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-lg font-semibold leading-none">{APP_NAME}</h1>
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
        <p className="mt-1 text-xs text-muted">{TAGLINE} · Pasco, Hernando, north Pinellas · Pages demo</p>
        {(tab === "list" || tab === "map") && (
          <div className="mt-2 space-y-2">
            <Input value={query} placeholder="Search eggs, sourdough, a town…" onChange={(e) => setQuery(e.target.value)} />
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
        )}
      </header>

      <div className="relative min-h-0 flex-1">
        <div className={cn("absolute inset-0", tab === "map" ? "block" : "hidden")}>
          <PagesStandMap stands={filtered} selectedId={selectedId} onSelect={selectStand} />
        </div>

        {tab === "list" && (
          <div className="flex h-full flex-col overflow-hidden">
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
            <PagesOwnerDesk
              stands={stands}
              onOpen={selectStand}
              onRefresh={refresh}
            />
          </div>
        )}
      </div>

      <BottomSheet
        open={showDetail && Boolean(selected)}
        onOpenChange={(open) => {
          setShowDetail(open);
        }}
        title={selected?.name ?? "Stand"}
        description={selected ? `${selected.city ?? "Area"}${selected.county ? ` · ${selected.county}` : ""}` : undefined}
      >
        {selected && (
          <PagesStandDetail
            compact
            stand={selected}
            onAskOwner={() => {
              setShowDetail(false);
              setTab("desk");
            }}
          />
        )}
      </BottomSheet>

      <nav className="grid grid-cols-4 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
        <NavBtn icon={List} label="Browse" active={tab === "list"} onClick={() => { setTab("list"); setShowDetail(false); }} />
        <NavBtn icon={MapIcon} label="Map" active={tab === "map"} onClick={() => { setTab("map"); setShowDetail(false); }} />
        <NavBtn icon={Heart} label="Saved" active={tab === "follow"} onClick={() => { setTab("follow"); setShowDetail(false); }} />
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
