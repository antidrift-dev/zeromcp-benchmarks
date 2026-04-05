let counter = 0;

export default {
  description: "Create an invoice with line items and tax",
  input: {
    customer_id: 'string',
    amount: 'number',
    currency: 'string',
    items: 'array',
  },
  execute: async ({ customer_id, amount, currency, items }) => {
    const TAX_RATES = { USD: 0.08, EUR: 0.21, GBP: 0.20 };
    const taxRate = TAX_RATES[currency] || 0.10;

    const lineItems = (items || []).map((item, i) => ({
      line: i + 1,
      description: item?.description || `Item ${i + 1}`,
      quantity: item?.quantity || 1,
      unit_price: item?.unit_price || (amount / Math.max((items || []).length, 1)),
      subtotal: (item?.quantity || 1) * (item?.unit_price || (amount / Math.max((items || []).length, 1))),
    }));

    const subtotal = lineItems.reduce((sum, li) => sum + li.subtotal, 0);
    const tax = Math.round(subtotal * taxRate * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;

    return {
      id: `inv_${++counter}_${Date.now()}`,
      customer_id,
      currency: currency || 'USD',
      line_items: lineItems,
      subtotal,
      tax,
      tax_rate: taxRate,
      total,
      status: 'draft',
      created: new Date().toISOString(),
    };
  },
};
