import type { ClientNode, PresenterNote } from '../../../shared/types'

interface Props {
  clients: ClientNode[]
  notes: Record<string, PresenterNote[]>
  activeClientId: string | null
  onSelectClient: (id: string) => void
}

function ControlDeck({ clients, notes, activeClientId, onSelectClient }: Props): React.JSX.Element {
  const activeNotes = activeClientId ? (notes[activeClientId] ?? []) : []
  const currentNote = activeNotes[activeNotes.length - 1]

  return (
    <div className="pane control-deck">
      <div className="control-deck-timeline">
        <div className="panel-heading">Control Deck</div>
        <div className="client-tabs">
          {clients.map((client) => (
            <button
              key={client.id}
              className={`client-tab ${activeClientId === client.id ? 'selected' : ''}`}
              onClick={() => onSelectClient(client.id)}
            >
              <span className={`status-dot ${client.online ? 'online' : 'offline'}`} />
              {client.name} · {client.app}
            </button>
          ))}
        </div>
        <div className="slide-timeline">
          {activeNotes.map((note) => (
            <div key={note.slideIndex} className="slide-chip">
              {note.slideIndex}
            </div>
          ))}
        </div>
      </div>
      <div className="notes-panel">
        <div className="panel-heading">Presenter Notes</div>
        <div className="notes-text">
          {currentNote ? currentNote.text : 'No notes for this slide.'}
        </div>
      </div>
    </div>
  )
}

export default ControlDeck
