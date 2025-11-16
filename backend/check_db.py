import sqlite3
from pathlib import Path

db_path = Path(__file__).parent.parent / "storage" / "database.db"
conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

cursor.execute('SELECT id, original_filename, pdf_filename, pdf_path FROM drawings ORDER BY upload_date DESC LIMIT 5')
print('Recent drawings:')
for row in cursor.fetchall():
    print(f'  ID: {row[0][:8]}... | original: "{row[1]}" | pdf: "{row[2]}" | path: {row[3]}')

conn.close()
