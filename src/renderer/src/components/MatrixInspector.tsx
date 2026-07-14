import type { MatrixOutput, Scene, Source } from '../../../shared/types'
import NdiOutputControl from './NdiOutputControl'

interface Props {
  outputs: MatrixOutput[]
  sources: Source[]
  scenes: Scene[]
  ndiOutputActive: boolean
  onToggleNdiOutput: () => void
  onRoute: (outputId: string, routedId: string | null) => void
}

const kindLabel: Record<MatrixOutput['kind'], string> = {
  decklink: 'DeckLink',
  stream: 'Stream',
  'stage-display': 'Stage Display'
}

function MatrixInspector({
  outputs,
  sources,
  scenes,
  ndiOutputActive,
  onToggleNdiOutput,
  onRoute
}: Props): React.JSX.Element {
  return (
    <div className="pane matrix-inspector">
      <div className="panel-heading">Matrix Inspector</div>
      <ul className="output-list">
        {outputs.map((output) => (
          <li key={output.id} className="output-row">
            <div className="output-meta">
              <div className="output-name">{output.name}</div>
              <div className="output-sub">{kindLabel[output.kind]}</div>
            </div>
            <select
              value={output.routedSourceId ?? ''}
              onChange={(e) => onRoute(output.id, e.target.value || null)}
            >
              <option value="">— Unrouted —</option>
              <optgroup label="Scenes">
                {scenes.map((scene) => (
                  <option key={scene.id} value={scene.id}>
                    {scene.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Sources">
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </optgroup>
            </select>
            {output.kind === 'stage-display' && (
              <NdiOutputControl
                disabled={!output.routedSourceId}
                active={ndiOutputActive}
                onToggle={onToggleNdiOutput}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default MatrixInspector
