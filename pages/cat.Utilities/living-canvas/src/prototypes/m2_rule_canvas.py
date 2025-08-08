import json

def apply_brenda_rules(items, rules):
    processed_items = []
    for item_data in items:
        current_props = json.loads(json.dumps(item_data["properties"])) 
        errors_for_item = []
        for rule in rules:
            target_prop = rule["target_property"]
            if rule["type"] == "fill_blank":
                if current_props.get(rule["source_field"]) in [None, ""]:
                    current_props[target_prop] = rule["fill_value"]
            elif rule["type"] == "conditional_overwrite":
                value_set = False
                for condition in rule.get("conditions", []):
                    if "if_prop_not_blank" in condition and current_props.get(condition["if_prop_not_blank"]) not in [None, ""]:
                        current_props[target_prop] = current_props.get(condition["then_use_prop_value"])
                        value_set = True
                        break
                if not value_set and "default_value_from_prop" in rule:
                    current_props[target_prop] = current_props.get(rule["default_value_from_prop"])
            elif rule["type"] == "concatenate_properties":
                result_parts = []
                for part in rule["parts"]:
                    if "prop" in part:
                        prop_val = current_props.get(part["prop"])
                        result_parts.append(str(prop_val) if prop_val not in [None, ""] else part.get("missing_value_sub", ""))
                    elif "literal" in part:
                        result_parts.append(part["literal"])
                current_props[target_prop] = "".join(result_parts)
        new_item_data = {"item_type": item_data["item_type"], "properties": current_props}
        if errors_for_item:
            new_item_data["_rule_errors"] = errors_for_item
        processed_items.append(new_item_data)
    return processed_items
