import sqlite3
import os

db_path = os.path.join("data", "ideas.db")

def migrate():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("Creating chat_messages table if it doesn't exist...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            validation_id INTEGER NOT NULL,
            role VARCHAR(50) NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(validation_id) REFERENCES validations(id) ON DELETE CASCADE
        )
    """)
    
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
