import * as fs from 'fs';
import { ScanItem, ScanCategoryId } from '../../shared/types';
import { SafetyPolicy, defaultSafetyPolicy } from '../scanner/safety/SafetyPolicy';
import { ApprovedRoots } from './safety/ApprovedRoots';
import { normalizePath } from '../scanner/safety/ProtectedPaths';

export interface PreDeletionValidationResult {
  canDelete: boolean;
  skipReason?: string;
}

export class CleanupValidator {
  private safetyPolicy: SafetyPolicy;

  constructor(safetyPolicy?: SafetyPolicy) {
    this.safetyPolicy = safetyPolicy || defaultSafetyPolicy;
  }

  /**
   * Validates whether an item from the scan session can be included in a cleanup plan.
   */
  public validateItemForPlan(item: ScanItem): { valid: boolean; reason?: string } {
    if (!item || !item.id) {
      return { valid: false, reason: 'Invalid item structure' };
    }

    // Whitelisted categories only
    if (
      item.category !== 'user_temp' &&
      item.category !== 'windows_temp' &&
      item.category !== 'browser_cache' &&
      item.category !== 'recycle_bin'
    ) {
      return { valid: false, reason: `Category ${item.category} is not eligible for cleanup` };
    }

    if (item.category === 'recycle_bin') {
      return { valid: true };
    }

    if (!item.fullPath) {
      return { valid: false, reason: 'Missing item path' };
    }

    if (this.safetyPolicy.isNetworkOrUncPath(item.fullPath)) {
      return { valid: false, reason: 'Network/UNC paths cannot be cleaned' };
    }

    if (this.safetyPolicy.isPathProtected(item.fullPath)) {
      return { valid: false, reason: 'Path is protected by system safety policy' };
    }

    if (!ApprovedRoots.isInsideApprovedRoot(item.fullPath)) {
      return { valid: false, reason: 'Path is outside approved cleanup boundaries' };
    }

    if (!fs.existsSync(item.fullPath)) {
      return { valid: false, reason: 'File no longer exists on disk' };
    }

    return { valid: true };
  }

  /**
   * Final atomic pre-deletion validation immediately before calling unlink.
   * Protects against race conditions, path traversal, symlink redirection, and modified files.
   */
  public validateImmediatelyBeforeDeletion(
    fullPath: string,
    expectedSize: number,
    category: ScanCategoryId
  ): PreDeletionValidationResult {
    if (category === 'recycle_bin') {
      return { canDelete: true };
    }

    if (!fs.existsSync(fullPath)) {
      return { canDelete: false, skipReason: 'File no longer exists' };
    }

    let lstats: fs.Stats;
    try {
      lstats = fs.lstatSync(fullPath);
    } catch {
      return { canDelete: false, skipReason: 'File inaccessible or currently in use' };
    }

    // Do NOT follow symlinks or delete reparse points
    if (lstats.isSymbolicLink()) {
      return { canDelete: false, skipReason: 'Reparse point / symlink target skipped' };
    }

    // Only individual files can be deleted directly
    if (!lstats.isFile()) {
      return { canDelete: false, skipReason: 'Directory deletion blocked' };
    }

    // Resolve canonical realpath
    let realPath: string;
    try {
      realPath = fs.realpathSync(fullPath);
    } catch {
      return { canDelete: false, skipReason: 'Cannot resolve canonical path' };
    }

    // Verify canonical path is inside approved root
    if (!ApprovedRoots.isInsideApprovedRoot(realPath)) {
      return { canDelete: false, skipReason: 'Path escapes approved cleanup root' };
    }

    // Verify canonical path is not protected
    if (this.safetyPolicy.isPathProtected(realPath)) {
      return { canDelete: false, skipReason: 'Protected system path' };
    }

    // Race condition check: if file size unexpectedly multiplied significantly, skip it
    if (expectedSize > 1024 * 1024 && lstats.size > expectedSize * 1.5) {
      return { canDelete: false, skipReason: 'File modified significantly after scan' };
    }

    return { canDelete: true };
  }
}

export const defaultCleanupValidator = new CleanupValidator();
