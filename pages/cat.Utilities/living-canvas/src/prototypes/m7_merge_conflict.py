import json
from collections import deque

def find_paths(data):
    paths = []
    queue = deque([("", data)])
    while queue:
        path, current = queue.popleft()
        if isinstance(current, dict):
            for k, v in current.items(): queue.append((f"{path}/{k}", v))
        elif isinstance(current, list):
            for i, v in enumerate(current): queue.append((f"{path}/{i}", v))
        else: paths.append((path, current))
    return paths

def get_value_by_path(doc, path):
    parts = path.split('/')[1:]
    val = doc
    for part in parts:
        try: val = val[part] if isinstance(val, dict) else val[int(part)]
        except (KeyError, IndexError, TypeError): return None
    return val

def three_way_merge(base_state, local_state, remote_state):
    conflicts = []
    merged_state = json.loads(json.dumps(local_state))
    remote_paths = {path: val for path, val in find_paths(remote_state)}
    base_paths = {path: val for path, val in find_paths(base_state)}
    for path, remote_val in remote_paths.items():
        base_val = get_value_by_path(base_state, path)
        local_val = get_value_by_path(local_state, path)
        if remote_val != base_val:
            if local_val == base_val:
                path_parts = path.split('/')[1:]
                target = merged_state
                for part in path_parts[:-1]: target = target[part] if isinstance(target, dict) else target[int(part)]
                target[path_parts[-1]] = remote_val
            elif local_val != remote_val:
                conflicts.append({"path": path, "base_value": base_val, "local_value": local_val, "remote_value": remote_val})
    return merged_state, conflicts
