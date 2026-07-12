import { useState } from 'react'
import type { Scene } from '../../../shared/types'

interface Props {
  scenes: Scene[]
  editingSceneId: string | null
  onSelect: (id: string) => void
  onAdd: (name: string) => void
  onRename: (id: string, name: string) => void
  onRemove: (id: string) => void
}

function Scenes({
  scenes,
  editingSceneId,
  onSelect,
  onAdd,
  onRename,
  onRemove
}: Props): React.JSX.Element {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const submitAdd = (): void => {
    if (!newName.trim()) return
    onAdd(newName.trim())
    setNewName('')
    setAdding(false)
  }

  const submitRename = (id: string): void => {
    if (editName.trim()) onRename(id, editName.trim())
    setEditingId(null)
  }

  return (
    <div className="pane scenes-panel">
      <div className="panel-heading with-action">
        <span>Scenes</span>
        <button className="icon-btn" title="Add scene" onClick={() => setAdding((v) => !v)}>
          +
        </button>
      </div>

      {adding && (
        <div className="inline-form">
          <input
            autoFocus
            placeholder="Scene name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitAdd()}
          />
          <div className="inline-form-actions">
            <button className="transport-btn" onClick={submitAdd}>
              Add
            </button>
            <button className="transport-btn ghost" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <ul className="scene-list">
        {scenes.map((scene) => (
          <li
            key={scene.id}
            className={`scene-row ${editingSceneId === scene.id ? 'selected' : ''}`}
            onClick={() => onSelect(scene.id)}
          >
            {editingId === scene.id ? (
              <input
                autoFocus
                className="inline-edit-input"
                value={editName}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitRename(scene.id)}
                onBlur={() => submitRename(scene.id)}
              />
            ) : (
              <div className="scene-meta">
                <div className="scene-name">{scene.name}</div>
                <div className="scene-sub">
                  {scene.layers.length} layer{scene.layers.length === 1 ? '' : 's'}
                </div>
              </div>
            )}
            <div className="row-actions">
              <button
                className="icon-btn"
                title="Rename"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingId(scene.id)
                  setEditName(scene.name)
                }}
              >
                ✎
              </button>
              <button
                className="icon-btn"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm(`Delete scene “${scene.name}”?`)) onRemove(scene.id)
                }}
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Scenes
