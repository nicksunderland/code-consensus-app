from dotenv import load_dotenv
import pandas as pd
import numpy as np
import os
from itertools import combinations
from pathlib import Path

# Ensure we pick up backend/.env even when run from elsewhere
load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")

# -----------------------------
# 0️⃣ Settings
# -----------------------------
HES = Path(os.getenv("HES"))
min_web_count = 100  # see guidance: https://community.ukbiobank.ac.uk/hc/en-gb/articles/24842092764061-Reporting-small-numbers-in-results-in-research-outputs-using-UK-Biobank-data

# -----------------------------
# 1️⃣ Read HES data
# -----------------------------
hes = pd.read_csv(HES, sep="\t")

# Keep only unique patient-code pairs and remove empty codes
unq_codes = hes[['eid', 'diag_icd10']].drop_duplicates()
unq_codes = unq_codes[unq_codes['diag_icd10'].notna()]
unq_codes = unq_codes[unq_codes['diag_icd10'] != ""]

# -----------------------------
# 2️⃣ Group codes by patient
# -----------------------------
codes_per_eid = unq_codes.groupby('eid')['diag_icd10'].apply(list).reset_index(name='codes')

# -----------------------------
# 3️⃣ Generate all co-occurring pairs
# -----------------------------
cooccur_list = []
for _, row in codes_per_eid.iterrows():
    codes_vec = row['codes']
    if len(codes_vec) < 2:
        continue
    # Generate all pairs (code_i, code_j)
    cooccur_list.extend([(row['eid'], ci, cj) for ci, cj in combinations(codes_vec, 2)])

cooccur_df = pd.DataFrame(cooccur_list, columns=['eid', 'code_i', 'code_j'])

# -----------------------------
# 4️⃣ Count co-occurrences
# -----------------------------
cooccur_counts = cooccur_df.groupby(['code_i', 'code_j']).size().reset_index(name='cooc_count')

# Ensure ordered pairs (code_i < code_j) before aggregating to avoid FK/constraint issues
sorted_pairs = np.sort(cooccur_counts[['code_i', 'code_j']].values, axis=1)
cooccur_counts['code_i'] = sorted_pairs[:, 0]
cooccur_counts['code_j'] = sorted_pairs[:, 1]
cooccur_counts = cooccur_counts.groupby(['code_i', 'code_j'], as_index=False)['cooc_count'].sum()

# -----------------------------
# 5️⃣ Count individual code occurrences
# -----------------------------
code_counts = unq_codes.groupby('diag_icd10').size().reset_index(name='count')
cooccur_counts = cooccur_counts.merge(code_counts.rename(columns={'diag_icd10': 'code_i', 'count': 'count_i'}), on='code_i')
cooccur_counts = cooccur_counts.merge(code_counts.rename(columns={'diag_icd10': 'code_j', 'count': 'count_j'}), on='code_j')

# -----------------------------
# 6️⃣ Total number of patients
# -----------------------------
n_patients = unq_codes['eid'].nunique()

# -----------------------------
# 7️⃣ Calculate Jaccard, Lift, Counts
# -----------------------------
cooccur_counts['jaccard'] = (
    cooccur_counts['cooc_count'] /
    (cooccur_counts['count_i'] + cooccur_counts['count_j'] - cooccur_counts['cooc_count'])
).round(3)

# clipped at 100
cooccur_counts['lift'] = (
    (cooccur_counts['cooc_count'] / n_patients) /
    ((cooccur_counts['count_i'] / n_patients) * (cooccur_counts['count_j'] / n_patients))
).clip(upper=99.999).round(3)

# Pair counts (suppressed/rounded downstream)
cooccur_counts['pair_count'] = cooccur_counts['cooc_count']

# -----------------------------
# 8️⃣ Apply web-browser threshold
# -----------------------------
cooccur_web = cooccur_counts[cooccur_counts['cooc_count'] >= min_web_count].copy()

# -----------------------------
# Replace codes with ids
# -----------------------------
codes_df = pd.read_csv(os.path.expanduser("~/Downloads/codes.csv"))
code_to_id = codes_df.set_index('code')['id'].to_dict()
cooccur_web['code_i'] = cooccur_web['code_i'].map(code_to_id)
cooccur_web['code_j'] = cooccur_web['code_j'].map(code_to_id)
cooccur_web = cooccur_web.dropna(subset=['code_i', 'code_j'])
cooccur_web['code_i'] = cooccur_web['code_i'].astype(int)
cooccur_web['code_j'] = cooccur_web['code_j'].astype(int)

# Enforce code_i < code_j after ID mapping and regroup
ordered_ids = np.sort(cooccur_web[['code_i', 'code_j']].values, axis=1)
cooccur_web['code_i'] = ordered_ids[:, 0]
cooccur_web['code_j'] = ordered_ids[:, 1]
cooccur_web = cooccur_web.groupby(['code_i', 'code_j'], as_index=False).agg({
    'jaccard': 'first',
    'lift': 'first',
    'pair_count': 'sum'
})

for col in ['cooc_count', 'count_i', 'count_j']:
    if col in cooccur_web.columns:
        cooccur_web = cooccur_web.drop(columns=[col])

cooccur_web = cooccur_web.reset_index(drop=True)  # reset default index
cooccur_web.insert(0, 'id', cooccur_web.index + 1)

# -----------------------------
# 9️⃣ Save results
# -----------------------------
cooccur_web.to_csv(os.path.expanduser('~/Downloads/cooccurrence_web_summary.csv'), index=False)
