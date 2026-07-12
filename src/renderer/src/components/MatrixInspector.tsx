import type { MatrixOutput, Source } from '../../../shared/types'

interface Props {
  outputs: MatrixOutput[]
  sources: Source[]
  onRoute: (outputId: string, sourceId: string | null) => void
}

const kindLabel: Record<MatrixOutput['kind'], string> = {
  decklink: 'DeckLink',
  stream: 'Stream',
  'stage-display': 'Stage Display'
}

function MatrixInspector({ outputs, sources, onRoute }: Props): React.JSX.Element {
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
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default MatrixInspector
