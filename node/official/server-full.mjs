import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "bench-official", version: "1.0.0" });

let counter = 0;

// Low — hello
server.tool("hello", { name: z.string() }, async ({ name }) => ({
  content: [{ type: "text", text: `Hello, ${name}!` }],
}));

// Medium — create_invoice
server.tool("create_invoice", {
  customer_id: z.string(),
  amount: z.number(),
  currency: z.string(),
  items: z.array(z.object({
    description: z.string().optional(),
    quantity: z.number().optional(),
    unit_price: z.number().optional(),
  })),
}, async ({ customer_id, amount, currency, items }) => {
  const TAX_RATES = { USD: 0.08, EUR: 0.21, GBP: 0.20 };
  const taxRate = TAX_RATES[currency] || 0.10;

  const lineItems = (items || []).map((item, i) => ({
    line: i + 1,
    description: item?.description || `Item ${i + 1}`,
    quantity: item?.quantity || 1,
    unit_price: item?.unit_price || (amount / Math.max(items.length, 1)),
    subtotal: (item?.quantity || 1) * (item?.unit_price || (amount / Math.max(items.length, 1))),
  }));

  const subtotal = lineItems.reduce((sum, li) => sum + li.subtotal, 0);
  const tax = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  return {
    content: [{ type: "text", text: JSON.stringify({
      id: `inv_${++counter}_${Date.now()}`,
      customer_id,
      currency: currency || 'USD',
      line_items: lineItems,
      subtotal, tax, tax_rate: taxRate, total,
      status: 'draft',
      created: new Date().toISOString(),
    })}],
  };
});

// High — process_data
server.tool("process_data", {
  records: z.array(z.object({
    id: z.string().optional(),
    value: z.number().optional(),
    category: z.string().optional(),
  })),
}, async ({ records }) => {
  const data = records || [];
  const filtered = data.filter(r => (r?.value || 0) > 0);
  const sorted = [...filtered].sort((a, b) => (b?.value || 0) - (a?.value || 0));

  const values = filtered.map(r => r?.value || 0);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = values.length > 0 ? sum / values.length : 0;
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 0;

  const groups = {};
  for (const r of filtered) {
    const cat = r?.category || 'uncategorized';
    if (!groups[cat]) groups[cat] = { count: 0, sum: 0, values: [] };
    groups[cat].count++;
    groups[cat].sum += r?.value || 0;
    groups[cat].values.push(r?.value || 0);
  }

  const groupStats = {};
  for (const [cat, g] of Object.entries(groups)) {
    groupStats[cat] = {
      count: g.count,
      sum: Math.round(g.sum * 100) / 100,
      avg: Math.round((g.sum / g.count) * 100) / 100,
      min: Math.min(...g.values),
      max: Math.max(...g.values),
    };
  }

  return {
    content: [{ type: "text", text: JSON.stringify({
      input_count: data.length,
      filtered_count: filtered.length,
      aggregates: { sum: Math.round(sum * 100) / 100, avg: Math.round(avg * 100) / 100, min, max },
      groups: groupStats,
      top_5: sorted.slice(0, 5).map(r => ({ id: r?.id, value: r?.value, category: r?.category })),
    })}],
  };
});

// Extreme — pipeline (uses fetch)
server.tool("pipeline", {
  url: z.string(),
  transform: z.string(),
}, async ({ url, transform }) => {
  const res = await fetch(url || 'http://localhost:18923/data');
  const body = await res.text();
  let data;
  try { data = JSON.parse(body); } catch { data = { raw: body }; }

  let result;
  switch (transform) {
    case 'keys': result = Object.keys(data); break;
    case 'values': result = Object.values(data); break;
    case 'flatten': result = flatten(data); break;
    default: result = summarize(data); break;
  }

  const output = JSON.stringify(result);
  let hash = 0;
  for (let i = 0; i < output.length; i++) {
    hash = ((hash << 5) - hash + output.charCodeAt(i)) | 0;
  }

  return {
    content: [{ type: "text", text: JSON.stringify({
      source: url, transform: transform || 'summarize',
      result, output_size: output.length, hash: hash.toString(16),
    })}],
  };
});

function flatten(obj, prefix = '') {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(result, flatten(v, key));
    } else {
      result[key] = v;
    }
  }
  return result;
}

function summarize(data) {
  if (Array.isArray(data)) return { type: 'array', length: data.length, sample: data.slice(0, 3) };
  if (data && typeof data === 'object') return { type: 'object', keys: Object.keys(data).length, fields: Object.keys(data) };
  return { type: typeof data, value: data };
}

const transport = new StdioServerTransport();
await server.connect(transport);
