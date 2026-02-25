import sqlite3
import time
import os

db_path = "data/ideas.db"
idea_id = 3

print(f"Monitoring DB for new validation on Idea {idea_id}...")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT MAX(id) FROM validations")
last_id = cursor.fetchone()[0] or 0
conn.close()

print(f"Current Max Val ID: {last_id}")
print("Waiting up to 300 seconds for background process...")

found = False
for i in range(30):
    time.sleep(10)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, final_score, decision, created_at FROM validations WHERE id > ? AND idea_id = ? ORDER BY id DESC LIMIT 1", (last_id, idea_id))
    val = cursor.fetchone()
    conn.close()
    
    if val:
        print(f"\nSUCCESS after { (i+1)*10 }s: Validation found!")
        print(f"New Val ID: {val[0]}, Score: {val[1]}, Decision: {val[2]}, Time: {val[3]}")
        found = True
        break
    else:
        print(f"Checked at { (i+1)*10 }s... not yet.")

if not found:
    print("\nTIMED OUT: Validation never appeared in DB.")
