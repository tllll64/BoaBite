// BoaBite · PRD 侧栏：实时读取 PRD.md 并渲染为可读文档（宽屏显示）
"use strict";

(function () {
  const holder = document.getElementById("prdContent");
  if (!holder) return;

  /* ---------- 迷你 Markdown 渲染（覆盖 PRD 用到的语法） ---------- */

  function esc(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }

  function cellsOf(row) {
    return row.replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); });
  }

  function mdToHtml(src) {
    const lines = src.split(/\r?\n/);
    let html = "";
    let buf = [];
    let i = 0;

    function flushP() {
      if (buf.length) html += "<p>" + buf.map(inline).join(" ") + "</p>";
      buf = [];
    }

    while (i < lines.length) {
      const t = lines[i].trim();

      if (!t) { flushP(); i++; continue; }

      // 标题
      const h = t.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        flushP();
        const lv = h[1].length;
        html += "<h" + lv + ">" + inline(h[2]) + "</h" + lv + ">";
        i++; continue;
      }

      // 分割线
      if (/^(---+|\*\*\*+)$/.test(t)) { flushP(); html += "<hr>"; i++; continue; }

      // 引用块
      if (t.startsWith(">")) {
        flushP();
        const q = [];
        while (i < lines.length && lines[i].trim().startsWith(">")) {
          q.push(lines[i].trim().replace(/^>\s?/, ""));
          i++;
        }
        html += "<blockquote>" + q.map(inline).join("<br>") + "</blockquote>";
        continue;
      }

      // 表格
      if (t.startsWith("|") && t.endsWith("|")) {
        flushP();
        const rows = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) {
          rows.push(lines[i].trim());
          i++;
        }
        if (rows.length >= 2) {
          const th = "<tr>" + cellsOf(rows[0]).map(function (c) { return "<th>" + inline(c) + "</th>"; }).join("") + "</tr>";
          const tb = rows.slice(2).map(function (r) {
            return "<tr>" + cellsOf(r).map(function (c) { return "<td>" + inline(c) + "</td>"; }).join("") + "</tr>";
          }).join("");
          html += "<table><thead>" + th + "</thead><tbody>" + tb + "</tbody></table>";
        }
        continue;
      }

      // 无序列表
      if (/^[-*]\s+/.test(t)) {
        flushP();
        const items = [];
        while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
          i++;
        }
        html += "<ul>" + items.map(function (x) { return "<li>" + inline(x) + "</li>"; }).join("") + "</ul>";
        continue;
      }

      // 有序列表
      if (/^\d+\.\s+/.test(t)) {
        flushP();
        const items = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
          i++;
        }
        html += "<ol>" + items.map(function (x) { return "<li>" + inline(x) + "</li>"; }).join("") + "</ol>";
        continue;
      }

      // 普通段落
      buf.push(t);
      i++;
    }
    flushP();
    return html;
  }

  /* ---------- 加载 PRD.md ---------- */

  fetch("PRD.md", { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    })
    .then(function (text) {
      holder.innerHTML = mdToHtml(text);
    })
    .catch(function (err) {
      holder.innerHTML = '<p><strong>PRD.md 加载失败：</strong>' + esc(String(err)) + "</p>";
    });
})();
