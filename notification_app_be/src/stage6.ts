import axios from "axios";
import dotenv from "dotenv";
import { configureLogger, Log } from "logging_middleware";

dotenv.config();

type NotificationType = "Placement" | "Result" | "Event";

interface ApiNotification {
  ID: string;
  Type: NotificationType;
  Message: string;
  Timestamp: string;
}

interface ApiResponse {
  notifications: ApiNotification[];
}

interface RankedNotification extends ApiNotification {
  score: number;
}

const BASE_URL = process.env.EVAL_API_BASE || "http://4.224.186.213";
const AUTH_TOKEN = process.env.AUTH_TOKEN || "";

if (!AUTH_TOKEN) {
  throw new Error("AUTH_TOKEN missing in .env");
}

configureLogger(AUTH_TOKEN, BASE_URL);

const TYPE_ORDER: Record<NotificationType, number> = {
  Placement: 3,
  Result: 2,
  Event: 1,
};

function toMillis(timestamp: string): number {
  const normalized = timestamp.includes("T")
    ? timestamp
    : timestamp.replace(" ", "T");
  const time = new Date(normalized).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getScore(item: ApiNotification): number {
  return TYPE_ORDER[item.Type] * 10000000000000 + toMillis(item.Timestamp);
}

function addToTopTen(
  list: RankedNotification[],
  item: RankedNotification
): RankedNotification[] {
  let index = 0;

  while (index < list.length && list[index].score >= item.score) {
    index += 1;
  }

  list.splice(index, 0, item);

  if (list.length > 10) {
    list.pop();
  }

  return list;
}

async function safeLog(
  level: "info" | "error",
  message: string
): Promise<void> {
  try {
    await Log("backend", level, "service", message);
  } catch {
    // logging should not stop the main output for stage 6
  }
}

async function fetchPage(
  page: number,
  limit: number
): Promise<ApiNotification[]> {
  const response = await axios.get<ApiResponse>(
    `${BASE_URL}/evaluation-service/notifications`,
    {
      params: { limit, page },
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      timeout: 10000,
    }
  );

  return response.data.notifications || [];
}

async function main(): Promise<void> {
  try {
    await safeLog("info", "stage 6 priority job started");

    const topTen: RankedNotification[] = [];
    const limit = 10;
    const maxPages = 20;

    for (let page = 1; page <= maxPages; page += 1) {
      const batch = await fetchPage(page, limit);

      if (batch.length === 0) {
        break;
      }

      for (const item of batch) {
        addToTopTen(topTen, {
          ...item,
          score: getScore(item),
        });
      }

      if (batch.length < limit) {
        break;
      }
    }

    console.log("Top 10 Priority Notifications");
    console.table(
      topTen.map((item, index) => ({
        Rank: index + 1,
        ID: item.ID,
        Type: item.Type,
        Message: item.Message,
        Timestamp: item.Timestamp,
      }))
    );

    await safeLog("info", "stage 6 priority job completed");
  } catch (error) {
    await safeLog("error", "stage 6 failed");
    console.error(error);
    process.exit(1);
  }
}

main();