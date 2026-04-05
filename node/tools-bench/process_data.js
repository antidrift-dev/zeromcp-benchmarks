export default {
  description: "Process records: filter, sort, aggregate, group by category",
  input: {
    records: 'array',
  },
  execute: async ({ records }) => {
    const data = records || [];

    // Filter: only records with value > 0
    const filtered = data.filter(r => (r?.value || 0) > 0);

    // Sort by value descending
    const sorted = [...filtered].sort((a, b) => (b?.value || 0) - (a?.value || 0));

    // Aggregate
    const values = filtered.map(r => r?.value || 0);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = values.length > 0 ? sum / values.length : 0;
    const min = values.length > 0 ? Math.min(...values) : 0;
    const max = values.length > 0 ? Math.max(...values) : 0;

    // Group by category
    const groups = {};
    for (const r of filtered) {
      const cat = r?.category || 'uncategorized';
      if (!groups[cat]) groups[cat] = { count: 0, sum: 0, values: [] };
      groups[cat].count++;
      groups[cat].sum += r?.value || 0;
      groups[cat].values.push(r?.value || 0);
    }

    // Compute group stats
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
      input_count: data.length,
      filtered_count: filtered.length,
      aggregates: {
        sum: Math.round(sum * 100) / 100,
        avg: Math.round(avg * 100) / 100,
        min,
        max,
      },
      groups: groupStats,
      top_5: sorted.slice(0, 5).map(r => ({ id: r?.id, value: r?.value, category: r?.category })),
    };
  },
};
