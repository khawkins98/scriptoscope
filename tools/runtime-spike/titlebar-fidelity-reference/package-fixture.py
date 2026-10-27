"""Add the retained fixture's 1 MiB SIZE policy to our compiled MacBinary.

Adapted from the existing public capture toolkit's package-v17.py (not engine
code). Input/output must be newly authored fixture binaries; never original
program assets. Refuses overwrite and an already packaged resource fork.
"""
from pathlib import Path
import binascii
import struct
import sys

source, destination = map(Path, sys.argv[1:3])
b = bytearray(source.read_bytes())
data_bytes, fork_bytes = struct.unpack_from('>II', b, 83)
offset = 128 + (data_bytes + 127) // 128 * 128
v = b[offset:offset + fork_bytes]
data_offset, map_offset, data_length, map_length = struct.unpack_from('>IIII', v)
m = v[map_offset:map_offset + map_length]
type_offset, name_offset = struct.unpack_from('>HH', m, 24)
count = struct.unpack_from('>H', m, type_offset)[0] + 1
groups = []
for i in range(count):
    pos = type_offset + 2 + i * 8
    kind = bytes(m[pos:pos + 4])
    n, ref_offset = struct.unpack_from('>HH', m, pos + 4)
    groups.append((kind, [bytes(m[type_offset + ref_offset + j * 12:type_offset + ref_offset + (j + 1) * 12]) for j in range(n + 1)]))
assert not any(kind == b'SIZE' for kind, _ in groups), 'Already packaged'
assert {kind for kind, _ in groups} == {b'CODE', b'DATA', b'RELA'}, 'Unexpected fixture resource types'
size = bytes.fromhex('00800010000000100000')
groups.append((b'SIZE', [struct.pack('>hH', -1, 65535) + b'\0' + data_length.to_bytes(3, 'big') + b'\0' * 4]))
types = bytearray(struct.pack('>H', len(groups) - 1))
refs = bytearray()
for kind, entries in groups:
    types += kind + struct.pack('>HH', len(entries) - 1, 2 + len(groups) * 8 + len(refs))
    refs += b''.join(entries)
newmap = bytearray(m[:28])
struct.pack_into('>HH', newmap, 24, 28, 28 + len(types) + len(refs))
newmap += types + refs + m[name_offset:]
data = v[data_offset:data_offset + data_length] + struct.pack('>I', len(size)) + size
header = struct.pack('>IIII', data_offset, data_offset + len(data), len(data), len(newmap))
newmap[:16] = header
fork = header + v[16:data_offset] + data + newmap
out = b[:offset] + fork
struct.pack_into('>I', out, 87, len(fork))
out += b'\0' * (-len(out) % 128)
struct.pack_into('>H', out, 124, binascii.crc_hqx(out[:124], 0))
with destination.open('xb') as f:
    f.write(out)
