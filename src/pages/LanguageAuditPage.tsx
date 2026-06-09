import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import api from '@/lib/api'
import { useStore } from '@/lib/store'

export default function LanguageAuditPage() {
  const { setDetailItemId } = useStore()
  const [lang, setLang] = useState('eng')
  const [type, setType] = useState('Movie')
  const [run, setRun] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['language-audit', lang, type],
    queryFn: () => api.languageAudit(lang, type),
    enabled: run,
    staleTime: 5 * 60_000,
  })

  const issues = (data as any)?.issues || []
  const total  = (data as any)?.total  || 0

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', padding: '24px var(--pad) 48px' }}>
      <h1 className="text-2xl tracking-[0.4em] uppercase mb-6" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>
        Language Audit
      </h1>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 rounded-2xl" style={{ background: 'var(--bg2)', border: '1px solid var(--border2)' }}>
        <div>
          <p className="text-[8px] uppercase tracking-widest mb-1" style={{ color: 'var(--muted)', opacity: 0.4 }}>Language</p>
          <div className="flex gap-2">
            {[['eng','English'],['fre','French'],['ger','German'],['spa','Spanish'],['jpn','Japanese']].map(([v,l]) => (
              <button key={v} onClick={() => setLang(v)}
                className="px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
                style={{ background: lang === v ? 'var(--accent)' : 'var(--subtle)', color: lang === v ? 'var(--bg)' : 'var(--muted)', border: `1px solid ${lang === v ? 'transparent' : 'var(--border2)'}` }}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[8px] uppercase tracking-widest mb-1" style={{ color: 'var(--muted)', opacity: 0.4 }}>Type</p>
          <div className="flex gap-2">
            {[['Movie','Movies'],['Series','Shows']].map(([v,l]) => (
              <button key={v} onClick={() => setType(v)}
                className="px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
                style={{ background: type === v ? 'var(--accent)' : 'var(--subtle)', color: type === v ? 'var(--bg)' : 'var(--muted)', border: `1px solid ${type === v ? 'transparent' : 'var(--border2)'}` }}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-end">
          <button onClick={() => setRun(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold hover:opacity-80"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
            {isLoading ? '⏳ Scanning…' : '🔍 Scan Library'}
          </button>
        </div>
      </div>

      {/* Results */}
      {run && !isLoading && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <p className="text-sm font-bold" style={{ color: issues.length === 0 ? '#2ecc71' : '#e74c3c' }}>
              {issues.length === 0
                ? `✓ All ${total} items have ${lang === 'eng' ? 'English' : lang} audio`
                : `${issues.length} of ${total} items missing ${lang === 'eng' ? 'English' : lang} audio`}
            </p>
          </div>

          {issues.length > 0 && (
            <div className="space-y-2">
              {issues.map((item: any, i: number) => (
                <motion.div key={item.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:opacity-80"
                  style={{ background: 'var(--bg2)', border: '1px solid var(--border2)' }}
                  onClick={() => setDetailItemId(item.id)}>
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt="" className="rounded-lg flex-shrink-0" style={{ width: 40, height: 60, objectFit: 'cover' }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--cream)' }}>{item.name} {item.year ? <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({item.year})</span> : null}</p>
                    <p className="text-[9px] mt-0.5" style={{ color: '#e74c3c' }}>
                      No {lang === 'eng' ? 'English' : lang} audio
                    </p>
                    <p className="text-[9px]" style={{ color: 'var(--muted)', opacity: 0.5 }}>
                      Audio: {item.audioLangs.join(', ') || 'none'} · Subs: {item.subLangs.join(', ') || 'none'}
                    </p>
                  </div>
                  <span className="text-[8px] px-2 py-1 rounded-full flex-shrink-0" style={{ background: 'rgba(231,76,60,0.1)', color: '#e74c3c' }}>
                    Missing
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {!run && (
        <p className="text-sm py-12 text-center" style={{ color: 'var(--muted)', opacity: 0.3 }}>
          Choose a language and click Scan Library to find items with missing audio tracks.
        </p>
      )}
    </div>
  )
}
