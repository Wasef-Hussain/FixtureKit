import { useFixtureGen } from '../hooks/useFixtureGen'
import InputPane from './InputPane'
import OutputPane from './OutputPane'
import OptionsBar from './OptionsBar'
import { theme } from '../styles/theme'

const { font, color, radius, shadow } = theme

export default function App() {
  const gen = useFixtureGen()

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.headerTop}>
          <div style={S.brand}>
            <span style={S.logo}>⚡</span>
            <h1 style={S.title}>FixtureKit</h1>
          </div>
          <div style={S.badges}>
            <span style={S.badge}>Runs in browser</span>
            <span style={S.badge}>No signup</span>
            <a 
              href="https://github.com/Wasef-Hussain/FixtureKit" 
              target="_blank" 
              rel="noopener noreferrer" 
              style={S.githubBtn}
              onMouseOver={(e) => e.currentTarget.style.borderColor = color.accent}
              onMouseOut={(e) => e.currentTarget.style.borderColor = color.border}
            >
              ⭐ Star on GitHub
            </a>
          </div>
        </div>
        <p style={S.subtitle}>
          <span style={{color: color.accent, fontWeight: 500, display: 'inline-block', marginBottom: '8px'}}>Runs entirely in your browser. No API calls. No schema leaves your machine.</span><br/>
          Paste a TypeScript interface or Zod schema — get realistic fixtures in{' '}
          <strong style={S.subtitleStrong}>TypeScript, JSON, MSW, or Playwright</strong>.
        </p>
        
        <div style={S.featureBadges as React.CSSProperties}>
          <span style={S.featureBadge as React.CSSProperties}>✓ Interfaces</span>
          <span style={S.featureBadge as React.CSSProperties}>✓ Type Aliases</span>
          <span style={S.featureBadge as React.CSSProperties}>✓ Record</span>
          <span style={S.featureBadge as React.CSSProperties}>✓ Pick</span>
          <span style={S.featureBadge as React.CSSProperties}>✓ Omit</span>
          <span style={S.featureBadge as React.CSSProperties}>✓ Partial</span>
          <span style={S.featureBadge as React.CSSProperties}>✓ Readonly</span>
          <span style={S.featureBadge as React.CSSProperties}>✓ Required</span>
          <span style={S.featureBadge as React.CSSProperties}>✓ Literal Unions</span>
        </div>
      </header>

      <OptionsBar
        count={gen.count}
        onCountChange={gen.setCount}
        varName={gen.customVarName}
        onVarNameChange={gen.setCustomVarName}
        isAdversarial={gen.isAdversarial}
        onAdversarialChange={gen.setIsAdversarial}
        isRandomized={gen.isRandomized}
        onRandomizedChange={gen.setIsRandomized}
        onShuffle={gen.shuffle}
        disabled={gen.loading}
      />

      <div style={S.columns} data-columns="">
        <section style={S.pane}>
          <div style={S.paneLabel}>
            <span style={S.paneDot} />
            Input
          </div>
          <div style={S.card}>
            <InputPane
              value={gen.inputText}
              onChange={gen.setInputText}
              mode={gen.mode}
              onModeChange={gen.setMode}
              error={gen.error}
              loading={gen.loading}
              disabled={false}
            />
          </div>
        </section>

        <section style={S.pane}>
          <div style={S.paneLabel}>
            <span style={{ ...S.paneDot, background: color.success }} />
            Output
          </div>
          <div style={{ ...S.card, ...S.outputCard }}>
            <OutputPane
              output={gen.output}
              activeTab={gen.activeTab}
              onTabChange={gen.setActiveTab}
            />
          </div>
        </section>
      </div>

      <footer style={S.footer}>
        <a href="https://github.com/Wasef-Hussain/FixtureKit/issues/new" target="_blank" rel="noopener noreferrer" style={S.footerLink}>Report Issue</a>
      </footer>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: '1180px',
    margin: '0 auto',
    padding: '32px 24px 48px',
    height: '100vh',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    fontFamily: font.sans,
    color: color.text,
  },
  header: {
    marginBottom: '20px',
  },
  headerTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '8px',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logo: {
    fontSize: '22px',
    lineHeight: 1,
  },
  title: {
    fontSize: '26px',
    fontWeight: 700,
    margin: 0,
    color: color.text,
    letterSpacing: '-0.6px',
    background: `linear-gradient(135deg, ${color.text} 0%, ${color.accent} 100%)`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  badges: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  badge: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.3px',
    padding: '4px 10px',
    borderRadius: radius.pill,
    background: color.accentSoft,
    color: color.accent,
    border: `1px solid rgba(79, 70, 229, 0.15)`,
  },
  githubBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 600,
    padding: '4px 12px',
    borderRadius: radius.pill,
    background: color.surfaceMuted,
    color: color.textMuted,
    border: `1px solid ${color.border}`,
    textDecoration: 'none',
    transition: 'border-color 0.15s ease',
  },
  subtitle: {
    fontSize: '15px',
    lineHeight: 1.6,
    color: color.textMuted,
    maxWidth: '640px',
    margin: 0,
  },
  subtitleStrong: {
    color: color.text,
    fontWeight: 600,
  },
  featureBadges: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    justifyContent: 'center',
    maxWidth: '800px',
    margin: '0 auto',
    marginTop: '16px',
  },
  featureBadge: {
    fontSize: '12px',
    color: color.textMuted,
    background: color.surface,
    padding: '4px 10px',
    borderRadius: '12px',
    border: `1px solid ${color.border}`,
  },
  options: {
    display: 'flex',
    gap: '20px',
    flex: 1,
    minHeight: 0,
  },
  columns: {
    display: 'flex',
    gap: '20px',
    flex: 1,
    minHeight: 0,
  },
  pane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
    gap: '8px',
  },
  paneLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
    color: color.textSubtle,
    paddingLeft: '4px',
  },
  paneDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: color.accent,
  },
  card: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.lg,
    boxShadow: shadow.card,
    padding: '16px',
    minHeight: 0,
  },
  outputCard: {
    padding: 0,
    overflow: 'hidden',
  },
  footer: {
    marginTop: '28px',
    paddingTop: '16px',
    borderTop: `1px solid ${color.border}`,
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  footerLink: {
    fontSize: '13px',
    color: color.textMuted,
    textDecoration: 'none',
  },
  footerSep: {
    fontSize: '13px',
    color: color.borderStrong,
  },
}
