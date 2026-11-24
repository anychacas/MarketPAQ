/**
 * scripts/check-cron.ts
 *
 * Verifies that cron-parser interprets '0 9 * * 1' as Monday 09:00 in SERVER LOCAL TIME.
 *
 * Run with:
 *   cd backend && npx tsx scripts/check-cron.ts
 */
import { CronExpressionParser } from 'cron-parser'

const CRON = '0 9 * * 1'
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fmt(d: Date): string {
  const day = DAYS[d.getDay()]
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${day} ${d.toLocaleDateString()} ${hh}:${mm}:${ss} (${d.toString()})`
}

console.log('─'.repeat(60))
console.log('cron-parser timezone check for:', CRON)
console.log('─'.repeat(60))
console.log('TZ env      :', process.env.TZ ?? '(not set — using system default)')
console.log('now local   :', fmt(new Date()))
console.log()

const interval = CronExpressionParser.parse(CRON)
const prev = interval.prev().toDate()
const next = interval.next().toDate()

console.log('prev slot   :', fmt(prev))
console.log('next slot   :', fmt(next))
console.log()

const prevOk = DAYS[prev.getDay()] === 'Mon' && prev.getHours() === 9 && prev.getMinutes() === 0
const nextOk = DAYS[next.getDay()] === 'Mon' && next.getHours() === 9 && next.getMinutes() === 0

console.log('prev is Mon 09:00 local?', prevOk ? '✓ YES' : '✗ NO — TIMEZONE MISMATCH')
console.log('next is Mon 09:00 local?', nextOk ? '✓ YES' : '✗ NO — TIMEZONE MISMATCH')
console.log()

if (!prevOk || !nextOk) {
  console.error('ERROR: cron-parser is NOT using server local time for this expression.')
  console.error('Set TZ env var on the server to the correct timezone (e.g. TZ=America/Mexico_City).')
  process.exit(1)
} else {
  console.log('OK: cron-parser uses server local time. Weekly digest will fire Mon 09:00 server time.')
}
console.log('─'.repeat(60))
