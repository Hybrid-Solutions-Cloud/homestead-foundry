# Foundry query library

These Azure Resource Graph queries provide the Foundry-specific, no-ingestion part of
the observability view. Run them with Reader access to the intended scope. They do not
modify Azure resources and contain no tenant identifier.

| Query | Operating question |
|---|---|
| `foundry-inventory.kql` | Which Foundry accounts and projects exist, where are they, and who owns them? |
| `foundry-tag-compliance.kql` | Which Foundry resources are missing accountability or lifecycle metadata? |
