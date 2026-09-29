from dotenv import load_dotenv
import pandas as pd
import numpy as np
import os
from itertools import combinations
from pathlib import Path

# Ensure we pick up backend/.env even when run from elsewhere
load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")

# Settings
HES = Path(os.getenv("HES"))
min_web_count = 100  # see guidance: https://community.ukbiobank.ac.uk/hc/en-gb/articles/24842092764061-Reporting-small-numbers-in-results-in-research-outputs-using-UK-Biobank-data

# Read HES data
hes = pd.read_csv(HES, sep="\t")

# Keep only unique patient-code pairs and remove empty codes
unq_codes = hes[['eid', 'diag_icd10']].drop_duplicates()
unq_codes = unq_codes[unq_codes['diag_icd10'].notna()]
unq_codes = unq_codes[unq_codes['diag_icd10'] != ""]

# Group codes by patient
codes_per_eid = unq_codes.groupby('eid')['diag_icd10'].apply(list).reset_index(name='codes')

# Generate all co-occurring pairs
cooccur_list = []
for _, row in codes_per_eid.iterrows():
    codes_vec = row['codes']
    if len(codes_vec) < 2:
        continue
    cooccur_list.extend([(row['eid'], ci, cj) for ci, cj in combinations(codes_vec, 2)])

cooccur_df = pd.DataFrame(cooccur_list, columns=['eid', 'code_i', 'code_j'])

# Count co-occurrences
cooccur_counts = cooccur_df.groupby(['code_i', 'code_j']).size().reset_index(name='cooc_count')

# order each pair (code_i < code_j) to match the table's check constraint
sorted_pairs = np.sort(cooccur_counts[['code_i', 'code_j']].values, axis=1)
cooccur_counts['code_i'] = sorted_pairs[:, 0]
cooccur_counts['code_j'] = sorted_pairs[:, 1]
cooccur_counts = cooccur_counts.groupby(['code_i', 'code_j'], as_index=False)['cooc_count'].sum()

# Count individual code occurrences
code_counts = unq_codes.groupby('diag_icd10').size().reset_index(name='count')
cooccur_counts = cooccur_counts.merge(code_counts.rename(columns={'diag_icd10': 'code_i', 'count': 'count_i'}), on='code_i')
cooccur_counts = cooccur_counts.merge(code_counts.rename(columns={'diag_icd10': 'code_j', 'count': 'count_j'}), on='code_j')

# Count raw event occurrences (non-deduplicated)
event_counts = hes[['diag_icd10']].copy()
event_counts = event_counts[event_counts['diag_icd10'].notna()]
event_counts = event_counts[event_counts['diag_icd10'] != ""]
event_counts = event_counts.groupby('diag_icd10').size().reset_index(name='event_count')

# Total number of patients
n_patients = unq_codes['eid'].nunique()

# Jaccard and lift
cooccur_counts['jaccard'] = (
    cooccur_counts['cooc_count'] /
    (cooccur_counts['count_i'] + cooccur_counts['count_j'] - cooccur_counts['cooc_count'])
).round(3)

# lift is clipped just under 100 as the column is NUMERIC(5,3)
cooccur_counts['lift'] = (
    (cooccur_counts['cooc_count'] / n_patients) /
    ((cooccur_counts['count_i'] / n_patients) * (cooccur_counts['count_j'] / n_patients))
).clip(upper=99.999).round(3)

# Pair counts (suppressed/rounded downstream)
cooccur_counts['pair_count'] = cooccur_counts['cooc_count']

# Drop anything under the UKB small-numbers threshold
cooccur_web = cooccur_counts[cooccur_counts['cooc_count'] >= min_web_count].copy()

# Map code strings to codes.id
codes_df = pd.read_csv(Path(__file__).resolve().parent / "data" / "codes.csv")
code_to_id = codes_df.set_index('code')['id'].to_dict()
cooccur_web['code_i'] = cooccur_web['code_i'].map(code_to_id)
cooccur_web['code_j'] = cooccur_web['code_j'].map(code_to_id)
cooccur_web = cooccur_web.dropna(subset=['code_i', 'code_j'])
cooccur_web['code_i'] = cooccur_web['code_i'].astype(int)
cooccur_web['code_j'] = cooccur_web['code_j'].astype(int)

# re-order after mapping to ids, since id order != code order
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

# Per-code counts for the Analysis tab
code_counts_web = code_counts.merge(event_counts, on='diag_icd10', how='left')
code_counts_web['code_id'] = code_counts_web['diag_icd10'].map(code_to_id)
code_counts_web = code_counts_web.dropna(subset=['code_id'])
code_counts_web['code_id'] = code_counts_web['code_id'].astype(int)
code_counts_web = code_counts_web[code_counts_web['count'] >= min_web_count]
code_counts_web = code_counts_web.rename(columns={'count': 'person_count'})
code_counts_web['dataset'] = 'ukb'
code_counts_web['event_count'] = code_counts_web['event_count'].fillna(0).astype(int)
code_counts_web = code_counts_web[['code_id', 'dataset', 'person_count', 'event_count']]

# Save results
cooccur_web.to_csv(Path(__file__).resolve().parent / "data" / "cooccurrence_web_summary.csv", index=False)
code_counts_web.to_csv(Path(__file__).resolve().parent / "data" / "code_counts_web.csv", index=False)
