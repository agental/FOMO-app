export function SkeletonCard() {
  return (
    <div
      className="bg-white rounded-[20px] overflow-hidden relative"
      style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
    >
      {/* shimmer sweep */}
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent z-10 pointer-events-none" />

      <div className="flex gap-4 p-4" dir="rtl">
        {/* Thumbnail */}
        <div className="relative flex-shrink-0 w-[88px] h-[88px] rounded-[16px] bg-gradient-to-br from-gray-100 to-gray-200 overflow-visible">
          {/* emoji badge */}
          <div className="absolute -bottom-1 -left-1 w-7 h-7 rounded-full bg-gray-200" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div className="space-y-2">
            {/* title */}
            <div className="h-[17px] bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg w-3/4" />
            {/* date + price row */}
            <div className="flex items-center gap-3">
              <div className="h-3 bg-gradient-to-r from-gray-100 to-gray-200 rounded-md w-28" />
              <div className="h-3 bg-gradient-to-r from-gray-100 to-gray-200 rounded-md w-12" />
            </div>
          </div>

          <div className="flex items-center justify-between mt-3">
            {/* attendees */}
            <div className="h-3 bg-gray-100 rounded-md w-16" />
            {/* join button */}
            <div className="w-[72px] h-[30px] rounded-[12px] bg-gradient-to-r from-gray-100 to-gray-200" />
          </div>
        </div>

        {/* Creator avatar */}
        <div className="flex-shrink-0 self-center w-9 h-9 rounded-full bg-gradient-to-br from-gray-100 to-gray-200" />
      </div>
    </div>
  );
}
