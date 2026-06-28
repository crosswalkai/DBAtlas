@echo off
echo DBA Diagnostic Copilot -- Backend
echo ==================================

if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat

echo Installing dependencies...
pip install -r requirements.txt -q

if not exist .env (
    echo ERROR: .env file not found. Copy .env.example to .env and set ANTHROPIC_API_KEY.
    pause
    exit /b 1
)

echo.
echo Starting FastAPI on http://localhost:8000
echo API docs: http://localhost:8000/docs
echo.

python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
