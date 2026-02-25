import sqlite3

conn = sqlite3.connect('data/ideas.db')
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE ideas ADD COLUMN structured_input JSON DEFAULT '{}';")
    print("Column added.")
except sqlite3.OperationalError as e:
    print(f"Error (maybe column exists): {e}")

conn.commit()
conn.close()
