(function () {
  "use strict";

  // ===================== Shared =====================
  var CAT_HUES = {};
  function assignHues(categories) {
    var hues = [210, 340, 28, 165, 265, 8, 190, 100, 45, 300, 130, 250];
    var cats = categories.slice().sort();
    cats.forEach(function (c, i) {
      if (!(c in CAT_HUES)) CAT_HUES[c] = hues[Object.keys(CAT_HUES).length % hues.length];
    });
  }
  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escAttr(s) { return escHtml(s); }

  // ===================== Tabs =====================
  var tabButtons = document.querySelectorAll(".tab");
  var panels = { browse: document.getElementById("panel-browse"), search: document.getElementById("panel-search") };
  var initialized = { browse: false, search: false };

  tabButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var name = btn.getAttribute("data-tab");
      tabButtons.forEach(function (b) {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      Object.keys(panels).forEach(function (k) {
        panels[k].hidden = k !== name;
      });
      if (name === "browse" && !initialized.browse) { initialized.browse = true; initBrowse(); }
      if (name === "search" && !initialized.search) { initialized.search = true; initSearch(); }
    });
  });

  // Default tab (browse) loads immediately.
  initialized.browse = true;
  initBrowse();

  // ===================== Browse (schema map) =====================
  function initBrowse() {
    fetch("data/table-map.json")
      .then(function (r) { return r.json(); })
      .then(function (dedup) {
        setupBrowse(dedup);
      })
      .catch(function (err) {
        document.getElementById("browseBody").innerHTML = "";
        document.getElementById("browseEmpty").style.display = "block";
        document.getElementById("browseEmpty").textContent = "Failed to load table-map.json";
        console.error(err);
      });
  }

  function setupBrowse(DATA) {
    var nameSet = {};
    DATA.forEach(function (d) { nameSet[d.name] = true; });
    assignHues(DATA.map(function (d) { return d.category; }));

    var catCounts = {};
    DATA.forEach(function (d) { catCounts[d.category] = (catCounts[d.category] || 0) + 1; });
    var activeCats = {};
    Object.keys(catCounts).forEach(function (c) { activeCats[c] = true; });

    var populated = DATA.filter(function (d) { return d.populatedRecords > 0; }).length;
    var totalChunks = DATA.reduce(function (s, d) { return s + d.chunkCount; }, 0);
    document.getElementById("statStrip").innerHTML = [
      [DATA.length.toLocaleString(), "unique tables"],
      [populated.toLocaleString(), "with data"],
      [totalChunks.toLocaleString(), "physical chunks"],
      [Object.keys(catCounts).length, "categories"],
    ].map(function (s) {
      return '<div class="stat"><div class="n">' + s[0] + '</div><div class="l">' + s[1] + "</div></div>";
    }).join("");

    var catList = document.getElementById("catList");
    function renderCatList() {
      var cats = Object.keys(catCounts).sort(function (a, b) { return catCounts[b] - catCounts[a]; });
      catList.innerHTML = cats.map(function (c) {
        var active = activeCats[c] ? "active" : "";
        return '<button class="cat-toggle ' + active + '" data-cat="' + escAttr(c) + '" style="--hue:' + CAT_HUES[c] + '">' + escHtml(c) + '<span class="count">' + catCounts[c] + "</span></button>";
      }).join("");
    }
    renderCatList();
    catList.addEventListener("click", function (e) {
      var btn = e.target.closest(".cat-toggle");
      if (!btn) return;
      var c = btn.getAttribute("data-cat");
      activeCats[c] = !activeCats[c];
      renderCatList();
      applyFilter();
    });
    document.getElementById("resetCats").addEventListener("click", function () {
      Object.keys(catCounts).forEach(function (c) { activeCats[c] = true; });
      document.getElementById("browseSearch").value = "";
      renderCatList();
      applyFilter();
    });

    var tbody = document.getElementById("browseBody");
    var rows = DATA.map(function (d, idx) {
      var tr = document.createElement("tr");
      tr.className = "row";
      tr.dataset.idx = idx;
      tr.tabIndex = 0;
      var hue = CAT_HUES[d.category];
      var pct = Math.max(2, Math.round((d.recordCapacity ? d.populatedRecords / d.recordCapacity : 0) * 100));
      tr.innerHTML =
        '<td class="c-id">' + d.primaryTableId + '</td>' +
        '<td class="c-name">' + escHtml(d.name) + (d.chunkCount > 1 ? '<span class="chunks">×' + d.chunkCount + '</span>' : '') + '</td>' +
        '<td class="c-cat"><span class="cat-chip" style="--hue:' + hue + '">' + escHtml(d.category) + '</span></td>' +
        '<td><div class="pop-bar-wrap"><div class="pop-bar"><span style="width:' + pct + '%"></span></div><span class="pop-num">' + d.populatedRecords.toLocaleString() + ' / ' + d.recordCapacity.toLocaleString() + '</span></div></td>' +
        '<td class="c-fields">' + d.fields.length + '</td>';
      tbody.appendChild(tr);
      return tr;
    });

    tbody.addEventListener("click", function (e) {
      var tr = e.target.closest("tr.row");
      if (tr) toggleDetail(tr);
    });

    var openIdx = null, openDetailEl = null;
    function toggleDetail(tr) {
      var idx = Number(tr.dataset.idx);
      if (openDetailEl) openDetailEl.remove();
      var prevOpen = document.querySelector("#browseBody tr.row.open");
      if (prevOpen) prevOpen.classList.remove("open");
      if (openIdx === idx) { openIdx = null; openDetailEl = null; return; }
      openIdx = idx;
      tr.classList.add("open");
      var d = DATA[idx];
      var detailTr = document.createElement("tr");
      detailTr.className = "detail-row";
      var td = document.createElement("td");
      td.colSpan = 5;
      td.appendChild(buildDetailPanel(d));
      detailTr.appendChild(td);
      tr.parentNode.insertBefore(detailTr, tr.nextSibling);
      openDetailEl = detailTr;
      detailTr.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    function buildDetailPanel(d) {
      var wrap = document.createElement("div");
      wrap.className = "detail-panel";
      var head = document.createElement("div");
      head.className = "detail-head";
      head.innerHTML =
        "<h3>" + escHtml(d.name) + "</h3>" +
        '<div class="detail-meta">' +
        "<span>Primary ID <b>" + d.primaryTableId + "</b></span>" +
        "<span>Chunk IDs <b>" + d.tableIds.join(", ") + "</b></span>" +
        "<span>Records <b>" + d.populatedRecords.toLocaleString() + " / " + d.recordCapacity.toLocaleString() + "</b></span>" +
        "</div>";
      wrap.appendChild(head);
      if (!d.fields.length) {
        var none = document.createElement("div");
        none.className = "field-shell";
        none.innerHTML = '<div class="no-fields" style="padding:14px;color:var(--text-faint);font-size:12px;">No schema attributes recorded.</div>';
        wrap.appendChild(none);
        return wrap;
      }
      var shell = document.createElement("div");
      shell.className = "field-shell";
      var table = document.createElement("table");
      table.className = "fields";
      table.innerHTML = "<thead><tr><th>Field</th><th>Type</th><th>Enum</th><th>Example</th></tr></thead>";
      var tb = document.createElement("tbody");
      d.fields.forEach(function (f) {
        var baseType = f.type.replace(/\[\]$/, "");
        var isRef = nameSet[baseType] && baseType !== d.name;
        var typeCell = isRef ? '<button class="ref-link" data-jump="' + escAttr(baseType) + '">' + escHtml(f.type) + "</button>" : escHtml(f.type);
        var hasExample = f.example !== null && f.example !== undefined && f.example !== "";
        var exampleClass = !hasExample ? "is-empty" : /^→/.test(f.example) ? "is-ref" : "";
        var tr = document.createElement("tr");
        tr.innerHTML =
          '<td class="f-name">' + escHtml(f.name) + "</td>" +
          '<td class="f-type">' + typeCell + "</td>" +
          '<td class="f-enum">' + (f.enum ? escHtml(f.enum) : "—") + "</td>" +
          '<td class="f-example ' + exampleClass + '">' + (hasExample ? escHtml(f.example) : "—") + "</td>";
        tb.appendChild(tr);
      });
      table.appendChild(tb);
      shell.appendChild(table);
      wrap.appendChild(shell);
      shell.addEventListener("click", function (e) {
        var btn = e.target.closest(".ref-link");
        if (btn) jumpTo(btn.getAttribute("data-jump"));
      });

      var recordsSection = document.createElement("div");
      recordsSection.className = "table-records";
      recordsSection.innerHTML = '<div class="no-records-note">Loading records…</div>';
      wrap.appendChild(recordsSection);
      ensureSDATA()
        .then(function () {
          var t = SDATA.tables.find(function (t) { return t.name === d.name; });
          recordsSection.innerHTML = "";
          if (!t) {
            recordsSection.innerHTML =
              '<div class="no-records-note">Full record browser not available for this table (engine/internal data, or no populated rows in the football-relevant dataset).</div>';
            return;
          }
          renderTableRecords(recordsSection, t);
        })
        .catch(function () {
          recordsSection.innerHTML = '<div class="no-records-note">Couldn’t load record data.</div>';
        });

      return wrap;
    }

    function jumpTo(name) {
      var idx = DATA.findIndex(function (d) { return d.name === name; });
      if (idx === -1) return;
      document.getElementById("browseSearch").value = "";
      Object.keys(catCounts).forEach(function (c) { activeCats[c] = true; });
      renderCatList();
      applyFilter();
      var tr = rows[idx];
      tr.scrollIntoView({ block: "center", behavior: "smooth" });
      toggleDetail(tr);
    }

    var searchInput = document.getElementById("browseSearch");
    var resultCount = document.getElementById("browseResultCount");
    var emptyState = document.getElementById("browseEmpty");
    function applyFilter() {
      var q = searchInput.value.trim().toLowerCase();
      var visible = 0;
      DATA.forEach(function (d, idx) {
        var tr = rows[idx];
        var catOk = activeCats[d.category];
        var textOk = !q || d.name.toLowerCase().indexOf(q) !== -1 || d.fields.some(function (f) { return f.name.toLowerCase().indexOf(q) !== -1; });
        var show = catOk && textOk;
        tr.classList.toggle("hidden", !show);
        if (show) visible++;
      });
      resultCount.textContent = visible.toLocaleString() + " of " + DATA.length.toLocaleString() + " tables";
      emptyState.style.display = visible === 0 ? "block" : "none";
    }
    var searchTimer = null;
    searchInput.addEventListener("input", function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(applyFilter, 80);
    });

    var sortState = { key: "id", dir: 1 };
    function applySort(key) {
      if (sortState.key === key) sortState.dir *= -1; else { sortState.key = key; sortState.dir = 1; }
      var cmp;
      if (key === "id") cmp = function (a, b) { return a.primaryTableId - b.primaryTableId; };
      else if (key === "name") cmp = function (a, b) { return a.name.localeCompare(b.name); };
      else if (key === "cat") cmp = function (a, b) { return a.category.localeCompare(b.category) || a.name.localeCompare(b.name); };
      else if (key === "pop") cmp = function (a, b) { return a.populatedRecords - b.populatedRecords; };
      else if (key === "fields") cmp = function (a, b) { return a.fields.length - b.fields.length; };
      var indexed = DATA.map(function (d, i) { return i; });
      indexed.sort(function (ia, ib) { return sortState.dir * cmp(DATA[ia], DATA[ib]); });
      var frag = document.createDocumentFragment();
      indexed.forEach(function (i) { frag.appendChild(rows[i]); });
      tbody.innerHTML = "";
      tbody.appendChild(frag);
      document.querySelectorAll("#panel-browse th[data-sort]").forEach(function (th) {
        th.classList.toggle("sorted", th.getAttribute("data-sort") === key);
        th.querySelector(".arrow").textContent = th.getAttribute("data-sort") === key ? (sortState.dir === 1 ? "↑" : "↓") : "";
      });
    }
    document.querySelectorAll("#panel-browse th[data-sort]").forEach(function (th) {
      th.addEventListener("click", function () { applySort(th.getAttribute("data-sort")); });
    });
    document.getElementById("browseSortSelect").addEventListener("change", function (e) {
      applySort(e.target.value);
    });

    applySort("id");
    applyFilter();
  }

  // ===================== Search (full-record index) =====================
  var SDATA = null;
  var sortedTokens = [];
  var tokenMap = null;
  var ROW_MULT = 1000000;
  var INITIAL_PER_GROUP = 12;
  var PAGE_SIZE = 25;
  var MAX_GROUPS_SHOWN = 30;

  var sdataPromise = null;
  // Memoized loader: the per-table "all records" view in Browse and the global Search tab
  // both need the same dataset, and whichever triggers first fetches it for both.
  function ensureSDATA() {
    if (!sdataPromise) {
      sdataPromise = fetch("data/data.json")
        .then(function (r) { return r.json(); })
        .then(function (json) {
          SDATA = json;
          assignHues(SDATA.tables.map(function (t) { return t.category; }));
          buildIndex();
          return SDATA;
        });
    }
    return sdataPromise;
  }

  function initSearch() {
    ensureSDATA()
      .then(function () {
        var totalRows = SDATA.tables.reduce(function (s, t) { return s + t.rows.length; }, 0);
        var introState = document.getElementById("introState");
        introState.innerHTML =
          '<p>Type something above — a school, a hometown, a coach\'s name, a position — and every record that mentions it shows up here, across every table.</p>' +
          '<p class="intro-scale">' + totalRows.toLocaleString() + " records indexed across " + SDATA.tables.length.toLocaleString() + " tables.</p>";
        renderTryChips();
        wireSearch();
      })
      .catch(function (err) {
        document.getElementById("introState").textContent = "Failed to load data.json";
        console.error(err);
      });
  }

  function tokenize(text) {
    return String(text).toLowerCase().split(/[^a-z0-9']+/).filter(function (w) { return w.length >= 2; });
  }

  function buildIndex() {
    var map = new Map();
    SDATA.tables.forEach(function (table, tableIdx) {
      table.rows.forEach(function (row, rowIdx) {
        var id = tableIdx * ROW_MULT + rowIdx;
        var seen = new Set();
        for (var i = 0; i < row.length; i++) {
          var v = row[i];
          if (v === null || v === undefined) continue;
          tokenize(v).forEach(function (w) { seen.add(w); });
        }
        seen.forEach(function (word) {
          var arr = map.get(word);
          if (!arr) { arr = []; map.set(word, arr); }
          arr.push(id);
        });
      });
    });
    tokenMap = map;
    sortedTokens = Array.from(map.keys()).sort();
  }

  function renderTryChips() {
    var suggestions = ["Alabama", "quarterback", "Georgia", "linebacker", "Texas"];
    var tryRow = document.getElementById("tryRow");
    tryRow.innerHTML = '<span class="try-label">Try:</span>' + suggestions.map(function (s) {
      return '<button class="try-chip" data-q="' + escAttr(s) + '">' + escHtml(s) + "</button>";
    }).join("");
    tryRow.addEventListener("click", function (e) {
      var btn = e.target.closest(".try-chip");
      if (!btn) return;
      var input = document.getElementById("search");
      input.value = btn.getAttribute("data-q");
      runSearch(input.value);
    });
  }

  function lowerBound(prefix) {
    var lo = 0, hi = sortedTokens.length;
    while (lo < hi) {
      var mid = (lo + hi) >>> 1;
      if (sortedTokens[mid] < prefix) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  function idsForWord(word) {
    var out = new Set();
    var start = lowerBound(word);
    var i = start;
    while (i < sortedTokens.length && sortedTokens[i].indexOf(word) === 0) {
      var arr = tokenMap.get(sortedTokens[i]);
      for (var j = 0; j < arr.length; j++) out.add(arr[j]);
      i++;
      if (i - start > 400) break;
    }
    return out;
  }

  function intersect(sets) {
    sets.sort(function (a, b) { return a.size - b.size; });
    var result = new Set();
    sets[0].forEach(function (id) {
      var inAll = true;
      for (var i = 1; i < sets.length; i++) {
        if (!sets[i].has(id)) { inAll = false; break; }
      }
      if (inAll) result.add(id);
    });
    return result;
  }

  function search(query) {
    var words = tokenize(query);
    if (words.length === 0) return null;
    var sets = words.map(idsForWord);
    if (sets.some(function (s) { return s.size === 0; })) return new Set();
    return intersect(sets);
  }

  function wireSearch() {
    var input = document.getElementById("search");
    var timer = null;
    input.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () { runSearch(input.value); }, 90);
    });
  }

  function runSearch(query) {
    query = query.trim();
    var results = document.getElementById("results");
    var introState = document.getElementById("introState");
    if (!query) {
      results.innerHTML = "";
      results.appendChild(introState);
      return;
    }
    var ids = search(query);
    var byTable = new Map();
    ids.forEach(function (id) {
      var tableIdx = Math.floor(id / ROW_MULT);
      var rowIdx = id % ROW_MULT;
      var arr = byTable.get(tableIdx);
      if (!arr) { arr = []; byTable.set(tableIdx, arr); }
      arr.push(rowIdx);
    });
    var groups = Array.from(byTable.entries()).map(function (e) { return { tableIdx: e[0], rowIdxs: e[1] }; });
    groups.sort(function (a, b) { return b.rowIdxs.length - a.rowIdxs.length; });

    results.innerHTML = "";
    if (groups.length === 0) {
      var empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = 'No records mention "' + query + '". Try a shorter or differently-spelled term.';
      results.appendChild(empty);
      return;
    }
    var terms = tokenize(query);
    groups.slice(0, MAX_GROUPS_SHOWN).forEach(function (g) {
      results.appendChild(renderGroup(g, terms));
    });
    if (groups.length > MAX_GROUPS_SHOWN) {
      var note = document.createElement("div");
      note.className = "empty-state";
      note.textContent = "+" + (groups.length - MAX_GROUPS_SHOWN) + " more tables match — narrow your search to see them.";
      results.appendChild(note);
    }
  }

  function renderGroup(g, terms) {
    var table = SDATA.tables[g.tableIdx];
    var wrap = document.createElement("div");
    wrap.className = "group";
    var head = document.createElement("div");
    head.className = "group-head";
    head.innerHTML =
      '<span class="cat-dot" style="--hue:' + CAT_HUES[table.category] + '"></span>' +
      '<span class="gname">' + escHtml(table.name) + "</span>" +
      '<span class="gcount">' + g.rowIdxs.length.toLocaleString() + " match" + (g.rowIdxs.length === 1 ? "" : "es") + "</span>";
    wrap.appendChild(head);
    var list = document.createElement("div");
    list.className = "row-list";
    wrap.appendChild(list);
    var cursor = 0;
    function renderChunk(count) {
      var end = Math.min(cursor + count, g.rowIdxs.length);
      for (; cursor < end; cursor++) list.appendChild(renderRecord(table, g.rowIdxs[cursor], terms));
    }
    renderChunk(INITIAL_PER_GROUP);
    if (g.rowIdxs.length > cursor) {
      var moreBtn = document.createElement("button");
      moreBtn.className = "show-more";
      moreBtn.textContent = "Show " + Math.min(PAGE_SIZE, g.rowIdxs.length - cursor) + " more of " + g.rowIdxs.length;
      moreBtn.addEventListener("click", function () {
        renderChunk(PAGE_SIZE);
        if (cursor >= g.rowIdxs.length) moreBtn.remove();
        else moreBtn.textContent = "Show " + Math.min(PAGE_SIZE, g.rowIdxs.length - cursor) + " more of " + g.rowIdxs.length;
      });
      wrap.appendChild(moreBtn);
    }
    return wrap;
  }

  // Per-table record browser embedded in a Browse detail panel: all rows for one table, with
  // a scoped local filter. Simple substring scan (not the global inverted index) - fast enough
  // since it's bounded to a single table's rows (worst case ~16k, still sub-frame per keystroke).
  function renderTableRecords(container, table) {
    var head = document.createElement("div");
    head.className = "records-head";
    var countLabel = table.rows.length.toLocaleString() + (table.chunkCount > 1 ? " · merged from " + table.chunkCount + " chunks" : "");
    head.innerHTML =
      '<span class="records-title">All records <span class="records-count">(' + countLabel + ')</span></span>' +
      '<input type="search" class="scoped-search" placeholder="Filter within ' + escAttr(table.name) + '…" autocomplete="off" />';
    container.appendChild(head);

    var list = document.createElement("div");
    list.className = "row-list";
    container.appendChild(list);

    var moreHolder = document.createElement("div");
    container.appendChild(moreHolder);

    var filteredIdxs = [];
    var cursor = 0;
    var currentTerms = [];

    function renderChunk(count) {
      var end = Math.min(cursor + count, filteredIdxs.length);
      for (; cursor < end; cursor++) list.appendChild(renderRecord(table, filteredIdxs[cursor], currentTerms));
    }

    function updateMoreBtn() {
      moreHolder.innerHTML = "";
      if (filteredIdxs.length > cursor) {
        var btn = document.createElement("button");
        btn.className = "show-more";
        btn.textContent = "Show " + Math.min(PAGE_SIZE, filteredIdxs.length - cursor) + " more of " + filteredIdxs.length;
        btn.addEventListener("click", function () {
          renderChunk(PAGE_SIZE);
          updateMoreBtn();
        });
        moreHolder.appendChild(btn);
      }
    }

    function reset(terms) {
      currentTerms = terms;
      filteredIdxs = table.rows
        .map(function (_, i) { return i; })
        .filter(function (i) {
          if (terms.length === 0) return true;
          var row = table.rows[i];
          return terms.every(function (t) {
            return row.some(function (v) { return v !== null && v !== undefined && String(v).toLowerCase().indexOf(t) !== -1; });
          });
        });
      list.innerHTML = "";
      cursor = 0;
      renderChunk(INITIAL_PER_GROUP);
      updateMoreBtn();
    }

    var input = head.querySelector(".scoped-search");
    var timer = null;
    input.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () { reset(tokenize(input.value.trim())); }, 100);
    });

    reset([]);
  }

  // Shows the fields that actually matched the query first, then fills remaining slots with
  // whatever else is non-null - otherwise a match buried in field #20 never appears on screen.
  function renderRecord(table, rowIdx, terms) {
    var row = table.rows[rowIdx];
    var matched = [];
    var rest = [];
    for (var i = 0; i < row.length; i++) {
      var v = row[i];
      if (v === null || v === undefined || v === "") continue;
      var text = String(v).toLowerCase();
      var isMatch = terms.some(function (t) { return text.indexOf(t) !== -1; });
      (isMatch ? matched : rest).push(i);
    }
    var order = matched.concat(rest).slice(0, 9);
    var rec = document.createElement("div");
    rec.className = "rec";
    rec.innerHTML = order.map(function (i) {
      return '<span class="cell"><span class="k">' + escHtml(table.fields[i]) + '</span><span class="v">' + highlight(String(row[i]), terms) + "</span></span>";
    }).join("");
    return rec;
  }

  function highlight(text, terms) {
    var escaped = escHtml(text);
    terms.forEach(function (t) {
      if (t.length < 2) return;
      var re = new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
      escaped = escaped.replace(re, "<mark>$1</mark>");
    });
    return escaped;
  }
})();
