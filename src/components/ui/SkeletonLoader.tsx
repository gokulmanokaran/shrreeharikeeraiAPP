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

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 shimmer rounded-full ${
            i === lines - 1 ? "w-2/3" : "w-full"
          }`}
        />
      ))}
    </div>
  );
}
