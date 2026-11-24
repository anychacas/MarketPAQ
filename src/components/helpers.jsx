// Slugify a name
export function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

// Generate unique slug
export async function generateUniqueSlug(name, Addons) {
  const base = slugify(name);
  let slug = base;
  let counter = 1;
  
  while (true) {
    const existing = await Addons.filter({ slug });
    if (existing.length === 0) return slug;
    counter++;
    slug = `${base}-${counter}`;
  }
}

// Sanitize WhatsApp number
export function sanitizeWhatsApp(number) {
  if (!number) return '';
  const digits = number.replace(/\D/g, '');
  if (digits.length === 10) return '52' + digits;
  return digits;
}

// Normalize website URL
export function normalizeWebsite(url) {
  if (!url) return '';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 'https://' + url;
  }
  return url;
}

// Check if developer profile is complete
export function isProfileComplete(profile) {
  if (!profile) return { complete: false, missing: ['Perfil no creado'] };
  const missing = [];
  if (!profile.displayName?.trim()) missing.push('Nombre de display');
  if (!profile.supportEmail?.includes('@')) missing.push('Email de soporte válido');
  const sanitized = sanitizeWhatsApp(profile.whatsapp);
  if (sanitized.length < 10) missing.push('WhatsApp (mín. 10 dígitos)');
  if (!profile.bio || profile.bio.length < 20) missing.push('Bio (mín. 20 caracteres)');
  if (!profile.contpaqi && !profile.softrestaurant) missing.push('Al menos un sistema (CONTPAQi o SoftRestaurant)');
  return { complete: missing.length === 0, missing };
}

// Check if addon has contact available
export function hasContactAvailable(addon, devProfile) {
  if (addon.contactWhatsApp || addon.contactEmail || addon.website) return true;
  if (devProfile) {
    const { complete } = isProfileComplete(devProfile);
    return complete;
  }
  return false;
}

// Build WhatsApp link
export function getWhatsAppLink(number) {
  const sanitized = sanitizeWhatsApp(number);
  return `https://wa.me/${sanitized}`;
}