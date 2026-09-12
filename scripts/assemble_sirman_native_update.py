#!/usr/bin/env python3
# Assemble a SIRMAN_NATIVE_UPDATE package from a publish/App directory.
# Copies every allow-listed native/runtime file (self-contained win-x64).
# Does not read Sirman_Final.html, Laegh_Final.html, or test_laegh.js.
# Does not apply or replace installed files.
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path

DEFAULT_PAYLOAD = [
    "Sirman.exe",
    "Sirman.dll",
    "Sirman.Core.dll",
    "Sirman.deps.json",
    "Sirman.runtimeconfig.json",
    "SIRMAN_VERSION.json",
    "WebView2Loader.dll",
]

REQUIRED_SELF_CONTAINED = [
    "hostfxr.dll",
    "hostpolicy.dll",
    "coreclr.dll",
    "clrjit.dll",
    "System.Private.CoreLib.dll",
    "System.Windows.Forms.dll",
    "WindowsBase.dll",
]

EXACT_ALLOWED = {
    "sirman.exe",
    "sirman.dll",
    "sirman.core.dll",
    "sirman.deps.json",
    "sirman.runtimeconfig.json",
    "sirman_version.json",
    "webview2loader.dll",
    "sirman.persistence.sqlite.dll",
    "createdump.exe",
    "coreclr.dll",
    "clrjit.dll",
    "clrgc.dll",
    "clretwrc.dll",
    "hostfxr.dll",
    "hostpolicy.dll",
    "mscorlib.dll",
    "netstandard.dll",
}

ALLOWED_PREFIXES = (
    "system.",
    "microsoft.",
    "presentation",
    "windowsbase",
    "windowsforms",
    "accessibility",
    "directwrite",
    "wpfgfx",
    "d3dcompiler",
    "penimc",
    "reachframework",
    "uiautomation",
    "vcruntime",
    "msvcp",
    "msquic",
)


def is_forbidden_html(rel: str) -> bool:
    name = Path(rel).name.lower()
    suffix = Path(rel).suffix.lower()
    if suffix in {".html", ".htm"}:
        return True
    if name == "test_laegh.js":
        return True
    if name.startswith("sirman_final") or name.startswith("laegh_final"):
        return True
    return False


def is_packaging_excluded(rel: str) -> bool:
    name = Path(rel).name.lower()
    suffix = Path(rel).suffix.lower()
    if suffix in {".pdb", ".xml"}:
        return True
    if name in {"createdump.exe", "createdump"}:
        return True
    if name.startswith("mscordaccore") or name in {"mscordbi.dll", "mscorrc.dll"}:
        return True
    return False


def is_allowed_native(rel: str) -> bool:
    if is_forbidden_html(rel) or is_packaging_excluded(rel):
        return False
    posix = rel.replace("\\", "/").strip().lstrip("/")
    name = Path(posix).name.lower()
    if name.endswith((".sqlite", ".db")):
        return False
    if name == "sirman_pending_update.json" or name.startswith("sirman_update_"):
        return False
    if name in EXACT_ALLOWED:
        return True
    if posix.lower().startswith("runtimes/"):
        return True
    return any(name.startswith(prefix) for prefix in ALLOWED_PREFIXES)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_identity(source: Path, args: argparse.Namespace) -> dict:
    version = args.version
    assembly = args.assembly
    ident = args.id
    ver_file = source / "SIRMAN_VERSION.json"
    if ver_file.is_file():
        data = json.loads(ver_file.read_text(encoding="utf-8"))
        version = version or data.get("app")
        assembly = assembly or data.get("assembly")
    if not version or not assembly:
        raise SystemExit("version/assembly required (args or SIRMAN_VERSION.json)")
    ident = ident or f"sirman-native-{version}-p0"
    return {
        "id": ident,
        "version": version,
        "assembly": assembly,
        "minAssembly": args.min_assembly or assembly,
        "maxAssembly": args.max_assembly or assembly,
    }


def add_file(source: Path, files_dir: Path, rel: str, entries: list, copied: set[str]) -> str | None:
    posix = rel.replace("\\", "/").strip().lstrip("/")
    key = posix.lower()
    if key in copied:
        return None
    copied.add(key)
    if is_forbidden_html(posix):
        print("refusing HTML payload name", posix, file=sys.stderr)
        return "html"
    src = source / posix
    if not src.is_file():
        return "missing"
    dest = files_dir / posix
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    entries.append(
        {
            "path": posix,
            "sha256": sha256_file(dest),
            "bytes": dest.stat().st_size,
        }
    )
    return None


def check_runtime(files_dir: Path) -> int:
    rc = files_dir / "Sirman.runtimeconfig.json"
    if not rc.is_file():
        return 0
    try:
        data = json.loads(rc.read_text(encoding="utf-8"))
    except Exception:
        print("Sirman.runtimeconfig.json invalid", file=sys.stderr)
        return 6
    opts = data.get("runtimeOptions") or {}
    included = opts.get("includedFrameworks") or []
    shared = opts.get("framework") or opts.get("frameworks")
    if shared and not included:
        print("framework-dependent runtimeconfig refused", file=sys.stderr)
        return 7
    if not included:
        return 0
    for name in REQUIRED_SELF_CONTAINED:
        path = files_dir / name
        if not path.is_file() or path.stat().st_size < 1:
            print("missing self-contained runtime file", name, file=sys.stderr)
            return 8
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Assemble SIRMAN native-only update package")
    p.add_argument("--source", required=True, help="publish or App directory (HTML beside it is skipped)")
    p.add_argument("--out", required=True, help="output package directory")
    p.add_argument("--id")
    p.add_argument("--version")
    p.add_argument("--assembly")
    p.add_argument("--min-assembly")
    p.add_argument("--max-assembly")
    args = p.parse_args()

    source = Path(args.source).resolve()
    out = Path(args.out).resolve()
    if not source.is_dir():
        print("source missing", file=sys.stderr)
        return 2

    skipped = []
    for path in source.rglob("*"):
        if not path.is_file():
            continue
        rel = str(path.relative_to(source)).replace("\\", "/")
        if is_forbidden_html(rel):
            skipped.append(rel)
            # do not open/read the HTML file

    ident = load_identity(source, args)
    files_dir = out / "files"
    if out.exists():
        shutil.rmtree(out)
    files_dir.mkdir(parents=True)

    entries: list[dict] = []
    copied: set[str] = set()
    for name in DEFAULT_PAYLOAD:
        src = source / name
        if not src.is_file():
            continue
        err = add_file(source, files_dir, name, entries, copied)
        if err:
            return 3

    for path in source.rglob("*"):
        if not path.is_file():
            continue
        rel = str(path.relative_to(source)).replace("\\", "/")
        if is_forbidden_html(rel) or is_packaging_excluded(rel):
            continue
        if not is_allowed_native(rel):
            continue
        err = add_file(source, files_dir, rel, entries, copied)
        if err:
            return 3

    if not entries:
        print("no native payload files found", file=sys.stderr)
        return 4

    runtime_rc = check_runtime(files_dir)
    if runtime_rc:
        return runtime_rc

    manifest = {
        "magic": "SIRMAN_NATIVE_UPDATE",
        "format": 1,
        "id": ident["id"],
        "version": ident["version"],
        "assembly": ident["assembly"],
        "minAssembly": ident["minAssembly"],
        "maxAssembly": ident["maxAssembly"],
        "payloadKind": "native-only",
        "replacesHtml": False,
        "files": entries,
    }
    (out / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("package", out)
    print("files", len(entries))
    print("skippedHtml", len(skipped))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
