"""Test suite for IronLedger Copilot preview, account mapping, and reconciliation engine."""

import re
import os
import pytest
from decimal import Decimal
from pathlib import Path
import sqlite3
import csv

# Add source paths relative to test file location
CURRENT_DIR = Path(__file__).resolve().parent
REPO_ROOT = CURRENT_DIR.parent.parent

import sys
sys.path.insert(0, str(REPO_ROOT / "IronLedger" / "src"))
sys.path.insert(0, str(CURRENT_DIR))

from preview import (
    ACCOUNT_MAP,
    CATEGORY_MAP,
    MERCHANT_OVERRIDES_COMPILED,
    cents,
    merchant_match,
    STOP,
)


class TestCentsConversion:
    """Unit tests for currency string to integer minor-unit (cents) conversion."""

    def test_positive_amounts(self):
        assert cents("0.01") == 1
        assert cents("1.00") == 100
        assert cents("12.34") == 1234
        assert cents("123456.78") == 12345678

    def test_negative_amounts(self):
        assert cents("-0.01") == -1
        assert cents("-12.34") == -1234
        assert cents("-500.00") == -50000

    def test_zero_amount(self):
        assert cents("0") == 0
        assert cents("0.00") == 0
        assert cents("-0.00") == 0

    def test_rejects_sub_cent_fractions(self):
        with pytest.raises(ValueError):
            cents("1.001")
        with pytest.raises(ValueError):
            cents("0.0001")
        with pytest.raises(ValueError):
            cents("12.345")


class TestMerchantMatching:
    """Unit tests for merchant matching tokenization, stop-words, and fuzzy overlap."""

    def test_exact_and_alias_matches(self):
        assert merchant_match("Amazon", "AMZN Mktp US")
        assert merchant_match("Publix Super Markets", "AplPay PUBLIX FORT MYERS FL")
        assert merchant_match("Dunkin Donuts", "AplPay DUNKIN #36407 SHELBY TOWNSH MI")
        assert merchant_match("Walmart", "WALMART.COM 80092562 BENTONVILLE AR")
        assert merchant_match("Chevron", "CHEVRON 0382623/CHEV TAMPA FL")

    def test_stops_generic_false_positives(self):
        assert not merchant_match("Online Payment", "Credit Card Payment")
        assert not merchant_match("ACH Transfer LLC", "Check Payment Inc")
        assert not merchant_match("Bank Deposit", "Debit Card Transaction")

    def test_stop_words_presence(self):
        for word in ["payment", "pay", "paypal", "online", "bank", "card", "credit", "llc", "aplpay", "tst"]:
            assert word in STOP


class TestAccountMappingRegistry:
    """Unit tests ensuring all financial accounts have canonical mappings and valid signs."""

    @pytest.mark.parametrize("account_name,expected_acc,expected_sign", [
        ("American Express Gold Card", "Liabilities:CreditCard:AmexGold", 1),
        ("Blue from American Express", "Liabilities:CreditCard:AmexBlue", 1),
        ("Bonvoy Amex Card", "Liabilities:CreditCard:AmexBonvoy", 1),
        ("Delta SkyMiles® Gold Card", "Liabilities:CreditCard:AmexDeltaSkyMiles", 1),
        ("Hilton Honors Aspire Card", "Liabilities:CreditCard:AmexHiltonAspire", 1),
        ("Marriott Bonvoy® Boundless Credit Card", "Liabilities:CreditCard:ChaseMarriott", -1),
        ("One Deposit Checking", "Assets:Citizens:Checking", -1),
        ("Southwest Rapid Rewards® Priority Credit Card", "Liabilities:CreditCard:ChaseRapidRewards", -1),
        ("Ultimate Rewards®", "Liabilities:CreditCard:ChaseFreedom", -1),
        ("World of Hyatt Credit Card", "Liabilities:CreditCard:ChaseWorldOfHyatt", -1),
        ("Apple Card", "Liabilities:CreditCard:AppleCard", 1),
        ("Apple Cash", "Assets:Apple:Cash", -1),
        ("Savings", "Assets:Apple:Savings", -1),
    ])
    def test_account_mapping_entries(self, account_name, expected_acc, expected_sign):
        assert account_name in ACCOUNT_MAP
        acc, sign = ACCOUNT_MAP[account_name]
        assert acc == expected_acc
        assert sign == expected_sign

    def test_account_name_whitespace_normalization(self):
        # Ensure non-breaking space variant normalizes cleanly
        raw_names = ["Apple\u00a0Card", "Apple\u00a0Cash", "Savings"]
        for name in raw_names:
            normalized = name.replace("\u00a0", " ").strip()
            assert normalized in ACCOUNT_MAP


class TestCategoryAndMerchantOverrides:
    """Unit tests for merchant-level overrides taking precedence over broad categories."""

    def _resolve_account(self, merchant_name: str, copilot_category: str) -> str:
        for regex_pat, target in MERCHANT_OVERRIDES_COMPILED:
            if regex_pat.search(merchant_name):
                return target
        if copilot_category in CATEGORY_MAP:
            return CATEGORY_MAP[copilot_category][0]
        return "review"

    def test_merchant_overrides_precedence(self):
        # Coastline Outfitters override to Shopping (Clothing)
        assert self._resolve_account("Coastline Outfitters North", "Restaurants") == "Expenses:Shopping"
        
        # Get Covered LLC override to Business
        assert self._resolve_account("Get Covered LLC", "Restaurants") == "Expenses:Business"
        
        # Harbor Freight override to Household
        assert self._resolve_account("AplPay HARBOR FREIGHT NORTH", "Restaurants") == "Expenses:Household"
        
        # Austin Airport F&B override to Dining
        assert self._resolve_account("Austin Airport-f&b", "Travel & Vacation") == "Expenses:Dining"
        
        # Sam's Club Renewal override to Subscriptions
        assert self._resolve_account("Sams Club Renewal", "Groceries") == "Expenses:Subscriptions"
        
        # Sam's Club Fuel override to Auto
        assert self._resolve_account("SAM'S CLUB FUEL #8130", "Shops") == "Expenses:Auto"
        
        # Sam's Club default override to Groceries
        assert self._resolve_account("SAM'S CLUB #6420", "Shops") == "Expenses:Groceries"
        
        # GEICO override to Insurance
        assert self._resolve_account("GEICO AUTO", "Car") == "Expenses:Insurance"
        
        # Primo Water override to Groceries
        assert self._resolve_account("Primo Water Corporatio", "Utilities") == "Expenses:Groceries"
        
        # Interest charge overrides
        assert self._resolve_account("PURCHASE INTEREST CHARGE", "Bank Fees") == "Expenses:InterestCharges"
        assert self._resolve_account("Interest Charge on Pay Over Time", "Bank Fees") == "Expenses:InterestCharges"

    def test_standard_category_resolution(self):
        assert self._resolve_account("Generic Restaurant", "Restaurants") == "Expenses:Dining"
        assert self._resolve_account("Supermarket", "Groceries") == "Expenses:Groceries"
        assert self._resolve_account("Shell Gas", "Car") == "Expenses:Auto"
        assert self._resolve_account("Dr Smith Dermatology", "Beauty") == "Expenses:Health:Beauty"
        assert self._resolve_account("Planet Fitness", "Gym") == "Expenses:Fitness"
        assert self._resolve_account("Petco", "Pets") == "Expenses:Pets"


class TestDatabaseAndLedgerInvariants:
    """Integration checks verifying database state and ledger account registrations."""

    def test_all_mapped_accounts_declared_in_beancount(self):
        accounts_file = REPO_ROOT / "IronLedger" / "ledger-vault" / "accounts.beancount"
        if not accounts_file.exists():
            accounts_file = Path("C:/dev/IronLedger/ledger-vault/accounts.beancount")
        
        assert accounts_file.exists(), f"accounts.beancount not found at {accounts_file}"
        declared_accounts = set()
        with accounts_file.open(encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) >= 3 and parts[1] == "open":
                    declared_accounts.add(parts[2])

        # Check every destination account in ACCOUNT_MAP is open in beancount
        for acc_name, (ledger_acc, _) in ACCOUNT_MAP.items():
            assert ledger_acc in declared_accounts, f"Account {ledger_acc} not open in accounts.beancount"

    def test_in_memory_staging_invariants(self):
        """Isolated in-memory test validating categorization and contra posting constraints."""
        conn = sqlite3.connect(":memory:")
        c = conn.cursor()
        
        # Setup schema
        c.execute("""
            CREATE TABLE staged_transactions (
                staged_transaction_id TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                categorized_at_utc TEXT
            )
        """)
        c.execute("""
            CREATE TABLE staged_postings (
                staged_posting_id TEXT PRIMARY KEY,
                staged_transaction_id TEXT NOT NULL,
                role TEXT NOT NULL,
                account TEXT,
                minor_units INTEGER NOT NULL
            )
        """)
        
        # Insert valid categorized transaction
        c.execute("INSERT INTO staged_transactions VALUES ('stx:1', 'categorized', '2026-10-07T22:00:00Z')")
        c.execute("INSERT INTO staged_postings VALUES ('sp:1', 'stx:1', 'imported', 'Liabilities:CreditCard:AmexGold', 1000)")
        c.execute("INSERT INTO staged_postings VALUES ('sp:2', 'stx:1', 'contra', 'Expenses:Groceries', -1000)")
        
        # Verify no unassigned contra legs exist in categorized items
        unassigned = c.execute("""
            SELECT st.staged_transaction_id
            FROM staged_transactions st
            JOIN staged_postings sp ON sp.staged_transaction_id = st.staged_transaction_id
            WHERE st.status = 'categorized'
              AND sp.role = 'contra'
              AND (sp.account IS NULL OR sp.account = '' OR sp.account = 'Expenses:Unassigned')
        """).fetchall()
        
        assert len(unassigned) == 0
        conn.close()

    def test_live_snapshot_db_has_no_null_contra_in_categorized(self):
        db_file = CURRENT_DIR / "snapshot.db"
        if not db_file.exists():
            pytest.skip("snapshot.db not present in local directory")
        
        conn = sqlite3.connect(f"file:{db_file}?mode=ro", uri=True)
        c = conn.cursor()
        
        invalid = c.execute("""
            SELECT st.staged_transaction_id, sp.account
            FROM staged_transactions st
            JOIN staged_postings sp ON sp.staged_transaction_id = st.staged_transaction_id
            WHERE st.status = 'categorized'
              AND sp.role = 'contra'
              AND (sp.account IS NULL OR sp.account = '' OR sp.account = 'Expenses:Unassigned')
        """).fetchall()
        
        conn.close()
        assert len(invalid) == 0, f"Found {len(invalid)} categorized transactions with unassigned contra leg"
