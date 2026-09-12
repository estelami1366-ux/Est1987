#!/usr/bin/env python3
# Assemble a SIRMAN_NATIVE_UPDATE package from a publish/App directory.
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

HTML_NAMES = ("sirman_final", "laegh_final", "test_laegh.js")


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

    entries = []
    for name in DEFAULT_PAYLOAD:
        src = source / name
        if not src.is_file():
            continue
        if is_forbidden_html(name):
            print("refusing HTML payload name", name, file=sys.stderr)
            return 3
        dest = files_dir / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        entries.append(
            {
                "path": name.replace("\\", "/"),
                "sha256": sha256_file(dest),
                "bytes": dest.stat().st_size,
            }
        )

    if not entries:
        print("no native payload files found", file=sys.stderr)
        return 4

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
