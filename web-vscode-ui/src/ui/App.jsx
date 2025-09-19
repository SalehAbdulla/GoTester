import React, { useEffect, useState, useRef } from "react";
import Editor from "@monaco-editor/react";
import "./vscode.css";

const DEFAULT_CODE = `package piscine

func SaveAndMiss(arg string, num int) string {
    // TODO: your solution here
    return arg
}`.trim();

const problems = [
  { id: "SaveAndMiss", name: "SaveAndMiss", filename: "saveandmiss.go", language: "go" },
];

function summarize(out) {
  const total = (out.match(/=== RUN\s+.*case_/g) || []).length;
  const failed = (out.match(/--- FAIL:\s+.*case_/g) || []).length;
  const passed = total ? total - failed : (out.includes("\nPASS\n") ? 1 : 0);
  return { total: total || null, passed, failed };
}

export default function App(){
  const [problem, setProblem]   = useState(problems[0]);
  const [filename, setFilename] = useState(problems[0].filename);
  const [code, setCode]         = useState(() => localStorage.getItem("code:"+problems[0].id) || DEFAULT_CODE);

  const [running, setRunning]   = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState({ok:null, stdout:"", stderr:"", exitCode:null, summary:null});

  // Layout
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [zen, setZen]                   = useState(false);
  const [qOpen, setQOpen]               = useState(false);     // QUESTION PANE
  const [qWidth, setQWidth]             = useState(380);       // px
  const [question, setQuestion]         = useState("Loading…");

  // drag-to-resize ref
  const dragRef = useRef(null);
  const startX  = useRef(0);
  const startW  = useRef(qWidth);

  useEffect(()=>{
    setFilename(problem.filename);
    const saved = localStorage.getItem("code:"+problem.id);
    setCode(saved || DEFAULT_CODE);
    fetch(`/questions/${problem.id}.md`)
      .then(r => r.ok ? r.text() : Promise.reject())
      .then(setQuestion)
      .catch(()=> setQuestion("No question file for this problem yet."));
  }, [problem.id]);

  // shortcuts
  useEffect(()=>{
    const onKey = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") { e.preventDefault(); setSidebarOpen(s=>!s); }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); setZen(z=>!z); }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "q") { e.preventDefault(); setQOpen(q=>!q); }
      if (e.key === "F9") { e.preventDefault(); onRun(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // drag handlers
  const onDragStart = (e) => {
    startX.current = e.clientX;
    startW.current = qWidth;
    const move = (ev) => {
      const dx = startX.current - ev.clientX;       // dragging left increases width
      const w  = Math.max(280, Math.min(600, startW.current + dx));
      setQWidth(w);
    };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const onRun = async () => {
    setRunning(true);
    setShowResult(false);
    try {
      const body = new URLSearchParams();
      body.set("problem", problem.id);
      body.set("filename", filename);
      body.set("code", code);

      const res = await fetch("http://localhost:3001/run", { method:"POST", body });
      const json = await res.json();
      const summary = summarize((json.stdout || "") + "\n" + (json.stderr || ""));
      setResult({...json, summary});
      setShowResult(true);
    } catch (e) {
      setResult({ok:false, stdout:"", stderr:String(e), exitCode:-1, summary:null});
      setShowResult(true);
    } finally {
      setRunning(false);
    }
  };

  const onChange = (value) => {
    setCode(value ?? "");
    localStorage.setItem("code:"+problem.id, value ?? "");
  };

  // grid columns: when in zen, we overlay the question pane (so keep main 2 cols)
  const gridCols = `${sidebarOpen ? "var(--sidebar-w)" : "0px"} 1fr ${(!zen && qOpen) ? `${qWidth}px` : "0px"}`;

  return (
    <div className={`app ${zen ? "zen": ""} ${sidebarOpen ? "withSidebar":"noSidebar"}`}>
      {/* Titlebar */}
      <div className="titlebar">
        <button className="iconBtn" title="Toggle sidebar (Ctrl+Shift+F)" onClick={()=>setSidebarOpen(s=>!s)}>☰</button>
        <div className="title">Go Piscine Tester</div>
        <div className="titleRight">
          <button className="btn" onClick={onRun} disabled={running}>▶ Run</button>
          <button className="btnAccent" onClick={()=>setQOpen(o=>!o)} title="Toggle question (Ctrl+Shift+Q)">📄 Show Question</button>
          <button className="btnGhost" title="Focus (Ctrl+Shift+Z)" onClick={()=>setZen(z=>!z)}>{zen ? "Exit Focus" : "Focus"}</button>
        </div>
      </div>

      {/* Main grid */}
      <div className="main" style={{ gridTemplateColumns: gridCols }}>
        {/* Problems sidebar */}
        <aside className="sidebar">
          <div className="sectionTitle">Level 5</div>
          {problems.map(p => (
            <div key={p.id}
                 className={"item"+(problem.id===p.id?" active":"")}
                 onClick={()=>setProblem(p)}>
              {p.name}
            </div>
          ))}
        </aside>

        {/* Editor */}
        <section className="editor">
          <div className="tabbar">
            <div className="tab">{filename}</div>
            <div style={{marginLeft:"auto", display:"flex", gap:8}}>
              <label className="fileLabel">File:</label>
              <input className="fileInput" value={filename} onChange={e=>setFilename(e.target.value)} />
              <button className="btn" onClick={onRun} disabled={running}>Run</button>
            </div>
          </div>

          <Editor
            height="100%"
            theme="vs-dark"
            defaultLanguage="go"
            language={problem.language}
            value={code}
            onChange={onChange}
            options={{
              minimap:{enabled:false},
              fontLigatures:true,
              fontFamily:'"Cascadia Code","Fira Code", Menlo, Consolas, monospace',
              fontSize:14,
              smoothScrolling:true,
              scrollBeyondLastLine:false,
              automaticLayout:true
            }}
          />
        </section>

        {/* Question Pane (right) */}
        <aside
          className={`qpane ${zen ? "overlay" : ""}`}
          style={{ display: qOpen ? "flex" : "none", width: (!zen ? qWidth : undefined) }}
        >
          <div className="qheader">
            <div>Question — {problem.name}</div>
            <button className="closeBtn" onClick={()=>setQOpen(false)}>✕</button>
          </div>
          <div className="qcontent">
            <pre className="md">{question}</pre>
          </div>
          {/* resizer (only when not overlaying in zen) */}
          {!zen && <div className="qresize" onMouseDown={onDragStart} ref={dragRef} title="Drag to resize" />}
        </aside>
      </div>

      {/* Statusbar */}
      <div className="statusbar">
        <span>Problem: {problem.name}</span>
        <span>|</span>
        <span>Server: http://localhost:3001</span>
        <span style={{marginLeft:"auto"}} className={result.ok ? "ok" : result.ok===false ? "fail" : ""}>
          {result.ok===true ? "All tests passed" : result.ok===false ? "Tests failed" : "Idle"}
        </span>
      </div>

      {/* Floating actions in Focus */}
      {zen && (
        <div className="fabGroup">
          <button className="fab" onClick={onRun} title="Run (F9)">▶</button>
          <button className="fab fabPurple" onClick={()=>setQOpen(o=>!o)} title="Show Question">?</button>
        </div>
      )}

      {/* Running Modal */}
      {running && (
        <div className="modalBackdrop">
          <div className="modalCard">
            <h3 className="modalTitle">Checking your code</h3>
            <div className="spinner" />
            <div style={{opacity:.8, fontSize:13}}>Running tests in a sandboxed Docker container…</div>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {showResult && !running && (
        <div className="modalBackdrop" onClick={()=>setShowResult(false)}>
          <div className="modalCard" onClick={e=>e.stopPropagation()}>
            <div className="modalHeader">
              <h3 className="modalTitle">
                {result.ok ? "✔ You passed!" : "✖ You didn't pass :("}
              </h3>
              <button className="closeBtn" onClick={()=>setShowResult(false)}>✕</button>
            </div>

            {result.summary?.total ? (
              <div style={{marginBottom:8, fontSize:14}}>
                Cases: <b>{result.summary.passed}</b> / <b>{result.summary.total}</b>
                {result.summary.failed ? `  •  Failed: ${result.summary.failed}` : ""}
              </div>
            ) : null}

            <div className="codeBlock">
              <div className="codeTitle">stdout</div>
              <pre>{result.stdout || "(empty)"}</pre>
            </div>
            <div className="codeBlock">
              <div className="codeTitle">stderr</div>
              <pre>{result.stderr || "(empty)"}</pre>
            </div>

            <div className="modalActions">
              <button className="btn" onClick={()=>setShowResult(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
