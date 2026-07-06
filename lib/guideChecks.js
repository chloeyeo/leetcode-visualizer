/**
 * Check-program generators for the guided thought-process coach
 * (docs/guided-coach-plan.md, Q2). A step check is just another Python
 * program sent to the existing Pyodide worker: `ast` rules parse the user's
 * code embedded as a string literal; `run` tests execute it and compare.
 *
 * Reference implementation (proven against wrong/right student code):
 * scripts/test-guide-pilot.py — keep the two in sync; scripts/
 * test-guide-checks.mjs asserts parity by running these generators under
 * a real Python interpreter.
 *
 * Worker-fidelity constraints (do not "clean up"):
 * - student code is compiled with filename '<user>' so the worker's
 *   4000-step budget still applies (its tracer only counts '<user>' frames);
 * - the verdict is the LAST stdout line starting with GUIDE_MARK, so the
 *   student's own print() output can't confuse the UI.
 */

export const GUIDE_MARK = '__GUIDE__';

// Embed a JS value as a Python expression. Routed through json.loads so
// true/false/null become True/False/None instead of Python syntax errors.
const py = (v) => `__json.loads(${JSON.stringify(JSON.stringify(v))})`;

const RULE_HELPERS = `
def __count(tree, name):
    import ast
    return sum(1 for n in ast.walk(tree) if type(n).__name__ == name)

def __defines(tree, name):
    import ast
    return any(type(n).__name__ in ("FunctionDef", "AsyncFunctionDef") and n.name == name
               for n in ast.walk(tree))

def __calls(tree, name):
    import ast
    for n in ast.walk(tree):
        if type(n).__name__ == "Call":
            f = n.func
            if (type(f).__name__ == "Name" and getattr(f, "id", None) == name) or \\
               (type(f).__name__ == "Attribute" and getattr(f, "attr", None) == name):
                return True
    return False

def __scope(tree, within):
    import ast
    if not within:
        return tree
    for n in ast.walk(tree):
        if type(n).__name__ in ("FunctionDef", "AsyncFunctionDef") and n.name == within:
            return n
    return None

def __rules_eval(tree, rules, res):
    for i, r in enumerate(rules):
        kind, level = r["kind"], r.get("level", "require")
        t = __scope(tree, r.get("within"))
        if t is None:
            hit = kind == "lacks"  # scope fn absent: nothing can be "had"/called
        elif kind == "defines":
            hit = __defines(tree, r["name"])
        elif kind == "calls":
            hit = __calls(t, r["name"])
        elif kind == "has":
            hit = __count(t, r["node"]) >= r.get("count", 1)
        else:
            hit = __count(t, r["node"]) < r.get("count", 1)
        if not hit:
            if level == "require":
                res["ok"] = False
                res["failed"].append("rule:%d" % i)
            else:
                res["notes"].append("rule:%d" % i)
`;

const RUN_HELPERS = `
import contextlib as __ctx, io as __io

def __cmp(got, exp, mode):
    if mode == 'sorted':
        try:
            return sorted(got) == sorted(exp)
        except Exception:
            return False
    if isinstance(exp, list) and isinstance(got, tuple):
        got = list(got)
    return got == exp
`;

/**
 * Build the self-contained Python check program for one step's `check`.
 * Returns null for checks with nothing to run in the worker (ok / llm).
 */
export function genCheckProgram(userCode, check) {
  if (!check || check.type === 'ok' || check.type === 'llm') return null;

  const head =
    `import ast as __ast, json as __json\n` +
    `__USER = ${JSON.stringify(userCode)}\n` +
    `__RULES = ${py(check.rules || [])}\n` +
    RULE_HELPERS +
    `__res = {"ok": True, "failed": [], "notes": []}\n` +
    `__tree = None\n` +
    `try:\n` +
    `    __tree = __ast.parse(__USER)\n` +
    `except SyntaxError as __e:\n` +
    `    __res["ok"] = False\n` +
    `    __res["failed"].append("syntax")\n` +
    `    __res["notes"].append("line %s: %s" % (__e.lineno, __e.msg))\n` +
    `if __tree is not None:\n` +
    `    __rules_eval(__tree, __RULES, __res)\n`;

  const verdict = `print("${GUIDE_MARK}" + __json.dumps(__res))\n`;

  if (check.type === 'ast') return head + verdict;

  // type === 'run': require-rules above act as a fail-fast gate, then the
  // student code executes (as '<user>' — keeps the worker step budget) with
  // its own stdout swallowed, then each test call is evaluated and compared.
  let body =
    RUN_HELPERS +
    `if __res["ok"] and __tree is not None:\n` +
    `    __g = {}\n` +
    `    try:\n` +
    `        with __ctx.redirect_stdout(__io.StringIO()):\n` +
    `            exec(compile(__USER, '<user>', 'exec'), __g)\n` +
    `    except Exception as __e:\n` +
    `        __res["ok"] = False\n` +
    `        __res["failed"].append("crash")\n` +
    `        __res["notes"].append("%s: %s" % (type(__e).__name__, __e))\n` +
    `    if __res["ok"]:\n`;
  (check.tests || []).forEach((t, i) => {
    body +=
      `        __call = ${JSON.stringify(t.call)}\n` +
      `        try:\n` +
      `            __got = eval(compile(__call, '<user>', 'eval'), __g)\n` +
      `            if not __cmp(__got, ${py(t.expect)}, ${JSON.stringify(t.compare || 'eq')}):\n` +
      `                __res["ok"] = False\n` +
      `                __res["failed"].append("test:${i}")\n` +
      `                __res["notes"].append("%s returned %r" % (__call, __got))\n` +
      `        except Exception as __e:\n` +
      `            __res["ok"] = False\n` +
      `            __res["failed"].append("test:${i}")\n` +
      `            __res["notes"].append("%s raised %s: %s" % (__call, type(__e).__name__, __e))\n`;
  });

  return head + body + verdict;
}

/** Pull the verdict out of a worker result's stdout. Null if none found. */
export function parseVerdict(stdout) {
  const lines = String(stdout || '').split('\n').filter((l) => l.startsWith(GUIDE_MARK));
  if (!lines.length) return null;
  try {
    const v = JSON.parse(lines[lines.length - 1].slice(GUIDE_MARK.length));
    if (typeof v.ok !== 'boolean') return null;
    return { ok: v.ok, failed: v.failed || [], notes: v.notes || [] };
  } catch {
    return null;
  }
}
