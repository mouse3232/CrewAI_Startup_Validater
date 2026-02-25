import sqlite3
import os
import sys

# Ensure server module can be imported
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

db_path = "startup_validater.db"

def migrate():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("Creating new v2 tables via SQLAlchemy...")
    from server.database import engine, Base
    import server.db_models # Ensure models are loaded
    
    Base.metadata.create_all(bind=engine)
    
    print("Adding workspace_id to ideas table...")
    try:
        cursor.execute("ALTER TABLE ideas ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE")
        conn.commit()
        print("Column added.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("Column already exists.")
        else:
            print(f"Error modifying ideas table: {e}")
            
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
