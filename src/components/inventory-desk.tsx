import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
  SAMPLE_SHEET_CSV, SEASONAL_TEMPLATES, UNITS, centsToPriceInput, dollarsToCents,
  parseIncomingList, type SuggestedItem, type Unit,
} from "@/lib/inventory/parse-list";
import {
  duplicateYesterday, listDemoItems, listItems, publishSuggestions, removeDemoItem, removeItem,
  replacePreorderSheet, snapshotBoard, suggestFromBoard, upsertDemoItem, upsertItem,
} from "@/lib/stands/owner";
import type { InventoryItem } from "@/lib/stands/types";

async function fileToBoardDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read photo"));
      el.src = url;
    });
    const max = 960;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not read photo");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.62);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function unitOptions(current: string): string[] {
  return UNITS.includes(current as Unit) ? [...UNITS] : [...UNITS, current];
}

function downloadSample() {
  const blob = new Blob([SAMPLE_SHEET_CSV], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "standstrong-items.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

export function InventoryDesk({ standId, onRefresh, guestDemo = false }: { standId: string; onRefresh?: () => void; guestDemo?: boolean }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [paste, setPaste] = useState("");
  const [suggested, setSuggested] = useState<SuggestedItem[]>([]);
  const [note, setNote] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("12");
  const [unit, setUnit] = useState("each");
  const [busy, setBusy] = useState(false);
  const [photoLabel, setPhotoLabel] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [sheetPaste, setSheetPaste] = useState("");
  const [sheetSuggested, setSheetSuggested] = useState<SuggestedItem[]>([]);

  const boardItems = items.filter((i) => !i.preorderable);
  const sheetItems = items.filter((i) => i.preorderable);

  async function reload() {
    setItems(guestDemo ? await listDemoItems({ data: { standId } }) : await listItems({ data: { standId } }));
  }
  useEffect(() => { void reload(); }, [standId, guestDemo]);

  function patchSuggested(index: number, partial: Partial<SuggestedItem>) {
    setSuggested((prev) => prev.map((s, i) => (i === index ? { ...s, ...partial } : s)));
  }

  async function addManual() {
    const cents = dollarsToCents(price);
    const maxQty = Math.max(0, Math.min(999, Number(qty) || 0));
    if (!name.trim() || cents == null) return;
    setBusy(true);
    try {
      const payload = {
        standId, name: name.trim(), unit, priceCents: cents, status: "in" as const,
        preorderable: false, decrementOnSale: true, maxQty,
      };
      if (guestDemo) await upsertDemoItem({ data: payload });
      else await upsertItem({ data: payload });
      setName(""); setPrice(""); setQty("12");
      await reload();
      onRefresh?.();
    } finally { setBusy(false); }
  }

  async function readBoard(dataUrl?: string | null) {
    setBusy(true);
    try {
      if (!dataUrl && paste.trim()) {
        const rows = parseIncomingList(paste);
        setSuggested(rows);
        setNote(rows.length ? "Fix any row that's off, then publish." : "Could not read that list.");
        return;
      }
      const res = await suggestFromBoard({
        data: { standId, text: paste, imageDataUrl: dataUrl ?? imageDataUrl ?? undefined },
      });
      setSuggested(res.items.length ? res.items : parseIncomingList(paste));
      setNote(res.note || "Fix any row that's off, then publish.");
    } finally { setBusy(false); }
  }

  async function importFile(file: File, into: "board" | "sheet") {
    const text = await file.text();
    const rows = parseIncomingList(text);
    if (into === "sheet") {
      setSheetSuggested(rows.map((r) => ({ ...r, preorderable: true })));
      setSheetPaste(text);
    } else {
      setSuggested(rows);
      setPaste(text);
      setNote(rows.length ? "Imported from spreadsheet. Edit, then publish." : "Could not read that spreadsheet.");
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <section className="grid gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Add item</p>
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-3 gap-2">
          <Input inputMode="decimal" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
          <Input inputMode="numeric" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
          <select className="h-11 rounded-[10px] border border-border bg-surface px-2 text-sm" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <Button className="h-12" disabled={busy} onClick={() => void addManual()}>Add to stand</Button>
      </section>

      <details className="grid gap-2">
        <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-muted">Paste, spreadsheet, or photo</summary>
        <Textarea placeholder={"name,unit,price,preorder\nRaw 5oz honey,jar,10,no\nEggs,dozen,6,yes"} value={paste} onChange={(e) => setPaste(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <label className="flex h-14 flex-1 items-center justify-center rounded-2xl border border-border bg-surface text-sm">
            Import .csv
            <input type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" className="sr-only" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importFile(file, "board");
              e.target.value = "";
            }} />
          </label>
          <Button type="button" variant="outline" className="h-14 flex-1" onClick={downloadSample}>Sample sheet</Button>
        </div>
        <label className="text-sm text-muted">
          Chalkboard photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="mt-1 block w-full text-sm"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setPhotoLabel(file.name);
              setBusy(true);
              try {
                const dataUrl = await fileToBoardDataUrl(file);
                setImageDataUrl(dataUrl);
                await readBoard(dataUrl);
              } catch {
                setNote("Could not read that photo. Paste the prices instead.");
              } finally { setBusy(false); }
            }}
          />
        </label>
        {photoLabel && <p className="text-xs text-muted">{busy ? "Reading the board…" : `Photo: ${photoLabel}`}</p>}
        {!guestDemo && (
          <Button className="h-14" variant="outline" disabled={busy || (!paste.trim() && !imageDataUrl)} onClick={() => void readBoard()}>Suggest rows</Button>
        )}
      </details>

      <SuggestList
        rows={suggested}
        note={note}
        busy={busy}
        onPatch={patchSuggested}
        onDrop={(i) => setSuggested((prev) => prev.filter((_, j) => j !== i))}
        onPublish={async () => {
          const rows = suggested.filter((s) => s.name.trim());
          setBusy(true);
          try {
            await publishSuggestions({ data: { standId, items: rows } });
            setSuggested([]);
            setPaste("");
            setImageDataUrl(null);
            setPhotoLabel("");
            await reload();
            onRefresh?.();
          } finally { setBusy(false); }
        }}
        action="Confirm & publish"
      />

      {!guestDemo && (
        <section className="flex flex-wrap gap-2">
          {SEASONAL_TEMPLATES.map((t) => (
            <button key={t.label} type="button" className="rounded-full bg-chip px-3 py-2 text-sm" onClick={() => { setSuggested(t.items); setNote("Edit any row, then publish."); }}>
              {t.label}
            </button>
          ))}
          <Button variant="outline" size="sm" onClick={() => void snapshotBoard({ data: { standId } })}>Save board</Button>
          <Button variant="outline" size="sm" onClick={async () => { await duplicateYesterday({ data: { standId } }); await reload(); }}>Duplicate yesterday</Button>
        </section>
      )}

      <section>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Walk-up board</p>
        {boardItems.length === 0 && <p className="mt-2 text-sm text-muted">Nothing on the walk-up board yet.</p>}
        <ul className="divide-y divide-border">
          {boardItems.map((it) => (
            <LiveItem key={it.id} item={it} standId={standId} busy={busy} guestDemo={guestDemo} onBusy={setBusy} onReload={async () => { await reload(); onRefresh?.(); }} />
          ))}
        </ul>
      </section>

      <section className="grid gap-2 rounded-2xl border border-border bg-surface p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Preorder sheet</p>
        <p className="text-sm text-muted">
          Upload a spreadsheet of items shoppers can reserve. This replaces the previous preorder list and puts a Preorder tab on your stand page.
        </p>
        <Textarea placeholder={"name,unit,price\nEggs,dozen,6\nSourdough,each,8"} value={sheetPaste} onChange={(e) => setSheetPaste(e.target.value)} />
        <label className="flex h-14 items-center justify-center rounded-2xl border border-border bg-chip text-sm">
          Import preorder .csv
          <input type="file" accept=".csv,.tsv,.txt,text/csv" className="sr-only" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importFile(file, "sheet");
            e.target.value = "";
          }} />
        </label>
        <Button className="h-14" variant="outline" disabled={busy || !sheetPaste.trim()} onClick={() => {
          const rows = parseIncomingList(sheetPaste).map((r) => ({ ...r, preorderable: true }));
          setSheetSuggested(rows);
        }}>Read sheet</Button>
        <SuggestList
          rows={sheetSuggested}
          note={sheetSuggested.length ? "Publishing replaces the last preorder sheet." : ""}
          busy={busy}
          onPatch={(i, partial) => setSheetSuggested((prev) => prev.map((s, j) => (j === i ? { ...s, ...partial } : s)))}
          onDrop={(i) => setSheetSuggested((prev) => prev.filter((_, j) => j !== i))}
          onPublish={async () => {
            const rows = sheetSuggested.filter((s) => s.name.trim());
            setBusy(true);
            try {
              await replacePreorderSheet({ data: { standId, items: rows } });
              setSheetSuggested([]);
              setSheetPaste("");
              await reload();
              onRefresh?.();
            } finally { setBusy(false); }
          }}
          action="Replace preorder sheet"
        />
        {sheetItems.length === 0 && <p className="text-sm text-muted">No preorder sheet yet.</p>}
        <ul className="divide-y divide-border">
          {sheetItems.map((it) => (
            <LiveItem key={it.id} item={it} standId={standId} busy={busy} guestDemo={guestDemo} onBusy={setBusy} onReload={async () => { await reload(); onRefresh?.(); }} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function SuggestList({
  rows, note, busy, onPatch, onDrop, onPublish, action,
}: {
  rows: SuggestedItem[];
  note: string;
  busy: boolean;
  onPatch: (index: number, partial: Partial<SuggestedItem>) => void;
  onDrop: (index: number) => void;
  onPublish: () => void;
  action: string;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="rounded-2xl border border-border bg-surface p-3">
      <p className="text-sm text-muted">{note || "Fix any row that's off, then publish."}</p>
      <ul className="mt-2 divide-y divide-border">
        {rows.map((s, i) => (
          <li key={i} className="grid gap-2 py-3">
            <Input placeholder="Name" value={s.name} onChange={(e) => onPatch(i, { name: e.target.value })} />
            <div className="grid grid-cols-[1fr_7rem_auto] gap-2">
              <PriceField cents={s.priceCents} onCents={(priceCents) => onPatch(i, { priceCents })} />
              <select className="h-11 rounded-xl border border-border bg-surface px-2" value={s.unit} onChange={(e) => onPatch(i, { unit: e.target.value as Unit })}>
                {unitOptions(s.unit).map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <button type="button" className="h-11 rounded-xl px-3 text-sm text-muted" onClick={() => onDrop(i)}>Drop</button>
            </div>
            <button
              type="button"
              className={s.preorderable ? "h-11 w-fit rounded-full bg-forest px-3 text-xs text-paper" : "h-11 w-fit rounded-full bg-chip px-3 text-xs"}
              onClick={() => onPatch(i, { preorderable: !s.preorderable })}
            >
              {s.preorderable ? "Preorder sheet" : "Walk-up board"}
            </button>
          </li>
        ))}
      </ul>
      <Button className="mt-3 h-14 w-full" disabled={busy || !rows.some((s) => s.name.trim())} onClick={() => void onPublish()}>{action}</Button>
    </section>
  );
}

function PriceField({ cents, onCents }: { cents: number; onCents: (n: number) => void }) {
  const [raw, setRaw] = useState(() => centsToPriceInput(cents));
  useEffect(() => { setRaw(centsToPriceInput(cents)); }, [cents]);
  return (
    <Input
      inputMode="decimal"
      placeholder="Price"
      value={raw}
      onChange={(e) => {
        setRaw(e.target.value);
        const n = dollarsToCents(e.target.value);
        if (n != null) onCents(n);
      }}
    />
  );
}

function LiveItem({
  item, standId, busy, onBusy, onReload, guestDemo = false,
}: {
  item: InventoryItem; standId: string; busy: boolean;
  onBusy: (v: boolean) => void; onReload: () => Promise<void>; guestDemo?: boolean;
}) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(centsToPriceInput(item.priceCents));
  const [unit, setUnit] = useState(item.unit);
  const [qty, setQty] = useState(item.maxQty == null ? "" : String(item.maxQty));
  useEffect(() => {
    setName(item.name);
    setPrice(centsToPriceInput(item.priceCents));
    setUnit(item.unit);
    setQty(item.maxQty == null ? "" : String(item.maxQty));
  }, [item.id, item.name, item.priceCents, item.unit, item.maxQty]);

  const cents = dollarsToCents(price);
  const parsedQty = qty.trim() === "" ? null : Math.max(0, Math.min(999, Number(qty) || 0));
  const dirty = name.trim() !== item.name || unit !== item.unit || (cents != null && cents !== item.priceCents) || parsedQty !== item.maxQty;

  async function save(extra?: Partial<InventoryItem>) {
    const nextCents = extra?.priceCents ?? cents ?? item.priceCents;
    const nextName = (extra?.name ?? name).trim() || item.name;
    const nextQty = extra?.maxQty !== undefined ? extra.maxQty : parsedQty;
    onBusy(true);
    try {
      const payload = {
        ...item,
        standId,
        id: item.id,
        name: nextName,
        unit: extra?.unit ?? unit,
        priceCents: nextCents,
        status: extra?.status ?? item.status,
        preorderable: extra?.preorderable ?? item.preorderable,
        photo: item.photo,
        maxQty: nextQty,
      };
      if (guestDemo) await upsertDemoItem({ data: payload });
      else await upsertItem({ data: payload });
      await onReload();
    } finally { onBusy(false); }
  }

  return (
    <li className="flex flex-col gap-2 py-3">
      <Input value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-3 gap-2">
        <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        <Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" />
        <select className="h-11 rounded-[10px] border border-border bg-surface px-2 text-sm" value={unit} onChange={(e) => setUnit(e.target.value)}>
          {unitOptions(unit).map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Button className="h-11" disabled={busy || !dirty || !name.trim() || cents == null} onClick={() => void save()}>Save</Button>
        <button type="button" className="h-11 rounded-xl px-3 text-sm text-muted underline" onClick={async () => {
          if (guestDemo) await removeDemoItem({ data: { standId, id: item.id } });
          else await removeItem({ data: { standId, id: item.id } });
          await onReload();
        }}>Remove</button>
      </div>
      <div className="flex flex-wrap gap-1">
        {(["in", "low", "out"] as const).map((st) => (
          <button
            key={st}
            type="button"
            className={item.status === st ? "h-11 rounded-full bg-ink px-3 text-xs text-paper" : "h-11 rounded-full bg-chip px-3 text-xs"}
            onClick={() => void save({ status: st })}
          >{st}</button>
        ))}
        <button
          type="button"
          className={item.preorderable ? "h-11 rounded-full bg-forest px-3 text-xs text-paper" : "h-11 rounded-full bg-chip px-3 text-xs"}
          onClick={() => void save({ preorderable: !item.preorderable })}
        >{item.preorderable ? "Preorder on" : "Preorder"}</button>
      </div>
    </li>
  );
}
