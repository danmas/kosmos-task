#!/usr/bin/env python3
"""Extract all text labels and structure from the AMO-AMOCRM Mermaid SVG flowchart."""
import re
import json

svg_path = r'C:\ERV\CARLINK\carlinkng\db\install\sql\KB\amo_amocrm_flow.svg'
with open(svg_path, 'r', encoding='utf-8') as f:
    svg = f.read()

# Remove the <style> block for cleaner parsing
svg_no_style = re.sub(r'<style[^>]*>.*?</style>', '', svg, flags=re.DOTALL)

# Find all <g> elements with transform (nodes)
# Mermaid nodes have a <g> with transform and contain rect and text
nodes = []
# Find all text elements inside the SVG
text_matches = re.findall(r'<text[^>]*>(.*?)</text>', svg, re.DOTALL)
print("=== All <text> elements ===")
for t in text_matches:
    # Extract tspan content
    tspans = re.findall(r'<tspan[^>]*>(.*?)</tspan>', t, re.DOTALL)
    if tspans:
        line = '|'.join(tspans)
    else:
        line = re.sub(r'<[^>]+>', '', t).strip()
    if line:
        print(repr(line))

# Also extract from <g class="node"> patterns
print("\n=== Node groups ===")
node_blocks = re.findall(r'<g[^>]*class="[^"]*node[^"]*"[^>]*>(.*?)</g>', svg, re.DOTALL)
for nb in node_blocks:
    # Extract transform for position
    transform_match = re.search(r'transform="([^"]*)"', nb)
    pos = transform_match.group(1) if transform_match else '?'
    # Extract text
    texts = re.findall(r'>([^<]+)<', nb)
    texts = [t.strip() for t in texts if t.strip() and len(t.strip()) > 1]
    if texts:
        print(f"  Pos: {pos}, Text: {texts}")

# Find edge paths
print("\n=== Edge paths ===")
edge_blocks = re.findall(r'<g[^>]*class="[^"]*edgePath[^"]*"[^>]*>(.*?)</g>', svg, re.DOTALL)
for eb in edge_blocks:
    texts = re.findall(r'>([^<]+)<', eb)
    texts = [t.strip() for t in texts if t.strip() and len(t.strip()) > 1]
    if texts:
        print(f"  Edge text: {texts}")

# Also find all text inside the document
print("\n=== All text content (unfiltered) ===")
all_texts = re.findall(r'>([^<]+)<', svg)
for t in all_texts:
    t_stripped = t.strip()
    if t_stripped and len(t_stripped) > 1 and not t_stripped.startswith(('@', '#', '.')):
        print(repr(t_stripped))
