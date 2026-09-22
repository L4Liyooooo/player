#!/usr/bin/env python3
"""
生成用于 uhttpd / 静态 Web 服务器的 tree.json 媒体清单
使用方法:
    python3 gen_tree.py          # 扫描当前目录下所有音频文件夹并生成 tree.json
    python3 gen_tree.py <目录>   # 扫描指定目录
"""
import os
import sys
import json
import re
from urllib.parse import quote

AUDIO_EXTS = {'.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'}
SUB_EXTS = {'.srt': 'srt'}

def natural_sort_key(s):
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]

def build_tree(root_dir, root_display_name="媒体库"):
    def scan_dir(dir_path, rel_base):
        display_name = os.path.basename(dir_path) or root_display_name
        node = {'name': display_name, 'children': {}, 'tracks': []}
        try:
            entries = sorted(os.scandir(dir_path), key=lambda e: natural_sort_key(e.name))
        except OSError:
            return node

        groups = {}
        subdirs = []

        for ent in entries:
            if ent.name.startswith('.') or ent.name.startswith('temp_'):
                continue
            if ent.is_dir(follow_symlinks=False):
                if ent.name not in ('__pycache__', 'node_modules', '.git', 'scratch'):
                    subdirs.append(ent.name)
                continue
            if not ent.is_file(follow_symlinks=False):
                continue

            dot = ent.name.rfind('.')
            if dot <= 0:
                continue
            base, ext = ent.name[:dot], ent.name[dot:].lower()
            if ext in AUDIO_EXTS:
                g = groups.setdefault(base, {'audio': None, 'sub': None, 'subType': None})
                g['audio'] = ent.name
            elif ext in SUB_EXTS:
                g = groups.setdefault(base, {'audio': None, 'sub': None, 'subType': None})
                g['sub'] = ent.name
                g['subType'] = 'srt'

        for base, g in groups.items():
            if not g['audio']:
                continue
            rel_dir = os.path.relpath(dir_path, root_dir)
            if rel_dir == '.':
                rel_dir = ''
            audio_rel = (rel_dir + '/' if rel_dir else '') + g['audio']
            sub_rel = ((rel_dir + '/' if rel_dir else '') + g['sub']) if g['sub'] else None
            
            node['tracks'].append({
                'title': base,
                'audioUrl': quote(audio_rel.replace(os.sep, '/')),
                'subUrl': quote(sub_rel.replace(os.sep, '/')) if sub_rel else None,
                'subType': g['subType'],
                'folderPath': rel_dir.replace(os.sep, '/'),
                'relPath': audio_rel.replace(os.sep, '/')
            })

        for dname in subdirs:
            sub_node = scan_dir(os.path.join(dir_path, dname), os.path.join(rel_base, dname))
            def has_tracks(n):
                return len(n['tracks']) > 0 or any(has_tracks(c) for c in n['children'].values())
            if has_tracks(sub_node):
                node['children'][dname] = sub_node

        return node

    root_node = scan_dir(root_dir, '')
    root_node['name'] = root_display_name
    return {
        'ok': True,
        'rootName': root_display_name,
        'tree': root_node
    }

def main():
    root_path = sys.argv[1] if len(sys.argv) > 1 else '.'
    abs_root = os.path.abspath(root_path)
    output_path = os.path.join(abs_root, 'tree.json')

    print(f"🔍 正在扫描媒体文件: {abs_root}")
    data = build_tree(abs_root)

    total_tracks = 0
    def count_tracks(n):
        nonlocal total_tracks
        total_tracks += len(n.get('tracks', []))
        for c in n.get('children', {}).values():
            count_tracks(c)
    count_tracks(data['tree'])

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ 生成成功 -> {output_path} (包含 {total_tracks} 首音频，{len(data['tree']['children'])} 个文件夹)")

if __name__ == '__main__':
    main()
