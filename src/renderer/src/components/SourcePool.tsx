import { useState } from 'react'
import type { ClientNode, DiscoveredNdiSource, NewSourceInput, Source } from '../../../shared/types'

interface Props {
  sources: Source[]
  discoveredSources: DiscoveredNdiSource[]
  clients: ClientNode[]
  selectedId: string | null
  editingSceneName: string | null
  onSelect: (id: string) => void
  onAddToScene: (sourceId: string) => void
  onAdd: (input: NewSourceInput) => void
  onUpdate: (id: string, patch: Partial<Omit<Source, 'kind' | 'id'>>) => void
  onRemove: (id: string) => void
}

function emptyForm(): NewSourceInput {
  return { kind: 'ndi', name: '', machineName: '' }
}

function sourceSubtitle(source: Source, clients: ClientNode[]): string {
  if (source.kind === 'ndi') return `NDI · ${source.machineName}`
  if (source.kind === 'web') return 'Web Source'
  const client = clients.find((c) => c.id === source.clientId)
  return client ? `Presenter Notes · ${client.name}` : 'Presenter Notes · disconnected'
}

function isSourceOnline(source: Source, clients: ClientNode[]): boolean {
  if (source.kind === 'web') return true
  if (source.kind === 'notes') return clients.some((c) => c.id === source.clientId && c.online)
  return source.connected
}

function SourcePool({
  sources,
  discoveredSources,
  clients,
  selectedId,
  editingSceneName,
  onSelect,
  onAddToScene,
  onAdd,
  onUpdate,
  onRemove
}: Props): React.JSX.Element {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<NewSourceInput>(emptyForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const submitAdd = (): void => {
    if (!form.name.trim()) return
    onAdd(form)
    setForm(emptyForm())
    setAdding(false)
  }

  const startEdit = (source: Source): void => {
    setEditingId(source.id)
    setEditName(source.name)
  }

  const submitEdit = (id: string): void => {
    if (editName.trim()) onUpdate(id, { name: editName.trim() })
    setEditingId(null)
  }

  return (
    <div className="pane source-pool">
      <div className="panel-heading with-action">
        <span>
          Source Pool{editingSceneName ? ` · double-click to add to “${editingSceneName}”` : ''}
        </span>
        <button className="icon-btn" title="Add source" onClick={() => setAdding((v) => !v)}>
          +
        </button>
      </div>

      {adding && (
        <div className="inline-form">
          <select
            value={form.kind}
            onChange={(e) => {
              const kind = e.target.value as 'ndi' | 'web' | 'notes'
              setForm(
                kind === 'ndi'
                  ? { kind: 'ndi', name: form.name, machineName: '' }
                  : kind === 'web'
                    ? { kind: 'web', name: form.name, url: '', transparent: true }
                    : { kind: 'notes', name: form.name, clientId: clients[0]?.id ?? '' }
              )
            }}
          >
            <option value="ndi">NDI</option>
            <option value="web">Web</option>
            <option value="notes">Presenter Notes</option>
          </select>
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          {form.kind === 'ndi' ? (
            <>
              <select
                className="discovered-select"
                defaultValue=""
                onChange={(e) => {
                  const found = discoveredSources.find((d) => d.id === e.target.value)
                  if (found)
                    setForm({
                      kind: 'ndi',
                      name: found.name,
                      machineName: found.host,
                      port: found.port
                    })
                }}
              >
                <option value="" disabled>
                  {discoveredSources.length > 0
                    ? `${discoveredSources.length} found on network…`
                    : 'No NDI sources found on network yet'}
                </option>
                {discoveredSources.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.host}:{d.port})
                  </option>
                ))}
              </select>
              <input
                placeholder="Machine name (or pick discovered above)"
                value={form.machineName}
                onChange={(e) => setForm({ ...form, machineName: e.target.value, port: undefined })}
              />
            </>
          ) : form.kind === 'web' ? (
            <>
              <input
                placeholder="URL"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={form.transparent}
                  onChange={(e) => setForm({ ...form, transparent: e.target.checked })}
                />
                Transparent
              </label>
            </>
          ) : (
            <select
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            >
              {clients.length === 0 && (
                <option value="" disabled>
                  No connected clients yet
                </option>
              )}
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.app})
                </option>
              ))}
            </select>
          )}
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

      <ul className="source-list">
        {sources.map((source) => (
          <li
            key={source.id}
            className={`source-row ${selectedId === source.id ? 'selected' : ''}`}
            onClick={() => onSelect(source.id)}
            onDoubleClick={() => onAddToScene(source.id)}
          >
            <span
              className={`status-dot ${isSourceOnline(source, clients) ? 'online' : 'offline'}`}
            />
            <div className="source-meta">
              {editingId === source.id ? (
                <input
                  autoFocus
                  className="inline-edit-input"
                  value={editName}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitEdit(source.id)}
                  onBlur={() => submitEdit(source.id)}
                />
              ) : (
                <>
                  <div className="source-name">{source.name}</div>
                  <div className="source-sub">{sourceSubtitle(source, clients)}</div>
                </>
              )}
            </div>
            <div className="row-actions">
              <button
                className="icon-btn"
                title="Rename"
                onClick={(e) => {
                  e.stopPropagation()
                  startEdit(source)
                }}
              >
                ✎
              </button>
              <button
                className="icon-btn"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm(`Delete “${source.name}”?`)) onRemove(source.id)
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

export default SourcePool
