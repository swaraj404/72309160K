import axios from "axios";

const BASE_URL_DEFAULT = "http://4.224.186.213";
const LOG_PATH = "/evaluation-service/logs";

type Stack = "backend" | "frontend";
type Level = "debug" | "info" | "warn" | "error" | "fatal";
type BackendPackage =
  | "cache"
  | "controller"
  | "cron_job"
  | "db"
  | "domain"
  | "handler"
  | "repository"
  | "route"
  | "service";
type FrontendPackage = "api" | "component" | "hook" | "page" | "state" | "style";
type CommonPackage = "auth" | "config" | "middleware" | "utils";
type LogPackage = BackendPackage | FrontendPackage | CommonPackage;

const backendAllowed = new Set<string>([
  "cache",
  "controller",
  "cron_job",
  "db",
  "domain",
  "handler",
  "repository",
  "route",
  "service",
  "auth",
  "config",
  "middleware",
  "utils",
]);

const frontendAllowed = new Set<string>([
  "api",
  "component",
  "hook",
  "page",
  "state",
  "style",
  "auth",
  "config",
  "middleware",
  "utils",
]);

let token = "";
let baseUrl = BASE_URL_DEFAULT;

export function configureLogger(authToken: string, customBaseUrl?: string): void {
  if (!authToken?.trim()) throw new Error("auth token is required");
  token = authToken.trim();
  baseUrl = customBaseUrl?.trim() || BASE_URL_DEFAULT;
}

function validatePackage(stack: Stack, pkg: LogPackage): void {
  if (stack === "backend" && !backendAllowed.has(pkg)) {
    throw new Error(`invalid package '${pkg}' for backend`);
  }
  if (stack === "frontend" && !frontendAllowed.has(pkg)) {
    throw new Error(`invalid package '${pkg}' for frontend`);
  }
}

export async function Log(
  stack: Stack,
  level: Level,
  pkg: LogPackage,
  message: string
): Promise<{ logID: string; message: string }> {
  if (!token) throw new Error("logger not configured");
  if (!message?.trim()) throw new Error("message is required");

  validatePackage(stack, pkg);

  const response = await axios.post(
    `${baseUrl}${LOG_PATH}`,
    { stack, level, package: pkg, message },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    }
  );

  return response.data;
}