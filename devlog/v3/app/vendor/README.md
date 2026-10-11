# V3 segmentation runtime

Before running the V3 preview on a fresh checkout:

```sh
python3 scripts/download-v3-model.py
npm run dev:v3
```

The full U²-Net model (about 176 MB) is downloaded from the rembg release and checked against MD5 `60024c5c889badc19c04ad937298a77b`. It is excluded from Git. The script preserves an existing model if downloading or verification fails.

The vendored ONNX Runtime Web files are from 1.20.1 and allow browser inference without a CDN. The small u2netp model remains as a reference; V3 uses the downloaded full model. See `devlog/v3/asset-review/SEGMENTATION_MODEL_TRIAL.md` for the source and limitations.
