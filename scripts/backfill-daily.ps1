# Daily solutions backfill - registered as the Windows scheduled task
# "lc-visualizer-backfill" (see README "Content coverage").
#
# Pulls latest, runs the resume-safe generator until the day's free-tier
# quota is exhausted (the generator self-stops after 4 consecutive failed
# batches), then commits and pushes public/solutions.json - the Vercel
# GitHub integration deploys it automatically.
#
# The generator saves solutions.json after EVERY batch, but this process
# tree can be killed mid-run (2026-07-06: the task's StopIfGoingOnBatteries
# setting killed it when the laptop was unplugged, stranding 320 entries
# uncommitted). A killed process cannot commit its own output, so each run
# salvage-commits whatever an earlier interrupted run left uncommitted
# BEFORE pulling (a dirty tracked file would also make pull --rebase refuse
# and abort the run), and the push step pushes ALL unpushed local commits,
# not just this run's.
#
# Requires: GEMINI_API_KEY stored as a user environment variable.

$ErrorActionPreference = 'Continue'
$repo = 'C:\Users\C\Desktop\leetcode-visualizer'
$log = Join-Path $repo 'backfill-daily.log'

# PS 5.1's *>> appends UTF-16LE, which garbles a UTF-8 log - route ALL log
# output through here instead. ErrorRecords (native stderr wrapped by PS)
# stringify to their plain message text, dropping the CategoryInfo noise.
filter Out-Log { "$_" | Out-File -FilePath $log -Append -Encoding utf8 }

# Decode child-process output (node prints UTF-8 middots/ellipses) correctly
# instead of through the OEM codepage.
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

Set-Location $repo
"=== backfill run $(Get-Date -Format s) ===" | Out-Log

if (-not $env:GEMINI_API_KEY) {
  "GEMINI_API_KEY missing from environment - aborting" | Out-Log
  exit 1
}

# Never auto-commit onto whatever branch happens to be checked out.
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne 'main') {
  "checkout is on '$branch', not main - aborting" | Out-Log
  exit 1
}

function Get-SolutionCount {
  $n = node -e "const s=JSON.parse(require('fs').readFileSync('public/solutions.json','utf8')); console.log(Object.keys(s).length)"
  if ($n) { $n } else { '?' }
}

# Commits public/solutions.json if it has uncommitted changes; returns $true
# when a commit was made.
function Commit-Solutions([string]$label) {
  $changed = git status --porcelain -- public/solutions.json
  if (-not $changed) { return $false }
  $count = Get-SolutionCount
  git add public/solutions.json 2>&1 | Out-Log
  git commit -m "feat: daily solutions backfill ($label) - $count/3973 covered" 2>&1 | Out-Log
  return ($LASTEXITCODE -eq 0)
}

# Salvage output stranded by a previous interrupted run.
if (Commit-Solutions 'auto, salvaged from interrupted run') {
  "salvaged uncommitted solutions.json left by an interrupted run" | Out-Log
}

git pull --rebase origin main 2>&1 | Out-Log
if ($LASTEXITCODE -ne 0) {
  git rebase --abort 2>$null
  "pull --rebase failed - aborting run (local commits kept; next run pushes them)" | Out-Log
  exit 1
}

$env:MODELS = 'gemini-2.5-flash-lite,gemini-2.5-flash,gemini-2.0-flash'
$env:LIMIT = '4000'
$env:BATCH = '20'
$env:DELAY_MS = '5000'
node scripts/gen-solutions.mjs 2>&1 | Out-Log

[void](Commit-Solutions 'auto')

# Push everything origin doesn't have yet - this run's commit, a salvage
# commit, and any commit stranded by an earlier failed push.
$unpushed = [int](git rev-list --count origin/main..HEAD)
if ($unpushed -gt 0) {
  git push origin main 2>&1 | Out-Log
  if ($LASTEXITCODE -eq 0) {
    "pushed $unpushed commit(s) - coverage $(Get-SolutionCount)/3973" | Out-Log
  } else {
    "push failed - commits stay local; next run retries" | Out-Log
  }
} else {
  "no changes to push this run" | Out-Log
}
