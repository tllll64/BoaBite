"""Download the local V3 segmentation model; verify before replacing a file."""
from pathlib import Path
import hashlib
import os
import tempfile
import urllib.request

DEST = Path(__file__).resolve().parents[1] / "devlog/v3/app/vendor/models/u2net.onnx"
URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx"
MD5 = "60024c5c889badc19c04ad937298a77b"

def checksum(path):
    digest = hashlib.md5()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def main():
    DEST.parent.mkdir(parents=True, exist_ok=True)
    if DEST.exists() and checksum(DEST) == MD5:
        print("Model already verified:", DEST)
        return
    fd, temporary = tempfile.mkstemp(prefix="u2net-", suffix=".download", dir=DEST.parent)
    os.close(fd)
    temporary = Path(temporary)
    try:
        with urllib.request.urlopen(URL, timeout=60) as response, temporary.open("wb") as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
        if checksum(temporary) != MD5:
            raise RuntimeError("Model checksum mismatch; existing model kept")
        temporary.replace(DEST)
        print("Model downloaded and verified:", DEST)
    finally:
        temporary.unlink(missing_ok=True)

if __name__ == "__main__":
    main()
