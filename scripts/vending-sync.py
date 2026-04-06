#!/usr/bin/env python3
"""
BrainWare Vending Machine Sync Script
--------------------------------------
Reads sales data from the local machine.db SQLite database
and pushes it to BrainWare's Supabase backend.

Run this on the Raspberry Pi as a cron job every 5 minutes:
  */5 * * * * /usr/bin/python3 /home/erfan/brainware_sync.py >> /home/erfan/brainware_sync.log 2>&1
"""

import sqlite3
import json
import os
import sys
import time
from datetime import datetime
from urllib.request import Request, urlopen
from urllib.error import URLError

# ---- Configuration ----
MACHINE_DB = "/home/erfan/Documents/machine.db"
SYNC_STATE_FILE = "/home/erfan/brainware_sync_state.json"

# Supabase config  
SUPABASE_URL = "https://jksuysdzvxlzfycchcwe.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprc3V5c2R6dnhsemZ5Y2NoY3dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1ODcwMzMsImV4cCI6MjA5MDE2MzAzM30.XqmP6idyMKI4OvbeJp716O-omFiZ3HILBFvey6ZckX8"

# Machine identity
STORE_ID = "65e7b013-8f66-48e6-ac0c-94d018809e15"
VENDING_MACHINE_ID = "54b25fc8-13ea-4e1b-978c-8292dc20e80e"
MACHINE_NAME = "Sistina"  # CyberEtna name: Cavour

# Product mapping: CyberEtna productId -> BrainWare product name
PRODUCT_MAP = {
    2525: "Prodotto 4",   # dispenserId 4, €40
    2531: "Prodotto 5",   # dispenserId 5, €40
    2526: "Prodotto 6",   # dispenserId 6, €40
    2528: "Prodotto 7",   # dispenserId 7, €40
    2534: "Prodotto 8",   # dispenserId 8, €40
    2532: "Prodotto 9",   # dispenserId 9, €30
    2529: "Prodotto 10",  # dispenserId 10, €30
    2530: "Prodotto 11",  # dispenserId 11, €30
    2533: "Prodotto 12",  # dispenserId 12, €35
    2527: "Prodotto 13",  # dispenserId 13, €30
}


def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}")


def supabase_request(endpoint, method="GET", data=None):
    """Make a request to Supabase REST API"""
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    
    body = json.dumps(data).encode() if data else None
    req = Request(url, data=body, headers=headers, method=method)
    
    try:
        with urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except URLError as e:
        log(f"Supabase error: {e}")
        return None


def load_sync_state():
    """Load last sync position"""
    if os.path.exists(SYNC_STATE_FILE):
        with open(SYNC_STATE_FILE, "r") as f:
            return json.load(f)
    return {"last_sale_id": 0, "last_ingresso_id": 0, "total_synced": 0}


def save_sync_state(state):
    """Save sync position"""
    with open(SYNC_STATE_FILE, "w") as f:
        json.dump(state, f)


def ms_to_iso(timestamp_ms):
    """Convert millisecond timestamp to ISO datetime string"""
    dt = datetime.fromtimestamp(timestamp_ms / 1000)
    return dt.isoformat()


def read_new_sales(last_id):
    """Read new sales from machine.db"""
    conn = sqlite3.connect(f"file:{MACHINE_DB}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    cur.execute("""
        SELECT id, dateOra, productId, price, note, tipoErogazione, 
               dispenserId, nomeProdotto, tipoPagamento
        FROM prodottiNewServer 
        WHERE id > ? 
        ORDER BY id ASC
    """, (last_id,))
    
    sales = [dict(row) for row in cur.fetchall()]
    conn.close()
    return sales


def read_new_cash_entries(last_id):
    """Read new cash entries (money inserted)"""
    conn = sqlite3.connect(f"file:{MACHINE_DB}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    cur.execute("""
        SELECT id, dateTime, cents, tipoDispositivo
        FROM storicoIngressi
        WHERE id > ?
        ORDER BY id ASC
    """, (last_id,))
    
    entries = [dict(row) for row in cur.fetchall()]
    conn.close()
    return entries


def get_sales_summary():
    """Get total sales count and revenue"""
    conn = sqlite3.connect(f"file:{MACHINE_DB}?mode=ro", uri=True)
    cur = conn.cursor()
    
    cur.execute("SELECT COUNT(*), COALESCE(SUM(price), 0) FROM prodottiNewServer WHERE tipoErogazione = 1")
    count, revenue = cur.fetchone()
    
    cur.execute("SELECT COALESCE(SUM(cents), 0) FROM storicoIngressi")
    total_cash_in = cur.fetchone()[0] / 100  # cents to euros
    
    cur.execute("SELECT COALESCE(SUM(cents), 0) FROM storicoUscite")
    total_cash_out = cur.fetchone()[0] / 100
    
    conn.close()
    return {
        "total_sales": count,
        "total_revenue": revenue,
        "total_cash_in": total_cash_in,
        "total_cash_out": total_cash_out,
        "net_cash": total_cash_in - total_cash_out,
    }


def sync_sales_to_supabase(sales):
    """Push new sales to Supabase vending_sales table"""
    if not STORE_ID or not VENDING_MACHINE_ID:
        log("⚠️  STORE_ID and VENDING_MACHINE_ID not configured. Run setup first.")
        return 0
    
    synced = 0
    for sale in sales:
        record = {
            "vending_machine_id": VENDING_MACHINE_ID,
            "store_id": STORE_ID,
            "local_id": sale["id"],
            "product_id_cyberetna": sale["productId"],
            "dispenser_id": sale["dispenserId"],
            "price": sale["price"],
            "payment_type": "cash" if sale.get("tipoPagamento") == 1 else "other",
            "note": sale.get("note", ""),
            "status": "success" if sale.get("tipoErogazione") == 1 else "failed",
            "sold_at": ms_to_iso(sale["dateOra"]),
        }
        
        result = supabase_request("vending_sales", method="POST", data=record)
        if result:
            synced += 1
        else:
            log(f"Failed to sync sale {sale['id']}")
    
    return synced


def update_machine_status(summary):
    """Update the vending machine status in Supabase"""
    if not VENDING_MACHINE_ID:
        return
    
    data = {
        "total_dispensed": summary["total_sales"],
        "last_sync_at": datetime.now().isoformat(),
        "status": "online",
    }
    
    supabase_request(
        f"vending_machines?id=eq.{VENDING_MACHINE_ID}",
        method="PATCH",
        data=data
    )


def main():
    log(f"🔄 BrainWare Vending Sync - {MACHINE_NAME}")
    
    # Check DB exists
    if not os.path.exists(MACHINE_DB):
        log(f"❌ Database not found: {MACHINE_DB}")
        sys.exit(1)
    
    # Load state
    state = load_sync_state()
    log(f"Last synced sale ID: {state['last_sale_id']}")
    
    # Read new sales
    new_sales = read_new_sales(state["last_sale_id"])
    log(f"New sales found: {len(new_sales)}")
    
    if new_sales:
        # Sync to Supabase
        synced = sync_sales_to_supabase(new_sales)
        log(f"✅ Synced {synced} sales to BrainWare")
        
        # Update state
        state["last_sale_id"] = new_sales[-1]["id"]
        state["total_synced"] = state.get("total_synced", 0) + synced
    
    # Read cash entries
    new_cash = read_new_cash_entries(state["last_ingresso_id"])
    if new_cash:
        log(f"💰 {len(new_cash)} new cash entries (€{sum(c['cents'] for c in new_cash) / 100:.2f})")
        state["last_ingresso_id"] = new_cash[-1]["id"]
    
    # Get summary
    summary = get_sales_summary()
    log(f"📊 Total: {summary['total_sales']} sales, €{summary['total_revenue']:.2f} revenue, €{summary['net_cash']:.2f} net cash")
    
    # Update machine status
    update_machine_status(summary)
    
    # Save state
    save_sync_state(state)
    log("✅ Sync complete\n")


if __name__ == "__main__":
    main()
