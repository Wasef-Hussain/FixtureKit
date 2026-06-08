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

const EXAMPLES = {
  prismaUser: `export interface PrismaUser {\n  id: string;\n  email: string;\n  firstName: string;\n  lastName: string;\n  avatarUrl: string;\n  role: "ADMIN" | "USER" | "GUEST";\n  isActive: boolean;\n  createdAt: Date;\n  updatedAt: Date;\n}`,
  nextAuthSession: `export type Session = {\n  user?: {\n    name?: string | null\n    email?: string | null\n    image?: string | null\n  }\n  expires: ISODateString\n}\ntype ISODateString = string`,
  shopifyProduct: `export interface ShopifyProduct {\n  id: string;\n  title: string;\n  body_html: string;\n  vendor: string;\n  product_type: string;\n  created_at: string;\n  handle: string;\n  updated_at: string;\n  published_at: string;\n  status: "active" | "archived" | "draft";\n  tags: string;\n}`,
  stripeCustomer: `export interface StripeCustomer {\n  id: string;\n  object: "customer";\n  address: Address | null;\n  balance: number;\n  created: number;\n  currency: string;\n  default_source: string | null;\n  delinquent: boolean;\n  description: string | null;\n  email: string | null;\n  phone: string | null;\n}\n\ninterface Address {\n  city: string | null;\n  country: string | null;\n  line1: string | null;\n  line2: string | null;\n  postal_code: string | null;\n  state: string | null;\n}`
}

export default function InputPane({ value, onChange, mode, onModeChange, error, loading, disabled }: Props) {
  return (
    <div style={styles.wrapper}>
      <div style={styles.toggleRow} role="tablist" aria-label="Input type">
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
            {error}
          </div>
          <div style={styles.feedbackBox}>
            <p style={styles.feedbackText}>
              <strong>Schema failed?</strong> Help improve FixtureKit by submitting the schema that broke it.
            </p>
            <a 
              href={`https://github.com/Wasef-Hussain/FixtureKit/issues/new?title=Parser+Failure&body=${encodeURIComponent(
                `**Error Message:**\n\`${error}\`\n\n**Environment:**\n- Browser: ${typeof window !== 'undefined' ? window.navigator.userAgent : 'Unknown'}\n- Version: 0.1.0\n\n**Failing Schema (Optional - please remove proprietary info):**\n\`\`\`ts\n\n\`\`\``
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.feedbackBtn}
            >
              Report Issue on GitHub
            </a>
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
  feedbackBox: {
    marginTop: '4px',
    paddingTop: '12px',
    borderTop: '1px solid #fecaca',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  feedbackText: {
    margin: 0,
    fontSize: '12.5px',
    color: '#b91c1c',
  },
  feedbackBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 12px',
    background: '#dc2626',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: radius.sm,
    fontWeight: 600,
    fontSize: '12px',
    width: 'fit-content',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
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
