export function SkeletonLoader() {
  return (
    <div className="bg-[#0d1b2a] rounded-xl p-6 border border-white/10 overflow-hidden relative">
      {/* Shimmer effect overlay */}
      <div className="absolute inset-0 animate-shimmer pointer-events-none"></div>
      
      {/* Header skeleton */}
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-white/10 rounded w-24"></div>
          <div className="h-6 bg-white/20 rounded w-3/4"></div>
        </div>
      </div>

      {/* Badges skeleton */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="h-6 bg-white/10 rounded-full w-16"></div>
        <div className="h-6 bg-white/10 rounded-full w-20"></div>
        <div className="h-6 bg-white/10 rounded-full w-24"></div>
      </div>

      {/* Time skeleton */}
      <div className="flex items-center gap-4 mb-4">
        <div className="h-4 bg-white/10 rounded w-32"></div>
        <div className="h-4 bg-white/10 rounded w-20"></div>
      </div>

      {/* Footer skeleton */}
      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-white/10 rounded-full"></div>
          <div className="h-4 bg-white/10 rounded w-24"></div>
        </div>
        <div className="h-9 bg-white/10 rounded-lg w-24"></div>
      </div>
    </div>
  );
}