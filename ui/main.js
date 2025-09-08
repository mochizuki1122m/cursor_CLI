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
  setJson("understanding", d.understanding);
  const f = d.understanding_feedback;
  if (typeof f === 'string') {
    document.getElementById('understandingFeedback').value = f;
  }
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
  if (d.path.endsWith("understanding_ir.json")) setJson("understanding", d.content);
  if (d.path.endsWith("understanding_feedback.txt")) {
    document.getElementById('understandingFeedback').value = String(d.content || '');
  }
});

document.getElementById('btnConfirm').addEventListener('click', async () => {
  const feedback = document.getElementById('understandingFeedback').value;
  const r = await fetch('/api/understanding/confirm', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify({ feedback }) });
  const j = await r.json();
  document.getElementById('understandingMsg').textContent = r.ok ? '承認しました。実装を開始します。' : (j.error || 'Error');
});

document.getElementById('btnReject').addEventListener('click', async () => {
  const feedback = document.getElementById('understandingFeedback').value;
  const r = await fetch('/api/understanding/reject', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify({ feedback }) });
  const j = await r.json();
  document.getElementById('understandingMsg').textContent = r.ok ? '差し戻しました。Markdownに不足情報を追記して再送してください。' : (j.error || 'Error');
});

// Human spec (Markdown) flow
document.getElementById('loadMdTemplate').addEventListener('click', async () => {
  try {
    const r = await fetch('/api/spec-md-template');
    const t = await r.text();
    document.getElementById('specMd').value = t;
  } catch (e) { alert('Failed to load template'); }
});

document.getElementById('submitSpecMd').addEventListener('click', async () => {
  const msg = document.getElementById('goalMsg');
  msg.textContent = 'Submitting...';
  try {
    const autoStart = document.getElementById('autoStart').checked;
    const markdown = document.getElementById('specMd').value;
    const r = await fetch(`/api/spec-md?autoStart=${autoStart ? 'true' : 'false'}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ markdown })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Failed');
    msg.textContent = `Saved ${j.dir} (started=${j.started})`;
  } catch (err) {
    msg.textContent = String(err.message || err);
  }
});

