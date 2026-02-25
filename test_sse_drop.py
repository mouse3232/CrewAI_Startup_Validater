import requests
import time
import sqlite3
import os

# 1. Start validation via SSE
idea_id = 3 # Known ID from check_db.py
url = f"http://localhost:8000/api/ideas/{idea_id}/validate/stream"

print(f"Starting SSE stream for Idea {idea_id}...")
try:
    with requests.get(url, stream=True, timeout=5) as r:
        print("Connected. Reading some events then dropping connection...")
        count = 0
        for line in r.iter_lines():
            if line:
                print(f"Event: {line.decode()}")
                count += 1
                if count > 5:
                    break
except requests.exceptions.Timeout:
    print("Connection timed out (as expected/simulated).")
except Exception as e:
    print(f"Disconnected: {e}")

print("\nWaiting 30 seconds for background task to (potentially) complete...")
time.sleep(30)

# 2. Check DB
db_path = "data/ideas.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT id, final_score, decision, created_at FROM validations WHERE idea_id = ? ORDER BY created_at DESC LIMIT 1", (idea_id,))
val = cursor.fetchone()
conn.close()

if val:
    print(f"\nSUCCESS: Validation found in DB!")
    print(f"Val ID: {val[0]}, Score: {val[1]}, Decision: {val[2]}, Time: {val[3]}")
else:
    print("\nFAILURE: No validation found in DB after connection drop.")
