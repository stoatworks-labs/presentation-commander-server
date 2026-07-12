import { useEffect, useState } from 'react'
import type { ClientNode, MatrixOutput, PresenterNote, Source } from '../../shared/types'
import './App.css'
import SourcePool from './components/SourcePool'
import Viewer from './components/Viewer'
import MatrixInspector from './components/MatrixInspector'
import ControlDeck from './components/ControlDeck'

interface MatrixState {
  sources: Source[]
  outputs: MatrixOutput[]
  clients: ClientNode[]
  notes: Record<string, PresenterNote[]>
}

function App(): React.JSX.Element {
  const [state, setState] = useState<MatrixState | null>(null)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [activeClientId, setActiveClientId] = useState<string | null>(null)

  useEffect(() => {
    window.api.matrix.getState().then((initial: MatrixState) => {
      setState(initial)
      setActiveClientId(initial.clients[0]?.id ?? null)
    })
    return window.api.matrix.onStateChanged((next) => setState(next as MatrixState))
  }, [])

  if (!state) {
    return (
      <div className="app-shell loading">
        <span>Connecting to Orchestrator…</span>
      </div>
    )
  }

  const activeSource = state.sources.find((s) => s.id === selectedSourceId) ?? null

  return (
    <div className="app-shell">
      <div className="app-titlebar">LiveMaster Orchestrator</div>
      <div className="app-grid">
        <SourcePool
          sources={state.sources}
          selectedId={selectedSourceId}
          onSelect={setSelectedSourceId}
        />
        <Viewer activeSource={activeSource} />
        <MatrixInspector
          outputs={state.outputs}
          sources={state.sources}
          onRoute={(outputId, sourceId) => window.api.matrix.route(outputId, sourceId)}
        />
        <ControlDeck
          clients={state.clients}
          notes={state.notes}
          activeClientId={activeClientId}
          onSelectClient={setActiveClientId}
        />
      </div>
    </div>
  )
}

export default App
