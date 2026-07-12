import { useEffect, useState } from 'react'
import type {
  AutomationCommand,
  NewSourceInput,
  OrchestratorState,
  Source
} from '../../shared/types'
import './App.css'
import Scenes from './components/Scenes'
import SourcePool from './components/SourcePool'
import Viewer from './components/Viewer'
import MatrixInspector from './components/MatrixInspector'
import ControlDeck from './components/ControlDeck'
import ControlSurface from './components/ControlSurface'

function App(): React.JSX.Element {
  const [state, setState] = useState<OrchestratorState | null>(null)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const [activeClientId, setActiveClientId] = useState<string | null>(null)
  const [dismissedMessageAt, setDismissedMessageAt] = useState<number | null>(null)

  useEffect(() => {
    window.api.matrix.getState().then((initial) => {
      setState(initial)
      setEditingSceneId(initial.scenes[0]?.id ?? null)
      setActiveClientId(initial.clients[0]?.id ?? null)
    })
    return window.api.matrix.onStateChanged(setState)
  }, [])

  const broadcastSentAt = state?.broadcastMessage?.sentAt
  useEffect(() => {
    if (!broadcastSentAt) return
    const timer = setTimeout(() => setDismissedMessageAt(broadcastSentAt), 8000)
    return () => clearTimeout(timer)
  }, [broadcastSentAt])

  if (!state) {
    return (
      <div className="app-shell loading">
        <span>Connecting to Orchestrator…</span>
      </div>
    )
  }

  const editingScene = state.scenes.find((s) => s.id === editingSceneId) ?? null
  const programOutput =
    state.outputs.find((o) => o.kind === 'decklink' && o.name.toLowerCase().includes('program')) ??
    state.outputs[0] ??
    null

  const addSource = (input: NewSourceInput): void => {
    window.api.sources.add(input)
  }
  const updateSource = (id: string, patch: Partial<Omit<Source, 'kind' | 'id'>>): void => {
    window.api.sources.update(id, patch)
  }
  const removeSource = (id: string): void => {
    window.api.sources.remove(id)
  }
  const addToEditingScene = (sourceId: string): void => {
    if (editingSceneId) window.api.scenes.addLayer(editingSceneId, sourceId)
  }
  const execute = (command: AutomationCommand): void => {
    window.api.automation.execute(command)
  }

  return (
    <div className="app-shell">
      <div className="app-titlebar">LiveMaster Orchestrator</div>
      <div className="app-grid">
        <div className="left-column">
          <Scenes
            scenes={state.scenes}
            editingSceneId={editingSceneId}
            onSelect={setEditingSceneId}
            onAdd={(name) => window.api.scenes.add(name)}
            onRename={(id, name) => window.api.scenes.rename(id, name)}
            onRemove={(id) => window.api.scenes.remove(id)}
          />
          <SourcePool
            sources={state.sources}
            selectedId={selectedSourceId}
            editingSceneName={editingScene?.name ?? null}
            onSelect={setSelectedSourceId}
            onAddToScene={addToEditingScene}
            onAdd={addSource}
            onUpdate={updateSource}
            onRemove={removeSource}
          />
        </div>
        <Viewer
          scene={editingScene}
          sources={state.sources}
          broadcastMessage={
            state.broadcastMessage && state.broadcastMessage.sentAt !== dismissedMessageAt
              ? state.broadcastMessage.text
              : null
          }
          onLayerChange={(layerId, patch) =>
            editingSceneId && window.api.scenes.updateLayer(editingSceneId, layerId, patch)
          }
          onLayerFront={(layerId) =>
            editingSceneId && window.api.scenes.bringLayerToFront(editingSceneId, layerId)
          }
          onLayerRemove={(layerId) =>
            editingSceneId && window.api.scenes.removeLayer(editingSceneId, layerId)
          }
        />
        <MatrixInspector
          outputs={state.outputs}
          sources={state.sources}
          scenes={state.scenes}
          onRoute={(outputId, routedId) => window.api.matrix.route(outputId, routedId)}
        />
        <ControlDeck
          clients={state.clients}
          notes={state.notes}
          activeSlideIndex={state.activeSlideIndex}
          activeClientId={activeClientId}
          onSelectClient={setActiveClientId}
        />
        <ControlSurface
          scenes={state.scenes}
          programOutput={programOutput}
          activeClientId={activeClientId}
          onExecute={execute}
        />
      </div>
    </div>
  )
}

export default App
