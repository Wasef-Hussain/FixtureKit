import { useFixtureGen } from '../hooks/useFixtureGen'
import InputPane from './InputPane'
import OutputPane from './OutputPane'
import OptionsBar from './OptionsBar'

export default function App() {
  const gen = useFixtureGen()

  return (
    <div style={S.page}>
      <header style={S.header}>
        <h1 style={S.title}>FixtureKit</h1>
        <span style={S.subtitle}>
          Your mocks in seconds, not minutes. Paste a TypeScript interface or Zod schema &mdash; get realistic, copy-ready fixture code. Nothing leaves the browser.
        </span>
      </header>

      <OptionsBar
        count={gen.count}
        onCountChange={gen.setCount}
        varName={gen.customVarName}
        onVarNameChange={gen.setCustomVarName}
        disabled={gen.loading}
      />

      <div style={S.columns} data-columns="">
        <div style={S.pane}>
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

        <div style={S.pane}>
          <OutputPane output={gen.output} />
        </div>
      </div>

      <footer style={S.footer}>
        <a href="https://github.com/Wasef-Hussain/FixtureKit" target="_blank" rel="noopener noreferrer" style={S.footerLink}>GitHub</a>
        <span style={S.footerSep}>·</span>
        <a href="https://github.com/Wasef-Hussain/FixtureKit/issues/new" target="_blank" rel="noopener noreferrer" style={S.footerLink}>Report Issue</a>
      </footer>
    </div>
  )
}

// Inline styles for the layout. Responsive stacking on mobile is handled
// by a media query in index.html (targets [data-columns]).
const S: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px 24px 48px',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#111827',
    background: '#ffffff',
  },
  header: {
    marginBottom: '4px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    margin: '0 0 4px',
    color: '#111827',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
  },
  columns: {
    display: 'flex',
    gap: '24px',
    flex: 1,
    minHeight: 0,
  },
  pane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: '500px',
  },
  footer: {
    marginTop: '24px',
    paddingTop: '16px',
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  footerLink: {
    fontSize: '13px',
    color: '#6b7280',
    textDecoration: 'none',
  },
  footerSep: {
    fontSize: '13px',
    color: '#d1d5db',
  },
}
