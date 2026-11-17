import hashlib
import json
import os
import struct
import sys

BLOCK_SIZE = 4194304


def compute_integrity(data: bytes) -> dict:
    full_hash = hashlib.sha256(data).hexdigest()
    blocks = []
    if len(data) == 0:
        blocks.append(hashlib.sha256(b"").hexdigest())
    else:
        for i in range(0, len(data), BLOCK_SIZE):
            blocks.append(hashlib.sha256(data[i : i + BLOCK_SIZE]).hexdigest())
    return {
        "algorithm": "SHA256",
        "hash": full_hash,
        "blockSize": BLOCK_SIZE,
        "blocks": blocks,
    }


def load_overrides(patch_dir: str) -> dict:
    overrides = {}
    if not os.path.isdir(patch_dir):
        return overrides
    for name in sorted(os.listdir(patch_dir)):
        full = os.path.join(patch_dir, name)
        if os.path.isfile(full):
            with open(full, "rb") as f:
                overrides[name] = f.read()
    return overrides


def patch_asar(src_path: str, dst_path: str, patch_dir: str) -> None:
    overrides = load_overrides(patch_dir)
    if not overrides:
        raise RuntimeError(f"Keine Patch-Dateien in '{patch_dir}' gefunden.")

    with open(src_path, "rb") as f:
        _, h_size, _, str_len = struct.unpack("<IIII", f.read(16))
        header = json.loads(f.read(str_len).decode("utf-8"))
        old_data_offset = 8 + h_size

        blobs = []
        seen_top = set()

        def collect(node: dict, parts: list) -> dict:
            out_files = {}
            for key, val in node.get("files", {}).items():
                if "files" in val:
                    out_files[key] = {"files": collect(val, parts + [key])}
                else:
                    rel = "/".join(parts + [key])
                    if not parts:
                        seen_top.add(key)
                    if not parts and key in overrides:
                        content = overrides[key]
                    else:
                        f.seek(old_data_offset + int(val["offset"]))
                        content = f.read(val["size"])
                    blobs.append((rel, parts + [key], content))
                    out_files[key] = None
            return out_files

        new_header = {"files": collect(header, [])}

    # Add new top-level files from overrides (e.g. updater.js)
    for name, content in overrides.items():
        if name not in seen_top:
            new_header["files"][name] = None
            blobs.append((name, [name], content))

    offset = 0
    for _, parts, content in blobs:
        cur = new_header
        for part in parts[:-1]:
            cur = cur["files"][part]
        cur["files"][parts[-1]] = {
            "size": len(content),
            "offset": str(offset),
            "integrity": compute_integrity(content),
        }
        offset += len(content)

    header_bytes = json.dumps(new_header, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    str_len = len(header_bytes)
    pad_len = (4 - (str_len % 4)) % 4
    u2 = str_len + pad_len + 4
    h_size = u2 + 4

    os.makedirs(os.path.dirname(os.path.abspath(dst_path)), exist_ok=True)
    tmp_path = dst_path + ".tmp"
    with open(tmp_path, "wb") as out:
        out.write(struct.pack("<IIII", 4, h_size, u2, str_len))
        out.write(header_bytes)
        out.write(b"\x00" * pad_len)
        for _, _, content in blobs:
            out.write(content)

    os.replace(tmp_path, dst_path)
    print(f"app.asar erfolgreich gepatcht ({len(blobs)} Dateien, Overrides: {', '.join(overrides.keys())}) -> {dst_path}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("Usage: patch-asar.py <src_app_asar> <dst_app_asar> <patch_dir>")
    patch_asar(sys.argv[1], sys.argv[2], sys.argv[3])
