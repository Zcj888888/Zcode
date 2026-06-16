const http = require("http");
const https = require("https");

const PORT = 8877;
const TARGET_URL = "https://wishub-x6.ctyun.cn/v1/chat/completions";
const API_KEY = "3eb14d162f734353aab4f8a4345fba44";

// 模型映射
const MODEL_MAP = {
  "claude-sonnet-4-20250514": "GLM-5.1",
  "claude-opus-4-20250514": "GLM-5.1",
  "claude-haiku-4-20250514": "GLM-5.1",
  "claude-3-5-sonnet-20241022": "GLM-5.1",
  "claude-3-5-haiku-20241022": "GLM-5.1",
  "claude-3-opus-20240229": "GLM-5.1",
  "GLM-5.1": "GLM-5.1",
  "GLM-5-Pro": "GLM-5.1",
};

function mapModel(model) {
  return MODEL_MAP[model] || model;
}

function anthropicToOpenAI(body) {
  const messages = [];
  
  // System message
  if (body.system) {
    const sysContent = typeof body.system === "string" ? body.system : body.system.map(s => s.text).join("\n");
    messages.push({ role: "system", content: sysContent });
  }
  
  // Messages
  for (const msg of body.messages || []) {
    if (typeof msg.content === "string") {
      messages.push({ role: msg.role, content: msg.content });
    } else if (Array.isArray(msg.content)) {
      let text = "";
      for (const block of msg.content) {
        if (block.type === "text") text += block.text;
        if (block.type === "tool_use") text += `\n[Tool Use: ${block.name}]\n${JSON.stringify(block.input)}`;
        if (block.type === "tool_result") {
          const resultText = typeof block.content === "string" ? block.content : (Array.isArray(block.content) ? block.content.map(c => c.text || "").join("") : JSON.stringify(block.content));
          text += `\n[Tool Result${block.tool_use_id ? " for " + block.tool_use_id : ""}]: ${resultText}`;
        }
      }
      messages.push({ role: msg.role, content: text });
    }
  }
  
  return {
    model: mapModel(body.model),
    messages,
    max_tokens: body.max_tokens || 4096,
    stream: body.stream || false,
    temperature: body.temperature,
  };
}

function openAIToAnthropic(oaiResp, model) {
  const choice = oaiResp.choices?.[0];
  const content = choice?.message?.content || "";
  
  return {
    id: oaiResp.id || `msg_${Date.now()}`,
    type: "message",
    role: "assistant",
    model: model,
    content: [{ type: "text", text: content }],
    stop_reason: choice?.finish_reason === "stop" ? "end_turn" : choice?.finish_reason || "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: oaiResp.usage?.prompt_tokens || 0,
      output_tokens: oaiResp.usage?.completion_tokens || 0,
    },
  };
}

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  
  // Health check
  if (req.url === "/health") { res.writeHead(200); res.end("OK"); return; }
  
  // Models endpoint
  if (req.url === "/v1/models") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      object: "list",
      data: [{ id: "GLM-5.1", object: "model", owned_by: "ctyun" }]
    }));
    return;
  }
  
  // Messages endpoint
  if (req.url === "/v1/messages" && req.method === "POST") {
    let data = "";
    req.on("data", chunk => data += chunk);
    req.on("end", () => {
      try {
        const anthropicBody = JSON.parse(data);
        const originalModel = anthropicBody.model;
        const openAIBody = anthropicToOpenAI(anthropicBody);
        
        const postData = JSON.stringify(openAIBody);
        const url = new URL(TARGET_URL);
        
        const options = {
          hostname: url.hostname,
          port: 443,
          path: url.pathname,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Length": Buffer.byteLength(postData),
          },
        };
        
        const proxyReq = https.request(options, (proxyRes) => {
          let respData = "";
          proxyRes.on("data", chunk => respData += chunk);
          proxyRes.on("end", () => {
            try {
              if (anthropicBody.stream) {
                // 简化处理：非流式返回
                const oaiResp = JSON.parse(respData);
                const anthropicResp = openAIToAnthropic(oaiResp, originalModel);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(anthropicResp));
              } else {
                const oaiResp = JSON.parse(respData);
                const anthropicResp = openAIToAnthropic(oaiResp, originalModel);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(anthropicResp));
              }
            } catch (e) {
              console.error("Parse error:", e.message, respData.substring(0, 200));
              res.writeHead(502, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "upstream parse error", detail: e.message }));
            }
          });
        });
        
        proxyReq.on("error", (e) => {
          console.error("Proxy error:", e.message);
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "proxy error", detail: e.message }));
        });
        
        proxyReq.write(postData);
        proxyReq.end();
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "bad request", detail: e.message }));
      }
    });
    return;
  }
  
  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`Claude Code Proxy running on http://localhost:${PORT}`);
  console.log(`Target: ${TARGET_URL}`);
  console.log(`Model mapping: All Claude models -> GLM-5.1`);
});
