import express from "express";

const app = express();

const PORT = process.env.PORT || 8792;
const MCP_ENDPOINT = process.env.MCP_ENDPOINT;
const BRIDGE_BASE_PATH = (process.env.BRIDGE_BASE_PATH || "").trim();

app.use(express.json());

function withBasePath(path) {
  if (!BRIDGE_BASE_PATH || BRIDGE_BASE_PATH === "/") {
    return path;
  }
  const normalizedBase = BRIDGE_BASE_PATH.startsWith("/")
    ? BRIDGE_BASE_PATH
    : `/${BRIDGE_BASE_PATH}`;
  return `${normalizedBase}${path}`;
}

app.get(withBasePath("/health"), (req, res) => {
  res.json({
    ok: true,
    service: "fundgrube-mcp-bridge"
  });
});

async function callMcpTool(name, args) {
  if (!MCP_ENDPOINT) {
    throw new Error("MCP_ENDPOINT is not configured");
  }

  const response = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name,
        arguments: args || {}
      }
    })
  });

  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return {
      ok: false,
      status: response.status,
      raw: text
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      response: json
    };
  }

  return {
    ok: true,
    status: response.status,
    response: json
  };
}

app.post(withBasePath("/address/search"), async (req, res) => {
  try {
    const result = await callMcpTool("address.search", req.body);
    res.status(result.ok ? 200 : 502).json(result);
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

app.post(withBasePath("/address/find"), async (req, res) => {
  try {
    const result = await callMcpTool("address.find", req.body);
    res.status(result.ok ? 200 : 502).json(result);
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

app.post(withBasePath("/address/create"), async (req, res) => {
  try {
    const result = await callMcpTool("address.create", req.body);
    res.status(result.ok ? 200 : 502).json(result);
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

app.post(withBasePath("/address/update"), async (req, res) => {
  try {
    const result = await callMcpTool("address.update", req.body);
    res.status(result.ok ? 200 : 502).json(result);
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});


app.post(withBasePath("/mcp"), async (req, res) => {
  try {
    if (!MCP_ENDPOINT) {
      return res.status(500).json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32000,
          message: "MCP_ENDPOINT is not configured"
        }
      });
    }

    const response = await fetch(MCP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(req.body)
    });

    const text = await response.text();

    res.status(response.status);
    res.setHeader("Content-Type", "application/json");
    res.send(text);

  } catch (error) {
    res.status(500).json({
      jsonrpc: "2.0",
      id: req.body?.id || null,
      error: {
        code: -32001,
        message: error.message
      }
    });
  }
});

app.listen(PORT, () => {
  console.log(`fundgrube-mcp-bridge listening on ${PORT}`);
});
