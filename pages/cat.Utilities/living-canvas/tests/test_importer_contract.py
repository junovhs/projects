# This file is designed to be run with the `pytest` command.

import pytest
from datetime import datetime

# The function under test (example)
def transform_data_with_smart_connector(raw_data, mapping_config):
    clean_items = []
    for row_data in raw_data:
        item = {"item_type": mapping_config["item_type"], "properties": {}}
        for prop_map in mapping_config["properties"]:
            source_field, target_property, prop_type = prop_map.get("source_field"), prop_map["target_property"], prop_map.get("type", "string")
            if source_field and source_field in row_data:
                raw_value = row_data.get(source_field)
                clean_value = None
                if raw_value is not None and raw_value != "":
                    try:
                        if prop_type == "date": clean_value = datetime.strptime(str(raw_value), prop_map["date_format"]).strftime("%Y-%m-%d")
                        else: clean_value = str(raw_value)
                    except (ValueError, TypeError): clean_value = None
                item["properties"][target_property] = clean_value
        clean_items.append(item)
    return clean_items

@pytest.fixture
def standard_mapping_config():
    return {"config_name": "Test Map", "item_type": "Contact", "properties": [{"source_field": "EMAIL", "target_property": "email", "type": "string"}, {"source_field": "REG_DATE", "target_property": "registrationDate", "type": "date", "date_format": "%Y-%m-%d"}]}

def test_malformed_date_input(standard_mapping_config):
    """Verifies that a malformed date results in a null value, not a crash."""
    raw_data = [{"EMAIL": "test@example.com", "REG_DATE": "INVALID-DATE"}]
    result = transform_data_with_smart_connector(raw_data, standard_mapping_config)
    assert result[0]["properties"]["registrationDate"] is None

def test_schema_drift_missing_column(standard_mapping_config):
    """Verifies that a missing mapped column results in no property, not a crash."""
    raw_data = [{"EMAIL": "test@example.com"}] # REG_DATE is missing
    result = transform_data_with_smart_connector(raw_data, standard_mapping_config)
    assert "registrationDate" not in result[0]["properties"]
