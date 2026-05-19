import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Trash2, Play, Loader, CheckCircle, AlertCircle, HardDrive, X } from 'lucide-react'
import api from '@/lib/api'
import { useStore } from '@/lib/store'
import { toast } from '@/components/ui/Toast'

function fmtSize(bytes: number) {
  if (!bytes) return '—'
  const u = ['B','KB','MB','GB','TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024,i)).toFixed(1)} ${u[i]}`
}

function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}

function ProgressRing({ pct, size = 36 }: { pct: number; size?: number }) {
  const r = (size - 4) / 2
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--accent)" strokeWidth={3}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct/100)}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
    </svg>
  )
}

function ActiveDownload({ dl }: { dl: any }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 p-4 rounded-xl mb-2"
      style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.15)' }}>
      <div className="relative flex-shrink-0">
        <ProgressRing pct={dl.progress || 0} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[9px] font-bold" style={{ color: 'var(--accent)' }}>{dl.progress || 0}%</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate" style={{ color: 'var(--cream)' }}>{dl.title}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${dl.progress||0}%`, background: 'var(--accent)' }} />
          </div>
          <span className="text-[9px] flex-shrink-0" style={{ color: 'var(--muted)' }}>{fmtSize(dl.size)}</span>
        </div>
        {dl.status === 'error' && <p className="text-[9px] mt-1" style={{ color: '#e74c3c' }}>{dl.error}</p>}
      </div>
      {dl.status === 'downloading' && <Loader size={14} className="animate-spin flex-shrink-0" style={{ color: 'var(--accent)' }} />}
      {dl.status === 'error' && <AlertCircle size={14} className="flex-shrink-0" style={{ color: '#e74c3c' }} />}
    </motion.div>
  )
}

function FileRow({ file, onPlay, onDelete, deleting }: any) {
  const ext = file.filename.split('.').pop()?.toLowerCase()
  const isVideo = ['mkv','mp4','avi','mov','m4v','webm'].includes(ext || '')

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex items-center gap-3 p-3 rounded-xl mb-2 group"
      style={{ background: 'var(--bg2)', border: '1px solid var(--border2)' }}>
      {/* File type icon */}
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: isVideo ? 'rgba(201,168,76,0.08)' : 'var(--bg3)', border: '1px solid var(--border2)' }}>
        <span style={{ fontSize: 16 }}>{isVideo ? '🎬' : '📄'}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate" style={{ color: 'var(--cream)' }}>
          {file.filename.replace(/\.[^.]+$/, '')}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[9px]" style={{ color: 'var(--muted)' }}>{fmtSize(file.size)}</span>
          <span className="text-[9px]" style={{ color: 'var(--muted)', opacity: 0.4 }}>·</span>
          <span className="text-[9px]" style={{ color: 'var(--muted)' }}>{fmtDate(file.modified)}</span>
          <span className="text-[8px] px-1.5 py-0.5 rounded uppercase font-bold"
            style={{ background: 'var(--subtle)', color: 'var(--muted)' }}>{ext}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isVideo && (
          <button onClick={() => onPlay(file)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold hover:opacity-80 transition-opacity"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
            <Play size={10} fill="currentColor" /> Play
          </button>
        )}
        <button onClick={() => onDelete(file.filename)} disabled={deleting === file.filename}
          className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
          style={{ color: '#e74c3c', opacity: deleting === file.filename ? 0.4 : 1 }}>
          {deleting === file.filename ? <Loader size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
      </div>
    </motion.div>
  )
}

export default function DownloadsPage() {
  const { setPlayingItem } = useStore()
  const qc = useQueryClient()
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['downloads'],
    queryFn: () => api.listDownloads(),
    refetchInterval: (data: any) => {
      const hasActive = (data?.active || []).some((d: any) => d.status === 'downloading')
      return hasActive ? 2000 : 30_000
    },
    staleTime: 2_000,
  })

  const d = data as any
  const active: any[] = (d?.active || []).filter((a: any) => a.status === 'downloading' || a.status === 'error')
  const files: any[] = d?.files || []
  const totalSize = files.reduce((s, f) => s + (f.size || 0), 0)

  const doDelete = async (filename: string) => {
    setDeleting(filename)
    try {
      await api.deleteDownload(filename)
      qc.invalidateQueries({ queryKey: ['downloads'] })
      toast.info('Deleted')
    } catch { toast.error('Delete failed') }
    setDeleting(null)
    setConfirmDelete(null)
  }

  const playFile = (file: any) => {
    setPlayingItem({
      id: file.filename,
      title: file.filename.replace(/\.[^.]+$/, ''),
      streamUrl: `/proxy/download?file=${encodeURIComponent(file.filename)}`,
      hlsUrl: null,
      startTime: 0,
    } as any)
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', padding: '24px var(--pad) 48px' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl tracking-[0.4em] uppercase mb-0.5"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>Downloads</h1>
          <p className="text-[10px]" style={{ color: 'var(--muted)', opacity: 0.4 }}>
            {files.length} files · {fmtSize(totalSize)} on disk
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{ background: 'var(--subtle)', border: '1px solid var(--border2)' }}>
          <HardDrive size={12} style={{ color: 'var(--muted)' }} />
          <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{fmtSize(totalSize)}</span>
        </div>
      </div>

      {/* Active downloads */}
      {active.length > 0 && (
        <div className="mb-6">
          <p className="text-[8px] font-bold tracking-[0.3em] uppercase mb-3" style={{ color: 'var(--accent)', opacity: 0.4 }}>
            Downloading ({active.length})
          </p>
          {active.map(dl => <ActiveDownload key={dl.id} dl={dl} />)}
        </div>
      )}

      {/* File list */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader size={20} className="animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      )}

      {!isLoading && files.length === 0 && active.length === 0 && (
        <div className="text-center py-20" style={{ color: 'var(--muted)' }}>
          <Download size={32} className="mx-auto mb-3" style={{ opacity: 0.2 }} />
          <p className="text-sm mb-1" style={{ opacity: 0.5 }}>No downloads yet</p>
          <p className="text-xs" style={{ opacity: 0.3 }}>Tap ⬇ in any movie or episode to download for offline viewing</p>
        </div>
      )}

      {files.length > 0 && (
        <>
          <p className="text-[8px] font-bold tracking-[0.3em] uppercase mb-3" style={{ color: 'var(--accent)', opacity: 0.4 }}>
            Downloaded ({files.length})
          </p>
          <AnimatePresence>
            {files
              .sort((a, b) => b.modified - a.modified)
              .map(f => (
                <FileRow key={f.filename} file={f}
                  onPlay={playFile}
                  onDelete={(name: string) => setConfirmDelete(name)}
                  deleting={deleting}
                />
              ))
            }
          </AnimatePresence>
        </>
      )}

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center pb-8 px-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-sm rounded-2xl p-5"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--cream)' }}>Delete file?</p>
            <p className="text-xs mb-4 truncate" style={{ color: 'var(--muted)' }}>{confirmDelete}</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-full text-sm hover:opacity-70"
                style={{ background: 'var(--subtle)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>
                Cancel
              </button>
              <button onClick={() => doDelete(confirmDelete)}
                className="flex-1 py-2.5 rounded-full text-sm font-bold hover:opacity-80"
                style={{ background: 'rgba(231,76,60,0.1)', color: '#e74c3c', border: '1px solid rgba(231,76,60,0.2)' }}>
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
