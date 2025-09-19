# Go Piscine Web Tester — VS Code–style UI (React + Monaco + Docker)

## Prereqs
- Docker
- Node 18+

## 1) Build the Docker test image
```bash
docker build -t go-tester ./go-tester
```

## 2) Start the API server
```bash
cd server
npm i
npm start    # http://localhost:3001
```

## 3) Start the UI (Vite dev server)
```bash
cd web-vscode-ui
npm i
npm run dev  # open the printed localhost URL
```

Paste your Go function (package `piscine`) and press **Run**.

### Add a new problem
- Add a test: `go-tester/tests/<Problem>_test.go` with a Go test named `Test<Problem>`.
- Add cases: `go-tester/tests/cases/<problem>.json` (and optional hidden at `tests/hidden/<problem>_hidden.json`).
- Rebuild image: `docker build -t go-tester ./go-tester`
- Add to UI `problems[]` in `web-vscode-ui/src/ui/App.jsx`.

### Security flags (server → docker run)
`--network none`, `--cpus 1`, `--memory 256m`, `--pids-limit 128`, `--read-only`, volume is read-only.

You can tighten further with `--security-opt no-new-privileges` and a custom seccomp.
