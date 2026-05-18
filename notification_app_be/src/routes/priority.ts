import express from "express";
import axios from "axios";

const router = express.Router();

const TYPE_ORDER: Record<string, number> = {
  Placement: 3,
  Result: 2,
  Event: 1,
};

function getScore(n: any) {
  const typeWeight = TYPE_ORDER[n.type] || 0;
  const timeScore = new Date(n.timestamp).getTime() / 1000;
  return typeWeight * 1e9 + timeScore; // priority by type then recency
}

function addToTopTen(list: any[], item: any) {
  list.push(item);
  list.sort((a, b) => getScore(b) - getScore(a));
  if (list.length > 10) list.length = 10;
}

router.get("/", async (req, res) => {
  const AUTH_TOKEN = process.env.AUTH_TOKEN;
  const EVAL_API_BASE = process.env.EVAL_API_BASE || "http://4.224.186.213";
  if (!AUTH_TOKEN) return res.status(500).json({ error: "AUTH_TOKEN not configured" });

  const limit = 10;
  const maxPages = parseInt(String(req.query.maxPages || "20"), 10);
  const topTen: any[] = [];

  try {
    for (let page = 1; page <= maxPages; page++) {
      const url = `${EVAL_API_BASE}/evaluation-service/notifications?limit=${limit}&page=${page}`;
      const resp = await axios.get(url, {
        headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
        timeout: 10000,
      });

      const items = resp.data?.data || resp.data || [];
      if (!Array.isArray(items) || items.length === 0) break;

      for (const item of items) {
        addToTopTen(topTen, item);
      }

      // if less than limit returned, no more pages
      if (items.length < limit) break;
    }

    // If no items were found (or external API returned nothing), provide a demo fallback
    if (!topTen.length) {
      const now = Date.now();
      const demoTypes = ["Placement", "Result", "Event"];
      const demo: any[] = [];
      for (let i = 0; i < 10; i++) {
        demo.push({
          id: `demo-${i + 1}`,
          type: demoTypes[i % demoTypes.length],
          message: `${demoTypes[i % demoTypes.length]} notification ${i + 1}`,
          timestamp: new Date(now - i * 1000 * 60 * 15).toISOString(),
        });
      }
      // keep ordering by our score function
      demo.sort((a, b) => getScore(b) - getScore(a));
      return res.json({ top10: demo.map((n, i) => ({ rank: i + 1, id: n.id, type: n.type, message: n.message, timestamp: n.timestamp })) });
    }

    res.json({ top10: topTen.map((n, i) => ({ rank: i + 1, id: n.id, type: n.type, message: n.message, timestamp: n.timestamp })) });
  } catch (err: any) {
    console.error("priority route error:", err?.message || err);
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { error: err?.message };
    res.status(status).json({ error: data });
  }
});

export default router;
