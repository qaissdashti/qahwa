// Skeleton primitives used by Next.js loading.js files while server
// components stream in. Shimmer animation is defined in globals.css.

export function SkelBox({ className = '', style }) {
  return <div className={`qahwa-skeleton ${className}`} style={style} />;
}

// Mirrors the dashboard overview layout: 3 stat cards + recent tips list.
export function DashboardOverviewSkeleton() {
  return (
    <div className="space-y-5">
      <SkelBox className="h-7 w-44" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[0,1,2].map((i) => (
          <div key={i} className="dash-surface rounded-2xl border border-white/10 p-5 space-y-3">
            <SkelBox className="h-4 w-24" />
            <SkelBox className="h-8 w-32" />
          </div>
        ))}
      </div>
      <div className="dash-surface rounded-2xl border border-white/10 p-5 space-y-3">
        <SkelBox className="h-5 w-32" />
        {[0,1,2,3,4].map((i) => (
          <div key={i} className="flex items-center justify-between gap-3 py-2">
            <SkelBox className="h-4 w-40" />
            <SkelBox className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

// A list of rows skeleton — used for tips/messages/payouts/creators lists.
export function ListSkeleton({ rows = 6, title = true }) {
  return (
    <div className="space-y-5">
      {title && <SkelBox className="h-7 w-40" />}
      <div className="dash-surface rounded-2xl border border-white/10 p-2 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 p-3">
            <div className="flex-1 space-y-1.5">
              <SkelBox className="h-4 w-40 max-w-[60%]" />
              <SkelBox className="h-3 w-24 max-w-[40%]" />
            </div>
            <SkelBox className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Settings + form skeleton.
export function FormSkeleton() {
  return (
    <div className="space-y-5">
      <SkelBox className="h-7 w-44" />
      {[0,1,2].map((i) => (
        <div key={i} className="dash-surface rounded-2xl border border-white/10 p-5 space-y-3">
          <SkelBox className="h-5 w-28" />
          <SkelBox className="h-10 w-full" />
          <SkelBox className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}
