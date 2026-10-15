// ─────────────────────────────────────────────────────────────────────────────
// SkeletonLoader.tsx
// Reusable shimmer skeleton components that match the app's actual UI layouts.
// All shapes use the existing `.shimmer` CSS class (defined in index.css).
// ─────────────────────────────────────────────────────────────────────────────

// ── Primitive building block ──────────────────────────────────────────────────

/** A generic shimmer rectangle. Pass className for size/shape. */
export function SkeletonBox({ className = "" }: { className?: string }) {
  return <div className={`shimmer ${className}`} />;
}

// ── Product Card skeleton — matches ProductCard layout ────────────────────────

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-[16px] border border-[#EAEAEA] overflow-hidden">
      <div className="aspect-square shimmer" />
      <div className="p-3 space-y-2">
        <div className="h-3.5 shimmer rounded-full w-3/4" />
        <div className="h-3 shimmer rounded-full w-1/2" />
        <div className="flex items-center justify-between mt-3">
          <div className="h-4 shimmer rounded-full w-1/3" />
          <div className="h-8 shimmer rounded-full w-16" />
        </div>
      </div>
    </div>
  );
}

/** 2-col responsive product grid of skeleton cards */
export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

// ── Text lines skeleton ────────────────────────────────────────────────────────

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 shimmer rounded-full ${i === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}

// ── Hero / PromoCarousel banner skeleton ──────────────────────────────────────

/** Matches the PromoCarousel outer container height (h-[112px] sm:h-[116px]) */
export function SkeletonBanner() {
  return (
    <div className="w-full pt-1 pb-1">
      <div className="relative overflow-hidden rounded-[18px] h-[112px] sm:h-[116px] shimmer" />
    </div>
  );
}

// ── Category pill skeleton — matches CategoryScroller filter mode ──────────────

export function SkeletonCategoryPills({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`flex-shrink-0 h-9 shimmer rounded-full ${
            i === 0 ? "w-16" : i % 3 === 0 ? "w-28" : "w-24"
          }`}
        />
      ))}
    </div>
  );
}

// ── Products page skeleton — title + category pills + grid ────────────────────

export function SkeletonProductsPage() {
  return (
    <div className="pb-24 max-w-6xl mx-auto">
      {/* Page title area */}
      <div className="px-3 sm:px-4 pt-4 pb-2 space-y-1.5">
        <div className="h-6 shimmer rounded-full w-40" />
        <div className="h-3.5 shimmer rounded-full w-28" />
      </div>
      {/* Category filter pills */}
      <div className="px-3 sm:px-4">
        <SkeletonCategoryPills count={7} />
      </div>
      <div className="h-3" />
      {/* Product grid */}
      <div className="px-3 sm:px-4">
        <SkeletonGrid count={8} />
      </div>
    </div>
  );
}

// ── Order card skeleton — matches OrdersPage individual order card ─────────────

export function SkeletonOrderCard() {
  return (
    <div className="bg-white rounded-[20px] border border-[#EAEAEA] shadow-sm p-4 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1.5 flex-1">
          <div className="h-3.5 shimmer rounded-full w-2/3" />
          <div className="h-3 shimmer rounded-full w-1/3" />
        </div>
        <div className="h-5 w-16 shimmer rounded-full shrink-0" />
      </div>
      <div className="h-3 shimmer rounded-full w-3/4" />
      <div className="h-3 shimmer rounded-full w-1/2" />
      <div className="h-4 shimmer rounded-full w-16" />
    </div>
  );
}

/** Multiple order card skeletons for OrdersPage loading state */
export function SkeletonOrdersList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonOrderCard key={i} />
      ))}
    </div>
  );
}
