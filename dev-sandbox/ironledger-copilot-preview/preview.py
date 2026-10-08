import csv, json, sqlite3, hashlib, collections, re, sys, os
from decimal import Decimal
from datetime import date
from pathlib import Path

sys.path.insert(0, "C:/dev/IronLedger/src")
from ironledger.ingest.identity import canonical_payee

ROOT = Path(__file__).parent
SOURCE = Path(os.environ.get("COPILOT_EXPORT_PATH", sys.argv[1] if len(sys.argv) > 1 else "G:/My Drive/transactions.csv"))

ACCOUNT_MAP = {
    "American Express Gold Card": ("Liabilities:CreditCard:AmexGold", 1),
    "Blue from American Express": ("Liabilities:CreditCard:AmexBlue", 1),
    "Bonvoy Amex Card": ("Liabilities:CreditCard:AmexBonvoy", 1),
    "Delta SkyMiles® Gold Card": ("Liabilities:CreditCard:AmexDeltaSkyMiles", 1),
    "Hilton Honors Aspire Card": ("Liabilities:CreditCard:AmexHiltonAspire", 1),
    "Marriott Bonvoy® Boundless Credit Card": ("Liabilities:CreditCard:ChaseMarriott", -1),
    "One Deposit Checking": ("Assets:Citizens:Checking", -1),
    "Southwest Rapid Rewards® Priority Credit Card": ("Liabilities:CreditCard:ChaseRapidRewards", -1),
    "Ultimate Rewards®": ("Liabilities:CreditCard:ChaseFreedom", -1),
    "World of Hyatt Credit Card": ("Liabilities:CreditCard:ChaseWorldOfHyatt", -1),
    "Apple Card": ("Liabilities:CreditCard:AppleCard", 1),
    "Apple Cash": ("Assets:Apple:Cash", -1),
    "Savings": ("Assets:Apple:Savings", -1),
}

CATEGORY_MAP = {
    "Groceries": ("Expenses:Groceries", ["Expenses:Groceries"]),
    "Restaurants": ("Expenses:Dining", ["Expenses:Dining"]),
    "Shops": ("Expenses:Shopping", ["Expenses:Shopping", "Expenses:Household"]),
    "Travel & Vacation": ("Expenses:Travel", ["Expenses:Travel"]),
    "Car": ("Expenses:Auto", ["Expenses:Auto"]),
    "Parking": ("Expenses:Auto", ["Expenses:Auto"]),
    "Pets": ("Expenses:Pets", ["Expenses:Pets"]),
    "Subscriptions": ("Expenses:Subscriptions", ["Expenses:Subscriptions", "Expenses:Business:Subscriptions"]),
    "Business Subscription": ("Expenses:Business:Subscriptions", ["Expenses:Business:Subscriptions"]),
    "Utilities": (None, ["Expenses:Phone", "Expenses:Housing:Utilites", "Expenses:Business:Internet"]),
    "Healthcare": ("Expenses:Health", ["Expenses:Health"]),
    "Beauty": ("Expenses:Health:Beauty", ["Expenses:Health:Beauty", "Expenses:PersonalCare"]),
    "Personal Care": ("Expenses:PersonalCare", ["Expenses:PersonalCare", "Expenses:Health:Beauty"]),
    "Insurance": ("Expenses:Insurance", ["Expenses:Insurance"]),
    "Gym": ("Expenses:Fitness", ["Expenses:Fitness"]),
    "Storage": ("Expenses:Housing:Storage", ["Expenses:Housing:Storage"]),
    "Rent": ("Expenses:Housing", ["Expenses:Housing"]),
    "Home": (None, ["Expenses:Housing", "Expenses:Household"]),
    "Interest Charges": ("Expenses:InterestCharges", ["Expenses:InterestCharges"]),
    "Bank Fees": ("Expenses:Fees", ["Expenses:Fees", "Expenses:CreditCard:AnnualFee"]),
    "Foreign Transaction Fee": ("Expenses:Fees", ["Expenses:Fees"]),
    "Entertainment": ("Expenses:Entertainment", ["Expenses:Entertainment"]),
}

MERCHANT_OVERRIDES = [
    (r"coastline outfitters", "Expenses:Shopping"),
    (r"get covered", "Expenses:Business"),
    (r"harbor freigh", "Expenses:Household"),
    (r"austin airport.*f&b", "Expenses:Dining"),
    (r"sam'?s\s*club\s*renewal", "Expenses:Subscriptions"),
    (r"sam'?s\s*club\s*fuel", "Expenses:Auto"),
    (r"sam'?s\s*club", "Expenses:Groceries"),
    (r"geico", "Expenses:Insurance"),
    (r"primo water", "Expenses:Groceries"),
    (r"purchase interest charge", "Expenses:InterestCharges"),
    (r"interest charge on pay over time", "Expenses:InterestCharges"),
]

MERCHANT_OVERRIDES_COMPILED = [
    (re.compile(p, re.IGNORECASE), target) for p, target in MERCHANT_OVERRIDES
]

def cents(value):
    amount = Decimal(value) * 100
    if not amount.is_finite() or amount != amount.to_integral_value():
        raise ValueError("Non-integral minor units")
    return int(amount)

assert cents("-12.34") == -1234 and cents("0.01") == 1
try: cents("1.001")
except ValueError: pass
else: raise AssertionError("Fractional cents accepted")

STOP = {"payment", "pay", "paypal", "online", "bank", "card", "credit", "check", "transaction", "ach", "inc", "llc", "com", "the", "us", "fl", "ny", "ca", "help", "tst", "aplpay"}
def merchant_match(left, right):
    left, right = canonical_payee(left), canonical_payee(right)
    def tokens(value):
        return {("amazon" if x in {"amzn", "amazon"} else x) for x in re.findall(r"[a-z]+", value) if len(x) >= 3 and x not in STOP}
    a,b=tokens(left),tokens(right)
    return bool(a and b and a & b)
assert merchant_match("Amazon", "AMZN Mktp US")
assert not merchant_match("Online Payment", "Credit Card Payment")


def run_preview(source_path: Path = SOURCE, root_dir: Path = ROOT):
    if not source_path.exists():
        print(f"Warning: source file {source_path} not found. Exiting.")
        return {}

    with source_path.open(encoding="utf-8-sig", newline="") as f:
        export = list(csv.DictReader(f))
    
    db_file = root_dir / "snapshot.db"
    c = sqlite3.connect(f"file:{db_file}?mode=ro", uri=True)
    c.row_factory = sqlite3.Row
    transactions = [dict(r) for r in c.execute("SELECT st.staged_transaction_id id,st.proposed_date date,st.payee,st.status,sp.account,sp.minor_units,sp.currency,sp.minor_unit_scale scale FROM staged_transactions st JOIN staged_postings sp ON sp.staged_transaction_id=st.staged_transaction_id WHERE sp.role='imported' AND st.status IN ('pending','categorized','approved')")]
    contra = collections.defaultdict(set)
    for r in c.execute("SELECT staged_transaction_id,account FROM staged_postings WHERE role='contra'"):
        if r[1]:
            contra[r[0]].add(r[1])
    
    index = collections.defaultdict(list)
    spans = {}
    for t in transactions:
        if t["currency"] == "USD" and t["scale"] == 2:
            index[(t["account"], t["minor_units"])].append(t)
        lo, hi = spans.get(t["account"], (t["date"], t["date"]))
        spans[t["account"]] = (min(lo, t["date"]), max(hi, t["date"]))
    
    def signature(r):
        return tuple(r.get(k, "") for k in ("date", "name", "amount", "account", "account mask", "type"))
    
    duplicates = collections.Counter(signature(r) for r in export)
    previews = []
    for lineno, r in enumerate(export, 2):
        n = cents(r["amount"])
        day = date.fromisoformat(r["date"])
        acc_clean = r.get("account", "").replace("\u00a0", " ").strip()
        mapped = ACCOUNT_MAP.get(acc_clean)
        out = {
            "csv_line": lineno,
            "copilot_date": r["date"],
            "copilot_name": r["name"],
            "amount_minor": n,
            "copilot_account": acc_clean,
            "account_mask": r.get("account mask", ""),
            "copilot_type": r.get("type", ""),
            "copilot_category": r.get("category", "").strip(),
            "parent_category": r.get("parent category", "").strip(),
            "budget_excluded": r.get("excluded", ""),
            "account_mapping": "provisional" if mapped else "unmapped",
            "ironledger_account": mapped[0] if mapped else "",
            "match": "",
            "target_id": "",
            "target_date": "",
            "target_payee": "",
            "target_status": "",
            "current_accounts": "",
            "category_action": "",
            "suggested_account": ""
        }
        if r.get("status") != "posted":
            out["match"] = "pending_export"
        elif duplicates[signature(r)] > 1:
            out["match"] = "duplicate_export_review"
        elif not mapped:
            out["match"] = "unmapped_account"
        else:
            candidates = []
            for t in index[(mapped[0], n * mapped[1])]:
                delta = abs((date.fromisoformat(t["date"]) - day).days)
                if delta <= 3:
                    candidates.append((delta, merchant_match(r["name"], t["payee"]), t))
            exact = [t for d, m, t in candidates if d == 0 and m]
            nearby = [t for d, m, t in candidates if m]
            chosen = exact if exact else nearby
            if len(chosen) == 1:
                t = chosen[0]
                out.update(
                    match="exact_date_merchant" if exact else "date_window_merchant",
                    target_id=t["id"],
                    target_date=t["date"],
                    target_payee=t["payee"],
                    target_status=t["status"],
                    current_accounts=" | ".join(sorted(contra[t["id"]]))
                )
            elif chosen:
                out["match"] = "ambiguous_targets"
            elif candidates:
                out["match"] = "amount_date_only_review"
            elif mapped[0] in spans and (r["date"] < spans[mapped[0]][0] or r["date"] > spans[mapped[0]][1]):
                out["match"] = "outside_account_coverage"
            else:
                out["match"] = "unmatched_in_coverage"
        previews.append(out)

    claims = collections.Counter(p["target_id"] for p in previews if p["target_id"])
    for p in previews:
        if p["target_id"] and claims[p["target_id"]] > 1:
            p["match"] = "competing_export_rows"
            p["target_id"] = ""
        if p["match"] not in {"exact_date_merchant", "date_window_merchant"}:
            p["category_action"] = "match_review_first"
            continue
        if p["copilot_type"] != "regular":
            p["category_action"] = "transfer_income_review"
            continue
        if p["budget_excluded"] == "true":
            p["category_action"] = "budget_exclusion_review"
            continue
        category = p["copilot_category"]
        mapping = CATEGORY_MAP.get(category)
        payee_to_check = p.get("target_payee") or ""
        for regex_pat, target in MERCHANT_OVERRIDES_COMPILED:
            if regex_pat.search(p["copilot_name"]) or (payee_to_check and regex_pat.search(payee_to_check)):
                mapping = (target, [target])
                break
        accounts = contra[p["target_id"]]
        known = accounts - {"Expenses:Unassigned", "Expenses:Uncategorized"}
        if not category:
            p["category_action"] = "copilot_category_missing"
        elif len(accounts) > 1:
            p["category_action"] = "preserve_split_review"
        elif not mapping:
            p["category_action"] = "broad_category_manual_review"
        elif known:
            compatible = all(any(a == family or a.startswith(family + ":") for family in mapping[1]) for a in known)
            p["category_action"] = "preserve_compatible_detail" if compatible else "category_conflict_review"
        elif mapping[0]:
            p["category_action"] = "propose_fill_gap"
            p["suggested_account"] = mapping[0]
        else:
            p["category_action"] = "needs_subcategory_review"

    assert len(previews) == len(export)
    assert len([p["target_id"] for p in previews if p["target_id"]]) == len({p["target_id"] for p in previews if p["target_id"]})
    
    with (root_dir / "transaction-preview.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(previews[0]))
        w.writeheader()
        w.writerows(previews)

    cross = collections.defaultdict(collections.Counter)
    for p in previews:
        if p["target_id"]:
            cross[p["copilot_category"]][p["current_accounts"]] += 1

    with (root_dir / "category-crosswalk.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["copilot_category", "export_rows", "matched_rows", "proposed_broad_target", "allowed_existing_families", "observed_ironledger_accounts"])
        w.writeheader()
        for category, count in sorted(collections.Counter(p["copilot_category"] for p in previews).items()):
            target, families = CATEGORY_MAP.get(category, (None, []))
            w.writerow(dict(
                copilot_category=category,
                export_rows=count,
                matched_rows=sum(cross[category].values()),
                proposed_broad_target=target or "review",
                allowed_existing_families=" | ".join(families),
                observed_ironledger_accounts=json.dumps(cross[category], sort_keys=True)
            ))

    summary = {
        "source_sha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
        "export_rows": len(export),
        "snapshot_transactions": len(transactions),
        "match_counts": dict(collections.Counter(p["match"] for p in previews)),
        "category_actions": dict(collections.Counter(p["category_action"] for p in previews)),
        "provisional_account_map": ACCOUNT_MAP,
        "unmapped_accounts": sorted({p["copilot_account"] for p in previews if p["account_mapping"] == "unmapped"}),
        "assumptions": [
            "No currency in export: USD compared only to USD 2-decimal imported legs",
            "Account mappings and per-account signs are provisional, based on names/date-amount overlap",
            "Merchant token overlap is preview evidence, not identity proof",
            "Excluded is budget metadata, not permission to discard income/transfers",
            "No live writes or new financial transactions"
        ]
    }
    (root_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


if __name__ == "__main__":
    summary = run_preview()
    if summary:
        print(json.dumps({k: v for k, v in summary.items() if k not in {"provisional_account_map", "source_sha256"}}, indent=2))
