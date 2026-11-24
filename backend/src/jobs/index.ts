/**
 * jobs/index.ts — Entry point for the job system.
 *
 * Exports:
 *  - seedJobDefinitions(prisma): upserts known job definitions on boot
 *  - startJobRunner(prisma): creates and starts the JobRunner
 */
import type { PrismaClient } from '@prisma/client'
import { JobRunner } from './runner'

export interface JobDefinitionSeed {
  key: string
  name: string
  scheduleType: string
  scheduleExpr: string | null
  isEnabled: boolean
}

const JOB_DEFINITIONS: JobDefinitionSeed[] = [
  {
    key: 'weekly_digest',
    name: 'Resumen semanal',
    scheduleType: 'cron',
    scheduleExpr: '0 9 * * 1', // Every Monday at 09:00 server local time
    isEnabled: true,
  },
  {
    key: 'remind_complete_profile',
    name: 'Recordatorio completar tipo de cuenta',
    scheduleType: 'cron',
    scheduleExpr: '0 10 * * 6', // Saturdays at 10:00 — 7-day filter enforced in handler
    isEnabled: true,
  },
  {
    key: 'remind_profile_48h',
    name: 'Recordatorio perfil developer (48h)',
    scheduleType: 'cron',
    scheduleExpr: '10 9 * * *', // Every day at 09:10 server local time
    // Disabled by default: requires DeveloperProfile completion detection
    // Enable once isProfileComplete field or similar is added to the schema.
    isEnabled: false,
  },
]

/** Upsert all known job definitions on server boot. Idempotent. */
export async function seedJobDefinitions(prisma: PrismaClient): Promise<void> {
  for (const def of JOB_DEFINITIONS) {
    await prisma.jobDefinition.upsert({
      where: { key: def.key },
      create: {
        key: def.key,
        name: def.name,
        scheduleType: def.scheduleType,
        scheduleExpr: def.scheduleExpr,
        isEnabled: def.isEnabled,
      },
      update: {
        name: def.name,
        scheduleType: def.scheduleType,
        scheduleExpr: def.scheduleExpr,
        // Do NOT update isEnabled — allows runtime toggling via DB without code changes
      },
    })
  }
  console.info('[jobs] %d job definitions seeded', JOB_DEFINITIONS.length)
}

/** Start the job runner. Call after Fastify is listening. */
export function startJobRunner(prisma: PrismaClient): JobRunner {
  const runner = new JobRunner(prisma)
  runner.start()
  return runner
}
