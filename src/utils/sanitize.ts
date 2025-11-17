import DOMPurify from 'dompurify';

export function sanitizeHTML(input: string) {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

export function sanitizeText(input: string | null | undefined) {
  if (!input) return '';
  // Remove tags and trim
  return String(input).replace(/<[^>]*>/g, '').trim();
}