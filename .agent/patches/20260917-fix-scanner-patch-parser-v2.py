from pathlib import Path

path = Path('/tmp/scanner-patch.py')
text = path.read_text()
start = text.index('\ndef property_pattern(key):')
end = text.index('\n\nfor filename,', start)
replacement = r'''
def property_span(text, key):
    lines = text.splitlines(keepends=True)
    for start_index, line in enumerate(lines):
        if not line.startswith(f"      {key}:"):
            continue
        end_index = start_index
        while end_index < len(lines):
            stripped = lines[end_index].rstrip()
            if stripped.endswith("',") or stripped.endswith('\",'):
                return lines, start_index, end_index
            end_index += 1
        break
    raise SystemExit(f'locale property missing: {key}')


def quote_ts(value):
    return value.replace('\\', '\\\\').replace("'", "\\'")


def replace_property(text, key, value):
    lines, start_index, end_index = property_span(text, key)
    lines[start_index:end_index + 1] = [f"      {key}: '{quote_ts(value)}',\n"]
    return ''.join(lines)


def insert_after_property(text, after_key, new_key, value):
    if any(line.startswith(f"      {new_key}:") for line in text.splitlines()):
        return text
    lines, _, end_index = property_span(text, after_key)
    lines.insert(end_index + 1, f"      {new_key}: '{quote_ts(value)}',\n")
    return ''.join(lines)
'''
path.write_text(text[:start] + replacement + text[end:])
