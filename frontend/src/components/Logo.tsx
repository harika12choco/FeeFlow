export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-600 text-white shadow-sm">
        <span className="text-lg font-extrabold leading-none">F</span>
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-[15px] font-extrabold tracking-tight text-navy-900">FeeFlow</div>
          <div className="text-[10px] font-medium uppercase tracking-widest text-navy-400">
            Fees &amp; parent portal
          </div>
        </div>
      )}
    </div>
  );
}
