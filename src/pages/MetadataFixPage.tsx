import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, AlertTriangle, CheckCircle, Wand2, Search } from 'lucide-react'
import api from '@/lib/api'
import { useStore } from '@/lib/store'
import { toast } from '@/components/ui/Toast'

const PROBLEM_LABELS: Record<string, string> = {
  no_overview:  'No overview',
  no_poster:    'No poster',
  no_backdrop:  'No backdrop',
  no_year:      'No year',
  no_genres:    'No genres',
  no_ids:       'No external IDs',
  no_cast:      'No cast',
}

const PROBLEM_SEVERITY: Record<string, 'warn' | 'error'> = {
  no_overview: 'warn', no_poster: 'error', no_backdrop: 'warn',
  no_year: 'warn', no_genres: 'warn', no_ids: 'error', no_cast: 'warn',
}

export default function MetadataFixPage() {
  const { setDetailItemId } = useStore()
  const qc = useQueryClient()
  const [type, setType] = useState<'Movie' | 'Series'>('Movie')
  const [run, setRun] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [fixProgress, setFixProgress] = useState<{ done: number; total: number } | null>(null)
  const [identifyId, setIdentifyId] = useState<string | null>(null)
  const [identifyForm, setIdentifyForm] = useState({ name: '', year: '', imdb: '', tmdb: '' })
  const [filter, setFilter] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['metadata-issues', type],
    queryFn: () => api.metadataIssues(type),
    enabled: run,
    staleTime: 60_000,
  })

  const issues = ((data as any)?.issues || []) as any[]
  const total = (data as any)?.total || 0

  const filtered = filter
    ? issues.filter(i => i.problems.includes(filter))
    : issues

  // Auto-fix all: trigger metadata refresh on every flagged item
  const autoFix = async () => {
    if (!issues.length) return
    setFixing(true)
    const ids = issues.map((i: any) => i.id)
    const BATCH = 50
    let done = 0
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH)
      const r = await api.autoFixMetadata(batch).catch(() => null)
      done += r?.fixed || batch.length
      setFixProgress({ done, total: ids.length })
    }
    setFixing(false)
    setFixProgress(null)
    toast.success(`Triggered refresh on ${done} items`)
    setTimeout(() => { refetch() }, 3000)
  }

  // Manual identify one item
  const identify = async () => {
    if (!identifyId) return
    setFixing(true)
    const r = await api.identifyItem(identifyId, identifyForm).catch(() => null)
    setFixing(false)
    if (r?.ok) {
      toast.success(r.name ? `Matched to "${r.name}" (${r.year})` : 'Metadata refresh triggered')
      setIdentifyId(null)
      setTimeout(() => refetch(), 2000)
    } else {
      toast.error(r?.error || 'Identify failed')
    }
  }

  // Count by problem type
  const counts: Record<string, number> = {}
  issues.forEach(i => i.problems.forEach((p: string) => { counts[p] = (counts[p] || 0) + 1 }))

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', padding: '24px var(--pad) 48px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl tracking-[0.4em] uppercase" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>
          Metadata Fix
        </h1>
        <div className="flex gap-2">
          {run && issues.length > 0 && (
            <button onClick={autoFix} disabled={fixing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold disabled:opacity-40 hover:opacity-80"
              style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
              <Wand2 size={11} className={fixing ? 'animate-pulse' : ''} />
              {fixProgress ? `${fixProgress.done}/${fixProgress.total}…` : 'Auto-Fix All'}
            </button>
          )}
          <button onClick={() => { setRun(true); if (run) refetch() }} disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold disabled:opacity-40 hover:opacity-80"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
            <Search size={11} className={isLoading ? 'animate-spin' : ''} />
            {isLoading ? 'Scanning…' : run ? 'Rescan' : 'Scan Library'}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex gap-2">
          {(['Movie', 'Series'] as const).map(t => (
            <button key={t} onClick={() => { setType(t); setRun(false) }}
              className="px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
              style={{ background: type === t ? 'var(--accent)' : 'var(--subtle)', color: type === t ? 'var(--bg)' : 'var(--muted)', border: `1px solid ${type === t ? 'transparent' : 'var(--border2)'}` }}>
              {t === 'Movie' ? 'Movies' : 'TV Shows'}
            </button>
          ))}
        </div>
        {/* Problem type filters */}
        {run && Object.keys(counts).length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            <button onClick={() => setFilter('')}
              className="flex-shrink-0 px-2.5 py-1 rounded-full text-[9px] font-bold"
              style={{ background: !filter ? 'var(--accent)' : 'var(--subtle)', color: !filter ? 'var(--bg)' : 'var(--muted)', border: `1px solid ${!filter ? 'transparent' : 'var(--border2)'}` }}>
              All ({issues.length})
            </button>
            {Object.entries(counts).sort(([,a],[,b]) => b-a).map(([k,v]) => (
              <button key={k} onClick={() => setFilter(filter === k ? '' : k)}
                className="flex-shrink-0 px-2.5 py-1 rounded-full text-[9px] font-bold whitespace-nowrap"
                style={{ background: filter === k ? (PROBLEM_SEVERITY[k] === 'error' ? '#e74c3c' : '#f39c12') : 'var(--subtle)', color: filter === k ? 'white' : 'var(--muted)', border: `1px solid ${filter === k ? 'transparent' : 'var(--border2)'}` }}>
                {PROBLEM_LABELS[k]} ({v})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      {run && !isLoading && (
        <div className="flex items-center gap-3 mb-5 p-3 rounded-xl"
          style={{ background: issues.length === 0 ? 'rgba(46,204,113,0.06)' : 'rgba(243,156,18,0.06)', border: `1px solid ${issues.length === 0 ? 'rgba(46,204,113,0.2)' : 'rgba(243,156,18,0.2)'}` }}>
          {issues.length === 0
            ? <><CheckCircle size={16} color="#2ecc71" /><p className="text-xs font-bold" style={{ color: '#2ecc71' }}>All {total} items have complete metadata</p></>
            : <><AlertTriangle size={16} color="#f39c12" /><p className="text-xs font-bold" style={{ color: '#f39c12' }}>{issues.length} of {total} items have metadata issues</p></>
          }
        </div>
      )}

      {/* Items list */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((item: any, i: number) => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.015 }}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border2)' }}>
              {/* Poster or placeholder */}
              <div className="flex-shrink-0 rounded-lg overflow-hidden"
                style={{ width: 36, height: 54, background: item.imageUrl ? 'transparent' : 'var(--bg3)', border: item.imageUrl ? 'none' : '1px solid var(--border2)' }}>
                {item.imageUrl
                  ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><AlertTriangle size={14} style={{ color: '#e74c3c' }} /></div>
                }
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <button onClick={() => setDetailItemId(item.id)}
                  className="text-sm font-bold truncate block hover:opacity-70 text-left w-full"
                  style={{ color: 'var(--cream)' }}>
                  {item.name} {item.year ? <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 11 }}>({item.year})</span> : null}
                </button>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {item.problems.map((p: string) => (
                    <span key={p} className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide"
                      style={{ background: PROBLEM_SEVERITY[p] === 'error' ? 'rgba(231,76,60,0.12)' : 'rgba(243,156,18,0.1)', color: PROBLEM_SEVERITY[p] === 'error' ? '#e74c3c' : '#f39c12' }}>
                      {PROBLEM_LABELS[p]}
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => { setIdentifyId(item.id); setIdentifyForm({ name: item.name, year: item.year || '', imdb: '', tmdb: '' }) }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[9px] font-bold hover:opacity-80"
                  style={{ background: 'var(--subtle)', border: '1px solid var(--border2)', color: 'var(--accent)' }}>
                  <Search size={10} /> Identify
                </button>
                <button onClick={async () => {
                  await api.autoFixMetadata([item.id]).catch(() => {})
                  toast.success('Refresh triggered')
                }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[9px] font-bold hover:opacity-80"
                  style={{ background: 'var(--subtle)', border: '1px solid var(--border2)', color: 'var(--muted)' }}>
                  <RefreshCw size={10} /> Fix
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!run && (
        <p className="text-sm py-16 text-center" style={{ color: 'var(--muted)', opacity: 0.25 }}>
          Click "Scan Library" to find items with incomplete metadata.
        </p>
      )}

      {/* Identify modal */}
      <AnimatePresence>
        {identifyId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-sm rounded-2xl p-5"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-bold mb-4" style={{ color: 'var(--cream)' }}>Identify Item</p>
              <p className="text-[9px] mb-4" style={{ color: 'var(--muted)', opacity: 0.5 }}>
                CyanFin will search Jellyfin's metadata providers and apply the best match.
              </p>
              {[['name','Title'],['year','Year'],['imdb','IMDB ID'],['tmdb','TMDB ID']].map(([k,l]) => (
                <div key={k} className="mb-3">
                  <p className="text-[8px] uppercase tracking-widest mb-1" style={{ color: 'var(--muted)', opacity: 0.4 }}>{l}</p>
                  <input value={(identifyForm as any)[k]}
                    onChange={e => setIdentifyForm(f => ({ ...f, [k]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                    style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />
                </div>
              ))}
              <div className="flex gap-2 mt-4">
                <button onClick={() => setIdentifyId(null)} className="flex-1 py-2 rounded-full text-xs font-bold"
                  style={{ background: 'var(--subtle)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>Cancel</button>
                <button onClick={identify} disabled={fixing} className="flex-1 py-2 rounded-full text-xs font-bold disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                  {fixing ? 'Identifying…' : 'Identify & Fix'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
