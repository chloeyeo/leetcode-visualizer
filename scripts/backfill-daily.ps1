# Daily solutions backfill — registered as the Windows scheduled task
# "lc-visualizer-backfill" (see README "Content coverage").
#
# Pulls latest, runs the resume-safe generator until the day's free-tier
# quota is exhausted (the generator self-stops after 4 consecutive failed
# batches), then commits and pushes public/solutions.json — the Vercel
# GitHub integration deploys it automatically.
#
# Requires: GEMINI_API_KEY stored as a user environment variable.

$ErrorActionPreference = 'Continue'
$repo = 'C:\Users\C\Desktop\leetcode-visualizer'
$log = Join-Path $repo 'backfill-daily.log'

Set-Location $repo
"=== backfill run $(Get-Date -Format s) ===" | Out-File -FilePath $log -Append -Encoding utf8

if (-not $env:GEMINI_API_KEY) {
  "GEMINI_API_KEY missing from environment - aborting" | Out-File -FilePath $log -Append -Encoding utf8
  exit 1
}

# Never fight a dirty tree or a diverged branch unattended.
$dirty = git status --porcelain -- public/solutions.json
git pull --rebase origin main *>> $log
if ($LASTEXITCODE -ne 0) {
  git rebase --abort 2>$null
  "pull --rebase failed - aborting run" | Out-File -FilePath $log -Append -Encoding utf8
  exit 1
}

$env:MODELS = 'gemini-2.5-flash-lite,gemini-2.5-flash,gemini-2.0-flash'
$env:LIMIT = '4000'
$env:BATCH = '20'
$env:DELAY_MS = '5000'
node scripts/gen-solutions.mjs *>> $log

$changed = git status --porcelain -- public/solutions.json
if ($changed) {
  $count = node -e "const s=JSON.parse(require('fs').readFileSync('public/solutions.json','utf8')); console.log(Object.keys(s).length)"
  git add public/solutions.json
  git commit -m "feat: daily solutions backfill (auto) - $count/3973 covered" *>> $log
  git push origin main *>> $log
  "pushed - coverage $count/3973" | Out-File -FilePath $log -Append -Encoding utf8
} else {
  "no new entries this run" | Out-File -FilePath $log -Append -Encoding utf8
}
