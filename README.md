# T2-z project website

Website for **T2-z: Test-Time Optimization of Environment Latents for Robotic World Models**.

- Website: https://t2-z-latent-optimization.github.io/
- Datasets: https://huggingface.co/datasets/huagailuowen/T2-z-datasets

This repository contains only the static project website and its presentation media, not model training or inference code.

## Local preview

Run from this repository:

```sh
python -m http.server 8765 --bind 127.0.0.1
```

Then open http://127.0.0.1:8765/. No build step is required.

## Deployment

GitHub Pages serves the root of the `main` branch. `.nojekyll` disables Jekyll processing. Updates pushed to `main` are published automatically.

Page content is in `index.html`, styles in `style.css`, interaction logic in `app.js`, and task results and media references in `data.json`. Compressed videos and figures are in `assets/`.

The project video is 1280 × 720. Qualitative clips retain their original dimensions, duration, and frame count. Paper and code links will be enabled when their public destinations are ready.
