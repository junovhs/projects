def generate_export_data(items, export_config):
    """Applies an export configuration to generate a flat list of dictionaries."""
    filtered_items = []
    export_filter = export_config.get("filter")
    if export_filter:
        for item in items:
            prop_val = item["properties"].get(export_filter["property"])
            op = export_filter["operator"]
            if op == "is_not_blank" and prop_val:
                filtered_items.append(item)
    else:
        filtered_items = items
    exportable_data = []
    for item in filtered_items:
        row = {}
        for column_map in export_config["columns"]:
            header = column_map["header"]
            source_prop = column_map["source_property"]
            row[header] = item["properties"].get(source_prop)
        exportable_data.append(row)
    headers = [col["header"] for col in export_config["columns"]]
    return headers, exportable_data
