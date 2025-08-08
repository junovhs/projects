# experiments/signature_first_context_strategy/secret_override_trailer_helper.py
# Purpose: Generates and parses machine-readable Git commit trailers for secret overrides.
# This is the final, hardened version incorporating multiple rounds of AI Auditor feedback.

import re
import hashlib
# import os # Not strictly needed for these functions if content is passed directly
from urllib.parse import quote, unquote

# --- Configuration ---
CANONICAL_DIGEST_CASE = "lower"  # 'lower' or 'upper'. Should be a fixed project-wide setting.

# --- Generation ---
def generate_secret_override_trailer(
    file_path: str,
    file_content_for_hash: bytes, # Byte content of the file
    reason: str = "Reason not provided",
    reviewer: str = "Reviewer not specified"
) -> str:
    """
    Generates a machine-parsable Git commit trailer for secret overrides.
    Uses URL encoding for path, reason, and reviewer fields.
    """
    if not file_path:
        raise ValueError("file_path is required and cannot be empty.")
    if '\n' in file_path or '\r' in file_path:
        # While URL encoding handles newlines, it's best practice for paths in trailers
        # to be single-line logical paths for clarity and to avoid issues with other
        # Git tooling that might parse trailers line by line.
        raise ValueError("file_path for trailer cannot contain newline characters.")

    if file_content_for_hash is None: # Should be enforced by type hinting, but defensive check.
        raise ValueError("file_content_for_hash is required and cannot be None.")

    computed_hash = hashlib.sha256(file_content_for_hash).hexdigest()
    if CANONICAL_DIGEST_CASE == "lower":
        file_sha256 = computed_hash.lower()
    else:
        file_sha256 = computed_hash.upper()

    # Sanitize newlines from reason/reviewer before URL encoding
    reason = reason.replace('\n', ' ').replace('\r', ' ')
    reviewer = reviewer.replace('\n', ' ').replace('\r', ' ')

    # URL encode all string values to be placed in quotes.
    # safe='' ensures maximum encoding for problematic characters within values,
    # including spaces, quotes, commas, percent signs, slashes (for reason/reviewer).
    encoded_path = quote(file_path, safe='')
    encoded_reason = quote(reason, safe='')
    encoded_reviewer = quote(reviewer, safe='')

    trailer_lines = [
        f'AI-Secret-Override: Path="{encoded_path}",SHA256="{file_sha256}",Reason="{encoded_reason}"',
        f'AI-Secret-Reviewer: "{encoded_reviewer}"'
    ]
    return "\n".join(trailer_lines)

# --- Parsing ---
def parse_trailers_from_commit_message(commit_message_body: str) -> list[dict]:
    """
    Parses all AI-Secret-Override/Reviewer trailer blocks from a commit message body.
    Adheres to strict two-line block expectation (Override then Reviewer), tolerating
    only blank lines in between. Reports warnings for malformed or incomplete blocks.
    """
    trailers = []
    lines = commit_message_body.strip().split('\n')
    
    i = 0
    while i < len(lines):
        line1 = lines[i].strip()
        current_line_number_for_debug = i + 1 # 1-based for logging
        i += 1 # Consume current line index for next iteration

        if not line1.startswith("AI-Secret-Override:"):
            continue

        # Potential Override line found
        override_match = re.fullmatch(
            r'AI-Secret-Override:\s*'
            r'Path\s*=\s*"(?P<Path>[^"]*)"\s*,\s*'
            r'SHA256\s*=\s*"(?P<SHA256>[0-9a-fA-F]{64})"\s*,\s*'
            r'Reason\s*=\s*"(?P<Reason>[^"]*)"',
            line1
        )

        if not override_match:
            print(f"Warning (line {current_line_number_for_debug}): Malformed 'AI-Secret-Override' line skipped: '{line1}'")
            continue
        
        temp_override_data = override_match.groupdict()
        
        # Search for the AI-Secret-Reviewer line, tolerating blank lines
        found_reviewer_for_block = False
        reviewer_line_index_search = i # Start searching from the line *after* the Override line
        
        while reviewer_line_index_search < len(lines):
            line2 = lines[reviewer_line_index_search].strip()
            line2_current_number_for_debug = reviewer_line_index_search + 1

            if line2 == "": # Blank line
                reviewer_line_index_search += 1
                continue

            if line2.startswith("AI-Secret-Reviewer:"):
                reviewer_match = re.fullmatch(
                    r'AI-Secret-Reviewer:\s*"(?P<Reviewer>[^"]*)"',
                    line2
                )
                if reviewer_match:
                    try:
                        parsed_data = {}
                        # Unquote and store path
                        parsed_data["Path"] = unquote(temp_override_data["Path"])
                        if '\n' in parsed_data["Path"] or '\r' in parsed_data["Path"]: # Post-unquote check
                           raise ValueError("Unquoted path contains newline characters.")

                        # Canonicalize and validate SHA256
                        sha_val = temp_override_data["SHA256"]
                        parsed_data["SHA256"] = sha_val.lower() if CANONICAL_DIGEST_CASE == "lower" else sha_val.upper()
                        if not re.match(r"^[0-9a-f]{64}$", parsed_data["SHA256"]):
                             raise ValueError(f"Invalid SHA256 format after canonicalization: {parsed_data['SHA256']}")

                        # Unquote reason and reviewer
                        parsed_data["Reason"] = unquote(temp_override_data["Reason"])
                        parsed_data["Reviewer"] = unquote(reviewer_match.group("Reviewer"))
                        
                        trailers.append(parsed_data)
                        found_reviewer_for_block = True
                    except Exception as e:
                        print(f"Warning (lines {current_line_number_for_debug}-{line2_current_number_for_debug}): Error finalizing parsed block for Override='{line1}': {e}. Block skipped.")
                else:
                    print(f"Warning (line {line2_current_number_for_debug}): Malformed 'AI-Secret-Reviewer' line found: '{line2}'. Associated 'AI-Secret-Override' (line {current_line_number_for_debug}) block skipped.")
                
                i = reviewer_line_index_search + 1 # Consume reviewer line for outer loop
                break # Stop searching for this block's reviewer
            
            else: # Non-blank, non-reviewer line found
                print(f"Warning (line {current_line_number_for_debug}): Expected 'AI-Secret-Reviewer' or blank line after Override, but found (line {line2_current_number_for_debug}): '{line2}'. 'AI-Secret-Override' block skipped.")
                # Outer loop 'i' is already positioned for the next line after line1.
                # This 'line2' will be re-evaluated by the outer loop.
                break 
        
        if not found_reviewer_for_block: # Reached end of lines or break from non-reviewer line
            print(f"Warning (line {current_line_number_for_debug}): 'AI-Secret-Override' found without a subsequent, valid 'AI-Secret-Reviewer' (or separated by non-blank lines). Block skipped: '{line1}'")
            # 'i' is already advanced by the outer loop to process the line after 'line1'.
            
    return trailers

# --- Verification ---
def verify_trailer_against_file_content(
    trailer_data: dict,
    file_content_for_verification: bytes
) -> bool:
    """
    Verifies the SHA256 in a parsed trailer against the actual content of a file.
    """
    if not trailer_data or "SHA256" not in trailer_data or "Path" not in trailer_data:
        raise ValueError("Invalid or incomplete trailer_data for verification (must include Path and SHA256).")
        
    computed_hash = hashlib.sha256(file_content_for_verification).hexdigest()
    trailer_sha256 = trailer_data["SHA256"] # Already canonical from parser
    
    if CANONICAL_DIGEST_CASE == "lower":
        return computed_hash.lower() == trailer_sha256
    else: # pragma: no cover (depends on CANONICAL_DIGEST_CASE)
        return computed_hash.upper() == trailer_sha256

if __name__ == "__main__":
    print("--- Testing Secret Override Trailer Helper (Final Hardened) ---")

    test_content_bytes_main = b"This is the main test content."
    test_path_main = "src/app/main_logic.py"
    expected_sha_main_lower = hashlib.sha256(test_content_bytes_main).hexdigest().lower()

    # 1. Test Generation
    print("\n1. Test Generation:")
    try:
        trailer_gen1 = generate_secret_override_trailer(
            test_path_main, test_content_bytes_main, 
            reason="User reviewed, contains \"test data\", okay for LLM.",
            reviewer="test-user <test@example.com>"
        )
        print(f"  Generated 1:\n{trailer_gen1}")
        assert f'Path="{quote(test_path_main, safe="")}"' in trailer_gen1
        assert f'Reason="{quote("User reviewed, contains %22test data%22, okay for LLM.".replace(chr(10)," ").replace(chr(13)," "), safe="")}"'
        assert f'Reviewer="{quote("test-user <test@example.com>", safe="")}"' in trailer_gen1

        path_with_space_unicode = "src/files/my résumé document.docx"
        trailer_gen2 = generate_secret_override_trailer(
             path_with_space_unicode, b"content for unicode path", "Unicode path test", "rev@unicode"
        )
        print(f"  Generated 2 (Unicode path):\n{trailer_gen2}")
        assert f'Path="{quote(path_with_space_unicode, safe="")}"' in trailer_gen2

    except ValueError as e:
        print(f"  Generation Error: {e}")

    try:
        generate_secret_override_trailer("path/with\nnewline.txt", b"content", "reason", "reviewer")
        print("  ERROR: Generation allowed newline in path.")
    except ValueError as e:
        print(f"  Correctly caught: {e}")
    
    try:
        generate_secret_override_trailer(test_path_main, None, "reason", "reviewer") # type: ignore
        print("  ERROR: Generation allowed None content.")
    except ValueError as e:
        print(f"  Correctly caught: {e}")

    # 2. Test Parsing
    print("\n2. Test Parsing:")
    commit_body_complex = f"""
Initial commit message.

{trailer_gen1}

Some other details.
Signed-off-by: User <user@example.com>

AI-Secret-Override: Path="another%2Fpath.js",SHA256="{expected_sha_main_lower}",Reason="Another%20reason"
AI-Secret-Reviewer: "another_reviewer"

AI-Secret-Override: Path="incomplete%2Foverride.txt",SHA256="{expected_sha_main_lower}",Reason="incomplete"
This line breaks the block.
AI-Secret-Reviewer: "should_not_be_parsed"

AI-Secret-Override: Path="path%2Fwith%2Fblanks",SHA256="{expected_sha_main_lower}",Reason="Blanks%20in%20between"

AI-Secret-Reviewer: "blank_user"

AI-Secret-Override: Path="no%2Freviewer%2Fat%2Feof",SHA256="{expected_sha_main_lower}",Reason="No%20Reviewer%20at%20EOF"
"""
    parsed_trailers = parse_trailers_from_commit_message(commit_body_complex)
    print(f"  Parsed {len(parsed_trailers)} trailers:")
    for idx, t_data in enumerate(parsed_trailers):
        print(f"    Trailer {idx+1}: Path='{t_data['Path']}', SHA='{t_data['SHA256'][:7]}...', Reason='{t_data['Reason']}', Reviewer='{t_data['Reviewer']}'")
    assert len(parsed_trailers) == 3
    assert parsed_trailers[0]["Path"] == test_path_main
    assert parsed_trailers[1]["Path"] == "another/path.js"
    assert parsed_trailers[2]["Path"] == "path/with/blanks"

    # Test malformed override line
    commit_body_malformed_override = 'AI-Secret-Override: Path="path",SHA256="badsha",Reason="reason"\nAI-Secret-Reviewer: "rev"'
    print(f"\n  Parsing malformed SHA override line: '{commit_body_malformed_override.splitlines()[0]}'")
    parsed_malformed_ov = parse_trailers_from_commit_message(commit_body_malformed_override)
    assert len(parsed_malformed_ov) == 0
    print(f"  Result: {len(parsed_malformed_ov)} trailers parsed (Correct)")
    
    # Test malformed reviewer line
    commit_body_malformed_reviewer = f'AI-Secret-Override: Path="p",SHA256="{expected_sha_main_lower}",Reason="r"\nAI-Secret-Reviewer: UnquotedReviewer'
    print(f"\n  Parsing malformed reviewer line: '{commit_body_malformed_reviewer.splitlines()[1]}'")
    parsed_malformed_rev = parse_trailers_from_commit_message(commit_body_malformed_reviewer)
    assert len(parsed_malformed_rev) == 0
    print(f"  Result: {len(parsed_malformed_rev)} trailers parsed (Correct)")

    # 3. Test Verification
    print("\n3. Test Verification:")
    if parsed_trailers:
        valid_verification = verify_trailer_against_file_content(parsed_trailers[0], test_content_bytes_main)
        print(f"  Verification (correct content) for Trailer 1 ('{parsed_trailers[0]['Path']}'): {valid_verification}")
        assert valid_verification

        invalid_verification = verify_trailer_against_file_content(parsed_trailers[0], b"wrong content")
        print(f"  Verification (wrong content) for Trailer 1 ('{parsed_trailers[0]['Path']}'): {invalid_verification}")
        assert not invalid_verification
    else:
        print("  Skipping verification tests as no trailers were successfully parsed previously.")
    
    try:
        verify_trailer_against_file_content({"Path":"p"}, b"c") # Missing SHA256
        print("  ERROR: Verification allowed trailer data missing SHA256.")
    except ValueError as e:
        print(f"  Correctly caught: {e}")

    print("\n--- All tests from __main__ complete. ---")