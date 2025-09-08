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

