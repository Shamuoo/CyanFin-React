import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, RefreshCw, Wand2, AlertTriangle, CheckCircle, Languages, Film } from 'lucide-react'
import api from '@/lib/api'
import { useStore } from '@/lib/store'
import { toast } from '@/components/ui/Toast'

type Tab = 'metadata' | 'language' | 'missing' | 'duplicates'

const PROBLEM_LABELS: Record<string, string> = {
  no_overview: 'No overview', no_poster: 'No poster', no_backdrop: 'No backdrop',
  no_year: 'No year', no_genres: 'No genres', no_ids: 'No external IDs', no_cast: 'No cast',
}
const PROBLEM_SEVERITY: Record<string, 'warn' | 'error'> = {
  no_overview: 'warn', no_poster: 'error', no_backdrop: 'warn',
  no_year: 'warn', no_genres: 'warn', no_ids: 'error', no_cast: 'warn',
}

function TabBtn({ id, active, onClick, children }: any) {
  return (
    <button onClick={() => onClick(id)}
      className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition-all"
      style={{ color: active ? 'var(--accent)' : 'var(--muted)', borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`, opacity: active ? 1 : 0.5 }}>
      {children}
    </button>
  )
}

export default function LibraryToolsPage() {
  const { setDetailItemId } = useStore()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('metadata')
  const [metaType, setMetaType] = useState<'Movie' | 'Series'>('Movie')
  const [langLang, setLangLang] = useState('eng')
  const [langType, setLangType] = useState('Movie')
  const [metaRun, setMetaRun] = useState(false)
  const [langRun, setLangRun] = useState(false)
  const [missingRun, setMissingRun] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [fixProgress, setFixProgress] = useState<{done:number;total:number}|null>(null)
  const [identifyId, setIdentifyId] = useState<string|null>(null)
  const [identifyForm, setIdentifyForm] = useState({name:'',year:'',imdb:'',tmdb:''})
  const [metaFilter, setMetaFilter] = useState('')

  const { data: metaData, isLoading: metaLoading, refetch: metaRefetch } = useQuery({
    queryKey: ['metadata-issues', metaType], queryFn: () => api.metadataIssues(metaType), enabled: metaRun, staleTime: 60_000,
  })
  const { data: langData, isLoading: langLoading } = useQuery({
    queryKey: ['language-audit', langLang, langType], queryFn: () => api.languageAudit(langLang, langType), enabled: langRun, staleTime: 60_000,
  })
  const { data: missingData, isLoading: missingLoading } = useQuery({
    queryKey: ['missing-episodes'], queryFn: () => api.missingEpisodes(), enabled: missingRun, staleTime: 5 * 60_000,
  })

  const metaIssues = (metaData as any)?.issues || []
  const langIssues = (langData as any)?.issues || []
  const missingIssues = (missingData as any)?.issues || []
  const metaTotal = (metaData as any)?.total || 0

  const metaCounts: Record<string,number> = {}
  metaIssues.forEach((i: any) => i.problems.forEach((p: string) => { metaCounts[p] = (metaCounts[p]||0)+1 }))
  const filteredMeta = metaFilter ? metaIssues.filter((i: any) => i.problems.includes(metaFilter)) : metaIssues

  const autoFix = async () => {
    if (!metaIssues.length) return
    setFixing(true)
    const ids = metaIssues.map((i: any) => i.id)
    let done = 0
    for (let i = 0; i < ids.length; i += 50) {
      const r = await api.autoFixMetadata(ids.slice(i, i+50)).catch(() => null) as any
      done += r?.fixed || 50; setFixProgress({ done: Math.min(done, ids.length), total: ids.length })
    }
    setFixing(false); setFixProgress(null)
    toast.success(`Triggered refresh on ${done} items`)
    setTimeout(() => metaRefetch(), 3000)
  }

  const identify = async () => {
    if (!identifyId) return
    setFixing(true)
    const r = await api.identifyItem(identifyId, identifyForm).catch(() => null) as any
    setFixing(false)
    if (r?.ok) { toast.success(r.name ? `Matched to "${r.name}"` : 'Refresh triggered'); setIdentifyId(null); setTimeout(() => metaRefetch(), 2000) }
    else toast.error(r?.error || 'Identify failed')
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header + tabs */}
      <div className="px-5 pt-6 pb-0" style={{ borderBottom: '1px solid var(--border2)' }}>
        <h1 className="text-xl tracking-[0.3em] uppercase mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>Library Tools</h1>
        <div className="flex gap-1">
          <TabBtn id="metadata" active={tab==='metadata'} onClick={setTab}>Metadata</TabBtn>
          <TabBtn id="language" active={tab==='language'} onClick={setTab}>Language</TabBtn>
          <TabBtn id="missing" active={tab==='missing'} onClick={setTab}>Missing Eps</TabBtn>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 py-5">

        {/* METADATA TAB */}
        {tab === 'metadata' && (
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="flex gap-2">
                {(['Movie','Series'] as const).map(t => (
                  <button key={t} onClick={() => { setMetaType(t); setMetaRun(false) }}
                    className="px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
                    style={{ background: metaType===t?'var(--accent)':'var(--subtle)', color: metaType===t?'var(--bg)':'var(--muted)', border:`1px solid ${metaType===t?'transparent':'var(--border2)'}` }}>
                    {t==='Movie'?'Movies':'TV Shows'}
                  </button>
                ))}
              </div>
              {metaRun && metaIssues.length > 0 && (
                <button onClick={autoFix} disabled={fixing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold disabled:opacity-40"
                  style={{ background:'rgba(201,168,76,0.15)', border:'1px solid var(--accent)', color:'var(--accent)' }}>
                  <Wand2 size={11} className={fixing?'animate-pulse':''} />
                  {fixProgress ? `${fixProgress.done}/${fixProgress.total}…` : 'Auto-Fix All'}
                </button>
              )}
              <button onClick={() => { setMetaRun(true); if (metaRun) metaRefetch() }} disabled={metaLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold ml-auto disabled:opacity-40"
                style={{ background:'var(--accent)', color:'var(--bg)' }}>
                <Search size={11} className={metaLoading?'animate-spin':''} />
                {metaLoading ? 'Scanning…' : metaRun ? 'Rescan' : 'Scan'}
              </button>
            </div>

            {metaRun && !metaLoading && (
              <div className="flex items-center gap-3 mb-4 p-3 rounded-xl"
                style={{ background: metaIssues.length===0 ? 'rgba(46,204,113,0.06)' : 'rgba(243,156,18,0.06)', border:`1px solid ${metaIssues.length===0?'rgba(46,204,113,0.2)':'rgba(243,156,18,0.2)'}` }}>
                {metaIssues.length===0
                  ? <><CheckCircle size={14} color="#2ecc71"/><p className="text-xs font-bold" style={{color:'#2ecc71'}}>All {metaTotal} items have complete metadata</p></>
                  : <><AlertTriangle size={14} color="#f39c12"/><p className="text-xs font-bold" style={{color:'#f39c12'}}>{metaIssues.length} of {metaTotal} items need attention</p></>
                }
              </div>
            )}

            {metaRun && !metaLoading && Object.keys(metaCounts).length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-2 mb-3">
                <button onClick={() => setMetaFilter('')}
                  className="flex-shrink-0 px-2.5 py-1 rounded-full text-[9px] font-bold"
                  style={{ background: !metaFilter?'var(--accent)':'var(--subtle)', color: !metaFilter?'var(--bg)':'var(--muted)', border:`1px solid ${!metaFilter?'transparent':'var(--border2)'}` }}>
                  All ({metaIssues.length})
                </button>
                {Object.entries(metaCounts).sort(([,a],[,b])=>b-a).map(([k,v]) => (
                  <button key={k} onClick={() => setMetaFilter(metaFilter===k?'':k)}
                    className="flex-shrink-0 px-2.5 py-1 rounded-full text-[9px] font-bold whitespace-nowrap"
                    style={{ background: metaFilter===k?(PROBLEM_SEVERITY[k]==='error'?'#e74c3c':'#f39c12'):'var(--subtle)', color: metaFilter===k?'white':'var(--muted)', border:`1px solid ${metaFilter===k?'transparent':'var(--border2)'}` }}>
                    {PROBLEM_LABELS[k]} ({v})
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {filteredMeta.slice(0, 50).map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background:'var(--bg2)', border:'1px solid var(--border2)' }}>
                  <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width:36, height:54, background: item.imageUrl?'transparent':'var(--bg3)', border:'1px solid var(--border2)' }}>
                    {item.imageUrl ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center"><AlertTriangle size={12} style={{color:'#e74c3c'}}/></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <button onClick={() => setDetailItemId(item.id)} className="text-sm font-bold truncate block text-left hover:opacity-70 w-full" style={{color:'var(--cream)'}}>
                      {item.name} {item.year && <span style={{color:'var(--muted)',fontWeight:400,fontSize:11}}>({item.year})</span>}
                    </button>
                    <div className="flex gap-1 mt-0.5 flex-wrap">
                      {item.problems.map((p: string) => (
                        <span key={p} className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide"
                          style={{ background:PROBLEM_SEVERITY[p]==='error'?'rgba(231,76,60,0.12)':'rgba(243,156,18,0.1)', color:PROBLEM_SEVERITY[p]==='error'?'#e74c3c':'#f39c12' }}>
                          {PROBLEM_LABELS[p]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => { setIdentifyId(item.id); setIdentifyForm({name:item.name, year:item.year||'', imdb:'', tmdb:''}) }}
                      className="px-2 py-1 rounded-full text-[9px] font-bold hover:opacity-80"
                      style={{ background:'var(--subtle)', border:'1px solid var(--border2)', color:'var(--accent)' }}>
                      Identify
                    </button>
                    <button onClick={async () => { await api.autoFixMetadata([item.id]).catch(()=>{}); toast.success('Refresh triggered') }}
                      className="px-2 py-1 rounded-full text-[9px] font-bold hover:opacity-80"
                      style={{ background:'var(--subtle)', border:'1px solid var(--border2)', color:'var(--muted)' }}>
                      Fix
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LANGUAGE TAB */}
        {tab === 'language' && (
          <div>
            <div className="flex flex-wrap gap-3 items-center mb-5">
              <div className="flex gap-2 flex-wrap">
                {[['eng','English'],['fre','French'],['ger','German'],['spa','Spanish'],['jpn','Japanese']].map(([v,l]) => (
                  <button key={v} onClick={() => setLangLang(v)}
                    className="px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
                    style={{ background:langLang===v?'var(--accent)':'var(--subtle)', color:langLang===v?'var(--bg)':'var(--muted)', border:`1px solid ${langLang===v?'transparent':'var(--border2)'}` }}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {(['Movie','Series'] as const).map(t => (
                  <button key={t} onClick={() => setLangType(t)}
                    className="px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
                    style={{ background:langType===t?'var(--accent)':'var(--subtle)', color:langType===t?'var(--bg)':'var(--muted)', border:`1px solid ${langType===t?'transparent':'var(--border2)'}` }}>
                    {t==='Movie'?'Movies':'Shows'}
                  </button>
                ))}
              </div>
              <button onClick={() => setLangRun(true)} disabled={langLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold ml-auto disabled:opacity-40"
                style={{ background:'var(--accent)', color:'var(--bg)' }}>
                <Search size={11} className={langLoading?'animate-spin':''} />
                {langLoading ? 'Scanning…' : 'Scan'}
              </button>
            </div>
            {langRun && !langLoading && (
              <div className="mb-4 p-3 rounded-xl" style={{ background: langIssues.length===0?'rgba(46,204,113,0.06)':'rgba(243,156,18,0.06)', border:`1px solid ${langIssues.length===0?'rgba(46,204,113,0.2)':'rgba(243,156,18,0.2)'}` }}>
                <p className="text-xs font-bold" style={{color: langIssues.length===0?'#2ecc71':'#f39c12'}}>
                  {langIssues.length===0 ? `All ${(langData as any)?.total||0} items have audio` : `${langIssues.length} missing ${langLang==='eng'?'English':langLang} audio`}
                </p>
              </div>
            )}
            <div className="space-y-2">
              {langIssues.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:opacity-80"
                  style={{ background:'var(--bg2)', border:'1px solid var(--border2)' }}
                  onClick={() => setDetailItemId(item.id)}>
                  {item.imageUrl && <img src={item.imageUrl} alt="" className="flex-shrink-0 rounded-lg object-cover" style={{width:36,height:54}}/>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{color:'var(--cream)'}}>{item.name} {item.year&&<span style={{color:'var(--muted)',fontWeight:400,fontSize:11}}>({item.year})</span>}</p>
                    <p className="text-[9px] mt-0.5" style={{color:'var(--muted)',opacity:0.4}}>Audio: {item.audioLangs.join(', ')||'none'}</p>
                  </div>
                  <span className="text-[8px] px-2 py-0.5 rounded-full flex-shrink-0" style={{background:'rgba(231,76,60,0.1)',color:'#e74c3c'}}>Missing</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MISSING EPISODES TAB */}
        {tab === 'missing' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <p className="text-xs" style={{color:'var(--muted)',opacity:0.5}}>Scan for gaps in episode numbering across your shows.</p>
              <button onClick={() => setMissingRun(true)} disabled={missingLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold disabled:opacity-40"
                style={{ background:'var(--accent)', color:'var(--bg)' }}>
                <Search size={11} className={missingLoading?'animate-spin':''} />
                {missingLoading ? 'Scanning…' : 'Scan Shows'}
              </button>
            </div>
            {missingRun && !missingLoading && (
              <div className="mb-4 p-3 rounded-xl" style={{ background: missingIssues.length===0?'rgba(46,204,113,0.06)':'rgba(243,156,18,0.06)', border:`1px solid ${missingIssues.length===0?'rgba(46,204,113,0.2)':'rgba(243,156,18,0.2)'}` }}>
                <p className="text-xs font-bold" style={{color:missingIssues.length===0?'#2ecc71':'#f39c12'}}>
                  {missingIssues.length===0 ? `No missing episodes in ${(missingData as any)?.showsScanned||0} shows` : `${missingIssues.length} shows have missing episodes`}
                </p>
              </div>
            )}
            <div className="space-y-2">
              {missingIssues.map((item: any) => (
                <div key={`${item.showId}-${item.season}`} className="flex items-center gap-3 p-3 rounded-xl"
                  style={{background:'var(--bg2)',border:'1px solid var(--border2)'}}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{color:'var(--cream)'}}>{item.showName}</p>
                    <p className="text-[9px]" style={{color:'var(--muted)',opacity:0.5}}>Season {item.season} · {item.present} present</p>
                  </div>
                  <span className="text-[9px] flex-shrink-0" style={{color:'#e74c3c'}}>
                    Missing E{item.missing.slice(0,5).join(', E')}{item.missing.length>5?` +${item.missing.length-5}more`:''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Identify modal */}
      <AnimatePresence>
        {identifyId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:'rgba(0,0,0,0.75)',backdropFilter:'blur(8px)'}}>
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="w-full max-w-sm rounded-2xl p-5" style={{background:'var(--bg2)',border:'1px solid var(--border)'}}>
              <p className="text-sm font-bold mb-4" style={{color:'var(--cream)'}}>Identify Item</p>
              {[['name','Title'],['year','Year'],['imdb','IMDB ID'],['tmdb','TMDB ID']].map(([k,l]) => (
                <div key={k} className="mb-3">
                  <p className="text-[8px] uppercase tracking-widest mb-1" style={{color:'var(--muted)',opacity:0.4}}>{l}</p>
                  <input value={(identifyForm as any)[k]} onChange={e => setIdentifyForm(f => ({...f,[k]:e.target.value}))}
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                    style={{background:'var(--bg3)',border:'1px solid var(--border2)',color:'var(--cream)'}}/>
                </div>
              ))}
              <div className="flex gap-2 mt-4">
                <button onClick={() => setIdentifyId(null)} className="flex-1 py-2 rounded-full text-xs font-bold" style={{background:'var(--subtle)',color:'var(--muted)',border:'1px solid var(--border2)'}}>Cancel</button>
                <button onClick={identify} disabled={fixing} className="flex-1 py-2 rounded-full text-xs font-bold disabled:opacity-40" style={{background:'var(--accent)',color:'var(--bg)'}}>
                  {fixing?'Identifying…':'Identify & Fix'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
