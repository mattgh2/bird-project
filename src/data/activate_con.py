
import duckdb
import os

def get_db():
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute(f"""
            CREATE SECRET (
                TYPE R2,
                KEY_ID '{os.environ["R2_ACCESS_KEY_ID"]}',
                SECRET '{os.environ["R2_SECRET_ACCESS_KEY"]}',
                ACCOUNT_ID '{os.environ["R2_ACCOUNT_ID"]}'
                );
            """)
    return con
