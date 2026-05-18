import { Router, Request, Response } from "express";
import { Log } from "logging_middleware";

const router = Router();


const mockNotifications = [
  {
    ID: "d146895a-8d86-4a34-9e69-3900a14576bc",
    Type: "Result",
    Message: "mid-sem",
    Timestamp: "2026-04-22 17:51:38",
  },
  {
    ID: "b283218f-ea5a-4b7c-93a9-1f2f24d6d4b0",
    Type: "Placement",
    Message: "CSX Corporation hiring",
    Timestamp: "2026-04-22 17:51:18",
  },
  {
    ID: "81589ada-8ad3-4f77-9554-f52fb558e09d",
    Type: "Event",
    Message: "farewell",
    Timestamp: "2026-04-22 17:51:06",
  },
  {
    ID: "e84836726-c25e-4f21-a72f-544a6af8a37f",
    Type: "Result",
    Message: "project-review",
    Timestamp: "2026-04-22 17:50:42",
  },
];


router.get("/", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const notificationType = req.query.notification_type as string | undefined;

    await Log(
      "backend",
      "info",
      "controller",
      `fetching notifications: limit=${limit}, page=${page}, type=${notificationType || "all"}`
    );

    let filtered = mockNotifications;
    if (notificationType) {
      filtered = filtered.filter((n) => n.Type === notificationType);
    }

    const startIdx = (page - 1) * limit;
    const paginated = filtered.slice(startIdx, startIdx + limit);

    res.json({
      notifications: paginated,
      total: filtered.length,
      page,
      limit,
    });

    await Log("backend", "info", "controller", "notifications sent successfully");
  } catch (err) {
    await Log("backend", "error", "controller", `failed to fetch notifications: ${err}`);
    res.status(500).json({ error: "failed to fetch notifications" });
  }
});

export default router;