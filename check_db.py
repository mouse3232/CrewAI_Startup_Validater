import sqlite3
import os

db_path = "data/ideas.db"
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("SELECT id, title, status FROM ideas ORDER BY updated_at DESC LIMIT 3")
    ideas = cursor.fetchall()
    print("--- RECENT IDEAS ---")
    for idea in ideas:
        print(f"ID: {idea[0]}, Title: {idea[1]}, Status: {idea[2]}")
        
    cursor.execute("SELECT id, idea_id, final_score, decision, created_at FROM validations ORDER BY created_at DESC LIMIT 5")
    vals = cursor.fetchall()
    print("\n--- RECENT VALIDATIONS ---")
    for val in vals:
        print(f"Val ID: {val[0]}, Idea ID: {val[1]}, Score: {val[2]}, Decision: {val[3]}, Created: {val[4]}")
except Exception as e:
    print(f"Error reading DB: {e}")
finally:
    conn.close()
