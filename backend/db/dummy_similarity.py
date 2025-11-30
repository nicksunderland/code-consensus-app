import pandas as pd
import numpy as np
import os
from itertools import combinations

# ----------------------------
# Parameters
# ----------------------------
codes = list(range(1, 11))   # Codes 1-10
n_transactions = 50          # Number of dummy transactions
min_codes_per_txn = 1
max_codes_per_txn = 5

# ----------------------------
# Step 1: Generate dummy transactions
# ----------------------------
transactions = []
for tid in range(1, n_transactions + 1):
    n_in_txn = np.random.randint(min_codes_per_txn, max_codes_per_txn + 1)
    txn_codes = np.random.choice(codes, size=n_in_txn, replace=False)
    transactions.append({
        'transaction_id': tid,
        'codes': ','.join(map(str, txn_codes))
    })

df_txn = pd.DataFrame(transactions)
df_txn.to_csv(os.path.expanduser('~/Downloads/dummy_transactions.csv'), index=False)
print("Saved dummy_transactions.csv")

# ----------------------------
# Step 2: Compute co-occurrence counts
# ----------------------------
# Initialize co-occurrence counts
cooc_counts = pd.DataFrame(0, index=codes, columns=codes)

# Fill counts
for codes_str in df_txn['codes']:
    txn_codes = list(map(int, codes_str.split(',')))
    for i, j in combinations(txn_codes, 2):
        cooc_counts.loc[i, j] += 1
        cooc_counts.loc[j, i] += 1  # symmetric

# ----------------------------
# Step 3: Compute metrics: Jaccard similarity & Lift
# ----------------------------
# Count how many transactions contain each code
code_counts = {code: sum(df_txn['codes'].str.contains(f'\\b{code}\\b')) for code in codes}
total_txns = len(df_txn)

# Build co-occurrence table
cooc_list = []
for i in codes:
    for j in codes:
        if i < j:  # store only one triangle
            count_ij = cooc_counts.loc[i,j]
            union = code_counts[i] + code_counts[j] - count_ij
            jaccard = count_ij / union if union > 0 else 0
            p_i = code_counts[i] / total_txns
            p_j = code_counts[j] / total_txns
            p_ij = count_ij / total_txns
            lift = p_ij / (p_i * p_j) if (p_i * p_j) > 0 else 0
            cooc_list.append({
                'code_i': i,
                'code_j': j,
                'count': count_ij,
                'jaccard': round(jaccard, 3),
                'lift': round(lift, 3)
            })

df_cooc = pd.DataFrame(cooc_list)
df_cooc.to_csv(os.path.expanduser('~/Downloads/dummy_code_cooccurrence.csv'), index=False)
print("Saved dummy_code_cooccurrence.csv")
