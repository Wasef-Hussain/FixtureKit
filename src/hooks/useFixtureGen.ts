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

import { useState, useEffect, useRef } from 'react'
import type { ParseResult } from '../lib/types'
import { generateFixture, type FixtureOutput } from '../lib/generator/generateFixture'
// Zod parser is lightweight (no dependencies) — import eagerly.
import { parseZod } from '../lib/parser/parseZod'

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
  activeTab: OutputTab
  setInputText: (s: string) => void
  setMode: (m: Mode) => void
  setCount: (n: number) => void
  setCustomVarName: (s: string) => void
  setIsAdversarial: (b: boolean) => void
  setActiveTab: (t: OutputTab) => void
}

const DEBOUNCE_MS = 300
const IDENTIFIER_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/

export function useFixtureGen(): FixtureGenState {
  const [inputText, setInputText] = useState('')
  const [mode, setMode] = useState<Mode>('ts')
  const [count, setCount] = useState(1)
  const [customVarName, setCustomVarName] = useState('')
  const [isAdversarial, setIsAdversarial] = useState(false)
  const [activeTab, setActiveTab] = useState<OutputTab>('ts')
  const [output, setOutput] = useState<FixtureOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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

  // Lazy-loaded TS parser. Null until first use.
  const tsParserRef = useRef<((source: string) => ParseResult) | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      const text = inputText
      const currentMode = modeRef.current
      const currentCount = countRef.current
      const currentVarName = varNameRef.current
      const currentAdversarial = adversarialRef.current

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
            runPipeline(text, 'ts', currentCount, currentVarName, currentAdversarial)
          })
          return
        }
        runPipeline(text, 'ts', currentCount, currentVarName, currentAdversarial)
      } else {
        runPipeline(text, 'zod', currentCount, currentVarName, currentAdversarial)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [inputText, mode, count, customVarName, isAdversarial])

  function runPipeline(
    source: string,
    currentMode: Mode,
    currentCount: number,
    currentVarName: string,
    currentAdversarial: boolean,
  ) {
    let result: ParseResult
    if (currentMode === 'ts') {
      result = tsParserRef.current!(source)
    } else {
      result = parseZod(source)
    }

    if (!result.ok) {
      setError(result.error)
      setOutput(null)
      return
    }

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
    })

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
    activeTab,
    setInputText,
    setMode,
    setCount,
    setCustomVarName,
    setIsAdversarial,
    setActiveTab,
  }
}
