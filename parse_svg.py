#!/usr/bin/env python3
import re
import json

with open(r'C:\ERV\CARLINK\carlinkng\db\install\sql\KB\amo_amocrm_flow.svg', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract all text content between > and <
texts = re.findall(r'>([^<]+)<', content)

# Extract title-like text and labels
print("=== All text content in SVG ===")
for t in texts:
    t = t.strip()
    if t and len(t) > 1:
        print(t)

print("\n=== Count:", len(texts))
