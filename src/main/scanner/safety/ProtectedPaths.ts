import * as path from 'path';

/**
 * Normalizes a Windows path to lowercase with backslashes and no trailing slash.
 */
export function normalizePath(p: string): string {
  if (!p) return '';
  return path.resolve(p).toLowerCase().replace(/[\/\\]+$/, '');
}

/**
 * Retrieve known Windows protected system paths dynamically from environment variables.
 */
export function getProtectedWindowsPaths(): string[] {
  const winDir = process.env.WINDIR || process.env.SystemRoot || 'C:\\Windows';
  const progFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const progData = process.env.ProgramData || 'C:\\ProgramData';

  const protectedRoots = [
    path.join(winDir, 'System32'),
    path.join(winDir, 'SysWOW64'),
    path.join(winDir, 'WinSxS'),
    path.join(winDir, 'Boot'),
    path.join(winDir, 'Fonts'),
    path.join(winDir, 'Installer'),
    path.join(winDir, 'Microsoft.NET'),
    progFiles,
    progFilesX86,
    path.join(progData, 'Microsoft', 'Windows'),
  ];

  return protectedRoots.map(normalizePath);
}
