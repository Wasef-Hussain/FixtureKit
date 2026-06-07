import { theme } from '../styles/theme'

interface Props {
  count: number
  onCountChange: (n: number) => void
  varName: string
  onVarNameChange: (s: string) => void
  isAdversarial: boolean
  onAdversarialChange: (b: boolean) => void
  disabled: boolean
}

const { font, color, radius, shadow } = theme

export default function OptionsBar({
  count,
  onCountChange,
  varName,
  onVarNameChange,
  isAdversarial,
  onAdversarialChange,
  disabled,
}: Props) {
  return (
    <div style={styles.card}>
      <div style={styles.group}>
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
      </div>

      <div style={styles.divider} />

      <div style={styles.group}>
        <label style={styles.label}>Variable name</label>
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

      <div style={styles.divider} />

      <div style={styles.group}>
        <div style={styles.adversarialLabel} title="Inject XSS, SQLi, and boundary values to stress-test your code">
          <button
            type="button"
            role="switch"
            aria-checked={isAdversarial}
            style={{
              ...styles.switch,
              ...(isAdversarial ? styles.switchOn : {}),
            }}
            onClick={() => !disabled && onAdversarialChange(!isAdversarial)}
            disabled={disabled}
          >
            <span style={{
              ...styles.switchThumb,
              ...(isAdversarial ? styles.switchThumbOn : {}),
            }} />
          </button>
          <span>
            <span style={styles.adversarialTitle}>Adversarial mode</span>
            <span style={styles.adversarialHint}>XSS · SQLi · edge cases</span>
          </span>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
    padding: '12px 16px',
    marginBottom: '16px',
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.lg,
    boxShadow: shadow.card,
  },
  group: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  divider: {
    width: '1px',
    height: '28px',
    background: color.border,
    flexShrink: 0,
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: color.textMuted,
    whiteSpace: 'nowrap',
    fontFamily: font.sans,
  },
  countInput: {
    width: '52px',
    padding: '6px 8px',
    fontSize: '14px',
    fontFamily: font.mono,
    fontWeight: 500,
    border: `1px solid ${color.border}`,
    borderRadius: radius.sm,
    outline: 'none',
    textAlign: 'center',
    background: color.surfaceMuted,
    color: color.text,
  },
  varInput: {
    width: '180px',
    padding: '6px 12px',
    fontSize: '13px',
    fontFamily: font.mono,
    border: `1px solid ${color.border}`,
    borderRadius: radius.sm,
    outline: 'none',
    background: color.surfaceMuted,
    color: color.text,
  },
  adversarialLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    padding: 0,
    fontFamily: font.sans,
  },
  adversarialTitle: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: color.text,
    lineHeight: 1.3,
  },
  adversarialHint: {
    display: 'block',
    fontSize: '10px',
    fontWeight: 500,
    color: color.textSubtle,
    lineHeight: 1.3,
  },
  switch: {
    position: 'relative',
    width: '40px',
    height: '22px',
    borderRadius: radius.pill,
    border: 'none',
    background: color.borderStrong,
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
    outline: 'none',
  },
  switchOn: {
    background: color.accent,
  },
  switchThumb: {
    position: 'absolute',
    top: '3px',
    left: '3px',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    background: '#ffffff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    transition: 'transform 0.15s',
  },
  switchThumbOn: {
    transform: 'translateX(18px)',
  },
}
