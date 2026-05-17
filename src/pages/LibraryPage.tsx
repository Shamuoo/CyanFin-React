import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import api from '@/lib/api'

const SECTIONS = [
  { key: 'overview', label: '📊 Overview' },
  { key: 'quality', label: '🎬 Quality' },
  { key: 'missing', label: '❌ Missing' },
  { key: 'versions', label: '📀 Versions' },
  { key: 'actions', label: '⚡ Actions' },
]

function SubTitle({ text, count }: { text: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: '1px solid var(--border2)' }}>
      <span className="text-[8px] font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--muted)', opacity: 0.5 }}>{text}</span>
      {count !== undefined && <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: count > 0 ? 'rgba(231,76,60,0.15)' : 'rgba(46,204,113,0.1)', color: count > 0 ? '#e74c3c' : '#2ecc71' }}>{count}</span>}
    </div>
  )
}

function LibItem({ title, year, quality, audio, posterUrl, badge, badgeColor, onMeta, onImages }: { title: string; year?: number; quality?: string; audio?: string; posterUrl?: string; badge: string; badgeColor: string; onMeta?: () => void; onImages?: () => void }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded mb-1.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border2)' }}>
      <img src={posterUrl} alt="" className="w-7 h-10 object-cover rounded flex-shrink-0" style={{ background: 'var(--bg3)' }} onError={e => (e.currentTarget.style.opacity = '0')} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold truncate" style={{ color: 'rgba(240,232,213,0.7)' }}>{title}</p>
        <p className="text-[9px]" style={{ color: 'var(--muted)' }}>{[year, quality, audio].filter(Boolean).join(' · ')}</p>
      </div>
      <span className="text-[7px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: badgeColor + '22', color: badgeColor, border: `1px solid ${badgeColor}44` }}>{badge}</span>
      <div className="flex gap-1">
        {onMeta && <button onClick={onMeta} className="text-[8px] px-1.5 py-0.5 rounded" style={{ border: '1px solid var(--border2)', color: 'var(--muted)' }}>↻</button>}
        {onImages && <button onClick={onImages} className="text-[8px] px-1.5 py-0.5 rounded" style={{ border: '1px solid var(--border2)', color: 'var(--muted)' }}>🖼</button>}
      </div>
    </div>
  )
}

export default function LibraryPage() {
  const [section, setSection] = useState('overview')
  const [log, setLog] = useState<string[]>([])
  const addLog = (msg: string) => setLog(prev => [...prev.slice(-20), `${new Date().toLocaleTimeString()} — ${msg}`])

  const { data: quality, refetch: refQuality } = useQuery({ queryKey: ['lib-quality'], queryFn: api.libQuality.bind(api), enabled: section === 'quality' || section === 'overview' })
  const { data: missing, refetch: refMissing } = useQuery({ queryKey: ['lib-missing'], queryFn: api.libMissing.bind(api), enabled: section === 'missing' || section === 'overview' })
  const { data: versions } = useQuery({ queryKey: ['lib-versions'], queryFn: api.libVersions.bind(api), enabled: section === 'versions' || section === 'overview' })

  const q = quality as any
  const m = missing as any
  const v = versions as any

  const doMeta = async (id: string, title: string) => {
    try { await api.libRefreshMeta(id); addLog(`↻ Refreshed: ${title}`) } catch(e: any) { addLog(`✗ ${title}: ${e.message}`) }
  }
  const doImages = async (id: string, title: string) => {
    try { await api.libRefreshImages(id); addLog(`🖼 Images fixed: ${title}`) } catch(e: any) { addLog(`✗ ${title}: ${e.message}`) }
  }

  const renderList = (items: any[], badge: string, color: string) => {
    if (!items?.length) return <p className="text-[11px] italic py-2" style={{ color: 'var(--muted)', opacity: 0.5 }}>✓ None found</p>
    return items.slice(0, 25).map((item: any) => (
      <LibItem key={item.id} title={item.title} year={item.year} quality={item.quality} audio={item.audio}
        posterUrl={item.posterUrl} badge={badge || item.quality || item.audio || '?'} badgeColor={color}
        onMeta={() => doMeta(item.id, item.title)} onImages={() => doImages(item.id, item.title)} />
    ))
  }

  return (
    <div className="h-full flex overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Sidebar */}
      <div className="w-48 flex-shrink-0 overflow-y-auto py-3" style={{ borderRight: '1px solid var(--border2)' }}>
        {SECTIONS.map(s => (
          <button key={s.key} onClick={() => setSection(s.key)}
            className="w-full text-left px-4 py-2.5 text-[10px] font-semibold tracking-wide uppercase transition-all"
            style={{ color: section === s.key ? 'var(--accent)' : 'var(--muted)', background: section === s.key ? 'var(--subtle)' : 'transparent', borderRight: section === s.key ? '2px solid var(--accent)' : '2px solid transparent' }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-6">

        {section === 'overview' && (
          <div>
            <h2 className="text-lg tracking-[0.4em] uppercase mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', opacity: 0.6 }}>Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'SD Files', val: q?.sdItems?.length, color: '#f39c12' },
                { label: 'Upgrades', val: q?.upgradeItems?.length, color: '#f39c12' },
                { label: 'Poor Audio', val: q?.poorAudioItems?.length, color: '#f39c12' },
                { label: 'No Poster', val: m?.missingPoster?.length, color: '#e74c3c' },
                { label: 'No Overview', val: m?.missingOverview?.length, color: '#f39c12' },
                { label: '3D Movies', val: v?.has3D?.length, color: '#2ecc71' },
                { label: 'Multi-Version', val: v?.multiVersion?.length, color: 'var(--blue)' },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)' }}>
                  <div className="text-2xl mb-1" style={{ fontFamily: 'var(--font-display)', color: item.color }}>{item.val ?? '…'}</div>
                  <div className="text-[8px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === 'quality' && (
          <div>
            <h2 className="text-lg tracking-[0.4em] uppercase mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', opacity: 0.6 }}>Quality Issues</h2>
            <SubTitle text="SD / Low Quality" count={q?.sdItems?.length} />
            {renderList(q?.sdItems, 'SD', '#e74c3c')}
            <SubTitle text="Upgrade Candidates" count={q?.upgradeItems?.length} />
            {renderList(q?.upgradeItems, '↑', '#f39c12')}
            <SubTitle text="Poor Audio" count={q?.poorAudioItems?.length} />
            {renderList(q?.poorAudioItems, 'Audio', '#f39c12')}
          </div>
        )}

        {section === 'missing' && (
          <div>
            <h2 className="text-lg tracking-[0.4em] uppercase mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', opacity: 0.6 }}>Missing Content</h2>
            <SubTitle text="Missing Poster" count={m?.missingPoster?.length} />
            {renderList(m?.missingPoster, 'No Poster', '#e74c3c')}
            <SubTitle text="Missing Backdrop" count={m?.missingBackdrop?.length} />
            {renderList(m?.missingBackdrop, 'No Backdrop', '#f39c12')}
            <SubTitle text="Missing Overview" count={m?.missingOverview?.length} />
            {renderList(m?.missingOverview, 'No Overview', '#f39c12')}
          </div>
        )}

        {section === 'versions' && (
          <div>
            <h2 className="text-lg tracking-[0.4em] uppercase mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', opacity: 0.6 }}>Versions & 3D</h2>
            <SubTitle text="Multiple Versions" count={v?.multiVersion?.length} />
            {renderList(v?.multiVersion, 'Multi', '#5dade2')}
            <SubTitle text="3D Library" count={v?.has3D?.length} />
            {renderList(v?.has3D, '3D', '#2ecc71')}
          </div>
        )}

        {section === 'actions' && (
          <div>
            <h2 className="text-lg tracking-[0.4em] uppercase mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', opacity: 0.6 }}>Quick Actions</h2>
            <div className="flex gap-2 flex-wrap mb-6">
              {[
                { label: '🔍 Scan Libraries', fn: async () => { await api.libScan(); addLog('Library scan triggered') } },
                { label: '🔄 Refresh All Metadata', fn: async () => { if (confirm('Refresh ALL metadata? This may take a while.')) { await api.libScan(); addLog('Full refresh triggered') } } },
                { label: '🔁 Rescan Quality', fn: async () => { await refQuality(); addLog('Quality report refreshed') } },
                { label: '🔁 Rescan Missing', fn: async () => { await refMissing(); addLog('Missing content report refreshed') } },
              ].map(btn => (
                <button key={btn.label} onClick={btn.fn}
                  className="px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all hover:opacity-80"
                  style={{ background: 'var(--subtle)', border: '1px solid var(--border)', color: 'var(--accent)' }}>
                  {btn.label}
                </button>
              ))}
            </div>
            <div className="rounded-xl p-4 font-mono text-[10px] min-h-32 max-h-64 overflow-y-auto scrollbar-hide"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border2)', color: 'var(--muted)', lineHeight: 1.8 }}>
              {log.length ? log.map((l, i) => <div key={i}>{l}</div>) : <span style={{ opacity: 0.4 }}>Action log will appear here…</span>}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
