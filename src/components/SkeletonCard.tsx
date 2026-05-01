export function SkeletonCard() {
  return (
    <div
      className="bg-white rounded-[20px] p-4 relative overflow-hidden"
      style={{
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
      }}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />

      <div className="flex gap-4">
        <div className="relative flex-shrink-0">
          <div className="w-[100px] h-[100px] rounded-[16px] bg-gradient-to-br from-gray-100 to-gray-200" />
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gray-200" />
        </div>

        <div className="flex-1 min-w-0 py-1 space-y-3">
          <div className="h-5 bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg w-3/4" />

          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-gray-100 flex-shrink-0" />
            <div className="h-3.5 bg-gradient-to-r from-gray-100 to-gray-200 rounded-md w-28" />
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-gray-100 flex-shrink-0" />
            <div className="h-3.5 bg-gradient-to-r from-gray-100 to-gray-200 rounded-md w-20" />
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200" />
          <div className="w-12 h-7 rounded-xl bg-gradient-to-r from-gray-100 to-gray-200" />
        </div>
      </div>
    </div>
  );
}
