import psycopg2
from psycopg2.extras import RealDictCursor

conn = psycopg2.connect("postgresql://neondb_owner:npg_alivbegXt69m@ep-bitter-mode-a1h4kt9i-pooler.ap-southeast-1.aws.neon.tech/iot_db?sslmode=require&channel_binding=require")
with conn.cursor(cursor_factory=RealDictCursor) as cur:
    # Xem cấu trúc bảng
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'energy_summary'
    """)
    print([dict(r) for r in cur.fetchall()])

    # Xem dữ liệu raw
    cur.execute("SELECT * FROM energy_summary ORDER BY month LIMIT 20")
    print([dict(r) for r in cur.fetchall()])