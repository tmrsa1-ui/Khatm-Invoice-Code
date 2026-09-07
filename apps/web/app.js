/* Living web UI — local only. Invoice bytes stay in this tab. */
(function () {
  const SESSION_KEY = "khatm.session.v1";
  const THEME_KEY = "khatm.theme";
  const LANG_KEY = "khatm.lang";
  const VIEW_KEY = "khatm.view";
  function engine() { return window.KhatmEngine; }
  function applyChrome() {
    const theme = localStorage.getItem(THEME_KEY) || "system";
    const lang = localStorage.getItem(LANG_KEY) || "ar";
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    root.setAttribute("lang", lang === "en" ? "en" : "ar");
    root.setAttribute("dir", lang === "en" ? "ltr" : "rtl");
    root.setAttribute("data-view", localStorage.getItem(VIEW_KEY) || "simple");
  }
  function saveSession(session) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (_) {}
    window.__khatmLast = session;
  }
  function loadSession() {
    if (window.__khatmLast) return window.__khatmLast;
    try { const raw = sessionStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
  }
  function clearSession() {
    window.__khatmLast = null;
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
    try { sessionStorage.clear(); } catch (_) {}
  }
  function el(tag, attrs, text) {
    const n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (attrs[k] == null) return;
      if (k === "class") n.className = attrs[k]; else n.setAttribute(k, attrs[k]);
    });
    if (text != null) n.textContent = text;
    return n;
  }
  function renderFindings(container, findings) {
    container.textContent = "";
    (findings || []).forEach(function (f) {
      const li = el("li", { class: "finding" });
      li.appendChild(el("span", { class: "chip " + (f.status || "") }, (engine() && engine().STATUS_AR && engine().STATUS_AR[f.status]) || f.status || ""));
      li.appendChild(el("div", { class: "id" }, f.id || ""));
      li.appendChild(el("div", null, f.title_ar || ""));
      if (f.title_en) li.appendChild(el("div", { class: "muted" }, f.title_en));
      if (f.message_ar) li.appendChild(el("p", { class: "muted" }, f.message_ar));
      if (f.source && f.source.document) li.appendChild(el("p", { class: "muted" }, f.source.document + " — " + (f.source.rule_reference || "")));
      container.appendChild(li);
    });
    if (engine() && engine().DISCLAIMER_AR) container.appendChild(el("li", { class: "finding" }, engine().DISCLAIMER_AR));
  }
  function renderLayers(session) {
    const box = document.getElementById("layers");
    if (!box) return;
    box.textContent = "";
    if (!session || !session.layers) return;
    session.layers.forEach(function (layer) {
      const chip = el("span", { class: "pill " + (layer.status || "") }, layer.layer + " · " + layer.status);
      box.appendChild(chip);
    });
  }
  function renderQrFields(session) {
    const box = document.getElementById("qr-fields");
    if (!box) return;
    box.textContent = "";
    if (!session || !session.qr || !session.qr.fields) return;
    const names = (engine() && engine().TAG_NAMES_AR) || {};
    box.textContent = session.qr.fields.map(function (f) {
      return (names[f.tag] || ("وسم " + f.tag)) + ": " + (f.textValue || "");
    }).join(" · ");
  }
  function renderCompareTable(session) {
    const box = document.getElementById("compare-table");
    if (!box) return;
    box.textContent = "";
    if (!session) return;
    const rows = session.compare_rows || (engine() && engine().compareRows && engine().compareRows(session.qr, session.xml)) || [];
    if (!rows.length) return;
    const table = el("table", { class: "compare" });
    const head = el("tr");
    ["الحقل", "QR", "XML"].forEach(function (h) { head.appendChild(el("th", null, h)); });
    table.appendChild(head);
    rows.forEach(function (row) {
      const tr = el("tr", { class: row.match === false ? "mismatch" : (row.match ? "match" : "") });
      tr.appendChild(el("td", null, row.label_ar || row.key));
      tr.appendChild(el("td", null, row.qr || "—"));
      tr.appendChild(el("td", null, row.xml || "—"));
      table.appendChild(tr);
    });
    box.appendChild(table);
  }
  function renderSession(session) {
    if (!session) return;
    const st = document.getElementById("status") || document.getElementById("last-status");
    const ul = document.getElementById("findings");
    if (st) { st.textContent = session.overall_status || "NOT_CHECKED"; st.className = "pill " + (session.overall_status || ""); }
    if (ul) renderFindings(ul, session.findings || []);
    const report = document.getElementById("last-report");
    if (report && session.overall_status) {
      report.textContent = "";
      report.appendChild(el("h2", null, "آخر فحص"));
      report.appendChild(el("p", null, session.disclaimer_ar || ""));
      report.appendChild(el("p", { class: "muted" }, "C14N11 INCONCLUSIVE — XSD NOT_CHECKED"));
    }
    renderLayers(session);
    renderQrFields(session);
    renderCompareTable(session);
  }
  function setMsg(text) {
    const box = document.getElementById("scan-msg") || document.getElementById("status");
    if (box) box.textContent = text;
  }
  function runQr() {
    const box = document.getElementById("qr");
    if (!box || !engine()) return;
    if (!box.value.trim()) { setMsg("لا توجد حمولة."); return; }
    const session = engine().validateSession({ qrBase64: box.value });
    saveSession(session); renderSession(session);
  }
  function runXml() {
    const box = document.getElementById("xml");
    if (!box || !engine()) return;
    if (!box.value.trim()) { setMsg("لا يوجد XML."); return; }
    const session = engine().validateSession({ xmlText: box.value });
    saveSession(session); renderSession(session);
  }
  function runCompare() {
    const q = document.getElementById("qr"); const x = document.getElementById("xml");
    if (!q || !x || !engine()) return;
    const session = engine().compare(q.value, x.value);
    saveSession(session); renderSession(session);
  }
  function loadSample() {
    const box = document.getElementById("qr");
    if (box && engine()) box.value = engine().SAMPLE || engine().OFFICIAL_BOBS;
    runQr();
  }
  function stopCamera() {
    const video = document.getElementById("cam");
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach(function (t) { t.stop(); });
      video.srcObject = null;
      video.style.display = "none";
    }
  }
  function scanQr() {
    const video = document.getElementById("cam");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMsg("الكاميرا غير متاحة. الصق الحمولة.");
      return;
    }
    if (!window.BarcodeDetector) {
      setMsg("الماسح غير مدعوم في هذا المتصفح. الصق الحمولة أو اختر صورة.");
      return;
    }
    if (!video) { setMsg("لا عنصر كاميرا في الصفحة."); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function (stream) {
      video.srcObject = stream;
      video.style.display = "block";
      video.play();
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      function tick() {
        if (!video.srcObject) return;
        detector.detect(video).then(function (codes) {
          if (codes && codes[0] && codes[0].rawValue) {
            const box = document.getElementById("qr");
            if (box) box.value = codes[0].rawValue;
            stopCamera();
            runQr();
            return;
          }
          requestAnimationFrame(tick);
        }).catch(function () { requestAnimationFrame(tick); });
      }
      requestAnimationFrame(tick);
    }).catch(function () {
      setMsg("رُفض إذن الكاميرا. الصق الحمولة.");
    });
  }
  function exportJson() {
    const session = loadSession();
    if (!session) { setMsg("لا نتيجة بعد."); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([engine().renderJson ? engine().renderJson(session) : JSON.stringify(session, null, 2)], { type: "application/json" }));
    a.download = "khatm-local-report.json"; a.click();
  }
  function exportHtml() {
    const session = loadSession();
    if (!session) { setMsg("لا نتيجة بعد."); return; }
    const html = engine().renderHtml ? engine().renderHtml(session) : "<p>" + (session.disclaimer_ar || "") + "</p>";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    a.download = "khatm-local-report.html"; a.click();
  }
  function bind() {
    applyChrome();
    var id = function (n) { return document.getElementById(n); };
    if (id("run-qr")) id("run-qr").addEventListener("click", runQr);
    if (id("run-xml")) id("run-xml").addEventListener("click", runXml);
    if (id("run-compare")) id("run-compare").addEventListener("click", runCompare);
    if (id("sample-qr")) id("sample-qr").addEventListener("click", loadSample);
    if (id("qr-sample")) id("qr-sample").addEventListener("click", loadSample);
    if (id("scan-qr")) id("scan-qr").addEventListener("click", scanQr);
    if (id("export-json")) id("export-json").addEventListener("click", exportJson);
    if (id("export-html")) id("export-html").addEventListener("click", exportHtml);
    if (id("xml-file")) id("xml-file").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { setMsg("الملف أكبر من حد الفحص."); return; }
      file.text().then(function (t) { if (id("xml")) id("xml").value = t; runXml(); });
    });
    if (id("qr-file")) id("qr-file").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file || !window.BarcodeDetector) { setMsg("اختر صورة أو الصق الحمولة."); return; }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        new window.BarcodeDetector({ formats: ["qr_code"] }).detect(img).then(function (codes) {
          URL.revokeObjectURL(url);
          if (codes && codes[0] && codes[0].rawValue) {
            if (id("qr")) id("qr").value = codes[0].rawValue;
            runQr();
          } else setMsg("لم يُقرأ رمز من الصورة. الصق الحمولة.");
        }).catch(function () { setMsg("تعذر قراءة الصورة. الصق الحمولة."); });
      };
      img.src = url;
    });
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (id("run-compare")) runCompare();
        else if (id("run-xml")) runXml();
        else if (id("run-qr")) runQr();
      }
    });
    if (id("clear-session") || id("wipe-session")) {
      [id("clear-session"), id("wipe-session")].forEach(function (btn) {
        if (btn) btn.addEventListener("click", function () {
          clearSession();
          setMsg("مسحت جلسة الفحص.");
          const ul = document.getElementById("findings");
          if (ul) ul.textContent = "";
          const st = document.getElementById("status") || document.getElementById("last-status");
          if (st) { st.textContent = "NOT_CHECKED"; st.className = "pill NOT_CHECKED"; }
        });
      });
    }
    if (id("delete-local")) id("delete-local").addEventListener("click", function () {
      clearSession();
      try { localStorage.removeItem(THEME_KEY); localStorage.removeItem(LANG_KEY); localStorage.removeItem(VIEW_KEY); } catch (_) {}
      applyChrome();
      setMsg("حُذفت البيانات المحلية التي كتبتها هذه الأداة.");
    });
    if (id("lang-ar")) id("lang-ar").addEventListener("click", function () { localStorage.setItem(LANG_KEY, "ar"); applyChrome(); });
    if (id("lang-en")) id("lang-en").addEventListener("click", function () { localStorage.setItem(LANG_KEY, "en"); applyChrome(); });
    if (id("theme-system")) id("theme-system").addEventListener("click", function () { localStorage.setItem(THEME_KEY, "system"); applyChrome(); });
    if (id("theme-light")) id("theme-light").addEventListener("click", function () { localStorage.setItem(THEME_KEY, "light"); applyChrome(); });
    if (id("theme-dark")) id("theme-dark").addEventListener("click", function () { localStorage.setItem(THEME_KEY, "dark"); applyChrome(); });
    var last = loadSession();
    if (last) renderSession(last);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(function () {});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
