import copy

def simple_apply_patch(doc, patch):
    new_doc = copy.deepcopy(doc)
    for op in patch:
        path_parts = op['path'].split('/')[1:]
        target = new_doc
        try:
            for part in path_parts[:-1]:
                target = target[part] if isinstance(target, dict) else target[int(part)]
            final_key = path_parts[-1]
            if op['op'] == 'replace': target[final_key] = op['value']
            elif op['op'] == 'add':
                if isinstance(target, list) and final_key == '-': target.append(op['value'])
                else: target[final_key] = op['value']
            elif op['op'] == 'remove': del target[final_key]
        except (KeyError, IndexError, TypeError):
            return None
    return new_doc

def merge_patches_sequentially(base_state, patch_list):
    """A simplified merge strategy that applies a list of patches sequentially."""
    current_state = copy.deepcopy(base_state)
    for patch in patch_list:
        next_state = simple_apply_patch(current_state, patch)
        if next_state is None: return None
        current_state = next_state
    return current_state
