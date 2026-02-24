"""
Single-command launcher for the AI Idea Validator.
Usage:  python run.py
"""

import os
import subprocess
import uvicorn
from dotenv import load_dotenv

load_dotenv()

def kill_port(port):
    print(f"Scanning for active processes on port {port}...")
    try:
        if os.name == 'nt': # Windows
            result = subprocess.run(['netstat', '-ano'], capture_output=True, text=True)
            for line in result.stdout.splitlines():
                if f":{port}" in line and "LISTENING" in line:
                    pid = line.split()[-1]
                    if pid != '0':
                        print(f"Terminating process {pid} on port {port}...")
                        subprocess.run(['taskkill', '/F', '/PID', pid], capture_output=True)
        else: # Lin/Mac
            result = subprocess.run(['lsof', '-t', f'-i:{port}'], capture_output=True, text=True)
            for pid in result.stdout.splitlines():
                if pid.strip():
                    print(f"Terminating process {pid} on port {port}...")
                    os.system(f"kill -9 {pid}")
    except Exception as e:
        print(f"Warning: Failed to scan or kill port {port} due to: {e}")

if __name__ == "__main__":
    kill_port(8002)
    
    uvicorn.run(
        "server.app:app",
        host="127.0.0.1",
        port=8002,
        reload=True,
    )
