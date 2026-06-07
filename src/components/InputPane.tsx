import type { Mode } from '../hooks/useFixtureGen'
import { theme } from '../styles/theme'

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

const { font, color, radius } = theme

const EXAMPLES = {
  User: `interface User {\n  id: string\n  firstName: string\n  lastName: string\n  email: string\n  phone: string\n  role: "admin" | "editor" | "viewer"\n  isActive: boolean\n  createdAt: Date\n  address: {\n    street: string\n    city: string\n    country: string\n    zip: string\n  }\n}`,
  Product: `interface Product {\n  id: string\n  name: string\n  slug: string\n  description: string\n  price: number\n  currency: string\n  inStock: boolean\n  tags: string[]\n  imageUrl: string\n  createdAt: Date\n}`,
  Order: `interface Order {\n  id: string\n  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled"\n  customerId: string\n  total: number\n  currency: string\n  items: {\n    productId: string\n    quantity: number\n    unitPrice: number\n  }[]\n  createdAt: Date\n  updatedAt: Date\n}`
}

export default function InputPane({ value, onChange, mode, onModeChange, error, loading, disabled }: Props) {
  return (
    <div style={styles.wrapper}>
      <div style={styles.toggleRow} role="tablist" aria-label="Input type">
        <button
          role="tab"
          aria-selected={mode === 'ts'}
          style={{ ...styles.toggleBtn, ...(mode === 'ts' ? styles.toggleBtnActive : {}) }}
          onClick={() => onModeChange('ts')}
          disabled={disabled}
        >
          TypeScript
        </button>
        <button
          role="tab"
          aria-selected={mode === 'zod'}
          style={{ ...styles.toggleBtn, ...(mode === 'zod' ? styles.toggleBtnActive : {}) }}
          onClick={() => onModeChange('zod')}
          disabled={disabled}
        >
          Zod
        </button>
      </div>

      <div style={styles.examplesRow}>
        <span style={styles.examplesLabel}>Examples:</span>
        <button style={styles.exampleBtn} onClick={() => onChange(EXAMPLES.User)} disabled={disabled}>User</button>
        <button style={styles.exampleBtn} onClick={() => onChange(EXAMPLES.Product)} disabled={disabled}>Product</button>
        <button style={styles.exampleBtn} onClick={() => onChange(EXAMPLES.Order)} disabled={disabled}>Order</button>
      </div>

      <textarea
        style={styles.textarea}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={PLACEHOLDER[mode]}
        spellCheck={false}
        disabled={disabled}
      />

      {loading && (
        <div style={styles.loadingBanner}>
          <span style={styles.spinner} />
          Loading TypeScript parser…
        </div>
      )}

      {error && !loading && (
        <div style={styles.errorBanner}>
          <span style={styles.errorIcon}>!</span>
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
    minHeight: 0,
  },
  toggleRow: {
    display: 'flex',
    gap: '4px',
    padding: '3px',
    borderRadius: radius.md,
    background: color.surfaceMuted,
    border: `1px solid ${color.border}`,
    width: 'fit-content',
  },
  toggleBtn: {
    padding: '7px 16px',
    border: 'none',
    borderRadius: radius.sm,
    background: 'transparent',
    color: color.textMuted,
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: font.sans,
    cursor: 'pointer',
    outline: 'none',
  },
  toggleBtnActive: {
    background: color.surface,
    color: color.text,
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)',
  },
  textarea: {
    flex: 1,
    padding: '16px',
    fontSize: '13px',
    fontFamily: font.mono,
    lineHeight: 1.65,
    border: `1px solid ${color.border}`,
    borderRadius: radius.md,
    resize: 'none',
    outline: 'none',
    background: color.surfaceMuted,
    color: color.text,
    minHeight: 0,
  },
  loadingBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    borderRadius: radius.sm,
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: font.sans,
    background: color.accentSoft,
    color: color.accent,
    border: `1px solid rgba(79, 70, 229, 0.2)`,
  },
  spinner: {
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    border: `2px solid ${color.accent}`,
    borderTopColor: 'transparent',
    animation: 'spin 0.8s linear infinite',
    flexShrink: 0,
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '10px 14px',
    borderRadius: radius.sm,
    fontSize: '13px',
    fontFamily: font.sans,
    background: color.dangerSoft,
    color: color.danger,
    border: `1px solid #fecaca`,
    lineHeight: 1.5,
  },
  errorIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: color.danger,
    color: '#fff',
    fontSize: '11px',
    fontWeight: 700,
    flexShrink: 0,
  },
  examplesRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '2px',
  },
  examplesLabel: {
    fontSize: '12px',
    fontFamily: font.sans,
    color: color.textSubtle,
    marginRight: '4px',
    fontWeight: 500,
  },
  exampleBtn: {
    padding: '3px 10px',
    border: `1px solid ${color.border}`,
    borderRadius: '100px',
    background: color.surfaceMuted,
    color: color.textMuted,
    fontSize: '11px',
    fontWeight: 600,
    fontFamily: font.sans,
    cursor: 'pointer',
    outline: 'none',
  },
}
