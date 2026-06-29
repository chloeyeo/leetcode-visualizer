'use client';

import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';

/**
 * CodeMirror 6 editor (Python), One Dark high-contrast theme.
 * Font size scales with the global `--font-scale` var via the `.cm-editor`
 * rule in globals.css, so the A-/A+ resizer enlarges the editor too.
 *
 * Load this through `next/dynamic` with `{ ssr: false }` so it never runs
 * during static prerender (keeps the export clean).
 */
export default function CodeEditor({ value, onChange, ariaLabel = 'Code editor', minHeight = '300px' }) {
  const extensions = useMemo(() => [python()], []);
  return (
    <CodeMirror
      value={value}
      onChange={(val) => onChange(val)}
      theme={oneDark}
      extensions={extensions}
      minHeight={minHeight}
      basicSetup={{ lineNumbers: true, highlightActiveLine: true, foldGutter: false, autocompletion: false }}
      className="cm-wrap"
      aria-label={ariaLabel}
    />
  );
}
