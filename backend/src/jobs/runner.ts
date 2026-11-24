/**
 * jobs/runner.ts — DB-first job runner with distributed locks and retries.
 *
 * - Tick every 60 s.
 * - instanceId: `${hostname}-${pid}` for lock ownership.
 * - Uses cron-parser to determine next slot for cron jobs.
 * - Atomic claim via updateMany (row-level lock via WHERE conditions).
 * - Retries with 5-min backoff: attempt * 5 min.
 */
import os from 'os'
import type { PrismaClient } from '@prisma/client'
import { CronExpressionParser } from 'cron-parser'
import { runWeeklyDigest } from './handlers/weeklyDigest'
import { runRemindCompleteProfile } from './handlers/remindCompleteProfile'

type HandlerResult = Record<string, unknown>

interface HandlerContext {
  prisma: PrismaClient
  meta?: Record<string, unknown>
}

type Handler = (ctx: HandlerContext) => Promise<HandlerResult>

const HANDLERS: Record<string, Handler> = {
  weekly_digest: async ({ prisma }) => {
    const result = await runWeeklyDigest({ prisma })
    return result as HandlerResult
  },
  remind_complete_profile: async ({ prisma }) => {
    const result = await runRemindCompleteProfile({ prisma })
    return result as unknown as HandlerResult
  },
  remind_profile_48h: async ({ prisma }) => {
    // E2: Profile reminder for developers who haven't completed their profile.
    // TODO: enable when DeveloperProfile.isProfileComplete field is available.
    // For now, query developers without a DeveloperProfile after 48h of creation.
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000)
    const candidates = await prisma.user.findMany({
      where: {
        userType: 'developer',
        emailVerified: true,
        createdAt: { lte: since },
        developerProfile: null,
      },
      select: { id: true, email: true, name: true },
    })

    let sent = 0
    for (const user of candidates) {
      // Anti-spam: only send once
      const alreadySent = await prisma.emailSendLog.findUnique({
        where: { kind_userId: { kind: 'remind_profile_48h', userId: user.id } },
      })
      if (alreadySent) continue

      const { sendMail } = await import('../services/mail')
      const { renderEmailLayout, renderParagraph, renderPrimaryButton, escapeHtml } = await import('../email/theme')
      const DASHBOARD_URL = `${process.env.MARKETPAQ_PUBLIC_URL ?? 'https://marketpaq.com'}/Dashboard`

      const bodyRows = [
        renderParagraph(`Hola${user.name ? `, ${escapeHtml(user.name)}` : ''},`),
        renderParagraph(
          'Notamos que a&uacute;n no has completado tu perfil de developer en MarketPAQ. ' +
          'Con un perfil completo, los distribuidores pueden encontrarte y contactarte f&aacute;cilmente.',
        ),
        renderPrimaryButton('Completar mi perfil', DASHBOARD_URL),
      ].join('')

      await sendMail({
        to: user.email,
        subject: 'MarketPAQ · ¿Ya completaste tu perfil de developer?',
        html: renderEmailLayout({
          title: 'Completa tu perfil',
          preheader: 'Tu perfil de developer en MarketPAQ está incompleto. Tarda solo unos minutos.',
          bodyRows,
        }),
        text: [
          `Hola${user.name ? `, ${user.name}` : ''},`,
          '',
          'Notamos que aún no has completado tu perfil de developer en MarketPAQ.',
          'Con un perfil completo, los distribuidores pueden encontrarte y contactarte.',
          '',
          `Completar perfil: ${DASHBOARD_URL}`,
          '',
          '— El equipo de MarketPAQ',
        ].join('\n'),
      })

      await prisma.emailSendLog.create({
        data: { kind: 'remind_profile_48h', userId: user.id },
      })
      sent++
    }

    return { sent, candidates: candidates.length }
  },
}

export class JobRunner {
  private readonly prisma: PrismaClient
  private readonly instanceId: string
  private intervalHandle: ReturnType<typeof setInterval> | null = null
  private running = false

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.instanceId = `${os.hostname()}-${process.pid}`
  }

  start(): void {
    if (this.running) return
    this.running = true
    // Run immediately on first start, then every 60 s
    void this.tick()
    this.intervalHandle = setInterval(() => void this.tick(), 60_000)
    console.info('[runner] started instanceId=%s', this.instanceId)
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
    this.running = false
    console.info('[runner] stopped')
  }

  private async tick(): Promise<void> {
    try {
      const defs = await this.prisma.jobDefinition.findMany({ where: { isEnabled: true } })

      for (const def of defs) {
        if (def.scheduleType === 'cron' && def.scheduleExpr) {
          await this.ensureQueuedForCron(def.key, def.scheduleExpr)
        }
      }

      await this.claimAndRun()
    } catch (err) {
      console.error('[runner] tick error: %s', err)
    }
  }

  /** Ensure a queued JobRun exists for the current/next cron slot. */
  private async ensureQueuedForCron(jobKey: string, cronExpr: string): Promise<void> {
    try {
      const interval = CronExpressionParser.parse(cronExpr)
      // Previous scheduled time = the slot that just fired (or is current)
      const prev = interval.prev().toDate()

      await this.prisma.jobRun.upsert({
        where: {
          // We need a unique constraint for this. Use a generated stable id approach:
          // Actually JobRun has no unique on jobKey+scheduledFor, so we use findFirst + create.
          id: `${jobKey}-${prev.getTime()}`, // stable deterministic id
        },
        create: {
          id: `${jobKey}-${prev.getTime()}`,
          jobKey,
          status: 'queued',
          scheduledFor: prev,
        },
        update: {}, // no-op if already exists
      })
    } catch {
      // Ignore — likely already exists
    }
  }

  /** Atomically claim queued jobs and run them. */
  private async claimAndRun(): Promise<void> {
    const now = new Date()

    // Claim: set status='running' + lock info for queued jobs ready to run
    await this.prisma.jobRun.updateMany({
      where: {
        status: 'queued',
        lockedAt: null,
        scheduledFor: { lte: now },
      },
      data: {
        status: 'running',
        lockedBy: this.instanceId,
        lockedAt: now,
        startedAt: now,
        attempt: { increment: 1 },
      },
    })

    // Fetch runs claimed by this instance
    const claimed = await this.prisma.jobRun.findMany({
      where: { status: 'running', lockedBy: this.instanceId },
    })

    for (const run of claimed) {
      await this.executeRun(run.id, run.jobKey, run.attempt, run.maxAttempts)
    }
  }

  private async executeRun(
    runId: string,
    jobKey: string,
    attempt: number,
    maxAttempts: number,
  ): Promise<void> {
    const handler = HANDLERS[jobKey]
    if (!handler) {
      await this.prisma.jobRun.update({
        where: { id: runId },
        data: {
          status: 'skipped',
          finishedAt: new Date(),
          error: `No handler registered for jobKey="${jobKey}"`,
        },
      })
      return
    }

    try {
      console.info('[runner] executing jobKey=%s runId=%s attempt=%d', jobKey, runId, attempt)
      const meta = await handler({ prisma: this.prisma })
      await this.prisma.jobRun.update({
        where: { id: runId },
        data: { status: 'success', finishedAt: new Date(), meta: meta as object },
      })
      // Update lastRunAt on JobDefinition
      await this.prisma.jobDefinition.updateMany({
        where: { key: jobKey },
        data: { lastRunAt: new Date() },
      })
      console.info('[runner] success jobKey=%s runId=%s', jobKey, runId)
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      console.error('[runner] failed jobKey=%s runId=%s attempt=%d err=%s', jobKey, runId, attempt, error)

      if (attempt < maxAttempts) {
        // Schedule retry with backoff
        const retryAt = new Date(Date.now() + attempt * 5 * 60 * 1000)
        await this.prisma.jobRun.update({
          where: { id: runId },
          data: {
            status: 'queued',
            lockedBy: null,
            lockedAt: null,
            scheduledFor: retryAt,
            error,
          },
        })
      } else {
        await this.prisma.jobRun.update({
          where: { id: runId },
          data: { status: 'failed', finishedAt: new Date(), error },
        })
      }
    }
  }
}
