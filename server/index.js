import express from "express";
import multer from "multer";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({limit:"1mb"}));
app.use(express.urlencoded({extended:true}));

// CORS for local dev
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

const upload = multer();

// Paths
const UI_QUESTIONS_DIR = path.join(__dirname, "..", "web-vscode-ui", "public", "questions");
const CASES_DIR        = path.join(__dirname, "cases");
for (const p of [UI_QUESTIONS_DIR, CASES_DIR]) fs.mkdirSync(p, {recursive:true});

// ---- Problems manifest (simple list used by the sidebar) ----
const MANIFEST = path.join(__dirname, "problems.json");
if (!fs.existsSync(MANIFEST)) {
  fs.writeFileSync(MANIFEST, JSON.stringify([
    { id:"SaveAndMiss", name:"SaveAndMiss", filename:"saveandmiss.go", language:"go" }
  ], null, 2));
}
const loadProblems = () => JSON.parse(fs.readFileSync(MANIFEST, "utf-8"));
const saveProblems = (arr) => fs.writeFileSync(MANIFEST, JSON.stringify(arr, null, 2));

// Ensure default cases file exists
const defaultCases = path.join(CASES_DIR, "saveandmiss.json");
if (!fs.existsSync(defaultCases)) {
  fs.writeFileSync(defaultCases, JSON.stringify([
    { "arg": "abcdef", "num": 2, "want": "ace" },
    { "arg": "zzz",    "num": 1, "want": "zzz" },
    { "arg": "",       "num": 3, "want": ""    }
  ], null, 2));
}

// ---------- API: Problems ----------
app.get("/api/problems", (_req, res) => res.json(loadProblems()));
app.post("/api/problems", (req, res) => {
  const { id, name, filename, language="go" } = req.body || {};
  if (!id || !name || !filename) return res.status(400).json({error:"id, name, filename required"});
  const list = loadProblems();
  if (list.find(p => p.id === id)) return res.status(400).json({error:"id already exists"});
  list.push({ id, name, filename, language });
  saveProblems(list);
  // seed empty question/cases
  const qPath = path.join(UI_QUESTIONS_DIR, `${id}.md`);
  const cPath = path.join(CASES_DIR, `${id}.json`);
  if (!fs.existsSync(qPath)) fs.writeFileSync(qPath, `# ${name}\n\nDescribe the task here.\n`);
  if (!fs.existsSync(cPath)) fs.writeFileSync(cPath, "[]");
  res.json({ok:true});
});

// ---------- API: Questions (markdown) ----------
app.get("/api/questions/:id", (req, res) => {
  const fn = path.join(UI_QUESTIONS_DIR, `${req.params.id}.md`);
  if (!fs.existsSync(fn)) return res.status(404).json({error:"not found"});
  res.type("text/markdown").send(fs.readFileSync(fn, "utf-8"));
});
app.post("/api/questions/:id", (req, res) => {
  const { content } = req.body || {};
  if (typeof content !== "string") return res.status(400).json({error:"content (string) required"});
  const fn = path.join(UI_QUESTIONS_DIR, `${req.params.id}.md`);
  fs.writeFileSync(fn, content);
  res.json({ok:true});
});

// ---------- API: Cases (JSON) ----------
app.get("/api/cases/:id", (req, res) => {
  const fn = path.join(CASES_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(fn)) return res.status(404).json({error:"not found"});
  res.type("application/json").send(fs.readFileSync(fn, "utf-8"));
});
app.post("/api/cases/:id", (req, res) => {
  // Accept either {cases: [...] } JSON or raw text (stringified JSON)
  let body = req.body;
  let text = "";
  if (typeof body === "string") {
    text = body;
  } else if (Array.isArray(body?.cases)) {
    text = JSON.stringify(body.cases, null, 2);
  } else if (typeof body?.text === "string") {
    text = body.text;
  } else {
    // last resort: stringify whatever was sent
    text = JSON.stringify(body, null, 2);
  }
  try { JSON.parse(text); } catch { return res.status(400).json({error:"invalid JSON"}); }
  const fn = path.join(CASES_DIR, `${req.params.id}.json`);
  fs.writeFileSync(fn, text);
  res.json({ok:true});
});

// ---------- Run tests (mount student AND cases) ----------
app.post("/run", upload.none(), async (req, res) => {
  try {
    const { problem, filename, code } = req.body;
    if (!problem || !filename || !code) return res.status(400).json({error:"missing problem/filename/code"});

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "go-tester-"));
    const studentDir = path.join(tmp, "student", "piscine");
    fs.mkdirSync(studentDir, {recursive:true});
    fs.writeFileSync(path.join(studentDir, filename), code, "utf-8");

    const image = "go-tester:latest";
    const args = [
      "run","--rm",
      "--network","none",
      "--cpus","1","--memory","256m",
      "--pids-limit","128",
      "--read-only",
      "-v", `${tmp}/student:/app/student:ro`,
      "-v", `${CASES_DIR}:/app/cases:ro`,           // << mount editable cases
      "-e", `RUN_REGEX=^Test${problem.replace(/[^A-Za-z0-9_]/g,'')}$`,
      "-e", `CASES_DIR=/app/cases`,                 // << tell tests where to read
      image
    ];

    const child = spawn("docker", args, {stdio:["ignore","pipe","pipe"]});
    let out="", err="";
    child.stdout.on("data", d => out += d.toString());
    child.stderr.on("data", d => err += d.toString());
    const codeExit = await new Promise(resolve => child.on("close", resolve));

    try { fs.rmSync(tmp, {recursive:true, force:true}); } catch {}

    res.json({ ok: codeExit === 0, exitCode: codeExit, stdout: out, stderr: err });
  } catch (e) {
    res.status(500).json({error:String(e)});
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, ()=> console.log("server listening on", PORT));
