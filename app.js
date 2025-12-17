const STORAGE_KEY = "apex_workspace_vault_v1";
    let entries = [];

    const form = document.getElementById("entry-form");
    const formCard = document.getElementById("form-card");
    const toggleFormBtn = document.getElementById("toggle-form");
    const tbody = document.getElementById("entries-body");
    const emptyState = document.getElementById("empty-state");
    const statusEl = document.getElementById("status");
    const exportBtn = document.getElementById("export-btn");
    const importBtn = document.getElementById("import-btn");
    const importFile = document.getElementById("import-file");
    const clearAllBtn = document.getElementById("clear-all");

    // modal controls
    const modalBackdrop = document.getElementById("modal-backdrop");
    const modalCancel = document.getElementById("modal-cancel");
    const modalMerge = document.getElementById("modal-merge");
    const modalReplace = document.getElementById("modal-replace");
    let pendingImportText = null;

    function setStatus(msg){ statusEl.textContent = msg || ""; }

    toggleFormBtn.addEventListener("click", () => {
      const isHidden = formCard.style.display === "none" || formCard.style.display === "";
      formCard.style.display = isHidden ? "block" : "none";
      toggleFormBtn.textContent = isHidden ? "✖ Close" : "➕ Add Entry";
      if (isHidden) setStatus("");
    });

    function nowIso(){ return new Date().toISOString(); }

    function normalizeEntry(e){
      return {
        id: e.id || (Date.now() + Math.floor(Math.random()*100000)),
        name: (e.name || "").toString(),
        link: (e.link || "").toString(),
        workspace: (e.workspace || "").toString(),
        username: (e.username || "").toString(),
        password: (e.password || "").toString(),
        updatedAt: (e.updatedAt || e.exportedAt || nowIso()).toString()
      };
    }

    function entryKey(e){
      return (e.link + "|" + e.workspace + "|" + e.username).trim().toLowerCase();
    }

    function loadEntries(){
      try{
        const raw = localStorage.getItem(STORAGE_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        entries = Array.isArray(arr) ? arr.map(normalizeEntry) : [];
      }catch(e){
        console.error(e);
        entries = [];
      }
    }

    function saveEntries(){
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }

    function renderEntries(){
      tbody.innerHTML = "";
      if(!entries.length){ emptyState.style.display="block"; return; }
      emptyState.style.display="none";

      entries
        .slice()
        .sort((a,b)=> (b.updatedAt || "").localeCompare(a.updatedAt || ""))
        .forEach((entry) => {
          const tr = document.createElement("tr");

          const nameCell = document.createElement("td");
          nameCell.className = "name-cell";
          const linkEl = document.createElement("a");
          linkEl.href = entry.link;
          linkEl.target = "_blank";
          linkEl.rel = "noreferrer";
          linkEl.textContent = entry.name || entry.link;
          nameCell.appendChild(linkEl);
          tr.appendChild(nameCell);

          const wsCell = document.createElement("td");
          wsCell.innerHTML = `<span class="tag mono">${entry.workspace}</span>`;
          tr.appendChild(wsCell);

          const userCell = document.createElement("td");
          userCell.innerHTML = `<span class="mono">${entry.username}</span>`;
          tr.appendChild(userCell);

          const passCell = document.createElement("td");
          const passSpan = document.createElement("span");
          passSpan.className = "mono";
          passSpan.textContent = "•".repeat(8);
          passSpan.dataset.real = entry.password;
          passSpan.dataset.visible = "false";

          const toggleBtn = document.createElement("button");
          toggleBtn.type = "button";
          toggleBtn.className = "outline";
          toggleBtn.style.marginLeft = "6px";
          toggleBtn.textContent = "Show";
          toggleBtn.addEventListener("click", () => {
            const visible = passSpan.dataset.visible === "true";
            if(visible){
              passSpan.textContent = "•".repeat(8);
              passSpan.dataset.visible = "false";
              toggleBtn.textContent = "Show";
            }else{
              passSpan.textContent = passSpan.dataset.real;
              passSpan.dataset.visible = "true";
              toggleBtn.textContent = "Hide";
            }
          });

          passCell.appendChild(passSpan);
          passCell.appendChild(toggleBtn);
          tr.appendChild(passCell);

          const actionsCell = document.createElement("td");
          const openBtn = document.createElement("button");
          openBtn.type = "button";
          openBtn.className = "outline";
          openBtn.textContent = "Open";
          openBtn.addEventListener("click", () => window.open(entry.link, "_blank", "noreferrer"));

          const deleteBtn = document.createElement("button");
          deleteBtn.type = "button";
          deleteBtn.className = "danger";
          deleteBtn.textContent = "Delete";
          deleteBtn.addEventListener("click", () => {
            const ok = confirm(`Delete entry "${entry.name}"?`);
            if(!ok) return;
            entries = entries.filter(e => e.id !== entry.id);
            saveEntries();
            renderEntries();
            setStatus("Deleted 1 entry.");
          });

          actionsCell.appendChild(openBtn);
          actionsCell.appendChild(deleteBtn);
          tr.appendChild(actionsCell);

          tbody.appendChild(tr);
        });
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("name").value.trim();
      const link = document.getElementById("link").value.trim();
      const workspace = document.getElementById("workspace").value.trim();
      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value;

      if(!name || !link || !workspace || !username || !password){
        alert("Please fill in all fields.");
        return;
      }

      const entry = normalizeEntry({ id: Date.now(), name, link, workspace, username, password, updatedAt: nowIso() });

      const k = entryKey(entry);
      const idx = entries.findIndex(e => entryKey(e) === k);
      if(idx >= 0) entries[idx] = entry;
      else entries.push(entry);

      saveEntries();
      renderEntries();
      form.reset();

      formCard.style.display = "none";
      toggleFormBtn.textContent = "➕ Add Entry";
      setStatus(idx >= 0 ? "Updated 1 entry." : "Saved 1 entry.");
    });

    clearAllBtn.addEventListener("click", () => {
      const ok = confirm("Clear ALL entries from this browser?");
      if(!ok) return;
      entries = [];
      saveEntries();
      renderEntries();
      setStatus("Cleared all entries from this browser.");
    });

    exportBtn.addEventListener("click", async () => {
      try{
        const payload = { schema: "apex_workspace_vault_v1", exportedAt: nowIso(), entries };
        const json = JSON.stringify(payload, null, 2);

        if(window.showSaveFilePicker){
          const handle = await window.showSaveFilePicker({
            suggestedName: "apex-workspace-vault.json",
            types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
          });
          const writable = await handle.createWritable();
          await writable.write(json);
          await writable.close();
          setStatus("Exported to file successfully.");
          return;
        }

        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "apex-workspace-vault.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setStatus("Exported (downloaded) JSON file.");
      }catch(err){
        console.error(err);
        setStatus("Export canceled or failed.");
      }
    });

    function openModalWithImportText(text){
      pendingImportText = text;
      modalBackdrop.style.display = "flex";
    }
    function closeModal(){
      modalBackdrop.style.display = "none";
      pendingImportText = null;
    }
    modalCancel.addEventListener("click", closeModal);
    modalBackdrop.addEventListener("click", (e)=>{ if(e.target === modalBackdrop) closeModal(); });

    modalReplace.addEventListener("click", () => {
      if(pendingImportText == null) return closeModal();
      applyImport(pendingImportText, "replace");
      closeModal();
    });
    modalMerge.addEventListener("click", () => {
      if(pendingImportText == null) return closeModal();
      applyImport(pendingImportText, "merge");
      closeModal();
    });

    importBtn.addEventListener("click", async () => {
      try{
        if(window.showOpenFilePicker){
          const [handle] = await window.showOpenFilePicker({
            multiple: false,
            types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
          });
          const file = await handle.getFile();
          const text = await file.text();
          openModalWithImportText(text);
          return;
        }
        importFile.value = "";
        importFile.click();
      }catch(err){
        console.error(err);
        setStatus("Import canceled or failed.");
      }
    });

    importFile.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if(!file) return;
      const text = await file.text();
      openModalWithImportText(text);
    });

    function parseImported(text){
      const obj = JSON.parse(text);
      let importedEntries = [];
      if(Array.isArray(obj)) importedEntries = obj;
      else if(obj && Array.isArray(obj.entries)) importedEntries = obj.entries;
      else throw new Error("Invalid format");
      return importedEntries.map(normalizeEntry).filter(e => e.link && e.workspace && e.username && e.password);
    }

    function mergeEntries(current, incoming){
      const map = new Map();
      for(const e of current){ map.set(entryKey(e), e); }
      let added = 0, updated = 0;
      for(const inc of incoming){
        const k = entryKey(inc);
        const existing = map.get(k);
        if(!existing){ map.set(k, inc); added++; continue; }
        const keepIncoming = (inc.updatedAt || "").localeCompare(existing.updatedAt || "") >= 0;
        if(keepIncoming){ map.set(k, inc); updated++; }
      }
      return { merged: Array.from(map.values()), added, updated };
    }

    function applyImport(text, mode){
      try{
        const incoming = parseImported(text);

        if(mode === "replace"){
          entries = incoming;
          saveEntries();
          renderEntries();
          setStatus(`Imported ${entries.length} entries (replaced).`);
          return;
        }

        const result = mergeEntries(entries, incoming);
        entries = result.merged;
        saveEntries();
        renderEntries();
        setStatus(`Merged: +${result.added} added, ${result.updated} updated. Total ${entries.length}.`);
      }catch(err){
        console.error(err);
        alert("Could not read that file. Is it valid JSON?");
        setStatus("Import failed.");
      }
    }

    loadEntries();
    renderEntries();
    setStatus("");