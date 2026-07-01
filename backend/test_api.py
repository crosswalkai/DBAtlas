import requests
import json
import time

def main():
    url = "http://localhost:8000/api/v1/diagnose/start"
    payload = {
        "server_name": "SQLPROD-02",
        "ticket_number": "INC123",
        "question": "this query suddenly got slow after last night's maintenance",
        "mode": "auto"
    }
    
    print(f"Starting session at {url}")
    response = requests.post(url, json=payload)
    if response.status_code != 200:
        print("Failed to start session:", response.text)
        return
        
    data = response.json()
    session_id = data.get("session_id")
    print(f"Session started: {session_id}")
    
    stream_url = f"http://localhost:8000/api/v1/diagnose/{session_id}/stream"
    print(f"Streaming from {stream_url}")
    
    # Simple SSE stream reading
    with requests.get(stream_url, stream=True) as r:
        for line in r.iter_lines():
            if line:
                decoded_line = line.decode('utf-8')
                print(decoded_line)

if __name__ == "__main__":
    main()
