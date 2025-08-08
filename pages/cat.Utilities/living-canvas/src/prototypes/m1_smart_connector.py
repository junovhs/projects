from datetime import datetime

def transform_data_with_smart_connector(raw_data, mapping_config):
    """Applies a mapping configuration to transform raw data into clean Items."""
    clean_items = []
    for row_num, row_data in enumerate(raw_data):
        item = {
            "item_type": mapping_config["item_type"],
            "properties": {},
            "source_info": {"raw_row_num": row_num + 1}
        }
        for prop_map in mapping_config["properties"]:
            source_field = prop_map.get("source_field")
            target_property = prop_map["target_property"]
            prop_type = prop_map.get("type", "string")
            if source_field:
                raw_value = row_data.get(source_field)
                clean_value = None
                if raw_value is not None and raw_value != "":
                    try:
                        if prop_type == "string": clean_value = str(raw_value)
                        elif prop_type == "boolean": clean_value = str(raw_value).upper() == str(prop_map.get("true_value", "TRUE"))
                        elif prop_type == "date": clean_value = datetime.strptime(str(raw_value), prop_map["date_format"]).strftime("%Y-%m-%d")
                        elif prop_type == "integer": clean_value = int(raw_value)
                        else: clean_value = raw_value
                    except (ValueError, TypeError):
                        clean_value = None
                item["properties"][target_property] = clean_value
            else:
                item["properties"][target_property] = None
        clean_items.append(item)
    return clean_items
