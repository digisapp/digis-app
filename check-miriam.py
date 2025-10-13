import psycopg2

conn = psycopg2.connect(
    host="aws-0-us-east-2.pooler.supabase.com",
    port=6543,
    database="postgres",
    user="postgres.lpphsjowsivjtcmafxnj",
    password="JWiYM6v3bq4Imaot"
)

cur = conn.cursor()
cur.execute("""
    SELECT id, supabase_id, email, username, display_name, is_creator, role, created_at
    FROM users
    WHERE username ILIKE '%miriam%' OR email ILIKE '%miriam%' OR display_name ILIKE '%miriam%'
    LIMIT 5
""")

rows = cur.fetchall()
print(f"Found {len(rows)} user(s):")
for row in rows:
    print(f"  ID: {row[0]}")
    print(f"  Supabase ID: {row[1]}")
    print(f"  Email: {row[2]}")
    print(f"  Username: {row[3]}")
    print(f"  Display Name: {row[4]}")
    print(f"  Is Creator: {row[5]}")
    print(f"  Role: {row[6]}")
    print(f"  Created: {row[7]}")
    print()

cur.close()
conn.close()
