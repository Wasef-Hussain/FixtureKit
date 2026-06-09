import type { Mode } from '../hooks/useFixtureGen'
import { theme } from '../styles/theme'
import { Analytics } from '../lib/analytics'

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

import { EXAMPLES } from '../lib/examples'

export default function InputPane({ value, onChange, mode, onModeChange, error, loading, disabled }: Props) {
  return (
    <div style={styles.wrapper}>
      <div style={styles.toggleRow} role="tablist" aria-label="Input type" className="mobile-wrap">
        <button
          role="tab"
          aria-selected={mode === 'ts'}
          style={{ ...styles.toggleBtn, ...(mode === 'ts' ? styles.toggleBtnActive : {}) }}
          onClick={() => {
            Analytics.track('input_mode_changed', { mode: 'ts' })
            onModeChange('ts')
          }}
          disabled={disabled}
        >
          TypeScript
        </button>
        <button
          role="tab"
          aria-selected={mode === 'zod'}
          style={{ ...styles.toggleBtn, ...(mode === 'zod' ? styles.toggleBtnActive : {}) }}
          onClick={() => {
            Analytics.track('input_mode_changed', { mode: 'zod' })
            onModeChange('zod')
          }}
          disabled={disabled}
        >
          Zod
        </button>
      </div>

      <div style={styles.examplesRow}>
        <span style={styles.examplesLabel}>Try one of these:</span>
        <button style={styles.exampleBtn} onClick={() => onChange(EXAMPLES.prismaUser)} disabled={disabled}>✓ Prisma User</button>
        <button style={styles.exampleBtn} onClick={() => onChange(EXAMPLES.nextAuthSession)} disabled={disabled}>✓ NextAuth Session</button>
        <button style={styles.exampleBtn} onClick={() => onChange(EXAMPLES.shopifyProduct)} disabled={disabled}>✓ Shopify Product</button>
        <button style={styles.exampleBtn} onClick={() => onChange(EXAMPLES.stripeCustomer)} disabled={disabled}>✓ Stripe Customer</button>
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
          <div style={styles.errorHeader}>
            <span style={styles.errorIcon}>!</span>
            <span>
              {error}
              <span style={{ display: 'block', marginTop: '6px', fontSize: '11.5px', opacity: 0.85 }}>
                <strong>Schema failed?</strong>{' '}
                <a 
                  href={`https://github.com/Wasef-Hussain/FixtureKit/issues/new?title=Parser+Failure&body=${encodeURIComponent(
                    `**Error Message:**\n\`${error}\`\n\n**Environment:**\n- Browser: ${typeof window !== 'undefined' ? window.navigator.userAgent : 'Unknown'}\n- Version: 0.1.0\n\n**Failing Schema (Optional - please remove proprietary info):**\n\`\`\`ts\n${value.slice(0, 1500)}${value.length > 1500 ? '\n... (truncated)' : ''}\n\`\`\``
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  Report it on GitHub
                </a>
              </span>
            </span>
          </div>
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
    flexDirection: 'column',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: radius.sm,
    fontSize: '13px',
    fontFamily: font.sans,
    background: color.dangerSoft,
    color: color.danger,
    border: `1px solid #fecaca`,
    lineHeight: 1.5,
  },
  errorHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
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
    gap: '8px',
    marginBottom: '8px',
    padding: '12px 14px',
    background: color.accentSoft,
    border: `1px solid rgba(79, 70, 229, 0.2)`,
    borderRadius: radius.md,
    flexWrap: 'wrap',
  },
  examplesLabel: {
    fontSize: '13px',
    fontFamily: font.sans,
    color: color.accent,
    marginRight: '6px',
    fontWeight: 700,
  },
  exampleBtn: {
    padding: '6px 14px',
    border: `1px solid rgba(79, 70, 229, 0.3)`,
    borderRadius: '100px',
    background: color.surface,
    color: color.accent,
    fontSize: '12.5px',
    fontWeight: 600,
    fontFamily: font.sans,
    cursor: 'pointer',
    outline: 'none',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    transition: 'all 0.15s ease',
  },
}
