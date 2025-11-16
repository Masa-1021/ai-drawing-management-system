import sqlite3
from pathlib import Path

db_path = Path(__file__).parent.parent / "storage" / "database.db"
conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

cursor.execute('PRAGMA table_info(drawings)')
print('Drawings table schema:')
for col in cursor.fetchall():
    print(f'  {col}')

conn.close()
