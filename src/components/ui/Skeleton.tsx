export default function MediaCardSkeleton({ width = 130 }: { width?: number }) {
  return (
    <div className="flex-shrink-0 animate-pulse" style={{ width }}>
      <div className="rounded-xl mb-2" style={{ width, height: Math.round(width * 1.5), background: 'var(--subtle)' }} />
      <div className="h-2.5 rounded mb-1.5" style={{ background: 'var(--subtle)', width: '80%' }} />
      <div className="h-2 rounded" style={{ background: 'var(--subtle)', width: '50%' }} />
    </div>
  )
}

export function MediaRowSkeleton({ count = 8, width = 130 }: { count?: number; width?: number }) {
  return (
    <div className="mb-8">
      <div className="h-3 rounded mb-4 mx-4" style={{ background: 'var(--subtle)', width: 120 }} />
      <div className="flex gap-3 overflow-hidden" style={{ padding: '0 var(--pad)' }}>
        {Array.from({ length: count }).map((_, i) => (
          <MediaCardSkeleton key={i} width={width} />
        ))}
      </div>
    </div>
  )
}
