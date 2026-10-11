import * as fs from 'fs';
import { RiskLevel, ScanCategoryId } from '../../../shared/types';
import { getProtectedWindowsPaths, normalizePath } from './ProtectedPaths';

export class SafetyPolicy {
  private protectedPaths: Set<string>;

  constructor(customProtectedPaths?: string[]) {
    const defaultPaths = getProtectedWindowsPaths();
    this.protectedPaths = new Set(
      customProtectedPaths
        ? customProtectedPaths.map(normalizePath)
        : defaultPaths
    );
  }

  /**
   * Check if a path is located inside a protected Windows directory.
   */
  public isPathProtected(targetPath: string): boolean {
    if (!targetPath) return true;
    const normalized = normalizePath(targetPath);

    for (const protectedRoot of this.protectedPaths) {
      if (normalized === protectedRoot || normalized.startsWith(protectedRoot + '\\')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check whether a path is a network or UNC path (e.g. \\server\share).
   */
  public isNetworkOrUncPath(targetPath: string): boolean {
    if (!targetPath) return false;
    const trimmed = targetPath.trim();
    return trimmed.startsWith('\\\\') || trimmed.startsWith('//');
  }

  /**
   * Determine whether a directory or file entry is a symlink or directory junction.
   */
  public isSymlinkOrJunction(stats: fs.Stats): boolean {
    return stats.isSymbolicLink();
  }

  /**
   * Classify an item into SAFE_TO_CLEAN, REVIEW_REQUIRED, or PROTECTED.
   */
  public classifyItem(category: ScanCategoryId, targetPath: string): RiskLevel {
    if (this.isPathProtected(targetPath) || this.isNetworkOrUncPath(targetPath)) {
      return 'PROTECTED';
    }

    switch (category) {
      case 'user_temp':
      case 'windows_temp':
      case 'browser_cache':
      case 'recycle_bin':
        return 'SAFE_TO_CLEAN';

      case 'large_files':
      case 'old_files':
        // User files must ALWAYS be review required, never automatically safe to clean.
        return 'REVIEW_REQUIRED';

      default:
        return 'PROTECTED';
    }
  }

  /**
   * Indicates whether a category is eligible for recoverable space calculations.
   */
  public isCategoryRecoverable(category: ScanCategoryId): boolean {
    return (
      category === 'user_temp' ||
      category === 'windows_temp' ||
      category === 'browser_cache' ||
      category === 'recycle_bin'
    );
  }
}

export const defaultSafetyPolicy = new SafetyPolicy();
