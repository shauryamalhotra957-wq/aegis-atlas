param(
  [string]$RepoName = "aegis-atlas",
  [string]$Visibility = "public"
)

$ErrorActionPreference = "Stop"

$GhPath = "C:\Program Files\GitHub CLI\gh.exe"
if (-not (Test-Path -LiteralPath $GhPath)) {
  $GhPath = "gh"
}

& $GhPath auth status | Out-Host
if ($LASTEXITCODE -ne 0) {
  Write-Host "GitHub CLI is not authenticated yet."
  Write-Host "Run:"
  Write-Host "  & 'C:\Program Files\GitHub CLI\gh.exe' auth login"
  exit 1
}

$status = git status --porcelain
if ($status) {
  Write-Host "Working tree is not clean. Commit or stash changes before publishing."
  git status -sb
  exit 1
}

$remote = git remote get-url origin 2>$null
if (-not $remote) {
  & $GhPath repo create $RepoName "--$Visibility" --source . --remote origin --push
} else {
  git push -u origin main
}

Write-Host "Published:"
& $GhPath repo view --web --json url --jq .url
