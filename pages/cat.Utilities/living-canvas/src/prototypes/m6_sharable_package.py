import json
from datetime import datetime

def create_living_package(items, importers, rules, exporters, lenses):
    """Bundles all application artifacts into a single dictionary."""
    living_package = {
        "format_version": "1.0",
        "created_at": datetime.now().isoformat(),
        "manifest": {
            "item_count": len(items),
            "importer_count": len(importers),
            "rule_set_count": len(rules),
            "exporter_count": len(exporters),
            "lens_count": len(lenses)
        },
        "data_items": items,
        "smart_connectors": importers,
        "rule_sets": rules,
        "custom_exporters": exporters,
        "lenses": lenses
    }
    return living_package

def load_living_package(package_data):
    """Loads a package into a new application state, proving portability."""
    if package_data.get("format_version") != "1.0":
        raise ValueError("Incompatible package version.")
    new_app_state = {
        "items": package_data.get("data_items", []),
        "importers": package_data.get("smart_connectors", []),
        "rules": package_data.get("rule_sets", []),
        "exporters": package_data.get("custom_exporters", []),
        "lenses": package_data.get("lenses", [])
    }
    return new_app_state
