# Local datasets

## FooDB

- Source: <https://foodb.ca/downloads>
- Archive: `raw/foodb/foodb_2020_04_07_json.zip`
- Version encoded by FooDB in the archive name: 2020-04-07
- License: Creative Commons Attribution-NonCommercial 4.0 International

The experiment reads `Food.json`, `Compound.json`, and compound rows from
`Content.json`. It builds `processed/foodb_compounds.sqlite3`, deduplicating each
food/compound pair while retaining one example of its content evidence.

The archive is for research/non-commercial use. Contact FooDB for commercial use.
The SQLite file is generated locally and can be rebuilt with:

```powershell
python experiments/image_to_compounds.py build-index --force
```

## OpenFoodTox 3.0

- Source: <https://www.efsa.europa.eu/en/data-report/chemical-hazards-database-openfoodtox>
- Dataset: <https://doi.org/10.5281/zenodo.19388272>
- Workbook: `raw/openfoodtox/OFT3.0_export_repository.xlsx`
- Version: 3.0, published 2026-04-30

The CLI imports substance identifiers, toxicological-reference record counts, and
conservative positive/ambiguous endpoint signals into the FooDB SQLite index. Rebuild it with:

```powershell
python experiments/image_to_compounds.py build-hazards --force
```
