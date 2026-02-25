import sqlite3
import os

db_path = "data/ideas.db"

def fix_db():
    if not os.path.exists(db_path):
        print(f"Database {db_path} not found.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check current columns in ideas
    cursor.execute("PRAGMA table_info(ideas)")
    columns = [row[1] for row in cursor.fetchall()]
    print(f"Current columns in 'ideas': {columns}")
    
    if 'workspace_id' not in columns:
        print("Adding 'workspace_id' to 'ideas'...")
        try:
            cursor.execute("ALTER TABLE ideas ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE")
            conn.commit()
            print("Successfully added 'workspace_id'.")
        except Exception as e:
            print(f"Failed to add column: {e}")
    else:
        print("'workspace_id' already exists.")

    # Check for other tables if needed
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    print(f"Current tables: {tables}")

    conn.close()

if __name__ == "__main__":
    fix_db()
