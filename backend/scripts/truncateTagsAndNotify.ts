/**
 * truncateTagsAndNotify.ts
 *
 * One-shot script: truncates add-ons with >3 tags to their first 3,
 * then emails each affected developer a summary of changes.
 *
 * Run from the backend/ directory:
 *   npx tsx scripts/truncateTagsAndNotify.ts
 *
 * The script is idempotent: addons already at ≤3 tags are untouched.
 */
import { PrismaClient } from '@prisma/client'
import { notifyTagsUpdated, type AffectedAddon } from '../src/email/notifications'

const prisma = new PrismaClient()

async function main() {
  console.log('[truncateTagsAndNotify] starting…')

  // 1. Find addons with more than 3 tags
  const addons = await prisma.addon.findMany({
    where: { status: 'published' },
    select: {
      id: true,
      name: true,
      slug: true,
      tags: true,
      userId: true,
      user: { select: { email: true, name: true } },
    },
  })

  const overLimit = addons.filter(a => a.tags.length > 3)
  if (overLimit.length === 0) {
    console.log('[truncateTagsAndNotify] no addons over the 3-tag limit — nothing to do')
    return
  }

  console.log(`[truncateTagsAndNotify] found ${overLimit.length} addon(s) over limit`)

  // 2. Group by developer
  const byDev = new Map<string, { email: string; name: string; addons: AffectedAddon[] }>()
  for (const addon of overLimit) {
    const devEmail = addon.user.email
    const devName = addon.user.name ?? devEmail
    if (!byDev.has(devEmail)) {
      byDev.set(devEmail, { email: devEmail, name: devName, addons: [] })
    }
    byDev.get(devEmail)!.addons.push({
      name: addon.name,
      slug: addon.slug,
      removedTags: addon.tags.slice(3),
      remainingTags: addon.tags.slice(0, 3),
    })
  }

  // 3. Truncate tags in DB
  for (const addon of overLimit) {
    const truncated = addon.tags.slice(0, 3)
    await prisma.addon.update({
      where: { id: addon.id },
      data: { tags: truncated },
    })
    console.log(`[truncateTagsAndNotify] truncated "${addon.name}": [${addon.tags.join(', ')}] → [${truncated.join(', ')}]`)
  }

  // 4. Send one email per developer
  for (const [email, dev] of byDev) {
    console.log(`[truncateTagsAndNotify] emailing ${email} (${dev.addons.length} addon(s))`)
    await notifyTagsUpdated(email, dev.name, dev.addons)
  }

  console.log('[truncateTagsAndNotify] done')
}

main()
  .catch(err => { console.error('[truncateTagsAndNotify] fatal:', err); process.exit(1) })
  .finally(() => prisma.$disconnect())
