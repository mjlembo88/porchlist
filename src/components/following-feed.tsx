import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocal } from "@/lib/stands/local";
import type { FarmStand } from "@/lib/stands/types";

export function FollowingFeed({
  stands,
  onOpen,
}: {
  stands: FarmStand[];
  onOpen: (id: string) => void;
}) {
  const follows = useLocal((s) => s.follows);
  const toggleFollow = useLocal((s) => s.toggleFollow);
  const saved = stands.filter((s) => follows.includes(s.id));

  if (saved.length === 0) {
    return (
      <div className="mx-auto max-w-md py-8">
        <h2 className="font-display text-2xl font-semibold">Following</h2>
        <p className="mt-2 text-sm text-muted">
          Follow a stand from its page. Hours and specials will land here — no account needed.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <h2 className="font-display text-2xl font-semibold">Following</h2>
      <p className="mt-1 text-sm text-muted">{saved.length} stand{saved.length === 1 ? "" : "s"}</p>
      <ul className="mt-3 divide-y divide-border">
        {saved.map((s) => (
          <li key={s.id} className="flex items-start justify-between gap-3 py-3">
            <button type="button" className="min-w-0 text-left" onClick={() => onOpen(s.id)}>
              <p className="font-medium">{s.name}</p>
              <p className="text-xs text-muted">{s.city ?? "Area"} · {s.hours ?? "Hours not listed"}</p>
              {s.latestSpecial && <p className="mt-1 text-sm">{s.latestSpecial}</p>}
            </button>
            <Button size="sm" variant="outline" onClick={() => toggleFollow(s.id)}>
              <Heart className="size-3.5 fill-forest text-forest" />
              Unfollow
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
