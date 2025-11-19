#!/usr/bin/env python3
"""
将译文写回 PPTX 文件
用法: python3 update_pptx.py <input.pptx> <output.pptx> <translations.json>
"""
import sys
import json
import os
import re
import zipfile
import io
import tempfile
from xml.etree import ElementTree as ET

def update_pptx_with_translations(input_path, output_path, translations_json):
    """
    根据 translations.json 更新 PPTX 文件中的文本
    translations_json 格式: {"source_text": "translated_text", ...}
    """
    with open(translations_json, 'r', encoding='utf-8') as f:
        translations = json.load(f)
    
    # 预处理：建立标准化 key 索引（去掉多余空白）
    def norm(s: str) -> str:
        return ' '.join((s or '').split())

    norm_lookup = {norm(k): v for k, v in translations.items()}
    print(f"加载了 {len(translations)} 条翻译（规范化后 {len(norm_lookup)} 条）")
    
    replaced_count = 0

    # 注册 DrawingML 命名空间，避免写回时丢失前缀
    ET.register_namespace('a', 'http://schemas.openxmlformats.org/drawingml/2006/main')

    # 预先生成按长度排序的 key 列表（子串匹配时用）
    keys_sorted = sorted(norm_lookup.keys(), key=len, reverse=True)

    slide_name_re = re.compile(r'^ppt/slides/slide(\d+)\.xml$')

    def replace_in_xml(xml_bytes: bytes, label: str) -> (bytes, int):
        nonlocal replaced_count
        try:
            root = ET.fromstring(xml_bytes)
        except Exception:
            return xml_bytes, 0

        local_replaced = 0
        replaced_texts = set()  # 记录已替换的文本，避免重复替换

        # 先做段落级替换：a:p 下的所有 a:t 合并后匹配整句
        for p in root.iter():
            if not str(p.tag).endswith('}p'):
                continue
            # 收集该段落内所有 a:t
            t_nodes = []
            for el in p.iter():
                if str(el.tag).endswith('}t'):
                    t_nodes.append(el)
            if not t_nodes:
                continue
            original = ''.join((tn.text or '') for tn in t_nodes).strip()
            if not original:
                continue
            k = norm(original)
            
            # 跳过已替换的文本
            if k in replaced_texts:
                continue
                
            hit_val = None
            match_type = None
            
            # 1. 精确匹配
            if k in norm_lookup and norm_lookup[k]:
                hit_val = norm_lookup[k]
                match_type = '精确'
            # 2. 子串匹配（原文包含译文 key）
            elif not hit_val:
                for key in keys_sorted:
                    if len(key) >= 5 and key in k:  # 提高阈值避免误匹配
                        hit_val = norm_lookup[key]
                        match_type = '子串'
                        break
            # 3. 反向匹配（译文 key 包含原文）- 处理原文被拆分的情况
            # 仅当原文长度足够且占 key 的比例较高时才匹配
            if not hit_val:
                for key in keys_sorted:
                    if len(k) >= 6 and k in key and len(k) / len(key) > 0.5:  # 原文至少占 key 的 50%
                        hit_val = norm_lookup[key]
                        match_type = '反向'
                        break
                        
            if hit_val:
                # 写回：第一个 a:t 赋完整译文，其余清空（保留 bullet 与样式）
                t_nodes[0].text = hit_val
                for tn in t_nodes[1:]:
                    tn.text = ''
                local_replaced += 1
                replaced_texts.add(k)
                print(f"  {label}[段落-{match_type}]: '{original[:40]}...' -> '{hit_val[:40]}...'")

        # 再遍历所有 a:t 节点做细粒度兜底
        for el in root.iter():
            tag = el.tag
            if tag.endswith('}t'):
                src = (el.text or '').strip()
                if not src:
                    continue
                key = norm(src)
                
                # 跳过已替换的文本
                if key in replaced_texts:
                    continue
                    
                hit_val = None
                match_type = None
                
                # 1. 精确匹配
                if key in norm_lookup and norm_lookup[key]:
                    hit_val = norm_lookup[key]
                    match_type = '精确'
                # 2. 子串匹配
                elif not hit_val:
                    for k in keys_sorted:
                        if len(k) >= 5 and k in key:  # 提高阈值避免误匹配
                            hit_val = norm_lookup[k]
                            match_type = '子串'
                            break
                # 3. 反向匹配 - 仅当原文长度足够且占比较高时
                if not hit_val:
                    for k in keys_sorted:
                        if len(key) >= 6 and key in k and len(key) / len(k) > 0.5:
                            hit_val = norm_lookup[k]
                            match_type = '反向'
                            break
                            
                if hit_val:
                    el.text = hit_val
                    local_replaced += 1
                    replaced_texts.add(key)
                    print(f"  {label}[节点-{match_type}]: '{src[:40]}...' -> '{hit_val[:40]}...'")

        if local_replaced:
            return ET.tostring(root, encoding='utf-8', xml_declaration=True), local_replaced
        else:
            return xml_bytes, 0

    # 读原始 pptx（zip），写新 pptx（zip），对 ppt/*.xml 做文本替换（slides、layouts、masters、notes 等）
    with zipfile.ZipFile(input_path, 'r') as zin:
        # 直接写到 output_path
        with zipfile.ZipFile(output_path, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                m = slide_name_re.match(item.filename)
                if item.filename.startswith('ppt/') and item.filename.endswith('.xml'):
                    # 识别 slideN.xml 以打印页码，其余打印文件名
                    if m:
                        label = f"第 {int(m.group(1))} 页"
                    else:
                        # 简短文件标签（例如 slideLayouts/slideLayout1.xml）
                        label = item.filename.replace('ppt/', '')
                    new_xml, nrep = replace_in_xml(data, label)
                    if nrep:
                        replaced_count += nrep
                    zout.writestr(item, new_xml)
                else:
                    zout.writestr(item, data)

    print(f"✓ 已保存翻译后的 PPTX: {output_path}")
    print(f"✓ 共替换 {replaced_count} 处文本")

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("用法: python3 update_pptx.py <input.pptx> <output.pptx> <translations.json>")
        sys.exit(1)
    
    input_pptx = sys.argv[1]
    output_pptx = sys.argv[2]
    translations_file = sys.argv[3]
    
    update_pptx_with_translations(input_pptx, output_pptx, translations_file)
