import { Request, Response, NextFunction } from 'express';

/**
 * Sanitizes input string to prevent stored/reflected XSS and prototype pollution attacks.
 */
function sanitizeValue(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    // 1. Remove dangerous script tags and event handlers
    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (typeof value === 'object') {
    const cleanObj: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      // 2. Prevent prototype pollution
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      cleanObj[key] = sanitizeValue(value[key]);
    }
    return cleanObj;
  }

  return value;
}

/**
 * Express middleware to sanitize all incoming request bodies, queries, and params.
 */
export function securitySanitizerMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeValue(req.body);
    }
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeValue(req.query);
    }
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeValue(req.params);
    }
  } catch (err) {
    console.error('[SecuritySanitizer] Error during payload sanitization:', err);
  }
  next();
}
