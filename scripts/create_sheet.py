"""
Create (or recreate) the "Credit Card Tool" Google Sheet.

This script builds the sheet layout that sheets.py expects:
  - C1:  years_counted (default 2)
  - Row 1, cols F/G, H/I, J/K, ...: card name / selected flag pairs
  - Rows 2-18, col A: row labels; col E: wallet totals (written by the API)
  - Rows 19-35, col D: spend category labels; col E: annual spend amounts
  - Rows 2-18, cols F,H,J,...: per-card computed outputs (written by the API)

Usage:
    python create_sheet.py                         # creates new sheet, prints URL
    python create_sheet.py --id SPREADSHEET_ID     # overwrites an existing sheet

The SPREADSHEET_ID (if given) is stored in .env as SPREADSHEET_ID automatically.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# Allow running from anywhere — repo root is one level up from scripts/
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from dotenv import load_dotenv

load_dotenv(REPO_ROOT / ".env")

# Must import after dotenv so env vars are set
from credit_cards.sheets import _get_client  # noqa: E402

SHEET_NAME = "Credit Card Tool"

# 26 credit cards in the order they appear in Financial.xlsx
CARD_NAMES = [
    "American Express Platinum",
    "American Express Gold",
    "American Express Business Gold",
    "American Express Blue Business Plus",
    "Chase Sapphire Reserve",
    "Chase Sapphire Preferred",
    "Chase Ink Preferred",
    "Chase Ink Cash",
    "Chase Freedom Unlimited",
    "Chase Freedom Flex",
    "Capital One Venture X",
    "Capital One Savor",
    "Citi Strata Elite",
    "Citi Strata Premier",
    "Citi Strata",
    "Citi Custom Cash",
    "Citi Double Cash",
    "Bilt Palladium",
    "Bilt Obsidian",
    "Bilt Blue",
    "Delta SkyMiles Gold",
    "Delta SkyMiles Gold Business",
    "Delta SkyMiles Platinum",
    "Delta SkyMiles Reserve",
    "Hilton Honors Surpass",
    "Hilton Honors Aspire",
]

# Spend categories (rows 19-35, col D)
CATEGORIES = [
    "All Other",
    "Dining",
    "Groceries",
    "Personal Care",
    "Drugstores",
    "Fitness",
    "Gas",
    "Rideshare",
    "Transit",
    "Entertainment",
    "Streaming",
    "Software, Hardware",
    "Internet",
    "Phone",
    "Airlines",
    "Hotels",
    "Rotating",
]

# Default annual spend values for each category (from Financial.xlsx seed data)
DEFAULT_SPEND = {
    "All Other":          5000.0,
    "Dining":             9000.0,
    "Groceries":          6000.0,
    "Personal Care":       500.0,
    "Drugstores":          500.0,
    "Fitness":             600.0,
    "Gas":                 600.0,
    "Rideshare":          1200.0,
    "Transit":             600.0,
    "Entertainment":      1200.0,
    "Streaming":           600.0,
    "Software, Hardware":  600.0,
    "Internet":            600.0,
    "Phone":               600.0,
    "Airlines":           3000.0,
    "Hotels":             3000.0,
    "Rotating":           1500.0,
}

# Row labels for computed rows 2-18
ROW_LABELS = {
    2:  "Annual EV",
    3:  "Points Earned",
    4:  "Annual Point Earn",
    5:  "2nd Year+ EV",
    6:  "Credit Valuation",
    7:  "Annual Fee",
    8:  "SUB Points",
    9:  "Annual Bonus Points",
    10: "SUB Min Spend",
    11: "SUB Months",
    12: "SUB Return on Spend",
    13: "SUB Extra Spend",
    14: "SUB Spend Points",
    15: "SUB Opp. Cost",
    16: "Opp. Cost Abs.",
    17: "Avg. Multiplier",
    18: "CPP",
}

# Col A header labels
COL_A_HEADER = "Metric"
COL_D_HEADER = "Category"
COL_E_HEADER = "Annual Spend"


def col_letter(n: int) -> str:
    """Convert 1-indexed column number to A1-notation letter(s)."""
    result = ""
    while n > 0:
        n, rem = divmod(n - 1, 26)
        result = chr(65 + rem) + result
    return result


def build_row1(num_cards: int = 26) -> list:
    """
    Build the header row (row 1).
    A1: "years_counted label"  C1: 2 (years_counted value)
    D1: empty  E1: "Wallet Total"
    Then pairs: card_name, TRUE/FALSE (default FALSE = not selected)
    Cards start at col F (col 6, 1-indexed), alternating data/flag cols.
    """
    row = [""] * (5 + num_cards * 2)
    row[0] = "Years Counted"   # A1
    row[2] = 2                 # C1 — default years_counted = 2
    row[4] = "Wallet Total"    # E1

    for i, name in enumerate(CARD_NAMES[:num_cards]):
        data_col_idx = 5 + i * 2   # 0-indexed; col F = index 5
        flag_col_idx = data_col_idx + 1
        row[data_col_idx] = name
        row[flag_col_idx] = False   # default: not selected

    return row


def build_metric_rows(num_cards: int = 26) -> list[list]:
    """
    Build rows 2-18: label in col A, wallet total placeholder in col E,
    empty cells for per-card outputs (cols F,H,J,...).
    """
    rows = []
    for row_num in range(2, 19):
        label = ROW_LABELS.get(row_num, "")
        row = [label, "", "", "", ""]  # A-E
        for _ in range(num_cards):
            row.append("")   # data col
            row.append("")   # flag/mult col
        rows.append(row)
    return rows


def build_spend_rows() -> list[list]:
    """
    Build rows 19-35: category label in col D, default spend in col E.
    Cols A-C and F+ are left empty.
    """
    rows = []
    for cat in CATEGORIES:
        spend = DEFAULT_SPEND.get(cat, 0.0)
        row = ["", "", "", cat, spend]
        rows.append(row)
    return rows


def create_or_reset_sheet(spreadsheet_id: str | None = None) -> str:
    """
    Create a new spreadsheet (or clear and rewrite an existing one).
    Returns the spreadsheet URL.
    """
    client = _get_client()

    if spreadsheet_id:
        sh = client.open_by_key(spreadsheet_id)
        try:
            ws = sh.worksheet(SHEET_NAME)
            ws.clear()
            print(f"Cleared existing worksheet '{SHEET_NAME}' in {spreadsheet_id}")
        except Exception:
            ws = sh.add_worksheet(title=SHEET_NAME, rows=60, cols=60)
            print(f"Created new worksheet '{SHEET_NAME}' in existing spreadsheet")
    else:
        sh = client.create(SHEET_NAME)
        # Rename the default Sheet1 to our desired name
        ws = sh.get_worksheet(0)
        ws.update_title(SHEET_NAME)
        print(f"Created new spreadsheet: {sh.url}")

    # Share with anyone who has the link (optional — comment out if not desired)
    # sh.share('', perm_type='anyone', role='writer')

    # ---- Build all data ----
    all_rows: list[list] = []

    # Row 1: header
    all_rows.append(build_row1())

    # Rows 2-18: metric labels + empty result slots
    all_rows.extend(build_metric_rows())

    # Rows 19-35: spend category labels + default spend values
    all_rows.extend(build_spend_rows())

    # Pad all rows to the same length
    max_len = max(len(r) for r in all_rows)
    padded = [r + [""] * (max_len - len(r)) for r in all_rows]

    ws.update(values=padded, range_name="A1", value_input_option="USER_ENTERED")

    # ---- Formatting: freeze row 1 and col A ----
    ws.freeze(rows=1, cols=1)

    # ---- Bold the header row ----
    num_cols = max_len
    ws.format("A1:ZZ1", {"textFormat": {"bold": True}})
    ws.format("A1:A35", {"textFormat": {"bold": True}})
    ws.format("D19:D35", {"textFormat": {"bold": True}})

    print(f"\nSheet URL: {sh.url}")
    print(f"Spreadsheet ID: {sh.id}")
    print(
        f"\nAdd this to credit_cards/.env:\n"
        f"  SPREADSHEET_ID={sh.id}\n"
        f"  SHEET_NAME={SHEET_NAME}\n"
    )
    return sh.url


def main() -> None:
    parser = argparse.ArgumentParser(description="Create the Credit Card Tool Google Sheet")
    parser.add_argument(
        "--id",
        dest="spreadsheet_id",
        default=None,
        help="Existing spreadsheet ID to reuse (creates a new one if omitted)",
    )
    args = parser.parse_args()
    create_or_reset_sheet(args.spreadsheet_id)


if __name__ == "__main__":
    main()
