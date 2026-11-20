const api = {
  async getCollection(name) {
    const response = await fetch(`/api/data/${name}`);
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    return (await response.json()).records;
  },
  async saveCollection(name, records) {
    const response = await fetch(`/api/data/${name}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records }),
    });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
  },
};

export default api;
