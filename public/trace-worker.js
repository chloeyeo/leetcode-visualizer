/* eslint-disable */
/*
 * Trace worker: runs user Python in Pyodide (Wasm) off the main thread and
 * records a step-by-step execution trace via sys.settrace.
 * A step budget makes infinite loops terminate instead of hanging the tab.
 */
const PYODIDE_VERSION = 'v0.26.4';
const BASE_URL = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`;

importScripts(BASE_URL + 'pyodide.js');

let pyodidePromise = null;

const HARNESS = `
import sys, json, io, contextlib, types

def __short(x):
    try:
        r = repr(x)
    except Exception:
        r = '<unrepr>'
    return r[:80] + '…' if len(r) > 80 else r

def __ser(v):
    if v is None or isinstance(v, (bool, int, float, str)):
        return {'t': 'scalar', 'v': __short(v)}
    if isinstance(v, (list, tuple)):
        if len(v) <= 60 and all((e is None or isinstance(e, (bool, int, float, str))) for e in v):
            return {'t': 'list', 'v': [__short(e) for e in v]}
        return {'t': 'scalar', 'v': __short(v)}
    if isinstance(v, (set, frozenset)):
        if len(v) <= 60 and all((e is None or isinstance(e, (bool, int, float, str))) for e in v):
            return {'t': 'set', 'v': sorted([__short(e) for e in v])}
        return {'t': 'scalar', 'v': __short(v)}
    if isinstance(v, dict):
        keys_ok = all(isinstance(k, (str, int, float, bool)) for k in v.keys())
        if keys_ok and 0 < len(v) <= 40 and all(isinstance(val, (list, tuple, set)) for val in v.values()):
            adj = []
            for k, val in v.items():
                adj.append([__short(k), [__short(e) for e in list(val)[:20]]])
            return {'t': 'graph', 'v': adj}
        if len(v) <= 40 and keys_ok:
            return {'t': 'dict', 'v': [[__short(k), __short(val)] for k, val in v.items()]}
        return {'t': 'scalar', 'v': __short(v)}
    if hasattr(v, 'val') and hasattr(v, 'next'):
        vals = []
        seen = set()
        cur = v
        cyclic = False
        while cur is not None and len(vals) < 60:
            if id(cur) in seen:
                cyclic = True
                break
            seen.add(id(cur))
            try:
                vals.append(__short(getattr(cur, 'val')))
            except Exception:
                vals.append('?')
            cur = getattr(cur, 'next', None)
        return {'t': 'llist', 'v': vals, 'cyclic': cyclic}
    if hasattr(v, 'val') and (hasattr(v, 'left') or hasattr(v, 'right')):
        def __bt(node, d):
            if node is None or d > 5:
                return None
            return {
                'val': __short(getattr(node, 'val', '?')),
                'left': __bt(getattr(node, 'left', None), d + 1),
                'right': __bt(getattr(node, 'right', None), d + 1),
            }
        return {'t': 'tree', 'v': __bt(v, 0)}
    return {'t': 'scalar', 'v': __short(v)}

def __run_user(code, max_steps=4000):
    TRACE = []
    counter = {'n': 0}
    err = None
    try:
        compiled = compile(code, '<user>', 'exec')
    except SyntaxError as e:
        return json.dumps({'trace': [], 'error': '%s: %s (line %s)' % (type(e).__name__, e.msg, e.lineno), 'stdout': ''})

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != '<user>':
            return tracer
        if event in ('line', 'call', 'return'):
            counter['n'] += 1
            if counter['n'] > max_steps:
                raise RuntimeError('Step limit (%d) exceeded — possible infinite loop.' % max_steps)
            stack = []
            f = frame
            while f is not None and f.f_code.co_filename == '<user>':
                nm = f.f_code.co_name
                stack.append('main' if nm == '<module>' else nm)
                f = f.f_back
            stack.reverse()
            loc = {}
            for k, v in list(frame.f_locals.items()):
                if k.startswith('__'):
                    continue
                if callable(v) or isinstance(v, types.ModuleType):
                    continue
                loc[k] = __ser(v)
            TRACE.append({
                'line': frame.f_lineno,
                'event': event,
                'func': 'main' if frame.f_code.co_name == '<module>' else frame.f_code.co_name,
                'locals': loc,
                'depth': len(stack),
                'stack': stack,
            })
        return tracer

    out = io.StringIO()
    sys.settrace(tracer)
    try:
        with contextlib.redirect_stdout(out):
            exec(compiled, {})
    except Exception as e:
        err = '%s: %s' % (type(e).__name__, e)
    finally:
        sys.settrace(None)
    return json.dumps({'trace': TRACE, 'error': err, 'stdout': out.getvalue()})
`;

async function ensurePyodide() {
  if (!pyodidePromise) {
    self.postMessage({ type: 'status', msg: 'Downloading Python runtime (first run only)…' });
    pyodidePromise = loadPyodide({ indexURL: BASE_URL }).then(async (py) => {
      py.runPython(HARNESS);
      return py;
    });
  }
  return pyodidePromise;
}

self.onmessage = async (e) => {
  if (e.data && e.data.type === 'run') {
    try {
      const py = await ensurePyodide();
      self.postMessage({ type: 'status', msg: 'Running…' });
      const runner = py.globals.get('__run_user');
      let jsonStr;
      try {
        jsonStr = runner(e.data.code);
      } finally {
        if (runner && runner.destroy) runner.destroy();
      }
      const data = JSON.parse(jsonStr);
      self.postMessage({
        type: 'result',
        id: e.data.id || null,
        trace: data.trace || [],
        error: data.error || null,
        stdout: data.stdout || '',
      });
    } catch (err) {
      self.postMessage({ type: 'error', id: e.data.id || null, message: String((err && err.message) || err) });
    }
  }
};
