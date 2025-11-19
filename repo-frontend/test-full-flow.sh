#!/bin/bash
# 完整测试翻译流程

PROJECT_ID="p_1763046498276_dep4lyaknqa"

echo "=== 1. 测试翻译 API ==="
echo "翻译元素 e3..."
curl -s -X POST http://localhost:3001/api/element/translate \
  -H "Content-Type: application/json" \
  -d '{"id":"e3"}' | python3 -m json.tool

echo -e "\n=== 2. 检查数据是否保存 ==="
sleep 2
cat .data/projects.json | python3 -c "
import json, sys
projects = json.load(sys.stdin)
proj = next((p for p in projects if p['id'] == '$PROJECT_ID'), None)
if proj:
    for eid in ['e1', 'e2', 'e3']:
        el = proj['elements'].get(eid)
        if el:
            trans = el['translated_text'] or '(空)'
            print(f'{eid}: {el[\"source_text\"][:15]} -> {trans[:30]}')
"

echo -e "\n=== 3. 统计翻译情况 ==="
cat .data/projects.json | python3 -c "
import json, sys
projects = json.load(sys.stdin)
proj = next((p for p in projects if p['id'] == '$PROJECT_ID'), None)
if proj:
    total = len(proj['elements'])
    translated = sum(1 for el in proj['elements'].values() if el['translated_text'])
    print(f'共 {total} 个元素，已翻译 {translated} 个 ({translated*100//total}%)')
"
