"""Vendor the pinned Supabase browser SDK and record reproducible integrity hashes."""
import base64
import hashlib
import io
import json
from pathlib import Path
import tarfile
from urllib.request import urlopen

VERSION = "2.116.0"
INTEGRITY = "sha512-YyWmKXt2NspV9iO8FPnlswUFJIRnrLd3oTCb+3ZyYRuKZtBH0xCUDgnUqoyA0fGUxpM/UhfwDjYf/dht/9bp7g=="
root = Path(__file__).resolve().parents[1] / "vendor"
with urlopen(f"https://registry.npmjs.org/@supabase/supabase-js/-/supabase-js-{VERSION}.tgz", timeout=30) as response:
    payload = response.read()
if "sha512-" + base64.b64encode(hashlib.sha512(payload).digest()).decode() != INTEGRITY:
    raise ValueError("Supabase archive integrity mismatch")
files = []
with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as archive:
    for target, member in [("supabase/supabase.js", "package/dist/umd/supabase.js"), ("supabase/LICENSE", "package/LICENSE")]:
        content = archive.extractfile(member).read()
        destination = root / target
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
        files.append({"path": target, "member": member, "sha256": hashlib.sha256(content).hexdigest()})
manifest = root / "manifest.json"
packages = [p for p in json.loads(manifest.read_text(encoding="utf-8")) if p["package"] != "@supabase/supabase-js"]
packages.append({"package": "@supabase/supabase-js", "version": VERSION, "archiveIntegrity": INTEGRITY, "files": files})
manifest.write_text(json.dumps(packages, indent=2) + "\n", encoding="utf-8")
print(f"Vendored @supabase/supabase-js@{VERSION}")
