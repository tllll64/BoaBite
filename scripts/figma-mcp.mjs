// BoaBite · Figma MCP 直连工具（本地 Figma Desktop MCP server，无静态 token）
// 前置：Figma 桌面应用 → Dev Mode → 启用 desktop MCP server（http://127.0.0.1:3845/mcp）
// 用法：
//   node scripts/figma-mcp.mjs tools       # 列出可用 MCP 工具
//   node scripts/figma-mcp.mjs call <tool> '<json-args>'   # 调用某个 MCP 工具（如 get_design_context）
import { readFileSync } from "node:fs";

const MCP_URL = process.env.FIGMA_MCP_URL || "http://127.0.0.1:3845/mcp";

const [,, cmd, toolName, argsJson] = process.argv;

let sessionId = null;

async function rpc(method, params) {
  const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params || {} })
  });
  const sid = res.headers.get("mcp-session-id");
  if (sid) sessionId = sid;
  const text = await res.text();
  if (!res.ok) { console.error("[rpc]", res.status, text.slice(0, 800)); process.exit(1); }
  if (text.trim().startsWith("{")) return JSON.parse(text);
  const data = text.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("\n");
  try { return JSON.parse(data); } catch { return { raw: data }; }
}

async function main() {
  if (cmd === "tools") {
    await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "dsh-agent", version: "1.0" } });
    const t = await rpc("tools/list", {});
    const tools = (t.result && t.result.tools) || [];
    console.log("tools:", tools.length);
    for (const x of tools) console.log("-", x.name, "\n  ", (x.description || "").slice(0, 220));
    return;
  }
  if (cmd === "call") {
    if (!toolName) { console.error("usage: call <tool> '<json>'"); process.exit(1); }
    await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "dsh-agent", version: "1.0" } });
    let params = {};
    try { params = argsJson ? JSON.parse(argsJson) : {}; } catch { console.error("args 不是合法 JSON"); process.exit(1); }
    const r = await rpc("tools/call", { name: toolName, arguments: params });
    const out = r.result ? r.result : r;
    if (out.isError) { console.error("[tool error]", JSON.stringify(out, null, 1)); process.exit(1); }
    console.log(JSON.stringify(out, null, 1));
    return;
  }
  console.error("用法见文件头注释");
}

main().catch((e) => { console.error(e); process.exit(1); });
