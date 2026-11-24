/**
 * seed.ts — LOCAL DEVELOPMENT seed data.
 *
 *   cd backend
 *   npm run db:seed        # or: npx prisma db seed
 *
 * Everything created here is obviously FAKE: no real people, no real
 * companies, no real email addresses (only @example.com / reserved 555
 * phone numbers) and no production data of any kind.
 *
 * The script is idempotent: every record is written with an upsert, so it
 * can be run as many times as you like without duplicating anything.
 *
 * Passwords are hashed exactly like the register/login routes do it
 * (bcrypt, 10 rounds — see backend/src/routes/api.ts).
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
// Side-effect import: loads backend/.env so DATABASE_URL is available.
import '../src/config/env'

const prisma = new PrismaClient()

/**
 * Shared password of every seeded account.
 * Documented in README.md — local development only.
 */
const DEV_PASSWORD = 'LocalDev123!'

/** bcrypt cost used by the register/login routes (keep them in sync). */
const BCRYPT_ROUNDS = 10

// ─────────────────────────────────────────────────────────────────────────────
// Seed data (all fake)
// ─────────────────────────────────────────────────────────────────────────────

/** Admin — full backend access (ADMIN_EMAILS / VITE_ADMIN_EMAILS). */
const ADMIN = {
  email: 'admin@example.com',
  name: 'Admin Demo',
  handle: 'admin-demo',
  company: 'MarketPAQ Demo',
  whatsapp: '5215550000000',
}

/** Developers — publish add-ons and own a developer profile. */
const DEVELOPERS = [
  {
    email: 'dev1@example.com',
    name: 'Dev One Studio',
    handle: 'dev-one',
    company: 'Estudio Demo Norte',
    whatsapp: '5215550000001',
    profile: {
      displayName: 'Dev One Studio',
      bio: 'Estudio ficticio que crea add-ons de demostración para CONTPAQi y SoftRestaurant.',
      website: 'https://example.com/dev-one',
      supportEmail: 'dev1@example.com',
      contpaqi: true,
      softrestaurant: true,
      location: 'Ciudad Demo',
      services: 'Add-ons de demostración para punto de venta y facturación.',
      responseTime: 'Menos de 24 horas',
    },
  },
  {
    email: 'dev2@example.com',
    name: 'Dev Two Labs',
    handle: 'dev-two',
    company: 'Laboratorios Demo Dos',
    whatsapp: '5215550000002',
    profile: {
      displayName: 'Dev Two Labs',
      bio: 'Laboratorio ficticio de herramientas para el sector de restaurantes.',
      website: 'https://example.com/dev-two',
      supportEmail: 'dev2@example.com',
      contpaqi: true,
      softrestaurant: false,
      location: 'Otra Ciudad Demo',
      services: 'Reportes y control de comisiones para CONTPAQi.',
      responseTime: '24 a 48 horas',
    },
  },
]

/** Partners — browse the catalog, rate add-ons and vote on feature requests. */
const PARTNERS = [
  {
    email: 'partner1@example.com',
    name: 'Partner Uno',
    handle: 'partner-uno',
    company: 'Distribuidora Demo Uno',
    whatsapp: '5215550000011',
  },
  {
    email: 'partner2@example.com',
    name: 'Partner Dos',
    handle: 'partner-dos',
    company: 'Distribuidora Demo Dos',
    whatsapp: '5215550000012',
  },
]

type AddonSeed = {
  slug: string
  name: string
  summary: string
  description: string
  vendor: string
  contpaqi: boolean
  softrestaurant: boolean
  manufacturer: string
  system: string
  classification: string
  tags: string[]
  priceFrom: number
  licenseType: string[]
  licenseDescription: string
  contactWhatsApp: string
  owner: string
}

/** Six invented add-ons split between CONTPAQi and SoftRestaurant. */
const ADDONS: AddonSeed[] = [
  {
    slug: 'comanda-rapida-pro',
    name: 'Comanda Rápida Pro',
    summary: 'Comanda de una pantalla con búsqueda de platillos y notas para mesero.',
    description:
      'Add-on de demostración para SoftRestaurant. Muestra el catálogo de platillos en una sola ' +
      'pantalla, permite agregar notas al pedido y guarda el historial de comandas del turno.',
    vendor: 'Estudio Demo Norte',
    contpaqi: false,
    softrestaurant: true,
    manufacturer: 'SoftRestaurant',
    system: 'Punto de venta',
    classification: 'aprobada',
    tags: ['comandas', 'mesero'],
    priceFrom: 990,
    licenseType: ['anual', 'mensual'],
    licenseDescription: 'Por establecimiento',
    contactWhatsApp: '5215550000001',
    owner: 'dev1@example.com',
  },
  {
    slug: 'sincronizador-inventario-demo',
    name: 'Sincronizador de Inventario Demo',
    summary: 'Sincroniza existencias entre el mostrador y el catálogo de productos.',
    description:
      'Add-on de demostración para CONTPAQi y SoftRestaurant. Compara el inventario del mostrador ' +
      'con el catálogo y genera una lista de diferencias para el cierre del día.',
    vendor: 'Estudio Demo Norte',
    contpaqi: true,
    softrestaurant: true,
    manufacturer: 'CONTPAQi',
    system: 'Facturación y punto de venta',
    classification: 'aprobada',
    tags: ['inventario', 'almacen'],
    priceFrom: 1490,
    licenseType: ['anual'],
    licenseDescription: 'Por equipo',
    contactWhatsApp: '5215550000001',
    owner: 'dev1@example.com',
  },
  {
    slug: 'panel-comisiones-demo',
    name: 'Panel de Comisiones Demo',
    summary: 'Calcula y exporta las comisiones de los vendedores por periodo.',
    description:
      'Add-on de demostración para CONTPAQi. Calcula las comisiones de cada vendedor a partir de ' +
      'las facturas del periodo y permite exportar el resultado en texto separado por tabulaciones.',
    vendor: 'Laboratorios Demo Dos',
    contpaqi: true,
    softrestaurant: false,
    manufacturer: 'CONTPAQi',
    system: 'Facturación',
    classification: 'aprobada',
    tags: ['comisiones', 'reportes'],
    priceFrom: 1990,
    licenseType: ['anual', 'mensual'],
    licenseDescription: 'Por usuario',
    contactWhatsApp: '5215550000002',
    owner: 'dev2@example.com',
  },
  {
    slug: 'respaldo-ordenes-demo',
    name: 'Respaldo Automático de Órdenes Demo',
    summary: 'Guarda una copia local de las órdenes cerradas del día.',
    description:
      'Add-on de demostración para SoftRestaurant. Al cerrar el turno escribe un archivo de texto ' +
      'con las órdenes del día para poder revisarlo sin conexión.',
    vendor: 'Laboratorios Demo Dos',
    contpaqi: false,
    softrestaurant: true,
    manufacturer: 'SoftRestaurant',
    system: 'Punto de venta',
    classification: 'propuesta',
    tags: ['respaldo', 'turno'],
    priceFrom: 0,
    licenseType: ['vitalicia'],
    licenseDescription: 'Sin costo, licencia vitalicia de demostración',
    contactWhatsApp: '5215550000002',
    owner: 'dev2@example.com',
  },
  {
    slug: 'calculadora-impuestos-locales-demo',
    name: 'Calculadora de Impuestos Locales Demo',
    summary: 'Desglose de impuestos locales por sucursal para el cierre contable.',
    description:
      'Add-on de demostración para CONTPAQi. Desglosa el impuesto local de cada sucursal usando ' +
      'tablas que se cargan a mano, para poder cuadrar el cierre contable.',
    vendor: 'Estudio Demo Norte',
    contpaqi: true,
    softrestaurant: false,
    manufacturer: 'CONTPAQi',
    system: 'Facturación',
    classification: 'aprobada',
    tags: ['impuestos', 'contabilidad'],
    priceFrom: 2490,
    licenseType: ['anual'],
    licenseDescription: 'Por RFC',
    contactWhatsApp: '5215550000001',
    owner: 'dev1@example.com',
  },
  {
    slug: 'monitor-turnos-demo',
    name: 'Monitor de Turnos Demo',
    summary: 'Muestra en pantalla los turnos del personal y los relevos pendientes.',
    description:
      'Add-on de demostración para SoftRestaurant. Presenta los turnos de la semana y avisa ' +
      'visualmente cuando falta confirmar un relevo.',
    vendor: 'Laboratorios Demo Dos',
    contpaqi: false,
    softrestaurant: true,
    manufacturer: 'SoftRestaurant',
    system: 'Punto de venta',
    classification: 'propuesta',
    tags: ['turnos', 'personal'],
    priceFrom: 790,
    licenseType: ['mensual'],
    licenseDescription: 'Por establecimiento',
    contactWhatsApp: '5215550000002',
    owner: 'dev2@example.com',
  },
]

type FeatureRequestSeed = {
  id: string
  title: string
  description: string
  status: string
  createdBy: string
  voters: string[]
}

/** Feature requests for the "Centro de mejoras" module. */
const FEATURE_REQUESTS: FeatureRequestSeed[] = [
  {
    id: 'seed-feature-request-export-excel',
    title: 'Exportar reportes a Excel',
    description:
      'Que los reportes de ventas y comisiones se puedan descargar en formato de hoja de cálculo ' +
      'en lugar de texto plano.',
    status: 'open',
    createdBy: 'dev1@example.com',
    voters: ['dev2@example.com', 'partner1@example.com', 'partner2@example.com'],
  },
  {
    id: 'seed-feature-request-whatsapp-notifications',
    title: 'Notificaciones por WhatsApp',
    description:
      'Enviar por WhatsApp los avisos de cambio de estado de un add-on y las novedades del catálogo.',
    status: 'planned',
    createdBy: 'dev2@example.com',
    voters: ['dev1@example.com', 'partner1@example.com'],
  },
  {
    id: 'seed-feature-request-dark-mode',
    title: 'Modo oscuro en el panel de administración',
    description:
      'Agregar un tema oscuro al panel de administración para trabajar de noche sin luz de fondo.',
    status: 'open',
    createdBy: 'partner1@example.com',
    voters: ['partner2@example.com'],
  },
]

/** Ratings: [slug del add-on, email de quien califica, puntuación, comentario]. */
const ADDON_RATINGS: Array<[string, string, number, string]> = [
  ['comanda-rapida-pro', 'partner1@example.com', 5, 'Muy ágil en el turno de prueba.'],
  ['comanda-rapida-pro', 'partner2@example.com', 4, 'Buena búsqueda de platillos.'],
  ['sincronizador-inventario-demo', 'partner1@example.com', 4, 'El reporte de diferencias ahorra tiempo.'],
  ['panel-comisiones-demo', 'partner2@example.com', 5, 'El cálculo por periodo coincide con el ours.'],
  ['respaldo-ordenes-demo', 'partner1@example.com', 4, 'Simple y funciona sin conexión.'],
  ['calculadora-impuestos-locales-demo', 'partner2@example.com', 5, 'Muy útil para el cierre.'],
  ['monitor-turnos-demo', 'partner1@example.com', 4, 'El aviso de relevos es claro.'],
]

/** Ratings of the developers: [email del developer, email de quien califica, ...]. */
const DEVELOPER_RATINGS: Array<[string, string, number, string]> = [
  ['dev1@example.com', 'partner1@example.com', 5, 'Responde rápido y documenta bien.'],
  ['dev1@example.com', 'partner2@example.com', 4, 'Buen soporte en las dudas de instalación.'],
  ['dev2@example.com', 'partner1@example.com', 4, 'Herramientas útiles para reportes.'],
  ['dev2@example.com', 'partner2@example.com', 5, 'Excelente comunicación.'],
]

// ─────────────────────────────────────────────────────────────────────────────
// Seed
// ─────────────────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Copy backend/.env.example to backend/.env (or export DATABASE_URL) and try again.',
    )
  }

  // One hash for all accounts (same password) — hashed like the register route.
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, BCRYPT_ROUNDS)

  // ── Users ──────────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: ADMIN.email },
    create: {
      email: ADMIN.email,
      name: ADMIN.name,
      handle: ADMIN.handle,
      company: ADMIN.company,
      whatsapp: ADMIN.whatsapp,
      passwordHash,
      role: 'admin',
      userType: 'developer',
      canPublishAddons: true,
      onboardingComplete: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    update: {
      name: ADMIN.name,
      handle: ADMIN.handle,
      company: ADMIN.company,
      whatsapp: ADMIN.whatsapp,
      passwordHash,
      role: 'admin',
      userType: 'developer',
      canPublishAddons: true,
      onboardingComplete: true,
      emailVerified: true,
    },
  })

  const developerUsers = new Map<string, { id: string }>()
  for (const dev of DEVELOPERS) {
    const user = await prisma.user.upsert({
      where: { email: dev.email },
      create: {
        email: dev.email,
        name: dev.name,
        handle: dev.handle,
        company: dev.company,
        whatsapp: dev.whatsapp,
        passwordHash,
        role: null,
        userType: 'developer',
        canPublishAddons: true,
        onboardingComplete: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
      update: {
        name: dev.name,
        handle: dev.handle,
        company: dev.company,
        whatsapp: dev.whatsapp,
        passwordHash,
        userType: 'developer',
        canPublishAddons: true,
        onboardingComplete: true,
        emailVerified: true,
      },
    })
    developerUsers.set(dev.email, user)
  }

  const partnerUsers = new Map<string, { id: string }>()
  for (const partner of PARTNERS) {
    const user = await prisma.user.upsert({
      where: { email: partner.email },
      create: {
        email: partner.email,
        name: partner.name,
        handle: partner.handle,
        company: partner.company,
        whatsapp: partner.whatsapp,
        passwordHash,
        role: null,
        userType: 'partner',
        canPublishAddons: false,
        onboardingComplete: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
      update: {
        name: partner.name,
        handle: partner.handle,
        company: partner.company,
        whatsapp: partner.whatsapp,
        passwordHash,
        userType: 'partner',
        canPublishAddons: false,
        onboardingComplete: true,
        emailVerified: true,
      },
    })
    partnerUsers.set(partner.email, user)
  }

  // ── Developer profiles ─────────────────────────────────────────────────────
  const developerProfiles = new Map<string, { id: string }>()
  for (const dev of DEVELOPERS) {
    const userId = developerUsers.get(dev.email)?.id
    if (!userId) continue
    const profile = await prisma.developerProfile.upsert({
      where: { userId },
      create: {
        userId,
        displayName: dev.profile.displayName,
        bio: dev.profile.bio,
        website: dev.profile.website,
        whatsapp: dev.whatsapp,
        supportEmail: dev.profile.supportEmail,
        contpaqi: dev.profile.contpaqi,
        softrestaurant: dev.profile.softrestaurant,
        location: dev.profile.location,
        services: dev.profile.services,
        responseTime: dev.profile.responseTime,
      },
      update: {
        displayName: dev.profile.displayName,
        bio: dev.profile.bio,
        website: dev.profile.website,
        whatsapp: dev.whatsapp,
        supportEmail: dev.profile.supportEmail,
        contpaqi: dev.profile.contpaqi,
        softrestaurant: dev.profile.softrestaurant,
        location: dev.profile.location,
        services: dev.profile.services,
        responseTime: dev.profile.responseTime,
      },
    })
    developerProfiles.set(dev.email, profile)
  }

  // ── Add-ons ────────────────────────────────────────────────────────────────
  const addons = new Map<string, { id: string }>()
  for (const addon of ADDONS) {
    const owner = developerUsers.get(addon.owner)
    if (!owner) continue
    const developer = developerProfiles.get(addon.owner)
    const data = {
      name: addon.name,
      summary: addon.summary,
      description: addon.description,
      vendor: addon.vendor,
      contpaqi: addon.contpaqi,
      softrestaurant: addon.softrestaurant,
      status: 'published',
      manufacturer: addon.manufacturer,
      system: addon.system,
      classification: addon.classification,
      tags: addon.tags,
      priceFrom: addon.priceFrom,
      licenseType: addon.licenseType,
      licenseDescription: addon.licenseDescription,
      youtubeLinks: [] as string[],
      images: [] as string[],
      coverImage: null as string | null,
      website: null as string | null,
      contactEmail: addon.owner,
      contactWhatsApp: addon.contactWhatsApp,
      ownerUserId: owner.id,
      developerId: developer?.id ?? null,
    }
    const row = await prisma.addon.upsert({
      where: { slug: addon.slug },
      create: { slug: addon.slug, ...data },
      update: data,
    })
    addons.set(addon.slug, row)
  }

  // ── Feature requests and votes ─────────────────────────────────────────────
  for (const fr of FEATURE_REQUESTS) {
    const author = developerUsers.get(fr.createdBy) ?? partnerUsers.get(fr.createdBy)
    if (!author) continue
    await prisma.featureRequest.upsert({
      where: { id: fr.id },
      create: {
        id: fr.id,
        title: fr.title,
        description: fr.description,
        status: fr.status,
        createdByUserId: author.id,
      },
      update: {
        title: fr.title,
        description: fr.description,
        status: fr.status,
        createdByUserId: author.id,
      },
    })

    for (const voterEmail of fr.voters) {
      const voter = developerUsers.get(voterEmail) ?? partnerUsers.get(voterEmail)
      if (!voter) continue
      await prisma.featureVote.upsert({
        where: { featureRequestId_userId: { featureRequestId: fr.id, userId: voter.id } },
        create: { featureRequestId: fr.id, userId: voter.id },
        update: {},
      })
    }
  }

  // ── Ratings ────────────────────────────────────────────────────────────────
  for (const [slug, email, score, comment] of ADDON_RATINGS) {
    const addon = addons.get(slug)
    const user = partnerUsers.get(email) ?? developerUsers.get(email)
    if (!addon || !user) continue
    await prisma.addonRating.upsert({
      where: { addonId_userId: { addonId: addon.id, userId: user.id } },
      create: { addonId: addon.id, userId: user.id, score, comment },
      update: { score, comment },
    })
  }

  for (const [devEmail, email, score, comment] of DEVELOPER_RATINGS) {
    const profile = developerProfiles.get(devEmail)
    const user = partnerUsers.get(email) ?? developerUsers.get(email)
    if (!profile || !user) continue
    await prisma.developerRating.upsert({
      where: { developerId_userId: { developerId: profile.id, userId: user.id } },
      create: { developerId: profile.id, userId: user.id, score, comment },
      update: { score, comment },
    })
  }

  console.info('')
  console.info('[seed] local development data ready')
  console.info('[seed] password for every seeded account: %s', DEV_PASSWORD)
  console.info('[seed] admin (put it in ADMIN_EMAILS / VITE_ADMIN_EMAILS): %s', admin.email)
  for (const dev of DEVELOPERS) console.info('[seed] developer: %s', dev.email)
  for (const partner of PARTNERS) console.info('[seed] partner:   %s', partner.email)
  console.info('[seed] %d add-ons, %d feature requests', ADDONS.length, FEATURE_REQUESTS.length)
  console.info('')
}

seed()
  .catch((err: unknown) => {
    console.error('[seed] failed:', err)
    process.exitCode = 1
  })
  .finally(() => {
    void prisma.$disconnect()
  })
