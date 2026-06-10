# BrowseMemory Website

The marketing site is a dependency-free static bundle.

## Preview locally

```bash
python3 -m http.server 4173 --directory website
```

Open `http://localhost:4173`.

## GitLab Pages

The repository root `.gitlab-ci.yml` publishes this directory as the Pages
artifact. Relative asset paths allow the site to work on both project and
custom domains.
