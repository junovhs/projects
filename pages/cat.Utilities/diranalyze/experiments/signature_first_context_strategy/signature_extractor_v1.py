# LEGACY – kept for baseline comparison; superseded by Tree-sitter extractor (TBD)
# experiments/signature_first_context_strategy/signature_extractor_v1.py
# Purpose: Initial experiment to extract basic JavaScript signatures using regex.
# Demonstrates potential for token reduction but highlights limitations of regex for complex code.
# This script was used for analysis of a snapshot of diranalyze/js/main.js.

import re

# Content of diranalyze/js/main.js (snapshot used during experiment)
# For brevity in this file, the actual main_js_content is not repeated here.
# Assume it's loaded or pasted if this script were to be run standalone.
# The original experiment used the main_js_content string directly in the script.
# To make this runnable standalone for demonstration, you might add:
# main_js_content = """ PASTE THE MAIN.JS CONTENT HERE """
# However, for documentation, its primary purpose was the functions below.

main_js_content_placeholder = """
// This is a placeholder. 
// In the original experiment, the full content of diranalyze/js/main.js was here.
// For this file to be runnable for demonstration, replace this with actual JS code.

function exampleFunction(param1, param2) {
    // code
}

const exampleObject = {
    key: "value"
};

export const exportedVar = 123;

import * as utils from './utils.js';
"""

def extract_js_signatures_initial(js_code):
    """
    Initial attempt at regex-based signature extraction.
    Known limitations: less robust, might miss constructs or miscategorize.
    """
    manifest_lines = []
    
    func_pattern = re.compile(r"^(async\s+function|function)\s+([a-zA-Z0-9_]+)\s*\((.*?)\)\s*\{", re.MULTILINE)
    for match in func_pattern.finditer(js_code):
        full_signature = match.group(0).strip().replace('{', '').strip()
        manifest_lines.append(f"FUNCTION: {full_signature};")

    obj_var_pattern = re.compile(r"^(export\s+)?(const|let)\s+([a-zA-Z0-9_]+)\s*=\s*(\{)", re.MULTILINE)
    processed_obj_vars = set()
    for match in obj_var_pattern.finditer(js_code):
        var_name = match.group(3)
        manifest_lines.append(f"OBJECT_LITERAL: {var_name};")
        processed_obj_vars.add(var_name)
        
    arrow_func_pattern = re.compile(r"^(export\s+)?(const|let)\s+([a-zA-Z0-9_]+)\s*=\s*(async\s*)?\((.*?)\)\s*=>\s*\{", re.MULTILINE)
    for match in arrow_func_pattern.finditer(js_code):
        var_name = match.group(3)
        if var_name not in processed_obj_vars:
            params = match.group(5)
            is_async = "async " if match.group(4) else ""
            manifest_lines.append(f"ARROW_FUNCTION: {is_async}{var_name}({params});")
            processed_obj_vars.add(var_name)

    simple_var_pattern = re.compile(r"^(export\s+)?(const|let)\s+([a-zA-Z0-9_]+)\s*=\s*[^;]+;", re.MULTILINE)
    for match in simple_var_pattern.finditer(js_code):
        var_name = match.group(3)
        if var_name not in processed_obj_vars:
            assignment_value = match.group(0).split('=')[1].strip().rstrip(';')
            var_type = "STRING_VARIABLE" if assignment_value.startswith('`') or assignment_value.startswith("'") or assignment_value.startswith('"') else \
                       "BOOLEAN_VARIABLE" if assignment_value.lower() in ["true", "false"] else \
                       "NUMBER_VARIABLE" if assignment_value.isdigit() else \
                       "VARIABLE"
            manifest_lines.append(f"{var_type}: {var_name};")
            processed_obj_vars.add(var_name)

    import_pattern = re.compile(r"^import\s+(?:\*\s+as\s+)?([a-zA-Z0-9_]+)\s+from\s+['\"](.+)['\"];", re.MULTILINE)
    for match in import_pattern.finditer(js_code):
        manifest_lines.append(f"IMPORT: {match.group(1)} from '{match.group(2)}';")
        
    export_list_pattern = re.compile(r"^export\s*\{([\s\S]*?)\}\s*(?:from\s*['\"].*?['\"])?;", re.MULTILINE)
    for match in export_list_pattern.finditer(js_code):
        items = [item.strip() for item in match.group(1).split(',')]
        for item in items:
            if item:
                is_detailed = any(item in line for line in manifest_lines if "FUNCTION:" in line or "OBJECT_LITERAL:" in line or "ARROW_FUNCTION:" in line)
                if not is_detailed:
                    manifest_lines.append(f"EXPORTED_ITEM: {item};")
    return "\n".join(sorted(list(set(manifest_lines))))

def extract_js_signatures_refined(js_code):
    """
    Refined regex-based signature extraction after initial testing.
    Improved capture of some constructs. Still not as robust as AST parsing.
    """
    manifest_lines = []
    
    func_pattern = re.compile(r"^(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*\{", re.MULTILINE)
    for match in func_pattern.finditer(js_code):
        func_name = match.group(1)
        params = match.group(2).strip()
        async_prefix = "async " if match.group(0).startswith("async") else ""
        manifest_lines.append(f"FUNCTION: {async_prefix}{func_name}({params});")

    categorized_vars = set()
    for line in manifest_lines:
        m = re.search(r"FUNCTION:\s*(?:async\s*)?([a-zA-Z0-9_]+)\(", line)
        if m: categorized_vars.add(m.group(1))

    arrow_func_pattern = re.compile(r"^(?:export\s+)?(?:const|let)\s+([a-zA-Z0-9_]+)\s*=\s*(async\s*)?\(([^)]*)\)\s*=>\s*\{", re.MULTILINE)
    for match in arrow_func_pattern.finditer(js_code):
        var_name = match.group(1)
        params = match.group(3).strip()
        async_prefix = "async " if match.group(2) else ""
        manifest_lines.append(f"ARROW_FUNCTION: {async_prefix}{var_name}({params});")
        categorized_vars.add(var_name)

    simple_obj_decl_pattern = re.compile(r"^(?:export\s+)?(?:const|let)\s+([a-zA-Z0-9_]+)\s*=\s*\{", re.MULTILINE)
    for match in simple_obj_decl_pattern.finditer(js_code):
        var_name = match.group(1)
        if var_name not in categorized_vars:
            manifest_lines.append(f"OBJECT_LITERAL_DECL: {var_name};")
            categorized_vars.add(var_name)
            
    other_var_pattern = re.compile(r"^(?:export\s+)?(?:const|let)\s+([a-zA-Z0-9_]+)\s*=\s*([^;{}]*?);", re.MULTILINE)
    for match in other_var_pattern.finditer(js_code):
        var_name = match.group(1)
        if var_name not in categorized_vars:
            value_preview = match.group(2).strip()
            var_type = "STRING_LITERAL" if value_preview.startswith('`') or value_preview.startswith("'") or value_preview.startswith('"') else \
                       "BOOLEAN_LITERAL" if value_preview.lower() in ["true", "false"] else \
                       "NUMBER_LITERAL" if value_preview.replace('.', '', 1).isdigit() else \
                       "OTHER_VARIABLE"
            manifest_lines.append(f"{var_type}: {var_name};")
            categorized_vars.add(var_name)
            
    import_pattern = re.compile(r"^import\s+(?:(?:\*\s+as\s+([a-zA-Z0-9_]+))|(?:\{([\s\S]*?)\})|(?:([a-zA-Z0-9_]+)))\s+from\s+['\"](.+?)['\"];", re.MULTILINE)
    for match in import_pattern.finditer(js_code):
        star_as, named_imports, default_import, module_path = match.groups()
        if star_as: manifest_lines.append(f"IMPORT_ALL: {star_as} from '{module_path}';")
        elif named_imports:
            imports = [imp.strip().split(' as ')[0] for imp in named_imports.strip().split(',')]
            manifest_lines.append(f"IMPORT_NAMED: {{{', '.join(imports)}}} from '{module_path}';")
        elif default_import: manifest_lines.append(f"IMPORT_DEFAULT: {default_import} from '{module_path}';")
             
    export_list_pattern = re.compile(r"^export\s*\{([\s\S]*?)\}\s*(?:from\s*['\"].*?['\"])?;", re.MULTILINE)
    for match in export_list_pattern.finditer(js_code):
        items_str = match.group(1)
        items = [item.strip().split(' as ')[0] for item in items_str.split(',') if item.strip()]
        for item_name in items:
            if item_name not in categorized_vars:
                is_detailed = any(item_name in line and ("FUNCTION:" in line or "OBJECT_LITERAL_DECL:" in line or "ARROW_FUNCTION:" in line) for line in manifest_lines)
                if not is_detailed: manifest_lines.append(f"EXPORTED_ITEM: {item_name};")
    return "\n".join(sorted(list(set(manifest_lines))))

if __name__ == "__main__":
    print("Running Signature Extractor v1 (Initial and Refined attempts using placeholder content)...")
    
    # To test, paste a snippet of JS code here or load from a file
    test_js_code = main_js_content_placeholder # Using placeholder for this file

    print("\n--- Initial Signature Extraction ---")
    initial_manifest = extract_js_signatures_initial(test_js_code)
    print(initial_manifest)
    print(f"\nOriginal size (placeholder): {len(test_js_code)} chars")
    print(f"Initial manifest size: {len(initial_manifest)} chars")

    print("\n--- Refined Signature Extraction ---")
    refined_manifest = extract_js_signatures_refined(test_js_code)
    print(refined_manifest)
    print(f"Refined manifest size: {len(refined_manifest)} chars")

    print("\nNote: This script is for historical/documentation purposes of the experiment.")
    print("For actual use, the main_js_content would need to be the full content from DirAnalyze.")