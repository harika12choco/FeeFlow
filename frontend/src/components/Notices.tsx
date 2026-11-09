import { FlaskConical, Info } from "lucide-react";
import type { ReactNode } from "react";

/** Banner clearly labelling demo/invented sample data. */
export function SampleDataBanner() {
  return (
    <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
      <FlaskConical className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <p>
        <span className="font-bold">Sample data.</span> All students, fees and records shown are
        invented for this assessment demo and do not represent real people.
      </p>
    </div>
  );
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-accent-100 bg-accent-50 px-4 py-3 text-xs text-accent-800">
      <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div>{children}</div>
    </div>
  );
}
