#!/usr/bin/env python3
"""Build knowledge graph JSON from the AMO-AMOCRM Mermaid flowchart."""
import json

# Source file
SOURCE_FILE = r"C:\ERV\CARLINK\carlinkng\db\install\sql\KB\amo_amocrm_flow.svg"

nodes = []
edges = []
hyperedges = []

node_id_map = {}

def add_node(nid, label, file_type="concept", subgraph=None):
    nid_full = f"amo_amocrm_flow_{nid}"
    node = {
        "id": nid_full,
        "label": label,
        "file_type": file_type,
        "source_file": SOURCE_FILE,
        "subgraph": subgraph,
        "metadata": {}
    }
    nodes.append(node)
    node_id_map[nid] = nid_full
    return nid_full

def add_edge(src, dst, label="", confidence=0.9, edge_type="directed"):
    src_id = node_id_map.get(src)
    dst_id = node_id_map.get(dst)
    if not src_id or not dst_id:
        print(f"WARNING: Unknown node: {src} -> {dst}")
        return
    edge = {
        "source": src_id,
        "target": dst_id,
        "label": label,
        "edge_type": edge_type,
        "confidence_score": confidence,
        "source_file": SOURCE_FILE,
        "metadata": {}
    }
    edges.append(edge)

# ========== NODES ==========

# 1. AmoCRM
add_node("amo_api", "AmoCRM API", "concept", "AmoCRM")

# 2. Config (carl_comm)
add_node("conf_tbl", "carl_comm.parameter ('amo_settings')", "concept", "Config (carl_comm)")
add_node("get_set", "getAmoSettings() / setAmoSettings()", "concept", "Config (carl_comm)")

# 3. External Services
add_node("ext_loader", "Внешний сервис ETL (получает из AmoCRM)", "concept", "External Services")
add_node("ext_sync", "Сервис интеграции (передаёт JSON в БД)", "concept", "External Services")

# 4. DB Integration (carl_amo)
add_node("write_sync", "writeSyncAmo() / writeSyncAmoJ()", "concept", "DB Integration (carl_amo)")
add_node("sync_amo", "carl_amo.sync_amo (raw JSON: lead/contact/company)", "concept", "DB Integration (carl_amo)")
add_node("write_status", "writeAuctAmoStatuses()", "concept", "DB Integration (carl_amo)")
add_node("auct_statuses", "carl_amo.auct_amo_statuses", "concept", "DB Integration (carl_amo)")
add_node("auct_data", "carl_amo.auct_amo_data (amo_data_in/out_sel/out_lead)", "concept", "DB Integration (carl_amo)")
add_node("create_from_amo", "_createNewFromAMO(p_data)", "concept", "DB Integration (carl_amo)")
add_node("get_auct_data", "getAuctAmoData(...)", "concept", "DB Integration (carl_amo)")

# 5. Core Tables (carl_data)
add_node("t_user", "user (carl_data)", "concept", "Core Tables (carl_data)")
add_node("t_profile", "profile (carl_data)", "concept", "Core Tables (carl_data)")
add_node("t_auction", "auction (carl_data)", "concept", "Core Tables (carl_data)")
add_node("t_object", "object (carl_data)", "concept", "Core Tables (carl_data)")

# 6. Analytics (carl_an)
add_node("amo_json", "carl_an.amo_json (raw JSON dump)", "concept", "Analytics (carl_an)")
add_node("fill", "fill_amo_data() (TRUNCATE+INSERT, dynamic columns)", "concept", "Analytics (carl_an)")
add_node("amo_data", "carl_an.amo_data (structured data)", "concept", "Analytics (carl_an)")
add_node("enrich1", "populate_amo_data_status()", "concept", "Analytics (carl_an)")
add_node("enrich2", "fill_amo_company_amo_json() / fill_amo_company_sync_amo()", "concept", "Analytics (carl_an)")

# 7. Consumers
add_node("reports", "Отчёты / аналитика", "concept", "Consumers")
add_node("app_seller", "Приложение (продавец/лид)", "concept", "Consumers")

# 8. Note / Rationale
add_node("note_dynamic", "Динамика: новые custom_fields → fill_amo_data() добавляет колонки в carl_an.amo_data", "rationale", None)

# 9. The SVG diagram itself as an image node
add_node("diagram", "AMO-AMOCRM Flow Diagram", "image", None)

# ========== EDGES ==========

# Config
add_edge("conf_tbl", "get_set", "contains config", 0.95)

# AmoCRM → External
add_edge("amo_api", "ext_loader", "data source", 0.9)
add_edge("amo_api", "ext_sync", "data source", 0.9)

# Config → External (dashed = reads config)
add_edge("get_set", "ext_loader", "читает конфиг", 0.85)
add_edge("get_set", "ext_sync", "читает конфиг", 0.85)

# External → DB Integration
add_edge("ext_sync", "write_sync", "JSON объекты", 0.95)
add_edge("write_sync", "sync_amo", "writes JSON", 0.95)
add_edge("ext_sync", "write_status", "JSON статусы", 0.95)
add_edge("write_status", "auct_statuses", "writes statuses", 0.95)
add_edge("write_status", "auct_data", "writes data", 0.9)
add_edge("sync_amo", "create_from_amo", "triggers creation", 0.9)
add_edge("auct_data", "get_auct_data", "data source", 0.9)

# DB Integration → Core Tables
add_edge("create_from_amo", "t_user", "creates user", 0.9)
add_edge("create_from_amo", "t_profile", "creates profile", 0.9)
add_edge("create_from_amo", "t_auction", "creates auction", 0.9)
add_edge("create_from_amo", "t_object", "creates object", 0.9)

# External → Analytics
add_edge("ext_loader", "amo_json", "JSON dump", 0.95)
add_edge("amo_json", "fill", "ETL pipeline", 0.95)
add_edge("fill", "amo_data", "structured output", 0.95)

# Analytics enrichment
add_edge("enrich1", "amo_data", "enriches with statuses", 0.9)
add_edge("enrich2", "amo_data", "enriches with company data", 0.9)

# Analytics → Consumers
add_edge("amo_data", "reports", "data for reports", 0.9)
add_edge("get_auct_data", "app_seller", "data for seller app", 0.9)

# Note edge
add_edge("fill", "note_dynamic", "управляет схемой", 0.85)

# Diagram → all top-level subgraphs (image to concepts)
# Add an edge from diagram to the first entity of each subgraph
add_edge("diagram", "amo_api", "contains", 1.0)
add_edge("diagram", "conf_tbl", "contains", 1.0)
add_edge("diagram", "ext_loader", "contains", 1.0)
add_edge("diagram", "write_sync", "contains", 1.0)
add_edge("diagram", "t_user", "contains", 1.0)
add_edge("diagram", "amo_json", "contains", 1.0)
add_edge("diagram", "reports", "contains", 1.0)

# ========== HYPEREDGES (max 3) ==========

# Hyperedge 1: Full integration flow
hyperedges.append({
    "id": "amo_amocrm_flow_hyper_flow",
    "label": "AMO→AMOCRM Integration Pipeline",
    "nodes": [
        node_id_map["amo_api"],
        node_id_map["ext_loader"],
        node_id_map["ext_sync"],
        node_id_map["write_sync"],
        node_id_map["sync_amo"],
        node_id_map["create_from_amo"],
        node_id_map["t_user"],
        node_id_map["t_profile"],
        node_id_map["t_auction"],
        node_id_map["t_object"]
    ],
    "file_type": "concept",
    "source_file": SOURCE_FILE,
    "metadata": {"description": "End-to-end data flow from AmoCRM API to core DB tables via carl_amo integration"}
})

# Hyperedge 2: Analytics pipeline
hyperedges.append({
    "id": "amo_amocrm_flow_hyper_analytics",
    "label": "Analytics ETL Pipeline",
    "nodes": [
        node_id_map["amo_api"],
        node_id_map["ext_loader"],
        node_id_map["amo_json"],
        node_id_map["fill"],
        node_id_map["amo_data"],
        node_id_map["enrich1"],
        node_id_map["enrich2"],
        node_id_map["reports"]
    ],
    "file_type": "concept",
    "source_file": SOURCE_FILE,
    "metadata": {"description": "Analytics data flow: AmoCRM → ETL → carl_an.amo_json → fill_amo_data() → structured carl_an.amo_data → reports"}
})

# Hyperedge 3: Status sync pipeline
hyperedges.append({
    "id": "amo_amocrm_flow_hyper_status",
    "label": "AmoCRM Status Sync Pipeline",
    "nodes": [
        node_id_map["amo_api"],
        node_id_map["ext_sync"],
        node_id_map["write_status"],
        node_id_map["auct_statuses"],
        node_id_map["auct_data"],
        node_id_map["get_auct_data"],
        node_id_map["app_seller"]
    ],
    "file_type": "concept",
    "source_file": SOURCE_FILE,
    "metadata": {"description": "Status synchronization: AmoCRM statuses → carl_amo.auct_amo_statuses → seller application"}
})

# Build final JSON
kg = {
    "nodes": nodes,
    "edges": edges,
    "hyperedges": hyperedges,
    "input_tokens": 0,
    "output_tokens": 0
}

output_path = r"C:\ERV\CARLINK\carlinkng\db\install\sql\graphify-out\.graphify_chunk_04.json"
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(kg, f, ensure_ascii=False, indent=2)

print(f"Written to {output_path}")
print(f"Nodes: {len(nodes)}, Edges: {len(edges)}, Hyperedges: {len(hyperedges)}")
print("Done.")
