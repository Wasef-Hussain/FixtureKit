import type { Mode } from '../hooks/useFixtureGen'

interface Props {
  value: string
  onChange: (s: string) => void
  mode: Mode
  onModeChange: (m: Mode) => void
  error: string | null
  loading: boolean
  disabled: boolean
}

const PLACEHOLDER: Record<Mode, string> = {
  ts: 'Paste TypeScript interface or type alias…\n\ninterface User {\n  id: string\n  name: string\n  email: string\n  age: number\n  isActive: boolean\n}',
  zod: 'Paste Zod schema…\n\nz.object({\n  name: z.string(),\n  age: z.number(),\n  email: z.string().optional(),\n})',
}

export default function InputPane({ value, onChange, mode, onModeChange, error, loading, disabled }: Props) {
  return (
    <div style={styles.wrapper}>
      {/* Mode toggle */}
      <div style={styles.toggleRow}>
        <button
          style={{ ...styles.toggleBtn, ...(mode === 'ts' ? styles.toggleBtnActive : {}) }}
          onClick={() => onModeChange('ts')}
          disabled={disabled}
        >
          TypeScript Interface
        </button>
        <button
          style={{ ...styles.toggleBtn, ...(mode === 'zod' ? styles.toggleBtnActive : {}) }}
          onClick={() => onModeChange('zod')}
          disabled={disabled}
        >
          Zod Schema
        </button>
      </div>

      {/* Textarea */}
      <textarea
        style={styles.textarea}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={PLACEHOLDER[mode]}
        spellCheck={false}
        disabled={disabled}
      />

      {/* Loading indicator */}
      {loading && (
        <div style={styles.loadingBanner}>Loading parser…</div>
      )}

      {/* Error banner */}
      {error && !loading && (
        <div style={styles.errorBanner}>
          <span style={styles.errorIcon}>⚠</span>
          {error}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    height: '100%',
  },
  toggleRow: {
    display: 'flex',
    gap: '0',
    borderRadius: '6px',
    overflow: 'hidden',
    border: '1px solid #d1d5db',
    width: 'fit-content',
  },
  toggleBtn: {
    padding: '6px 16px',
    border: 'none',
    background: '#f9fafb',
    color: '#374151',
    fontSize: '13px',
    fontFamily: 'inherit',
    cursor: 'pointer',
    outline: 'none',
  },
  toggleBtnActive: {
    background: '#1f2937',
    color: '#ffffff',
  },
  textarea: {
    flex: 1,
    padding: '16px',
    fontSize: '14px',
    fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", monospace',
    lineHeight: 1.7,
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    resize: 'none',
    outline: 'none',
    background: '#fafafa',
    color: '#111827',
  },
  loadingBanner: {
    padding: '8px 14px',
    borderRadius: '6px',
    fontSize: '13px',
    background: '#eff6ff',
    color: '#1e40af',
    border: '1px solid #bfdbfe',
  },
  errorBanner: {
    padding: '10px 14px',
    borderRadius: '6px',
    fontSize: '13px',
    background: '#fef2f2',
    color: '#991b1b',
    border: '1px solid #fecaca',
    lineHeight: 1.5,
  },
  errorIcon: {
    marginRight: '8px',
  },
}
