import fs from 'fs';
import path from 'path';

const TEMPLATE_ROOT = path.resolve(process.cwd(), 'public', 'templates');

/**
 * Resolve a "/templates/..." reference to a regular file inside public/templates.
 * Returns null for anything that escapes the directory (../, absolute paths,
 * symlinks pointing elsewhere) or does not exist.
 */
export function resolveTemplateAsset(reference: string): string | null {
  const relative = reference.replace(/^\/+/, '').replace(/^templates[\\/]/, '');
  const candidate = path.resolve(TEMPLATE_ROOT, relative);
  if (!candidate.startsWith(TEMPLATE_ROOT + path.sep)) return null;
  try {
    const real = fs.realpathSync(candidate);
    const realRoot = fs.realpathSync(TEMPLATE_ROOT);
    if (!real.startsWith(realRoot + path.sep)) return null;
    return fs.statSync(real).isFile() ? real : null;
  } catch {
    return null;
  }
}
