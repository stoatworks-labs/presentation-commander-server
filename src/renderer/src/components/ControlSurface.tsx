import { useState } from 'react'
import type { AutomationCommand, MatrixOutput, Scene } from '../../../shared/types'

interface Props {
  scenes: Scene[]
  programOutput: MatrixOutput | null
  activeClientId: string | null
  onExecute: (command: AutomationCommand) => void
}

function ControlSurface({
  scenes,
  programOutput,
  activeClientId,
  onExecute
}: Props): React.JSX.Element {
  const [message, setMessage] = useState('')

  const sendNote = (): void => {
    if (!message.trim()) return
    onExecute({ type: 'send-note', message: message.trim() })
    setMessage('')
  }

  return (
    <div className="pane control-surface">
      <div className="panel-heading">Control Surface</div>
      <div className="control-surface-body">
        <div className="button-grid">
          {scenes.map((scene) => (
            <button
              key={scene.id}
              className={`osc-btn ${programOutput?.routedSourceId === scene.id ? 'active' : ''}`}
              disabled={!programOutput}
              onClick={() =>
                programOutput &&
                onExecute({ type: 'recall-preset', outputId: programOutput.id, sceneId: scene.id })
              }
            >
              {scene.name}
            </button>
          ))}
          <button
            className={`osc-btn danger ${programOutput?.routedSourceId === null ? 'active' : ''}`}
            disabled={!programOutput}
            onClick={() =>
              programOutput && onExecute({ type: 'blackout', outputId: programOutput.id })
            }
          >
            Blackout
          </button>
        </div>

        <div className="transport-row">
          <button
            className="osc-btn"
            disabled={!activeClientId}
            onClick={() =>
              activeClientId && onExecute({ type: 'previous-slide', clientId: activeClientId })
            }
          >
            ◀ Prev Slide
          </button>
          <button
            className="osc-btn"
            disabled={!activeClientId}
            onClick={() =>
              activeClientId && onExecute({ type: 'next-slide', clientId: activeClientId })
            }
          >
            Next Slide ▶
          </button>
        </div>

        <div className="send-note-row">
          <input
            placeholder="Message to stage display…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendNote()}
          />
          <button className="osc-btn" onClick={sendNote}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

export default ControlSurface
