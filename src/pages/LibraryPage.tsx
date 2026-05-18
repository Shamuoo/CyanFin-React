import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Server, Tv, CheckCircle, AlertCircle } from 'lucide-react'
import api from '@/lib/api'
import { useState } from 'react'

function LibraryRow({ match }: { match: any }) {
  const typeIcon = match.type === 'movie' ? '🎬' : match.type === 'show' ? '📺' : match.type === 'music' ? '🎵' : '📁'

  return (
    <div className="rounded-xl p-4 mb-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border2)' }}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-lg">{typeIcon}</span>
        <p className="text-sm font-bold" style={{ color: 'var(--cream)' }}>
          {match.primary?.name || match.backup?.name || match.plex?.name}
        </p>
        <span className="text-[9px] px-2 py-0.5 rounded-full uppercase font-bold"
          style={{ background: 'var(--subtle)', color: 'var(--muted)'}}>{match.type}</span>
        {match.synced
          ? <span className="ml-auto flex items-center gap-1 text-[9px] font-bold" style={{ color: '#2ecc71' }}><CheckCircle size={11}/> Synced</span>
          : match.primary && match.backup
            ? <span className="ml-auto flex items-center gap-1 text-[9px] font-bold" style={{ color: '#e74c3c' }}><AlertCircle size={11}/> Out of sync</span>
            : <span className="ml-auto text-[9px]" style={{ color: 'var(--muted)', opacity: 0.5 }}>Partial</span>
        }
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Primary Jellyfin', data: match.primary, icon: <Server size={11}/> },
          { label: 'Backup Jellyfin',  data: match.backup,  icon: <Server size={11}/> },
          { label: 'Plex',             data: match.plex,    icon: <Tv size={11}/> },
        ].map(({ label, data, icon }) => (
          <div key={label} className="p-3 rounded-lg text-center"
            style={{ background: data ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.01)', border: `1px solid ${data ? 'var(--border2)' : 'rgba(255,255,255,0.03)'}` }}>
            <div className="flex items-center justify-center gap-1 mb-1" style={{ color: data ? 'var(--accent)' : 'var(--muted)', opacity: data ? 0.6 : 0.3 }}>
              {icon}
              <span className="text-[8px] font-bold uppercase tracking-wide">{label}</span>
            </div>
            {data
              ? <p className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)' }}>
                  {data.count ?? '—'}
                  <span className="text-[9px] font-normal ml-1" style={{ color: 'var(--muted)' }}>items</span>
                </p>
              : <p className="text-[10px]" style={{ color: 'var(--muted)', opacity: 0.3 }}>Not configured</p>
            }
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LibraryPage() {
  const [showDiff, setShowDiff] = useState(false)
  const { data: diff, isLoading: diffLoading, refetch: refetchDiff } = useQuery({
    queryKey: ['library-sync-diff'],
    queryFn: () => api.libSyncDiff(),
    enabled: showDiff,
    staleTime: 5 * 60_000,
  })

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['all-server-libraries'],
    queryFn: () => api.allServerLibraries(),
    staleTime: 5 * 60_000,
  })

  const d = data as any
  const matched = Array.isArray(d?.matched) ? d.matched : []

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)' }}>
      <div style={{ padding: '24px var(--pad) 48px' }}>

        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl tracking-[0.4em] uppercase" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>Libraries</h1>
          <button onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide hover:opacity-80"
            style={{ background: 'var(--subtle)', border: '1px solid var(--border)', color: 'var(--accent)' }}>
            <RefreshCw size={11} className={isFetching ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Server summary */}
        {d && (
          <div className="flex gap-3 mb-6">
            {[
              { label: 'Primary Jellyfin', icon: <Server size={12}/>, available: d.primary?.available, count: d.primary?.count },
              { label: 'Backup Jellyfin',  icon: <Server size={12}/>, available: d.backup?.available,  count: d.backup?.count },
              { label: 'Plex',             icon: <Tv size={12}/>,    available: d.plex?.available,    count: d.plex?.count },
            ].filter(s => s.count != null).map(s => (
              <div key={s.label} className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{ background: 'var(--subtle)', border: '1px solid var(--border2)' }}>
                <span style={{ color: s.available ? 'var(--accent)' : 'var(--muted)' }}>{s.icon}</span>
                <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{s.label}</span>
                <span className="text-[10px] font-bold" style={{ color: 'var(--cream)' }}>{s.count} libs</span>
              </div>
            ))}
          </div>
        )}

        {/* Sync diff */}
        <div className="mb-4">
          <button onClick={() => setShowDiff(s => !s)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide hover:opacity-80 mb-3"
            style={{ background: showDiff ? 'rgba(231,76,60,0.1)' : 'var(--subtle)', border: '1px solid var(--border)', color: showDiff ? '#e74c3c' : 'var(--muted)' }}>
            {diffLoading ? '…' : showDiff ? '▲ Hide Diff' : '⊕ Check Sync'}
          </button>
          {showDiff && diff && !(diff as any).error && (
            <div className="rounded-xl p-4 mb-3" style={{ background: 'rgba(231,76,60,0.06)', border: '1px solid rgba(231,76,60,0.2)' }}>
              <p className="text-xs font-bold mb-1" style={{ color: '#e74c3c' }}>
                {(diff as any).missingCount} items on primary missing from backup
              </p>
              <p className="text-[9px] mb-3" style={{ color: 'var(--muted)' }}>
                Primary: {(diff as any).primaryCount} · Backup: {(diff as any).backupCount}
              </p>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {((diff as any).items || []).map((item: any) => (
                  <div key={item.id} className="flex items-center gap-2 py-1">
                    {item.posterUrl && <img src={item.posterUrl} alt="" className="w-6 h-8 object-cover rounded flex-shrink-0" />}
                    <p className="text-[10px] flex-1 truncate" style={{ color: 'var(--muted)' }}>{item.title} {item.year ? `(${item.year})` : ''}</p>
                    {item.imdbId && (
                      <a href={`https://www.imdb.com/title/${item.imdbId}/`} target="_blank" rel="noreferrer"
                        className="text-[8px] flex-shrink-0 hover:opacity-70"
                        style={{ color: '#f5c518' }}>IMDb</a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {showDiff && (diff as any)?.error && (
            <p className="text-xs mb-3" style={{ color: '#e74c3c' }}>{(diff as any).error}</p>
          )}
        </div>

        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} />
          </div>
        )}

        {matched.length > 0 && matched.map((match: any, i: number) => (
          <LibraryRow key={i} match={match} />
        ))}

        {!isLoading && matched.length === 0 && (
          <div className="text-center py-20" style={{ color: 'var(--muted)' }}>
            <p className="text-sm mb-2" style={{ opacity: 0.5 }}>No libraries found</p>
            <p className="text-xs mb-4" style={{ opacity: 0.3 }}>
              {d?.primary?.available === false
                ? 'Jellyfin primary is unreachable'
                : d?.primary?.count === 0
                  ? 'Jellyfin returned 0 libraries — check your API key has access'
                  : 'Check server configuration in Settings → Servers'}
            </p>
            <button onClick={() => refetch()}
              className="text-xs px-4 py-2 rounded-full hover:opacity-80"
              style={{ background: 'var(--subtle)', border: '1px solid var(--border)', color: 'var(--accent)' }}>
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
