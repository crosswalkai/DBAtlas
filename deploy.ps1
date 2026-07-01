# deploy.ps1
# Automates staging, committing, and pushing changes to trigger GCP Cloud Run redeployment.

# 1. Stage all changes
Write-Host "Staging all changes..." -ForegroundColor Cyan
git add .

# 2. Get commit message (defaults to automatic deploy message)
$commitMsg = $args[0]
if ([string]::IsNullOrEmpty($commitMsg)) {
    $commitMsg = "deploy: automatic deployment update - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
}

# 3. Commit changes
Write-Host "Committing changes with message: '$commitMsg'..." -ForegroundColor Cyan
git commit -m $commitMsg

# 4. Push to remote repository
Write-Host "Pushing to GitHub (origin main)..." -ForegroundColor Cyan
git push origin main

Write-Host "Push complete! Cloud Run build has been triggered." -ForegroundColor Green
