async function loadTop10() {
  const status = document.getElementById("status");
  const rows = document.getElementById("rows");
  const table = document.getElementById("table");
  try {
    status.textContent = "Fetching top-10 from backend...";
    const res = await fetch("http://localhost:5000/priority");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const list = json.top10 || [];
    rows.innerHTML = "";
    for (const item of list) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${item.rank}</td><td>${item.type}</td><td>${escapeHtml(item.message)}</td><td>${item.timestamp}</td>`;
      rows.appendChild(tr);
    }
    status.hidden = true;
    if (list.length) table.hidden = false;
    else status.textContent = "No notifications returned.";
  } catch (err) {
    status.textContent = "Error fetching top-10: " + (err.message || err);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

window.addEventListener("load", () => {
  loadTop10();
});
