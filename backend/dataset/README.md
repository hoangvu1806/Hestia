# Local datasets

## FooDB

- Source: <https://foodb.ca/downloads>
- Archive: `raw/foodb/foodb_2020_04_07_json.zip`
- Version encoded by FooDB in the archive name: 2020-04-07
- License: Creative Commons Attribution-NonCommercial 4.0 International

The current application reads FooDB from the PostgreSQL `food_intelligence` schema. The imported
relations deduplicate each food/compound pair while retaining one example of its content evidence.

The archive is for research/non-commercial use. Contact FooDB for commercial use. A legacy SQLite
snapshot may be retained as a migration backup, but no runtime code opens it. Import it with:

```powershell
$env:PYTHONPATH='src'
python scripts/migrate_food_intelligence_to_postgres.py --source dataset/processed/foodb_compounds.sqlite3
```

## OpenFoodTox 3.0

- Source: <https://www.efsa.europa.eu/en/data-report/chemical-hazards-database-openfoodtox>
- Dataset: <https://doi.org/10.5281/zenodo.19388272>
- Workbook: `raw/openfoodtox/OFT3.0_export_repository.xlsx`
- Version: 3.0, published 2026-04-30

Substance identifiers, toxicological-reference record counts, and conservative
positive/ambiguous endpoint signals are stored in
`food_intelligence.openfoodtox_substance` in PostgreSQL.
