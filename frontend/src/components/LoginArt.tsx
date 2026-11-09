import { ArrowUpRight, BellRing, CheckCircle2, Wallet } from "lucide-react";

/**
 * Static, dashboard-inspired illustration for the login branding panel.
 * Purely decorative — no data fetching or real functionality.
 */
export function LoginArt() {
  const bars = [46, 60, 52, 74, 66, 90];
  const months = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
  const collectionRate = 87;

  return (
    <div className="relative w-full max-w-md">
      {/* Main analytics card */}
      <div className="ff-card relative p-5 shadow-card-hover">
        {/* floating "payment received" pill (contained within the card) */}
        <div className="absolute -top-3 right-4 flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white shadow-card-hover">
          <CheckCircle2 className="h-3.5 w-3.5" />
          ₹10,000 received
        </div>

        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-400">
              Collections · last 6 months
            </p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900">
              ₹7,40,000
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
            <ArrowUpRight className="h-3.5 w-3.5" />
            12%
          </span>
        </div>

        {/* mini bar chart */}
        <div className="mt-4 flex h-24 items-end gap-2.5">
          {bars.map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className={`w-full rounded-md bg-gradient-to-t ${
                  i === bars.length - 1
                    ? "from-accent-600 to-accent-400"
                    : "from-accent-300 to-accent-200"
                }`}
                style={{ height: `${h}%` }}
              />
              <span className="text-[9px] font-medium text-navy-300">{months[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Row: collection-rate ring + instalment progress */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="ff-card flex items-center gap-3 p-4 shadow-card">
          <Ring percent={collectionRate} />
          <div>
            <p className="text-lg font-extrabold leading-none text-navy-900">{collectionRate}%</p>
            <p className="mt-1 text-[11px] font-medium text-navy-400">Collection rate</p>
          </div>
        </div>

        <div className="ff-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
              <Wallet className="h-4 w-4" />
            </span>
            <span className="text-[11px] font-semibold text-navy-400">2 of 3</span>
          </div>
          <p className="mt-2 text-xs font-semibold text-navy-700">Instalment plan</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-navy-100">
            <div className="h-full rounded-full bg-accent-500" style={{ width: "66%" }} />
          </div>
          <p className="mt-1.5 text-[10px] text-navy-400">₹20,000 of ₹30,000 paid</p>
        </div>
      </div>

      {/* Reminder toast */}
      <div className="ff-card mt-4 flex items-center gap-3 p-3.5 shadow-card">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <BellRing className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-navy-800">
            Reminder sent to parent · Hindi
          </p>
          <p className="truncate text-[11px] text-navy-400">
            Fee due in 3 days · auto-stops once paid
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
          Delivered
        </span>
      </div>
    </div>
  );
}

function Ring({ percent }: { percent: number }) {
  return (
    <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e0e7ff" strokeWidth="3.5" />
      <circle
        cx="18"
        cy="18"
        r="15.915"
        fill="none"
        stroke="#4f46e5"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={`${percent} ${100 - percent}`}
      />
    </svg>
  );
}
