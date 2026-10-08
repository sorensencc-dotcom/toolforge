# Copilot / IronLedger reconciliation preview

Read-only preview. Export: 5,992 rows, 2018-01-25 through 2026-10-07. Consistent native-volume database snapshot: 1,012 staged transactions; 436 compiled entries already represented by staged IDs, so compiled entries are not counted twice. No live writes or financial posting imports.

## Results

| Item | Count |
|---|---:|
| Same account, signed amount, date, merchant overlap | 215 |
| Same account/amount, merchant overlap, date within three days | 237 |
| Compatible existing detailed categories retained | 203 |
| Pending transactions with proposed missing-category fills | 99 |
| Category disagreements requiring review | 34 |
| Disagreements already compiled into accounting authority | 16 |
| Matched transfer/income rows kept out of expense category proposals | 79 |
| Matched budget-excluded regular transactions kept for review | 9 |
| Matched broad categories requiring manual interpretation | 22 |
| Matched Utilities transactions requiring subcategory choice | 6 |
| Export rows before mapped-account coverage | 3,190 |
| Export rows newer than mapped-account coverage | 49 |
| Unmapped-account export rows | 2,085 |
| Duplicate export signatures requiring review | 132 |
| Pending export transactions | 28 |
| Ambiguous candidate matches | 3 |
| Amount/date-only candidates with no merchant support | 19 |
| Unmatched within mapped-account date coverage | 34 |

These are provisional candidate matches, not proved identities. Merchant token overlap can give false positives; review both payees. One-to-one claims enforced. Duplicate export signatures are not silently deduplicated because identical purchases can be legitimate. Coverage gaps are not automatically missing transactions.

## Algorithm and category contract

1. Identify account by issuer/product/name and date/amount evidence; never by mask alone. Ten provisional account mappings in summary.json. Two Amex accounts share mask 1002. Apple Card, Apple Cash, and Savings remain unmapped. Sign orientation is inferred separately for each mapped source account, not globally: matched Amex amounts agree with Copilot; Citizens and Chase amounts reverse sign.
2. Compare integer cents against existing imported legs in USD accounts. Export lacks currency: USD denomination is an explicit assumption requiring confirmation. Posted rows only; restrict to mapped account. Exact date and merchant evidence first; unique candidates within three days are secondary. Ambiguous/competing/duplicate rows stay review-only. No new posting for a matched transaction.
3. Keep Copilot category/parent category as external labels. Do not convert every flat label into a replacement leaf account. Map each label to compatible existing account families; retain detailed accounts such as Pets:Medical, Travel:Cruises, Auto:Tolls, and Business:Subscriptions:AISubscriptions when compatible.
4. Fill uncategorized pending transactions only after match/account/currency review. Refine within the compatible family using unambiguous existing merchant rules or consistent operator-approved merchant history; otherwise show a broad fallback or request a subcategory. Current 99 proposals are broad semantic fallbacks, not trained classifications. Clothing, Other, Work Expenses, loan principal/interest, and ambiguous Utilities need operator interpretation.
5. Flag disagreements rather than overwriting detail. Sixteen flagged transactions already exist in compiled accounting: corrections require the existing governed financial amendment workflow, not projection edits.
6. Income and internal transfers remain accounting transactions. Copilot excluded is budgeting metadata, not permission to discard those rows or create expense postings. Credit-card/loan payments require both sides and principal/interest separation; never treat a payment label alone as an expense.

## Review artifacts

- transaction-preview.csv: all 5,992 rows, candidates, account/sign assumptions, current accounts, review actions.
- pending-category-proposals.csv: 99 missing-category proposals, all pending in IronLedger.
- category-conflicts.csv: 34 disagreements; target status retained.
- category-crosswalk.csv: category counts, compatible families, and observed existing targets.
- summary.json: counts, provisional account map, source hash and assumptions.
- preview.py: repeatable private analysis with integer parsing and one-to-one assertions. Not installed as an importer and not committed with personal financial data.

Next approval gate: confirm ten account mappings/signs and USD assumption, review proposed crosswalk, then select pending rows to apply. Approved/compiled conflicts are separate amendment decisions. Do not enable bulk import for historical or unmapped rows from this preview.
