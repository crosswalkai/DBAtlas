# start.ps1 - Run from the backend/ directory
# Usage: .\start.ps1

Write-Host "DBA Diagnostic Copilot - Backend" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Check Python
$pyVersion = python --version 2>&1
Write-Host "Python: $pyVersion"

# Install dependencies if needed
if (-not (Test-Path ".\venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

# Activate venv
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
.\venv\Scripts\Activate.ps1

# Install deps
Write-Host "Installing dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt -q

# Check .env exists
if (-not (Test-Path ".\.env")) {
    Write-Host "ERROR: .env file not found. Copy .env.example to .env and set your ANTHROPIC_API_KEY." -ForegroundColor Red
    exit 1
}

# Check API key is set
$envContent = Get-Content .\.env
$apiKeyLine = $envContent | Where-Object { $_ -match "ANTHROPIC_API_KEY=" }
if ($apiKeyLine -match "your-anthropic-api-key-here") {
    Write-Host "WARNING: ANTHROPIC_API_KEY is not set in .env - Claude calls will fail." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting FastAPI server on http://localhost:8000" -ForegroundColor Green
Write-Host "API docs: http://localhost:8000/docs" -ForegroundColor Green
Write-Host "Health:   http://localhost:8000/api/v1/health" -ForegroundColor Green
Write-Host ""

# Start uvicorn with hot reload
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
