"""
DBAtlas Telemetry Correlation Verification Suite
------------------------------------------------
This script triggers a diagnostic session on the SQL Server Live Slowness playbook,
allowing you to verify that Grafana OS metrics and Splunk application logs are
ingested, processed, and correlated correctly.

Prerequisites:
  1. Backend server is running (port 8000).
  2. Python `requests` library is installed (`pip install requests` inside venv).

Usage:
  python test_telemetry.py
"""

import requests
import time
import sys

BASE_URL = "http://localhost:8000"

def run_telemetry_triage_test():
    payload = {
        "server_name": "SQLPROD-02",
        "ticket_number": "INC8827162",
        "question": "Please diagnose our SQL Server slowness and correlate it with Grafana metrics and Splunk app exceptions.",
        "mode": "auto"
    }

    print("=" * 70)
    print("1. STARTING DIAGNOSTIC SESSION")
    print(f"Target Server: {payload['server_name']}")
    print(f"Ticket Reference: {payload['ticket_number']}")
    print(f"Question: \"{payload['question']}\"")
    print("=" * 70)

    try:
        r = requests.post(f"{BASE_URL}/api/v1/diagnose", json=payload)
    except requests.exceptions.ConnectionError:
        print(f"[-] Error: Could not connect to backend server at {BASE_URL}.")
        print("    Please ensure uvicorn is running (port 8000) and try again.")
        sys.exit(1)

    if r.status_code != 200:
        print(f"[-] Error starting session: {r.status_code} - {r.text}")
        sys.exit(1)

    session_id = r.json().get("session_id")
    print(f"[+] Diagnostic session initialized successfully.")
    print(f"    Session ID: {session_id}")
    print("\n2. RUNNING DIAGNOSTIC PLAYBOOK LOOP (Polling status...)")

    # Poll until COMPLETE
    completed = False
    for attempt in range(20):
        time.sleep(3)
        res = requests.get(f"{BASE_URL}/api/v1/session/{session_id}")
        if res.status_code != 200:
            print(f"[-] Error fetching session state: {res.status_code}")
            sys.exit(1)
        
        data = res.json()
        state = data.get("state")
        steps_run = data.get("steps_executed", [])
        print(f"    [Poll {attempt+1}] State: {state:<12} | Steps run: {steps_run}")
        
        if state == "COMPLETE":
            completed = True
            break
        elif state == "ERROR":
            print(f"[-] Diagnostic loop failed with error state.")
            sys.exit(1)

    if not completed:
        print("[-] Error: Diagnostic session timed out before completing.")
        sys.exit(1)

    print("\n" + "=" * 70)
    print("3. VERIFYING COMPLETED EXECUTION TRACE")
    print("=" * 70)
    print(f"[+] Total Steps Executed: {data.get('steps_executed')}")
    print(f"[+] Steps Skipped: {data.get('steps_skipped')}")

    # Verify telemetry steps exist in the completed path
    expected_steps = ["active_requests", "blocking_chains", "grafana_os_telemetry", "splunk_app_logs"]
    missing = [step for step in expected_steps if step not in data.get("steps_executed", [])]
    if not missing:
        print("[SUCCESS] All database, infrastructure, and application telemetry steps were executed!")
    else:
        print(f"[WARNING] Some expected steps were not executed: {missing}")

    print("\n" + "=" * 70)
    print("4. CORRELATED ROOT CAUSE ANALYSIS REPORT")
    print("=" * 70)
    analysis = data.get("analysis", {})
    print(f"Severity: {analysis.get('severity', 'UNKNOWN').upper()} (Rationale: {analysis.get('severity_rationale')})")
    print(f"Confidence: {analysis.get('confidence', 'UNKNOWN').upper()}")
    print("-" * 70)
    print(f"Summary of Findings:\n{analysis.get('summary')}\n")
    
    print("Key Evidence-Backed Findings:")
    for i, finding in enumerate(analysis.get("key_findings", []), 1):
        print(f" {i}. {finding}")
        
    print("\nRecommended Corrective Actions:")
    for i, action in enumerate(analysis.get("recommended_actions", []), 1):
        print(f" {i}. {action}")
    print("=" * 70)

if __name__ == "__main__":
    run_telemetry_triage_test()
