#!/bin/bash
# 测试翻译 API

echo "=== 测试翻译 API ==="
echo "1. 测试元素 e10 (第4页: 利润代表什么意义？)"

curl -X POST http://localhost:3001/api/element/translate \
  -H "Content-Type: application/json" \
  -d '{"id":"e10"}' \
  2>&1 | python3 -m json.tool || echo "请求失败"

echo -e "\n\n2. 检查数据是否保存"
cat .data/projects.json | python3 -c "
import json, sys
d = json.load(sys.stdin)
el = d[0]['elements']['e10']
print(f\"元素 e10:\")
print(f\"  原文: {el['source_text']}\")
print(f\"  译文: {el['translated_text']}\")
"
