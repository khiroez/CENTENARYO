# -*- mode: python ; coding: utf-8 -*-
import os
from PyInstaller.utils.hooks import collect_all

datas = [
    ('backend\\config', 'backend\\config'),
    ('backend\\core', 'backend\\core'),
    ('backend\\db.sqlite3', 'backend'),
    ('backend\\manage.py', 'backend'),
    ('frontend\\out', 'frontend\\out'),
]
if os.path.exists('backend\\media'):
    datas.append(('backend\\media', 'backend\\media'))

binaries = []
hiddenimports = []
for pkg in [
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'whitenoise',
    'rapidfuzz',
    'pypdf',
    'pypdfium2',
    'winocr',
    'winrt',
    'zxingcpp',
]:
    tmp_ret = collect_all(pkg)
    datas += tmp_ret[0]
    binaries += tmp_ret[1]
    hiddenimports += tmp_ret[2]


a = Analysis(
    ['app_launcher.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='CENTENARYO',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='CENTENARYO',
)
