import type { Source } from '../../../shared/types'

interface Props {
  sources: Source[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function SourcePool({ sources, selectedId, onSelect }: Props): React.JSX.Element {
  return (
    <div className="pane source-pool">
      <div className="panel-heading">Source Pool</div>
      <ul className="source-list">
        {sources.map((source) => (
          <li
            key={source.id}
            className={`source-row ${selectedId === source.id ? 'selected' : ''}`}
            onClick={() => onSelect(source.id)}
          >
            <span
              className={`status-dot ${source.kind === 'web' || source.connected ? 'online' : 'offline'}`}
            />
            <div className="source-meta">
              <div className="source-name">{source.name}</div>
              <div className="source-sub">
                {source.kind === 'ndi' ? `NDI · ${source.machineName}` : 'Web Source'}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default SourcePool
