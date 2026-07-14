import { useEffect, useRef } from 'react'
import type {
  ClientNode,
  MatrixOutput,
  PresenterNote,
  Scene,
  SceneLayer,
  Source
} from '../../../shared/types'
import { isLiveNdiSource, packFrame } from '../ndiFrames'

interface Props {
  outputs: MatrixOutput[]
  scenes: Scene[]
  sources: Source[]
  clients: ClientNode[]
  notes: Record<string, PresenterNote[]>
  activeSlideIndex: Record<string, number>
  active: boolean
}

const OUTPUT_WIDTH = 1920
const OUTPUT_HEIGHT = 1080

/** Resolves a Matrix Inspector routing target to the layers it should render:
 *  a Scene composites all its visible layers, a bare Source is one full-frame layer. */
function resolveLayers(routedId: string | null, scenes: Scene[], sources: Source[]): SceneLayer[] {
  if (!routedId) return []
  const scene = scenes.find((s) => s.id === routedId)
  if (scene) return scene.layers.filter((l) => l.visible)
  const source = sources.find((s) => s.id === routedId)
  if (!source) return []
  return [{ id: 'single', sourceId: source.id, x: 0, y: 0, width: 100, height: 100, visible: true }]
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

/**
 * Always-mounted, invisible: composites whatever is routed to the first
 * `stage-display` output (the "Confidence Monitor") into one 1920x1080
 * frame — live NDI video layers plus live "Presenter Notes" text layers —
 * and pushes it out as real NDI via ndiOutputSenderService whenever the
 * output is toggled on. Renders nothing; the canvas it draws to is never
 * attached to the DOM.
 */
function StageDisplayCompositor({
  outputs,
  scenes,
  sources,
  clients,
  notes,
  activeSlideIndex,
  active
}: Props): null {
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const scratchCanvases = useRef(new Map<string, HTMLCanvasElement>())

  const stageOutput = outputs.find((o) => o.kind === 'stage-display') ?? null
  const layers = resolveLayers(stageOutput?.routedSourceId ?? null, scenes, sources)
  const sourceById = (id: string): Source | undefined => sources.find((s) => s.id === id)

  const liveSourceIds = layers
    .map((l) => sourceById(l.sourceId))
    .filter(isLiveNdiSource)
    .map((s) => s.id)
  const liveSourceKey = [...new Set(liveSourceIds)].sort().join(',')

  const redraw = (): void => {
    const canvas = canvasRef.current
    canvas.width = OUTPUT_WIDTH
    canvas.height = OUTPUT_HEIGHT
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT)

    for (const layer of layers) {
      const source = sourceById(layer.sourceId)
      if (!source) continue
      const px = (layer.x / 100) * OUTPUT_WIDTH
      const py = (layer.y / 100) * OUTPUT_HEIGHT
      const pw = (layer.width / 100) * OUTPUT_WIDTH
      const ph = (layer.height / 100) * OUTPUT_HEIGHT

      if (source.kind === 'ndi') {
        const scratch = scratchCanvases.current.get(source.id)
        if (scratch) ctx.drawImage(scratch, px, py, pw, ph)
      } else if (source.kind === 'notes') {
        const clientNotes = notes[source.clientId] ?? []
        const currentSlide = activeSlideIndex[source.clientId]
        const note = clientNotes.find((n) => n.slideIndex === currentSlide)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
        ctx.fillRect(px, py, pw, ph)
        const fontSize = Math.max(16, Math.min(48, ph / 6))
        ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace`
        ctx.fillStyle = '#fff'
        ctx.textBaseline = 'top'
        const padding = fontSize * 0.6
        const text = note?.text || 'No notes for this slide.'
        const lines = wrapText(ctx, text, pw - padding * 2)
        lines.forEach((line, i) => {
          ctx.fillText(line, px + padding, py + padding + i * fontSize * 1.3)
        })
      }
      // 'web' layers have no offscreen-renderable content yet (matches the
      // Viewer's own live preview, which is also NDI-only) — left blank.
    }

    if (!active) return
    const imageData = ctx.getImageData(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT)
    window.api.ndiOutput.pushFrame(
      new Uint8Array(imageData.data.buffer),
      OUTPUT_WIDTH,
      OUTPUT_HEIGHT
    )
  }

  useEffect(() => {
    const ids = liveSourceKey ? liveSourceKey.split(',') : []
    for (const id of ids) {
      const source = sourceById(id)
      if (isLiveNdiSource(source)) window.api.ndiPreview.start(id, source.machineName, source.port)
    }
    return () => {
      for (const id of ids) window.api.ndiPreview.stop(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveSourceKey])

  useEffect(() => {
    return window.api.ndiPreview.onFrame((sourceId, frame) => {
      if (!liveSourceKey.split(',').includes(sourceId)) return
      let scratch = scratchCanvases.current.get(sourceId)
      if (!scratch) {
        scratch = document.createElement('canvas')
        scratchCanvases.current.set(sourceId, scratch)
      }
      if (scratch.width !== frame.width) scratch.width = frame.width
      if (scratch.height !== frame.height) scratch.height = frame.height
      scratch.getContext('2d')?.putImageData(packFrame(frame), 0, 0)
      redraw()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveSourceKey])

  // Redraw immediately on any state that affects composited content, and a
  // ~1s fallback so notes-only/blank scenes still push at least a keep-alive
  // frame (video-driven redraws above happen far more often than this).
  useEffect(() => {
    redraw()
    const interval = setInterval(redraw, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageOutput?.routedSourceId, scenes, sources, clients, notes, activeSlideIndex, active])

  return null
}

export default StageDisplayCompositor
