#!/usr/bin/env python3
"""Capture unreviewed independent-tool observations; never update review status."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import struct
import subprocess

ROOT = Path(__file__).resolve().parents[2]
def digest(data):
    return hashlib.sha256(data).hexdigest()
def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()
def fourcc(number):
    return number.to_bytes(4, 'big').decode('mac_roman') if number is not None else None

def inspect_resource_map(data):
    """Independent read-only header/map/string observation, no project decoder."""
    data_start, map_start, data_size, map_size = struct.unpack_from('>4I', data)
    if data_start + data_size > len(data) or map_start + map_size > len(data):
        raise ValueError('resource fork ranges exceed input')
    types_start = map_start + struct.unpack_from('>H', data, map_start + 24)[0]
    type_count = struct.unpack_from('>H', data, types_start)[0] + 1
    types, strings = {}, []
    for i in range(type_count):
        pos = types_start + 2 + i * 8
        kind = data[pos:pos + 4].decode('mac_roman')
        count, references = struct.unpack_from('>HH', data, pos + 4)
        types[kind] = count + 1
        if kind not in ['vers', 'STR#', 'STR ', 'TEXT']:
            continue
        for j in range(count + 1):
            ref = types_start + references + j * 12
            resource_id = struct.unpack_from('>h', data, ref)[0]
            start = data_start + int.from_bytes(data[ref + 5:ref + 8], 'big')
            length = struct.unpack_from('>I', data, start)[0]
            payload = data[start + 4:start + 4 + length]
            if len(payload) != length:
                raise ValueError('resource payload truncated')
            parsed = []
            if kind == 'TEXT':
                parsed = [payload.decode('mac_roman')]
            else:
                offset = 6 if kind == 'vers' else 2 if kind == 'STR#' else 0
                n = 2 if kind == 'vers' else struct.unpack_from('>H', payload)[0] if kind == 'STR#' else 1
                for _ in range(n):
                    if offset >= len(payload):
                        raise ValueError('string length missing')
                    size = payload[offset]
                    offset += 1
                    if offset + size > len(payload):
                        raise ValueError('string truncated')
                    parsed.append(payload[offset:offset + size].decode('mac_roman'))
                    offset += size
            strings.append({'type': kind, 'signedId': resource_id, 'payloadSha256': digest(payload), 'strings': parsed})
    return {'resourceTypes': types, 'identityStrings': strings}

def capture():
    tools = {}
    for name in ['lsar', 'unar']:
        executable = shutil.which(name)
        if not executable:
            raise RuntimeError(f'{name} must be installed; observations are never synthesized')
        tools[name] = {'version': subprocess.check_output([name, '-v']).decode().strip(),
                       'binarySha256': digest(Path(executable).read_bytes())}
    rows = []
    choices = json.loads((ROOT / 'tests/control-availability/source-choices.json').read_text())['sources']
    for choice in choices:
        source = ROOT / choice['path']
        payload = source.read_bytes()
        if digest(payload) != choice['archiveSha256']:
            raise ValueError(f'{choice["slug"]}: source hash drift')
        row = {'slug': choice['slug'], 'sourceSha256': digest(payload), 'sourceByteLength': len(payload),
               'kind': 'standalone-input' if choice['format'] == 'rsrc' else 'archive-input'}
        if choice['format'] == 'rsrc':
            row['content'] = inspect_resource_map(payload)
        else:
            listing = json.loads(subprocess.check_output(['lsar', '-j', str(source)]))
            row['format'] = listing['lsarFormatName']
            row['filenameEncoding'] = {'name': listing.get('lsarEncoding'), 'confidence': listing.get('lsarConfidence')}
            entries, matching_indexes = [], []
            for original in listing['lsarContents']:
                entry = {'lsarIndex': original['XADIndex'], 'name': original.get('XADFileName'),
                         'resourceFork': bool(original.get('XADIsResourceFork')), 'directory': bool(original.get('XADIsDirectory')),
                         'fileType': fourcc(original.get('XADFileType')), 'creator': fourcc(original.get('XADFileCreator')),
                         'byteLength': original.get('XADFileSize'), 'compression': original.get('XADCompressionName')}
                text = entry['fileType'] in ['TEXT', 'ttro'] or entry['name'].lower().endswith(('.html', '.htm', '.txt'))
                if not entry['directory'] and (entry['resourceFork'] or text):
                    # Index namespace is lsar's, never the registry's munbox index.
                    extracted = subprocess.check_output(['unar', '-q', '-o', '-', '-i', str(source), str(entry['lsarIndex'])])
                    entry['extractedSha256'] = digest(extracted)
                    entry['extractedByteLength'] = len(extracted)
                    if entry['resourceFork'] and digest(extracted) == choice['forkSha256']:
                        entry['content'] = inspect_resource_map(extracted)
                        matching_indexes.append(entry['lsarIndex'])
                entries.append(entry)
            row['entries'] = entries
            row['listingSha256'] = digest(canonical(entries))
            # This is a match to the proposed input, not approval or size selection.
            row['declaredForkMatches'] = matching_indexes
        rows.append(row)
    return {'schemaVersion': 1, 'status': 'unreviewed-independent-tool-observations', 'tools': tools, 'rows': rows,
            'limits': ['Independent output agreement is not general decoder certification.',
                       'No original engine or Resource Manager policy executes or is inferred.',
                       'Raw wrapping history and filename-codec uncertainty remain unverified.']}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    if args.output.resolve() == ROOT / 'tests/source-inputs/evidence.json':
        parser.error('write a review candidate elsewhere; capture cannot replace reviewed evidence')
    args.output.write_text(json.dumps(capture(), indent=2, ensure_ascii=False) + '\n')
