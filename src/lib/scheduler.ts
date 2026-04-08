import cron, { type ScheduledTask } from 'node-cron';
import { collectAllFeeds } from './rss-collector';
import { translateTopArticles } from './translator';
import { prisma } from './prisma';

let scheduledTask: ScheduledTask | null = null;

async function runCollection(): Promise<void> {
  console.log('[scheduler] Starting scheduled collection...');
  try {
    const collectResult = await collectAllFeeds();
    const translateResult = await translateTopArticles();

    await prisma.collectionLog.updateMany({
      where: { articlesTranslated: 0 },
      data: { articlesTranslated: translateResult.articlesTranslated },
    });

    console.log(
      `[scheduler] Done — sources: ${collectResult.sourcesChecked}, ` +
      `collected: ${collectResult.articlesCollected}, ` +
      `translated: ${translateResult.articlesTranslated}`
    );
  } catch (err) {
    console.error('[scheduler] Collection failed:', err);
  }
}

async function getIntervalHours(): Promise<number> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'collect_interval_hours' },
    });
    const hours = setting ? parseInt(setting.value, 10) : 3;
    return isNaN(hours) || hours < 1 ? 3 : hours;
  } catch {
    return 3;
  }
}

export async function startScheduler(): Promise<void> {
  // Only run scheduler on local backend server
  if (process.env.DEPLOYMENT_TARGET === 'vercel') return;
  if (process.env.NODE_ENV !== 'production') return;

  const intervalHours = await getIntervalHours();
  const cronExpression = `0 */${intervalHours} * * *`;

  if (scheduledTask) {
    scheduledTask.stop();
  }

  scheduledTask = cron.schedule(cronExpression, runCollection, {
    timezone: 'Asia/Seoul',
  });

  console.log(`[scheduler] Started — interval: every ${intervalHours}h (${cronExpression}, KST)`);
}

export async function restartScheduler(): Promise<void> {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
  await startScheduler();
}

export function stopScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[scheduler] Stopped');
  }
}
