export const UNITS = ["each", "oz", "lb", "pint", "jar", "bunch", "dozen", "bag", "box"] as const;
export type Unit = (typeof UNITS)[number];
export type ItemStatus = "in" | "low" | "out";

export type SuggestedItem = {
  name: string;
  unit: Unit;
  priceCents: number;
  status: ItemStatus;
  preorderable: boolean;
};

const SIZE_CHUNK = /(\d+(?:\.\d+)?)\s*(oz|ounces?|lbs?|pounds?)\b/gi;
const DOLLAR = /\$\s*(\d+(?:\.\d{1,2})?)/;
const SALE_UNIT = /\b(each|ea|jars?|pints?|bunches|bunch|dozen|doz|bags?|boxes|box)\b/gi;
const LOOSE_UNIT = /\b(oz|ounces?|lbs?|pounds?|#)\b/gi;

function pickUnit(line: string): Unit {
  const l = line.toLowerCase();
  if (/\bdoz(en)?\b/.test(l)) return "dozen";
  if (/\bjars?\b/.test(l)) return "jar";
  if (/\bpints?\b/.test(l)) return "pint";
  if (/\bbunch/.test(l)) return "bunch";
  if (/\bbags?\b/.test(l)) return "bag";
  if (/\bbox(es)?\b/.test(l)) return "box";
  if (/\b(lb|lbs|pounds?|#)\b/.test(l) || /\d(lbs?)\b/.test(l)) return "lb";
  if (/\b(oz|ounces?)\b/.test(l) || /\d(oz)\b/.test(l)) return "oz";
  if (/\b(each|ea)\b/.test(l)) return "each";
  return "each";
}

export function dollarsToCents(raw: string): number | null {
  const t = raw.trim().replace(/[$,]/g, "");
  if (!t || t === ".") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 1000) return null;
  return Math.round(n * 100);
}

export function centsToPriceInput(cents: number): string {
  if (!Number.isFinite(cents) || cents < 0) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** Parse a chalkboard paste: "Eggs $6 dozen" / "Raw 5oz honey - $10" */
export function parseItemList(text: string): SuggestedItem[] {
  const lines = text.split(/\n|;/).map((l) => l.trim()).filter(Boolean);
  const out: SuggestedItem[] = [];
  for (const line of lines) {
    if (line.length < 2) continue;
    const dollar = line.match(DOLLAR);
    let priceCents = 0;
    if (dollar) {
      priceCents = Math.round(Number(dollar[1]) * 100);
    } else {
      const masked = line.replace(SIZE_CHUNK, " ");
      const bare = masked.match(/(?:^|[\s:/|-])(\d+(?:\.\d{1,2})?)\b/);
      if (bare) priceCents = Math.round(Number(bare[1]) * 100);
    }
    const unit = pickUnit(line);
    const sizes: string[] = [];
    let name = line.replace(SIZE_CHUNK, (m) => {
      sizes.push(m.replace(/\s+/g, " ").trim());
      return ` §${sizes.length - 1}§ `;
    });
    name = name.replace(DOLLAR, " ");
    if (!dollar && priceCents > 0) {
      const dollars = centsToPriceInput(priceCents);
      name = name.replace(new RegExp(`(?<!\\d)${dollars.replace(".", "\\.")}(?!\\d)`), " ");
    }
    name = name
      .replace(/\b(low|out|in stock|preorder|pre-order)\b/gi, " ")
      .replace(SALE_UNIT, " ")
      .replace(LOOSE_UNIT, " ")
      .replace(/[,/|]+/g, " ")
      .replace(/\s*[-–—]+\s*/g, " ")
      .replace(/§(\d+)§/g, (_, i) => sizes[Number(i)] ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!name) continue;
    const status: ItemStatus = /\bout\b/i.test(line) ? "out" : /\blow\b/i.test(line) ? "low" : "in";
    out.push({
      name,
      unit,
      priceCents: Number.isFinite(priceCents) ? priceCents : 0,
      status,
      preorderable: /pre-?order/i.test(line),
    });
  }
  return out;
}

export const SAMPLE_SHEET_CSV = `name,unit,price,preorder
Raw 5oz honey,jar,10,no
Eggs,dozen,6,yes
Tomatoes,lb,3.50,no
Sourdough,each,8,yes
`;

const HEADER_MAP: Record<string, "name" | "unit" | "price" | "preorder" | "status"> = {
  name: "name", item: "name", items: "name", product: "name", title: "name", description: "name",
  unit: "unit", units: "unit", size: "unit", measure: "unit",
  price: "price", cost: "price", amount: "price", price_cents: "price", cents: "price",
  preorder: "preorder", "pre-order": "preorder", preorderable: "preorder", sheet: "preorder",
  status: "status", stock: "status",
};

function detectDelim(line: string): "," | "\t" | ";" {
  const tabs = (line.match(/\t/g) ?? []).length;
  const semis = (line.match(/;/g) ?? []).length;
  const commas = (line.match(/,/g) ?? []).length;
  if (tabs >= commas && tabs >= semis && tabs > 0) return "\t";
  if (semis > commas) return ";";
  return ",";
}

function splitCsvLine(line: string, delim: "," | "\t" | ";"): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (c === delim && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

function headerKey(cell: string): "name" | "unit" | "price" | "preorder" | "status" | null {
  const k = cell.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return HEADER_MAP[k] ?? null;
}

function truthyPreorder(raw: string): boolean {
  return /^(y|yes|true|1|preorder|pre-order)$/i.test(raw.trim());
}

function rowToItem(name: string, unitRaw: string, priceRaw: string, preorder: boolean, statusRaw: string): SuggestedItem | null {
  const cleanName = name.replace(/\s+/g, " ").trim();
  if (cleanName.length < 2) return null;
  const fromCell = unitRaw.trim();
  const unit: Unit = UNITS.includes(fromCell.toLowerCase() as Unit)
    ? (fromCell.toLowerCase() as Unit)
    : pickUnit(`${cleanName} ${fromCell}`);
  let priceCents = dollarsToCents(priceRaw) ?? 0;
  if (priceCents === 0 && /cents/i.test(priceRaw) === false) {
    const n = Number(priceRaw.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n) && n >= 100 && n === Math.round(n)) priceCents = Math.round(n);
  }
  const status: ItemStatus = /\bout\b/i.test(statusRaw) ? "out" : /\blow\b/i.test(statusRaw) ? "low" : "in";
  return { name: cleanName.slice(0, 80), unit, priceCents, status, preorderable: preorder };
}

/** CSV / TSV / Excel-paste: name, unit, price, optional preorder. */
export function parseSpreadsheet(text: string): SuggestedItem[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const delim = detectDelim(lines[0]);
  const first = splitCsvLine(lines[0], delim);
  const mapped = first.map(headerKey);
  const hasHeader = mapped.some((m) => m === "name" || m === "price");
  const out: SuggestedItem[] = [];
  const start = hasHeader ? 1 : 0;
  const cols = hasHeader ? mapped : null;
  for (let i = start; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], delim);
    if (cells.every((c) => !c)) continue;
    let name = "";
    let unit = "";
    let price = "";
    let pre = false;
    let status = "";
    if (cols) {
      cols.forEach((key, idx) => {
        const v = cells[idx] ?? "";
        if (key === "name") name = v;
        else if (key === "unit") unit = v;
        else if (key === "price") price = v;
        else if (key === "preorder") pre = truthyPreorder(v);
        else if (key === "status") status = v;
      });
    } else if (cells.length >= 3) {
      name = cells[0] ?? "";
      unit = cells[1] ?? "";
      price = cells[2] ?? "";
      pre = truthyPreorder(cells[3] ?? "");
    } else if (cells.length === 2) {
      name = cells[0] ?? "";
      price = cells[1] ?? "";
    } else {
      continue;
    }
    const item = rowToItem(name, unit, price, pre, status);
    if (item) out.push(item);
  }
  return out;
}

export function looksLikeSpreadsheet(text: string): boolean {
  const first = text.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
  if (!first) return false;
  if (/\t/.test(first) && first.split("\t").length >= 2) return true;
  if (/name|item|product|price|unit/i.test(first) && /[,;\t]/.test(first)) return true;
  if ((first.match(/,/g) ?? []).length >= 2) return true;
  return false;
}

export function parseIncomingList(text: string): SuggestedItem[] {
  if (looksLikeSpreadsheet(text)) return parseSpreadsheet(text);
  return parseItemList(text);
}

export const SEASONAL_TEMPLATES: { label: string; items: SuggestedItem[] }[] = [
  {
    label: "Eggs + bread",
    items: [
      { name: "Eggs", unit: "dozen", priceCents: 600, status: "in", preorderable: true },
      { name: "Sourdough", unit: "each", priceCents: 800, status: "in", preorderable: true },
    ],
  },
  {
    label: "Summer produce",
    items: [
      { name: "Tomatoes", unit: "lb", priceCents: 350, status: "in", preorderable: false },
      { name: "Cucumbers", unit: "each", priceCents: 100, status: "in", preorderable: false },
      { name: "Basil bunch", unit: "bunch", priceCents: 300, status: "in", preorderable: false },
    ],
  },
  {
    label: "Honey + jam",
    items: [
      { name: "Raw 5oz honey", unit: "jar", priceCents: 1000, status: "in", preorderable: true },
      { name: "Jam", unit: "jar", priceCents: 700, status: "in", preorderable: true },
    ],
  },
];
