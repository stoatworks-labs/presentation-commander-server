import { useRef, useState } from 'react'
import type { Scene, SceneLayer, Source } from '../../../shared/types'

interface Props {
  scene: Scene | null
  sources: Source[]
  broadcastMessage: string | null
  onLayerChange: (layerId: string, patch: Partial<Omit<SceneLayer, 'id' | 'sourceId'>>) => void
  onLayerFront: (layerId: string) => void
  onLayerRemove: (layerId: string) => void
}

type DragMode = 'move' | 'resize'

interface DragState {
  layerId: string
  mode: DragMode
  startClientX: number
  startClientY: number
  origin: Pick<SceneLayer, 'x' | 'y' | 'width' | 'height'>
}

const MIN_SIZE = 8

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function Viewer({
  scene,
  sources,
  broadcastMessage,
  onLayerChange,
  onLayerFront,
  onLayerRemove
}: Props): React.JSX.Element {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [preview, setPreview] = useState<{ layerId: string; patch: Partial<SceneLayer> } | null>(
    null
  )

  const sourceName = (id: string): string =>
    sources.find((s) => s.id === id)?.name ?? 'Unknown Source'

  const beginDrag = (e: React.MouseEvent, layer: SceneLayer, mode: DragMode): void => {
    e.stopPropagation()
    onLayerFront(layer.id)
    const state: DragState = {
      layerId: layer.id,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origin: { x: layer.x, y: layer.y, width: layer.width, height: layer.height }
    }
    setDrag(state)

    const canvasRect = canvasRef.current?.getBoundingClientRect()

    const handleMove = (moveEvent: MouseEvent): void => {
      if (!canvasRect) return
      const dxPct = ((moveEvent.clientX - state.startClientX) / canvasRect.width) * 100
      const dyPct = ((moveEvent.clientY - state.startClientY) / canvasRect.height) * 100

      if (state.mode === 'move') {
        const x = clamp(state.origin.x + dxPct, 0, 100 - state.origin.width)
        const y = clamp(state.origin.y + dyPct, 0, 100 - state.origin.height)
        setPreview({ layerId: state.layerId, patch: { x, y } })
      } else {
        const width = clamp(state.origin.width + dxPct, MIN_SIZE, 100 - state.origin.x)
        const height = clamp(state.origin.height + dyPct, MIN_SIZE, 100 - state.origin.y)
        setPreview({ layerId: state.layerId, patch: { width, height } })
      }
    }

    const handleUp = (): void => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      setPreview((current) => {
        if (current && current.layerId === state.layerId) {
          onLayerChange(state.layerId, current.patch)
        }
        return null
      })
      setDrag(null)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  return (
    <div className="pane viewer">
      <div className="panel-heading">{scene ? `Compositor — ${scene.name}` : 'Compositor'}</div>
      {broadcastMessage && <div className="broadcast-banner">{broadcastMessage}</div>}
      <div className="viewer-canvas" ref={canvasRef}>
        {!scene && <div className="viewer-placeholder dim">No Scene Selected</div>}
        {scene?.layers.length === 0 && (
          <div className="viewer-placeholder dim">
            Empty Scene — double-click a source to add it
          </div>
        )}
        {scene?.layers.map((layer) => {
          const live =
            preview && preview.layerId === layer.id ? { ...layer, ...preview.patch } : layer
          return (
            <div
              key={layer.id}
              className={`scene-layer ${drag?.layerId === layer.id ? 'dragging' : ''} ${live.visible ? '' : 'hidden-layer'}`}
              style={{
                left: `${live.x}%`,
                top: `${live.y}%`,
                width: `${live.width}%`,
                height: `${live.height}%`
              }}
              onMouseDown={(e) => beginDrag(e, layer, 'move')}
            >
              <div className="scene-layer-header">
                <span className="scene-layer-name">{sourceName(layer.sourceId)}</span>
                <div className="row-actions">
                  <button
                    className="icon-btn"
                    title={layer.visible ? 'Hide' : 'Show'}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => onLayerChange(layer.id, { visible: !layer.visible })}
                  >
                    {layer.visible ? '👁' : '⊘'}
                  </button>
                  <button
                    className="icon-btn"
                    title="Remove from scene"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => onLayerRemove(layer.id)}
                  >
                    ×
                  </button>
                </div>
              </div>
              <div
                className="scene-layer-resize"
                onMouseDown={(e) => beginDrag(e, layer, 'resize')}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Viewer
