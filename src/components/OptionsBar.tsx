interface Props {
  count: number
  onCountChange: (n: number) => void
  varName: string
  onVarNameChange: (s: string) => void
  disabled: boolean
}

export default function OptionsBar({ count, onCountChange, varName, onVarNameChange, disabled }: Props) {
  return (
    <div style={styles.row}>
      <label style={styles.label}>Fixtures</label>
      <input
        type="number"
        style={styles.countInput}
        value={count}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (n >= 1 && n <= 5) onCountChange(n)
        }}
        min={1}
        max={5}
        disabled={disabled}
      />

      <label style={{ ...styles.label, marginLeft: '20px' }}>Variable name</label>
      <input
        type="text"
        style={styles.varInput}
        value={varName}
        onChange={(e) => onVarNameChange(e.target.value)}
        placeholder="auto (from schema)"
        spellCheck={false}
        disabled={disabled}
      />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 0',
    gap: '8px',
    flexWrap: 'wrap',
    borderBottom: '1px solid #e5e7eb',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#374151',
    whiteSpace: 'nowrap',
  },
  countInput: {
    width: '52px',
    padding: '4px 8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    textAlign: 'center',
  },
  varInput: {
    width: '180px',
    padding: '4px 10px',
    fontSize: '14px',
    fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", monospace',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
  },
}
