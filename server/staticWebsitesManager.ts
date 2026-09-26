import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { HostedWebsite, WebsiteSettings } from '../src/types';

const HOSTED_BOTS_DIR = path.join(process.cwd(), 'hosted_bots');
const WEBSITES_FILE = path.join(HOSTED_BOTS_DIR, 'websites.json');
const WEBSITES_SETTINGS_FILE = path.join(HOSTED_BOTS_DIR, 'website_settings.json');
const HOSTED_WEBSITES_ROOT = path.join(process.cwd(), 'hosted_websites');

// Ensure root storage directory exists
if (!fs.existsSync(HOSTED_WEBSITES_ROOT)) {
  fs.mkdirSync(HOSTED_WEBSITES_ROOT, { recursive: true });
}

export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'www', 'mail', 'ftp', 'smtp', 'panel', 'dashboard',
  'server', 'localhost', 'app', 'bot', 'bots', 'site', 'sites', 'auth',
  'login', 'register', 'support', 'store', 'wallet', 'plans', 'static',
  'assets', 'public', 'test', 'help', 'billing', 'root', 'internal'
]);

export function getWebsiteSettings(): WebsiteSettings {
  const defaultSettings: WebsiteSettings = {
    maxWebsitesPerUser: 5,
    maxStorageMb: 50,
    maxFileSizeMb: 15,
    baseDomain: process.env.HOSTING_BASE_DOMAIN || 'hostinglivefast.cloud',
    allowedExtensions: [
      'html', 'htm', 'css', 'js', 'mjs', 'png', 'jpg', 'jpeg', 'gif',
      'webp', 'svg', 'ico', 'json', 'woff', 'woff2', 'ttf', 'otf',
      'eot', 'mp3', 'mp4', 'webm', 'ogg', 'wav', 'txt', 'xml', 'map', 'pdf'
    ]
  };

  try {
    if (fs.existsSync(WEBSITES_SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(WEBSITES_SETTINGS_FILE, 'utf-8'));
      return { ...defaultSettings, ...data };
    }
  } catch (err) {
    console.error('Error loading website_settings.json:', err);
  }
  return defaultSettings;
}

export function saveWebsiteSettings(settings: Partial<WebsiteSettings>): boolean {
  try {
    if (!fs.existsSync(HOSTED_BOTS_DIR)) {
      fs.mkdirSync(HOSTED_BOTS_DIR, { recursive: true });
    }
    const current = getWebsiteSettings();
    const updated = { ...current, ...settings };
    fs.writeFileSync(WEBSITES_SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving website_settings.json:', err);
    return false;
  }
}

export function getWebsites(userId?: string): HostedWebsite[] {
  try {
    if (fs.existsSync(WEBSITES_FILE)) {
      const data = JSON.parse(fs.readFileSync(WEBSITES_FILE, 'utf-8'));
      if (Array.isArray(data)) {
        if (!userId) return data;
        return data.filter((w) => w.userId === userId);
      }
    }
  } catch (err) {
    console.error('Error loading websites.json:', err);
  }
  return [];
}

export function getWebsiteById(id: string, userId?: string): HostedWebsite | undefined {
  const websites = getWebsites(userId);
  return websites.find((w) => w.id === id);
}

export function saveWebsites(websites: HostedWebsite[]): void {
  try {
    if (!fs.existsSync(HOSTED_BOTS_DIR)) {
      fs.mkdirSync(HOSTED_BOTS_DIR, { recursive: true });
    }
    fs.writeFileSync(WEBSITES_FILE, JSON.stringify(websites, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving websites.json:', err);
  }
}

export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}

export function isValidSlug(slug: string): boolean {
  if (!slug || slug.length < 3 || slug.length > 30) return false;
  if (!/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/.test(slug)) return false;
  if (RESERVED_SLUGS.has(slug)) return false;
  return true;
}

function getSiteDirectory(userId: string, siteId: string): string {
  return path.join(HOSTED_WEBSITES_ROOT, userId, siteId);
}

function calculateDirectorySize(dirPath: string): { totalBytes: number; fileCount: number } {
  let totalBytes = 0;
  let fileCount = 0;

  if (!fs.existsSync(dirPath)) {
    return { totalBytes, fileCount };
  }

  function traverse(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(fullPath);
          totalBytes += stat.size;
          fileCount++;
        } catch {}
      }
    }
  }

  traverse(dirPath);
  return { totalBytes, fileCount };
}

/**
 * Create a new website record and directory
 */
export async function createWebsite(
  userId: string,
  userEmail: string,
  name: string,
  requestedSlug?: string
): Promise<{ success: boolean; website?: HostedWebsite; error?: string }> {
  const cleanName = (name || '').trim();
  if (!cleanName) {
    return { success: false, error: 'ওয়েবসাইটের নাম দেওয়া আবশ্যক (Website name is required)' };
  }

  let slug = sanitizeSlug(requestedSlug || cleanName);
  if (!isValidSlug(slug)) {
    // If slug is too short, append random number
    if (slug.length < 3) slug = `${slug || 'site'}-${Math.floor(100 + Math.random() * 900)}`;
    if (!isValidSlug(slug)) {
      return { success: false, error: 'সাবডোমেন ৩-৩০ অক্ষরের হতে হবে এবং শুধুমাত্র ছোট হাতের অক্ষর, সংখ্যা ও হাইফেন গ্রহণযোগ্য।' };
    }
  }

  const websites = getWebsites();

  // Check slug uniqueness across all users
  const slugConflict = websites.find((w) => w.slug === slug);
  if (slugConflict) {
    return { success: false, error: `সাবডোমেন '${slug}' ইতোমধ্যে ব্যবহৃত হয়েছে। অন্য একটি নাম দিন।` };
  }

  const siteId = `site_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const siteDir = getSiteDirectory(userId, siteId);
  fs.mkdirSync(siteDir, { recursive: true });

  const settings = getWebsiteSettings();
  const baseDomain = settings.baseDomain;

  // Create initial beautiful starter index.html
  const starterHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cleanName} | Hosted on hosting live fast</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #070b14; color: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 18px; padding: 40px; max-width: 540px; width: 100%; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .badge { display: inline-block; background: rgba(0, 210, 147, 0.15); color: #00d293; border: 1px solid #00d293; padding: 6px 16px; border-radius: 9999px; font-size: 13px; font-weight: 700; margin-bottom: 20px; }
    h1 { font-size: 26px; color: #f8fafc; margin-bottom: 12px; }
    p { font-size: 15px; color: #94a3b8; line-height: 1.6; margin-bottom: 28px; }
    .domain { background: #030712; padding: 12px 18px; border-radius: 10px; font-family: monospace; color: #38bdf8; font-size: 14px; margin-bottom: 24px; word-break: break-all; }
    .footer { font-size: 12px; color: #64748b; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">🚀 LIVE ON FAST CLOUD</div>
    <h1>${cleanName}</h1>
    <p>আপনার স্ট্যাটিক ওয়েবসাইট সফলভাবে তৈরি হয়েছে! এখন আপনার নিজস্ব HTML, CSS, JS ফাইল বা ZIP আপলোড করুন।</p>
    <div class="domain">${slug}.${baseDomain}</div>
    <div class="footer">Powered by <strong>hosting live fast</strong></div>
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(siteDir, 'index.html'), starterHtml, 'utf-8');

  const { totalBytes, fileCount } = calculateDirectorySize(siteDir);

  const newWebsite: HostedWebsite = {
    id: siteId,
    userId,
    userEmail,
    name: cleanName,
    slug,
    subdomainUrl: `https://${slug}.${baseDomain}`,
    directUrl: `/site/${slug}/`,
    status: 'online',
    storageBytes: totalBytes,
    filesCount: fileCount,
    hasIndexHtml: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastDeployedAt: new Date().toISOString()
  };

  websites.push(newWebsite);
  saveWebsites(websites);

  return { success: true, website: newWebsite };
}

/**
 * Deploy website files directly (supports multiple files with relative paths)
 */
export async function deployWebsiteFiles(
  siteId: string,
  userId: string,
  files: Array<{ name: string; content?: string; base64?: string }>
): Promise<{ success: boolean; filesCount?: number; storageBytes?: number; error?: string }> {
  const websites = getWebsites();
  const website = websites.find((w) => w.id === siteId && (w.userId === userId || userId === 'admin'));
  if (!website) {
    return { success: false, error: 'ওয়েবসাইট পাওয়া যায়নি অথবা আপনার এই সাইটে আপলোড করার অনুমতি নেই।' };
  }

  const siteDir = getSiteDirectory(website.userId, siteId);
  if (!fs.existsSync(siteDir)) {
    fs.mkdirSync(siteDir, { recursive: true });
  }

  const settings = getWebsiteSettings();
  const allowedExts = new Set(settings.allowedExtensions);
  const dangerousExts = new Set(['php', 'phtml', 'exe', 'sh', 'bat', 'cmd', 'pl', 'cgi', 'bin']);

  for (const f of files) {
    const rawName = f.name.replace(/\\/g, '/');
    const safePath = path.normalize(rawName).replace(/^(\.\.[\/\\])+/, '');
    const targetFilePath = path.join(siteDir, safePath);

    // Path traversal check
    if (!targetFilePath.startsWith(siteDir + path.sep) && targetFilePath !== siteDir) {
      continue;
    }

    const ext = path.extname(safePath).replace('.', '').toLowerCase();
    if (dangerousExts.has(ext)) {
      return { success: false, error: `নিরাপত্তাজনিত কারণে .${ext} ফাইল আপলোড নিষিদ্ধ` };
    }

    const fileDir = path.dirname(targetFilePath);
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }

    if (f.base64) {
      const buffer = Buffer.from(f.base64, 'base64');
      fs.writeFileSync(targetFilePath, buffer);
    } else if (typeof f.content === 'string') {
      fs.writeFileSync(targetFilePath, f.content, 'utf-8');
    }
  }

  const { totalBytes, fileCount } = calculateDirectorySize(siteDir);
  website.storageBytes = totalBytes;
  website.filesCount = fileCount;
  website.hasIndexHtml = fs.existsSync(path.join(siteDir, 'index.html'));
  website.lastDeployedAt = new Date().toISOString();
  website.updatedAt = new Date().toISOString();
  saveWebsites(websites);

  return { success: true, filesCount: fileCount, storageBytes: totalBytes };
}

/**
 * Deploy website by safely unzipping archive with Zip-Slip protection
 */
export async function deployWebsiteZip(
  siteId: string,
  userId: string,
  zipBase64: string
): Promise<{ success: boolean; filesCount?: number; storageBytes?: number; error?: string }> {
  const websites = getWebsites();
  const website = websites.find((w) => w.id === siteId && (w.userId === userId || userId === 'admin'));
  if (!website) {
    return { success: false, error: 'ওয়েবসাইট পাওয়া যায়নি অথবা আপলোড করার অনুমতি নেই।' };
  }

  const siteDir = getSiteDirectory(website.userId, siteId);
  if (!fs.existsSync(siteDir)) {
    fs.mkdirSync(siteDir, { recursive: true });
  }

  try {
    const zipBuffer = Buffer.from(zipBase64, 'base64');
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    if (entries.length === 0) {
      return { success: false, error: 'জিপ ফাইলটি খালি (ZIP is empty)' };
    }

    const dangerousExts = new Set(['php', 'phtml', 'exe', 'sh', 'bat', 'cmd', 'pl', 'cgi', 'bin']);

    // Check if files are all wrapped inside a single root folder in the zip
    const firstEntryNames = entries.map((e) => e.entryName.split('/')[0]).filter(Boolean);
    const uniqueRoots = Array.from(new Set(firstEntryNames));
    const isSingleFolderZip = uniqueRoots.length === 1 && entries.every((e) => e.entryName.startsWith(uniqueRoots[0] + '/'));
    const stripPrefix = isSingleFolderZip ? `${uniqueRoots[0]}/` : '';

    for (const entry of entries) {
      let relativePath = entry.entryName;
      if (stripPrefix && relativePath.startsWith(stripPrefix)) {
        relativePath = relativePath.slice(stripPrefix.length);
      }

      if (!relativePath) continue;

      const safePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
      const targetPath = path.join(siteDir, safePath);

      // Strict Zip-Slip protection
      if (!targetPath.startsWith(siteDir + path.sep) && targetPath !== siteDir) {
        continue;
      }

      if (entry.isDirectory) {
        fs.mkdirSync(targetPath, { recursive: true });
        continue;
      }

      const ext = path.extname(safePath).replace('.', '').toLowerCase();
      if (dangerousExts.has(ext)) {
        continue; // skip dangerous files
      }

      const parentDir = path.dirname(targetPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      fs.writeFileSync(targetPath, entry.getData());
    }

    const { totalBytes, fileCount } = calculateDirectorySize(siteDir);
    website.storageBytes = totalBytes;
    website.filesCount = fileCount;
    website.hasIndexHtml = fs.existsSync(path.join(siteDir, 'index.html'));
    website.lastDeployedAt = new Date().toISOString();
    website.updatedAt = new Date().toISOString();
    saveWebsites(websites);

    return { success: true, filesCount: fileCount, storageBytes: totalBytes };
  } catch (err: any) {
    console.error('ZIP extraction error:', err);
    return { success: false, error: `জিপ আনপ্যাক করতে ত্রুটি: ${err.message}` };
  }
}

/**
 * Toggle online / stopped status of a website
 */
export function toggleWebsiteStatus(
  siteId: string,
  userId?: string,
  targetStatus?: 'online' | 'stopped'
): { success: boolean; website?: HostedWebsite; error?: string } {
  const websites = getWebsites();
  const website = websites.find((w) => w.id === siteId && (!userId || w.userId === userId || userId === 'admin'));
  if (!website) {
    return { success: false, error: 'ওয়েবসাইট পাওয়া যায়নি' };
  }

  website.status = targetStatus || (website.status === 'online' ? 'stopped' : 'online');
  website.updatedAt = new Date().toISOString();
  saveWebsites(websites);

  return { success: true, website };
}

/**
 * Delete a website and completely remove its isolated directory
 */
export function deleteWebsite(siteId: string, userId?: string): { success: boolean; error?: string } {
  const websites = getWebsites();
  const index = websites.findIndex((w) => w.id === siteId && (!userId || w.userId === userId || userId === 'admin'));
  if (index === -1) {
    return { success: false, error: 'ওয়েবসাইট পাওয়া যায়নি' };
  }

  const website = websites[index];
  const siteDir = getSiteDirectory(website.userId, siteId);

  try {
    if (fs.existsSync(siteDir)) {
      fs.rmSync(siteDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.error('Error removing website directory:', err);
  }

  websites.splice(index, 1);
  saveWebsites(websites);

  return { success: true };
}

/**
 * Resolve website by slug for static serving
 */
export function getWebsiteBySlug(slug: string): { website: HostedWebsite; siteDir: string } | null {
  const cleanSlug = sanitizeSlug(slug);
  const websites = getWebsites();
  const website = websites.find((w) => w.slug === cleanSlug);
  if (!website) return null;

  const siteDir = getSiteDirectory(website.userId, website.id);
  return { website, siteDir };
}

/**
 * Get list of files in a website directory
 */
export function getWebsiteFilesList(siteId: string, userId?: string): Array<{ path: string; size: number; modified: string }> {
  const websites = getWebsites();
  const website = websites.find((w) => w.id === siteId && (!userId || w.userId === userId || userId === 'admin'));
  if (!website) return [];

  const siteDir = getSiteDirectory(website.userId, siteId);
  const fileList: Array<{ path: string; size: number; modified: string }> = [];

  function traverse(currentDir: string, relativePath = '') {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const rel = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        traverse(fullPath, rel);
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(fullPath);
          fileList.push({
            path: rel,
            size: stat.size,
            modified: stat.mtime.toISOString()
          });
        } catch {}
      }
    }
  }

  traverse(siteDir);
  return fileList;
}
