export default function Loading() {
  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-gray-950">
      <div className="h-0.5 w-full overflow-hidden">
        <div className="h-full bg-blue-500 animate-[loading-bar_1.4s_ease-in-out_infinite]" />
      </div>

      <div className="max-w-3xl mx-auto px-6 py-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div className="h-4 w-24 rounded-md bg-gray-200 dark:bg-gray-800 animate-pulse" />
          <div className="h-8 w-44 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
        </div>
        <div className="flex gap-1">
          {[80, 110, 80, 90].map((w, i) => (
            <div key={i} className="h-8 rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse" style={{ width: w }} />
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 pb-8 flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 px-5 py-4 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              <div className="h-3.5 rounded-md bg-gray-200 dark:bg-gray-800 animate-pulse" style={{ width: `${40 + (i * 17) % 40}%` }} />
              <div className="h-3 rounded-md bg-gray-100 dark:bg-gray-800/60 animate-pulse" style={{ width: `${55 + (i * 13) % 30}%` }} />
            </div>
            <div className="h-7 w-24 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
