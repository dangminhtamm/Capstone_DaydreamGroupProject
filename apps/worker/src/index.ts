import { summarizeJob } from "./jobs/summarize";
import { syncCalendarJob } from "./jobs/sync-calendar";

async function bootstrap(): Promise<void> {
  await syncCalendarJob();
  await summarizeJob();
}

bootstrap().catch((error) => {
  console.error("[worker] bootstrap failed", error);
  throw error;
});
