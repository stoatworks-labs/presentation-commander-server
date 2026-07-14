interface Props {
  disabled: boolean
  active: boolean
  onToggle: () => void
}

function NdiOutputControl({ disabled, active, onToggle }: Props): React.JSX.Element {
  return (
    <button
      className={`transport-btn ${active ? 'active' : ''}`}
      disabled={disabled}
      onClick={onToggle}
    >
      {active ? 'Stop NDI Output' : 'NDI Output'}
    </button>
  )
}

export default NdiOutputControl
