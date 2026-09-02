import { useState } from "react";
import { Calculator, X } from "lucide-react";

const KEYS = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ".", "C", "+"] as const;

function apply(a: number, b: number, op: string) {
  if (op === "+") return a + b;
  if (op === "−") return a - b;
  if (op === "×") return a * b;
  if (op === "÷") return b === 0 ? a : a / b;
  return b;
}

export function StandCalc() {
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState("0");
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [fresh, setFresh] = useState(true);

  function tap(key: string) {
    if (key === "C") {
      setDisplay("0");
      setAcc(null);
      setOp(null);
      setFresh(true);
      return;
    }
    if ("÷×−+".includes(key)) {
      const n = Number(display);
      const next = acc != null && op && !fresh ? apply(acc, n, op) : n;
      setAcc(next);
      setOp(key);
      setDisplay(String(next));
      setFresh(true);
      return;
    }
    if (key === ".") {
      if (fresh) {
        setDisplay("0.");
        setFresh(false);
        return;
      }
      if (!display.includes(".")) setDisplay(display + ".");
      return;
    }
    if (fresh || display === "0") {
      setDisplay(key);
      setFresh(false);
    } else {
      setDisplay((display + key).slice(0, 12));
    }
  }

  function equals() {
    if (acc == null || !op) return;
    const n = apply(acc, Number(display), op);
    const shown = Number.isInteger(n) ? String(n) : n.toFixed(2);
    setDisplay(shown);
    setAcc(null);
    setOp(null);
    setFresh(true);
  }

  return (
    <>
      <button
        type="button"
        className="fixed bottom-20 right-4 z-40 grid size-14 place-items-center rounded-full bg-forest text-paper shadow-lg sm:bottom-6"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close calculator" : "Open calculator"}
      >
        {open ? <X className="size-5" /> : <Calculator className="size-5" />}
      </button>
      {open && (
        <div className="fixed bottom-36 right-4 z-40 w-64 rounded-2xl border border-border bg-surface p-3 shadow-lg sm:bottom-24">
          <p className="mb-2 h-12 overflow-hidden text-right font-display text-3xl font-semibold tabular-nums">{display}</p>
          <div className="grid grid-cols-4 gap-1.5">
            {KEYS.map((k) => (
              <button
                key={k}
                type="button"
                className="h-11 rounded-xl bg-chip text-sm font-medium"
                onClick={() => tap(k)}
              >
                {k}
              </button>
            ))}
            <button type="button" className="col-span-4 h-12 rounded-xl bg-forest text-paper" onClick={equals}>
              =
            </button>
          </div>
        </div>
      )}
    </>
  );
}
