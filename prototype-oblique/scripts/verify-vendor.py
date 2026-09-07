"""Check pinned browser assets; --upstream also compares published npm archives."""
import argparse
import base64
import hashlib
import io
import json
from pathlib import Path
import tarfile
from urllib.request import urlopen


def verify(upstream=False):
    root = Path(__file__).resolve().parents[1] / "vendor"
    packages = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    for package in packages:
        files = {item["path"]: (root / item["path"]).read_bytes() for item in package["files"]}
        for item in package["files"]:
            if hashlib.sha256(files[item["path"]]).hexdigest() != item["sha256"]:
                raise ValueError(f"Local asset hash mismatch: {item['path']}")
        if upstream:
            name, version = package["package"], package["version"]
            url = f"https://registry.npmjs.org/{name}/-/{name}-{version}.tgz"
            with urlopen(url, timeout=30) as response:
                payload = response.read()
            integrity = "sha512-" + base64.b64encode(hashlib.sha512(payload).digest()).decode()
            if integrity != package["archiveIntegrity"]:
                raise ValueError(f"Published archive integrity mismatch: {name}@{version}")
            # Read exact members in memory; never extract archive paths to disk.
            with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as archive:
                for item in package["files"]:
                    if archive.extractfile(item["member"]).read() != files[item["path"]]:
                        raise ValueError(f"Published asset differs: {item['path']}")
        print(f"PASS: {package['package']}@{package['version']} ({'upstream and local' if upstream else 'local'})")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--upstream", action="store_true", help="Download pinned archives for byte comparisons")
    verify(parser.parse_args().upstream)
