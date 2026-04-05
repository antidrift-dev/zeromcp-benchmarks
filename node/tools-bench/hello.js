export default {
  description: "Say hello to someone",
  input: { name: 'string' },
  execute: async ({ name }) => `Hello, ${name}!`,
};
