export default {
  description: "Fetch data, transform, and return processed result",
  input: {
    url: 'string',
    transform: 'string',
  },
  permissions: {
    network: ['localhost'],
  },
  execute: async ({ url, transform }, ctx) => {
    // Fetch via sandboxed fetch
    const res = await ctx.fetch(url || 'http://localhost:18923/data');
    const body = await res.text();
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      data = { raw: body };
    }

    // Apply transform
    let result;
    switch (transform) {
      case 'keys':
        result = Object.keys(data);
        break;
      case 'values':
        result = Object.values(data);
        break;
      case 'flatten':
        result = flatten(data);
        break;
      case 'summarize':
      default:
        result = summarize(data);
        break;
    }

    // Generate hash of output
    const output = JSON.stringify(result);
    let hash = 0;
    for (let i = 0; i < output.length; i++) {
      hash = ((hash << 5) - hash + output.charCodeAt(i)) | 0;
    }

    return {
      source: url,
      transform: transform || 'summarize',
      result,
      output_size: output.length,
      hash: hash.toString(16),
    };
  },
};

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
  const type = typeof data;
  if (Array.isArray(data)) {
    return { type: 'array', length: data.length, sample: data.slice(0, 3) };
  }
  if (data && type === 'object') {
    return { type: 'object', keys: Object.keys(data).length, fields: Object.keys(data) };
  }
  return { type, value: data };
}
