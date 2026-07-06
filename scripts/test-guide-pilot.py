"""End-to-end proof for the Phase R pilot guide (docs/guided-coach-plan.md, Q6).

Builds the SAME check programs the build phase will send to the Pyodide worker
(one self-contained Python source string per OK-click) and executes each pilot
step's program against wrong-then-right sample student code, asserting the
verdict. This is the reference implementation for lib/guideChecks.js.

Run:  py scripts/test-guide-pilot.py        (exit 1 on any unexpected verdict)

Worker-fidelity notes (build phase must keep these):
- student code is compiled with filename '<user>' so the worker's 4000-step
  budget still applies to it (the tracer only counts '<user>' frames);
- the verdict is the LAST line starting with __GUIDE__ on stdout, so student
  prints can't confuse the UI.
"""
import io
import json
import sys
import contextlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GUIDE = json.loads((ROOT / "public" / "solutions.json").read_text(encoding="utf-8"))["two-sum"]["guide"]

MARK = "__GUIDE__"

# Shared rule-evaluation helpers, embedded into every generated program.
RULE_HELPERS = r'''
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
            if (type(f).__name__ == "Name" and getattr(f, "id", None) == name) or \
               (type(f).__name__ == "Attribute" and getattr(f, "attr", None) == name):
                return True
    return False

def __rules(tree, rules, res):
    for i, r in enumerate(rules):
        kind, level = r["kind"], r.get("level", "require")
        if kind == "defines":
            hit = __defines(tree, r["name"])
        elif kind == "calls":
            hit = __calls(tree, r["name"])
        elif kind == "has":
            hit = __count(tree, r["node"]) >= r.get("count", 1)
        else:  # lacks: fewer than count occurrences
            hit = __count(tree, r["node"]) < r.get("count", 1)
        if not hit:
            if level == "require":
                res["ok"] = False
                res["failed"].append("rule:%d" % i)
            else:
                res["notes"].append("rule:%d" % i)
'''


def gen_check_program(user_code, check):
    """check dict -> self-contained Python source, or None for ok/llm steps."""
    if check["type"] in ("ok", "llm"):
        return None
    rules = json.dumps(check.get("rules", []))
    head = (
        "import ast as __ast, json as __json\n"
        f"__USER = {user_code!r}\n"
        f"__RULES = {rules}\n"
        + RULE_HELPERS
        + '__res = {"ok": True, "failed": [], "notes": []}\n'
        "__tree = None\n"
        "try:\n"
        "    __tree = __ast.parse(__USER)\n"
        "except SyntaxError as __e:\n"
        '    __res["ok"] = False\n'
        '    __res["failed"].append("syntax")\n'
        '    __res["notes"].append("line %s: %s" % (__e.lineno, __e.msg))\n'
        "if __tree is not None:\n"
        "    __rules(__tree, __RULES, __res)\n"
    )
    if check["type"] == "ast":
        return head + f'print("{MARK}" + __json.dumps(__res))\n'

    # type == "run": require-rules act as a fail-fast gate; then execute the
    # student code (as '<user>' — keeps the worker step budget) and the tests.
    tests = check["tests"]
    body = (
        'if __res["ok"] and __tree is not None:\n'
        "    __g = {}\n"
        "    try:\n"
        '        with __redirect_out():\n'
        "            exec(compile(__USER, '<user>', 'exec'), __g)\n"
        "    except Exception as __e:\n"
        '        __res["ok"] = False\n'
        '        __res["failed"].append("crash")\n'
        '        __res["notes"].append("%s: %s" % (type(__e).__name__, __e))\n'
        '    if __res["ok"]:\n'
    )
    for i, t in enumerate(tests):
        call, expect, cmp_ = t["call"], json.dumps(t["expect"]), t.get("compare", "eq")
        body += (
            f"        try:\n"
            f"            __got = eval(compile({t['call']!r}, '<user>', 'eval'), __g)\n"
            f"            if not __cmp(__got, __json.loads({expect!r}), {cmp_!r}):\n"
            f'                __res["ok"] = False\n'
            f'                __res["failed"].append("test:{i}")\n'
            f'                __res["notes"].append("{call} returned %r" % (__got,))\n'
            f"        except Exception as __e:\n"
            f'            __res["ok"] = False\n'
            f'            __res["failed"].append("test:{i}")\n'
            f'            __res["notes"].append("{call} raised %s: %s" % (type(__e).__name__, __e))\n'
        )
    helpers = (
        "import contextlib as __ctx, io as __io\n"
        "def __redirect_out():\n"
        "    return __ctx.redirect_stdout(__io.StringIO())\n"
        "def __cmp(got, exp, mode):\n"
        "    if mode == 'sorted':\n"
        "        try:\n"
        "            return sorted(got) == sorted(exp)\n"
        "        except Exception:\n"
        "            return False\n"
        "    if isinstance(exp, list) and isinstance(got, tuple):\n"
        "        got = list(got)\n"
        "    return got == exp\n"
    )
    return head + helpers + body + f'print("{MARK}" + __json.dumps(__res))\n'


def run_program(src):
    """Execute a generated check program the way the worker does; parse verdict."""
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        exec(compile(src, "<user>", "exec"), {})
    lines = [l for l in out.getvalue().splitlines() if l.startswith(MARK)]
    assert lines, "check program printed no verdict"
    return json.loads(lines[-1][len(MARK):])


# ---- sample student code at each stage of the guided solve ----

STARTER = GUIDE and json.loads((ROOT / "public" / "solutions.json").read_text(encoding="utf-8"))["two-sum"]["starterCode"]

BRUTE = (
    "def two_sum(nums, target):\n"
    "    for i in range(len(nums)):\n"
    "        for j in range(i + 1, len(nums)):\n"
    "            if nums[i] + nums[j] == target:\n"
    "                return [i, j]\n"
    "\n"
    "print(two_sum([2, 7, 11, 15], 9))\n"
)
MID_REFACTOR = (
    "def two_sum(nums, target):\n"
    "    seen = {}\n"
    "    for i, x in enumerate(nums):\n"
    "        pass\n"
)
MID_REFACTOR_DICTCALL = MID_REFACTOR.replace("seen = {}", "seen = dict()")
INSERT_BEFORE_CHECK = (
    "def two_sum(nums, target):\n"
    "    seen = {}\n"
    "    for i, x in enumerate(nums):\n"
    "        seen[x] = i\n"
    "        if target - x in seen:\n"
    "            return [seen[target - x], i]\n"
)
OPTIMAL = (
    "def two_sum(nums, target):\n"
    "    seen = {}\n"
    "    for i, x in enumerate(nums):\n"
    "        if target - x in seen:\n"
    "            return [seen[target - x], i]\n"
    "        seen[x] = i\n"
)
SYNTAX_ERROR = "def two_sum(nums, target)\n    pass\n"

# (step id, student code, expected ok, expected note present)
CASES = [
    ("brute-force", STARTER, False, False),           # no loops yet, returns None
    ("brute-force", BRUTE, True, False),
    ("hash-idea", BRUTE, False, True),                # still two loops (+no-dict note)
    ("hash-idea", SYNTAX_ERROR, False, True),         # half-typed code fails gently
    ("hash-idea", MID_REFACTOR, True, False),
    ("hash-idea", MID_REFACTOR_DICTCALL, True, True), # "prefer" rule -> pass with note
    ("check-then-insert", MID_REFACTOR, False, False),# no membership test / return
    ("check-then-insert", INSERT_BEFORE_CHECK, True, False),  # bug survives here...
    ("check-then-insert", OPTIMAL, True, False),
    ("edge-duplicates", INSERT_BEFORE_CHECK, False, True),    # ...and dies here
    ("edge-duplicates", OPTIMAL, True, False),
]

steps = {s["id"]: s for s in GUIDE["steps"]}
machine_checked = [s["id"] for s in GUIDE["steps"] if s["check"]["type"] not in ("ok", "llm")]
assert set(c[0] for c in CASES) == set(machine_checked), "every machine-checked step needs cases"

failures = []
for step_id, code, want_ok, want_note in CASES:
    src = gen_check_program(code, steps[step_id]["check"])
    v = run_program(src)
    got_ok, got_note = v["ok"], bool(v["notes"])
    tag = "PASS" if (got_ok, got_note) == (want_ok, want_note) else "FAIL"
    if tag == "FAIL":
        failures.append((step_id, v))
    label = code.splitlines()[0][:40] + (" ..." if len(code.splitlines()) > 1 else "")
    print(f"  {tag}  {step_id:18s} ok={got_ok!s:5s} note={got_note!s:5s}  <- {label}")

print(f"\n{len(CASES) - len(failures)}/{len(CASES)} verdicts as expected across "
      f"{len(machine_checked)} machine-checked steps (+{len(GUIDE['steps']) - len(machine_checked)} ok-steps).")
if failures:
    for sid, v in failures:
        print(f"  unexpected verdict at {sid}: {json.dumps(v)}")
    sys.exit(1)
