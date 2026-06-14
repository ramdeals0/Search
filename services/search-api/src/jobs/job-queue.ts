export interface BackgroundJob {
  id: string;
  type: string;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

type JobHandler = () => Promise<void>;

const queue: Array<{ job: BackgroundJob; handler: JobHandler }> = [];
let processing = false;
let jobCounter = 0;

function createJobId(type: string): string {
  jobCounter += 1;
  return `job_${type}_${Date.now()}_${jobCounter}`;
}

export function enqueueJob(type: string, handler: JobHandler): BackgroundJob {
  const job: BackgroundJob = {
    id: createJobId(type),
    type,
    status: "queued",
    createdAt: new Date().toISOString(),
  };
  queue.push({ job, handler });
  void processQueue();
  return { ...job };
}

export function listJobs(limit = 25): BackgroundJob[] {
  return queue
    .map((entry) => ({ ...entry.job }))
    .slice(-limit)
    .reverse();
}

export function getJobById(id: string): BackgroundJob | undefined {
  const entry = queue.find((item) => item.job.id === id);
  return entry ? { ...entry.job } : undefined;
}

async function processQueue(): Promise<void> {
  if (processing) {
    return;
  }

  processing = true;
  while (queue.length > 0) {
    const entry = queue.find((item) => item.job.status === "queued");
    if (!entry) {
      break;
    }

    entry.job.status = "running";
    entry.job.startedAt = new Date().toISOString();

    try {
      await entry.handler();
      entry.job.status = "completed";
      entry.job.completedAt = new Date().toISOString();
    } catch (error) {
      entry.job.status = "failed";
      entry.job.completedAt = new Date().toISOString();
      entry.job.errorMessage =
        error instanceof Error ? error.message : "Background job failed.";
    }
  }
  processing = false;
}
