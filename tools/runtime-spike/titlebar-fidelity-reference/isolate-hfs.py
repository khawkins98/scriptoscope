"""Rebuild retained public hfsutils in a fresh private run; no global state.

Usage: python3 isolate-hfs.py RETAINED_HFSUTILS NEW_ABSOLUTE_RUN_ROOT
Never mounts media or installs tools globally. The caller owns the resulting run.
"""
from pathlib import Path
import json
import shutil
import subprocess
import sys

source, root = map(Path, sys.argv[1:])
if not root.is_absolute() or root.parent.resolve() != root.parent or root.exists():
    raise SystemExit('Run must be a fresh canonical absolute path')
old = 'home = "/tmp/scriptoscope-original-reference-20261018-01/hfs-state";'
text = (source / 'hcwd.c').read_text()
if text.count(old) != 1:
    raise SystemExit('Unexpected retained HFS state implementation')
root.mkdir(mode=0o700)
for name in ['hfs-state', 'work', 'web', 'logs', 'captures']:
    (root / name).mkdir()
(root / 'titlebar-owned-run.json').write_text(json.dumps({'purpose': 'titlebar-pair-v1'}) + '\n')
destination = root / 'hfsutils'
shutil.copytree(source, destination, symlinks=False)
(destination / 'hcwd.c').write_text(text.replace(old, 'home = ' + json.dumps(str(root / 'hfs-state')) + ';'))
with (root / 'logs/hfs-build.log').open('x') as log:
    subprocess.run(['make', 'clean'], cwd=destination, stdout=log, stderr=log, check=True)
    subprocess.run(['make', 'hfsutil'], cwd=destination, stdout=log, stderr=log, check=True)
for name in ['hmount', 'hls', 'hcopy', 'hdel', 'humount', 'hvol', 'hcd', 'hpwd']:
    # hfsutil dispatches by argv[0]; regular copies avoid linked tool state.
    shutil.copyfile(destination / 'hfsutil', destination / name)
    (destination / name).chmod(0o700)
print(root)
