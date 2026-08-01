export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-400">加载中...</p>
      </div>
    </div>
  );
}
