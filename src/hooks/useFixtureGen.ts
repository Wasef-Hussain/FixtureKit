// Wires the parser → inference → generator pipeline with debounced regeneration.
//
// State managed:
//   inputText        — raw schema paste
//   mode             — "ts" | "zod"
//   count            — number of fixtures (1–5)
//   customVarName    — optional override for the const name
//   isAdversarial    — adversarial mode toggle (V2.1)
//   activeTab        — current output format tab (V2.1)
//
// Derived (computed automatically):
//   output           — FixtureOutput object with all 4 formats (null when empty/error)
//   error            — parse error message (null when input is empty or valid)
//   loading          — true while the TS parser is being lazy-loaded

import { useState, useEffect, useRef, useCallback } from 'react'
import type { ParseResult } from '../lib/types'
import { generateFixture, type FixtureOutput } from '../lib/generator/generateFixture'
// Zod parser is lightweight (no dependencies) — import eagerly.
import { parseZod } from '../lib/parser/parseZod'
import { Analytics } from '../lib/analytics'
import { EXAMPLES } from '../lib/examples'

export type Mode = 'ts' | 'zod'

/** Available output format tabs. */
export type OutputTab = 'ts' | 'json' | 'msw' | 'playwright'

export interface FixtureGenState {
  output: FixtureOutput | null
  error: string | null
  loading: boolean
  inputText: string
  mode: Mode
  count: number
  customVarName: string
  isAdversarial: boolean
  isRandomized: boolean
  baseSeed: number
  activeTab: OutputTab
  setInputText: (s: string) => void
  setMode: (m: Mode) => void
  setCount: (n: number) => void
  setCustomVarName: (s: string) => void
  setIsAdversarial: (b: boolean) => void
  setIsRandomized: (b: boolean) => void
  shuffle: () => void
  setActiveTab: (t: OutputTab) => void
}

const DEBOUNCE_MS = 300
const IDENTIFIER_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/

const getInitialState = () => {
  try {
    if (typeof window !== 'undefined' && window.location.hash.length > 1) {
      const hash = window.location.hash.slice(1)
      const decoded = JSON.parse(decodeURIComponent(atob(hash)))
      return {
        inputText: decoded.inputText ?? '',
        mode: (decoded.mode as Mode) ?? 'ts',
        activeTab: (decoded.activeTab as OutputTab) ?? 'ts',
        count: decoded.count ?? 1,
        isAdversarial: decoded.isAdversarial ?? false,
      }
    }
  } catch (e) {
    // ignore decoding errors
  }
  return null
}

export function useFixtureGen(): FixtureGenState {
  const initial = getInitialState()

  const [inputText, setInputText] = useState(initial?.inputText ?? EXAMPLES.prismaUser)
  const [mode, setMode] = useState<Mode>(initial?.mode ?? 'ts')
  const [count, setCount] = useState(initial?.count ?? 1)
  const [customVarName, setCustomVarName] = useState('')
  const [isAdversarial, setIsAdversarial] = useState(initial?.isAdversarial ?? false)
  const [isRandomized, setIsRandomized] = useState(false)
  const [baseSeed, setBaseSeed] = useState(0)
  const [activeTab, setActiveTab] = useState<OutputTab>(initial?.activeTab ?? 'ts')
  const [output, setOutput] = useState<FixtureOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const shuffle = useCallback(() => {
    setBaseSeed(Math.floor(Math.random() * 1000000))
  }, [])

  // Auto-shuffle when randomized mode is toggled on
  useEffect(() => {
    if (isRandomized) {
      shuffle()
    } else {
      setBaseSeed(0)
    }
  }, [isRandomized, shuffle])

  // Refs for values consumed inside the debounced effect — avoids stale closures
  // while still letting the effect re-fire when these change.
  const countRef = useRef(count)
  countRef.current = count
  const varNameRef = useRef(customVarName)
  varNameRef.current = customVarName
  const modeRef = useRef(mode)
  modeRef.current = mode
  const adversarialRef = useRef(isAdversarial)
  adversarialRef.current = isAdversarial
  const randomizedRef = useRef(isRandomized)
  randomizedRef.current = isRandomized
  const baseSeedRef = useRef(baseSeed)
  baseSeedRef.current = baseSeed

  // Lazy-loaded TS parser. Null until first use.
  const tsParserRef = useRef<((source: string) => ParseResult) | null>(null)

  useEffect(() => {
    try {
      const state = { inputText, mode, activeTab, count, isAdversarial }
      const hash = btoa(encodeURIComponent(JSON.stringify(state)))
      window.history.replaceState(null, '', '#' + hash)
    } catch (e) {
      // ignore encoding errors
    }
  }, [inputText, mode, activeTab, count, isAdversarial])

  useEffect(() => {
    const timer = setTimeout(() => {
      const text = inputText
      const currentMode = modeRef.current
      const currentCount = countRef.current
      const currentVarName = varNameRef.current
      const currentAdversarial = adversarialRef.current
      const currentRandomized = randomizedRef.current
      const currentBaseSeed = baseSeedRef.current

      // Empty input → clear output and error, nothing to show.
      if (!text.trim()) {
        setOutput(null)
        setError(null)
        return
      }

      if (currentMode === 'ts') {
        if (!tsParserRef.current) {
          setLoading(true)
          import('../lib/parser/parseTypeScript').then((mod) => {
            tsParserRef.current = mod.parseTypeScript
            setLoading(false)
            // Re-run once the parser is ready.
            runPipeline(text, 'ts', currentCount, currentVarName, currentAdversarial, currentBaseSeed)
          })
          return
        }
        runPipeline(text, 'ts', currentCount, currentVarName, currentAdversarial, currentBaseSeed)
      } else {
        runPipeline(text, 'zod', currentCount, currentVarName, currentAdversarial, currentBaseSeed)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [inputText, mode, count, customVarName, isAdversarial, isRandomized, baseSeed])

  function runPipeline(
    source: string,
    currentMode: Mode,
    currentCount: number,
    currentVarName: string,
    currentAdversarial: boolean,
    currentBaseSeed: number,
  ) {
    let result: ParseResult
    if (currentMode === 'ts') {
      result = tsParserRef.current!(source)
    } else {
      result = parseZod(source)
    }

    if (!result.ok) {
      // Avoid tracking trivial "empty" or "still typing" parse failures to reduce noise.
      // E.g. "Property or signature expected."
      if (!result.error.includes('Property or signature expected')) {
        Analytics.track('parse_failure', { error_type: result.error, mode: currentMode })
      }
      setError(result.error)
      setOutput(null)
      return
    }

    Analytics.track('parse_success', { mode: currentMode })

    setError(null)

    // Validate custom variable name before use.
    const trimmedVarName = currentVarName.trim()
    if (trimmedVarName.length > 0 && !IDENTIFIER_RE.test(trimmedVarName)) {
      setError('Variable name must be a valid identifier (letters, digits, $, _ — cannot start with a digit).')
      setOutput(null)
      return
    }

    // Determine varName and typeName for generateFixture.
    const hasCustomName = trimmedVarName.length > 0
    const varName = hasCustomName ? trimmedVarName : result.rootName

    // Type name: only available for TS schemas with the default varName.
    // e.g. mockUser → User. Omitted for Zod schemas and custom varName overrides.
    const isTS = currentMode === 'ts'
    const defaultName = result.rootName
    const typeName =
      !hasCustomName && isTS && defaultName.startsWith('mock')
        ? defaultName.slice(4)
        : undefined
    const generated = generateFixture({
      varName,
      typeName,
      fields: result.fields,
      count: currentCount,
      isAdversarial: currentAdversarial,
      baseSeed: currentBaseSeed,
    })

    Analytics.track('schema_generated', { field_count: result.fields.length })
    setOutput(generated)
  }

  return {
    output,
    error,
    loading,
    inputText,
    mode,
    count,
    customVarName,
    isAdversarial,
    isRandomized,
    baseSeed,
    activeTab,
    setInputText,
    setMode,
    setCount,
    setCustomVarName,
    setIsAdversarial,
    setIsRandomized,
    shuffle,
    setActiveTab,
  }
}
