function setJson(id, obj) {
  const el = document.getElementById(id);
  el.textContent = obj ? JSON.stringify(obj, null, 2) : "(none)";
}

function appendEvent(str) {
  const ul = document.getElementById("events");
  const li = document.createElement("li");
  li.textContent = str;
  ul.prepend(li);
}

function setGo(val) {
  document.getElementById("goGate").textContent = val || "(unset)";
}

const ev = new EventSource("/events");
ev.onopen = () => { document.getElementById("status").textContent = "Connected"; };
ev.onerror = () => { document.getElementById("status").textContent = "Disconnected"; };

ev.addEventListener("snapshot", (e) => {
  const d = JSON.parse(e.data);
  setJson("patchIr", d.patch);
  setJson("verifyIr", d.verify);
  setJson("scorecard", d.score);
});

ev.addEventListener("file_add", (e) => {
  const d = JSON.parse(e.data);
  appendEvent(`ADD ${d.path}`);
});

ev.addEventListener("file_unlink", (e) => {
  const d = JSON.parse(e.data);
  appendEvent(`DEL ${d.path}`);
});

ev.addEventListener("file_change", (e) => {
  const d = JSON.parse(e.data);
  appendEvent(`CHG ${d.path}`);
  if (d.path.endsWith("patch_ir.json")) setJson("patchIr", d.content);
  if (d.path.endsWith("verify_ir.json")) setJson("verifyIr", d.content);
  if (d.path.endsWith("scorecard.json")) setJson("scorecard", d.content);
  if (d.path.endsWith("GO.txt")) setGo(d.content);
});

// Goal form logic
async function fetchTemplate() {
  const r = await fetch('/api/spec-template');
  return r.json();
}

document.getElementById('fillTemplate').addEventListener('click', async () => {
  try {
    const t = await fetchTemplate();
    document.getElementById('task_id').value = t.task_id || '';
    document.getElementById('intent').value = t.intent || 'feature';
    document.getElementById('constraints').value = (t.constraints || []).join('\n');
    document.getElementById('acceptance').value = (t.acceptance || []).join('\n');
    const paths = (t.targets || []).map(x => x.path).join(', ');
    document.getElementById('targets').value = paths;
  } catch (e) { alert('Failed to load template'); }
});

document.getElementById('goalForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('goalMsg');
  msg.textContent = 'Submitting...';
  const task_id = document.getElementById('task_id').value.trim();
  const intent = document.getElementById('intent').value;
  const constraints = document.getElementById('constraints').value.split(/\r?\n/).filter(Boolean);
  const acceptance = document.getElementById('acceptance').value.split(/\r?\n/).filter(Boolean);
  const targets = document.getElementById('targets').value.split(',').map(s => s.trim()).filter(Boolean).map(p => ({ path: p }));
  const autoStart = document.getElementById('autoStart').checked;
  try {
    const r = await fetch('/api/goals', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task_id, intent, constraints, acceptance, targets, autoStart })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Failed');
    msg.textContent = `Created ${j.dir} (started=${j.started})`;
  } catch (err) {
    msg.textContent = String(err.message || err);
  }
});

