import type { Source } from '../../../shared/types'

interface Props {
  activeSource: Source | null
}

function Viewer({ activeSource }: Props): React.JSX.Element {
  return (
    <div className="pane viewer">
      <div className="panel-heading">Viewer</div>
      <div className="viewer-canvas">
        {activeSource ? (
          <div className="viewer-placeholder">{activeSource.name}</div>
        ) : (
          <div className="viewer-placeholder dim">No Source Selected</div>
        )}
      </div>
      <div className="transport">
        <button className="transport-btn">◀ Previous</button>
        <button className="transport-btn">Next ▶</button>
      </div>
    </div>
  )
}

export default Viewer
