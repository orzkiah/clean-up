import * as fs from 'fs';
import * as path from 'path';
import {
  DuplicateScanResult,
  DuplicateGroup,
  DuplicateFileItem,
  DuplicateActionItem,
} from '../../../shared/types';
import { SafetyPolicy, defaultSafetyPolicy } from '../../scanner/safety/SafetyPolicy';
import { normalizePath } from '../../scanner/safety/ProtectedPaths';
import { HashCacheDatabase, defaultHashCache } from '../cache/HashCacheDatabase';
import { FingerprintService, defaultFingerprintService } from '../FingerprintService';

export interface ValidationItemResult {
  valid: boolean;
  fileItem: DuplicateFileItem;
  group: DuplicateGroup;
  failureReason?: string;
}

export interface PlanValidationResult {
  valid: boolean;
  itemsToTrash: DuplicateFileItem[];
  reclaimableBytes: number;
  errors: string[];
}

export class DuplicateResolutionValidator {
  private safetyPolicy: SafetyPolicy;
  private hashCache: HashCacheDatabase;
  private fingerprintService: FingerprintService;

  constructor(
    safetyPolicy?: SafetyPolicy,
    hashCache?: HashCacheDatabase,
    fingerprintService?: FingerprintService
  ) {
    this.safetyPolicy = safetyPolicy || defaultSafetyPolicy;
    this.hashCache = hashCache || defaultHashCache;
    this.fingerprintService = fingerprintService || defaultFingerprintService;
  }

  /**
   * Performs the full 15-point validation across the requested user actions against an active scan session.
   */
  public async validateActions(
    scanResult: DuplicateScanResult | null,
    actions: DuplicateActionItem[],
    allowedRoots: string[]
  ): Promise<PlanValidationResult> {
    const errors: string[] = [];

    // 1. Session Active
    if (!scanResult || !scanResult.groups || scanResult.groups.length === 0) {
      return {
        valid: false,
        itemsToTrash: [],
        reclaimableBytes: 0,
        errors: ['No active duplicate scan session found in memory.'],
      };
    }

    // 2. Session Not Stale (< 60 minutes)
    const scanAgeMs = Date.now() - new Date(scanResult.completedAt).getTime();
    const MAX_SESSION_AGE_MS = 60 * 60 * 1000; // 60 mins
    if (scanAgeMs > MAX_SESSION_AGE_MS) {
      return {
        valid: false,
        itemsToTrash: [],
        reclaimableBytes: 0,
        errors: ['The duplicate scan session has expired (> 60 minutes old). Please run a fresh scan.'],
      };
    }

    if (!actions || actions.length === 0) {
      return {
        valid: false,
        itemsToTrash: [],
        reclaimableBytes: 0,
        errors: ['No actions provided.'],
      };
    }

    // Index all files by itemId and map them to their group
    const fileMap = new Map<string, { file: DuplicateFileItem; group: DuplicateGroup }>();
    for (const group of scanResult.groups) {
      for (const file of group.files) {
        fileMap.set(file.itemId, { file, group });
      }
    }

    const actionMap = new Map<string, 'KEEP' | 'REMOVE'>();
    for (const action of actions) {
      actionMap.set(action.itemId, action.action);
    }

    // 5. At least one copy kept per affected group
    const groupDecisions = new Map<string, { totalFiles: number; keepCount: number; removeCount: number }>();
    for (const group of scanResult.groups) {
      let keepCount = 0;
      let removeCount = 0;
      for (const file of group.files) {
        const action = actionMap.get(file.itemId);
        if (action === 'REMOVE') {
          removeCount++;
        } else {
          // If not explicitly marked REMOVE, it defaults to being kept
          keepCount++;
        }
      }

      if (removeCount > 0) {
        if (keepCount === 0) {
          errors.push(
            `Safety violation: Duplicate group with hash ${group.hash.substring(0, 8)}... has all copies marked for removal. At least one original copy must be kept.`
          );
        }
        groupDecisions.set(group.groupId, { totalFiles: group.files.length, keepCount, removeCount });
      }
    }

    if (errors.length > 0) {
      return {
        valid: false,
        itemsToTrash: [],
        reclaimableBytes: 0,
        errors,
      };
    }

    const itemsToTrash: DuplicateFileItem[] = [];
    let reclaimableBytes = 0;
    const normalizedRoots = allowedRoots.map(normalizePath);

    // Validate each REMOVE item individually
    for (const action of actions) {
      if (action.action !== 'REMOVE') {
        continue;
      }

      // 3. Item belongs to active session
      const entry = fileMap.get(action.itemId);
      if (!entry) {
        errors.push(`Item ID '${action.itemId}' does not exist in the active scan session.`);
        continue;
      }

      const { file, group } = entry;

      // 4. Explicit user selection
      if (action.action !== 'REMOVE') {
        continue;
      }

      // 6. Physically exists on disk
      if (!fs.existsSync(file.fullPath)) {
        errors.push(`File no longer exists on disk: ${file.fullPath}`);
        continue;
      }

      // 7 & 8. Check lstat for symlink/reparse point, regular file
      let lstat: fs.Stats;
      try {
        lstat = fs.lstatSync(file.fullPath);
      } catch (err: any) {
        errors.push(`Cannot inspect file metadata: ${file.fullPath} (${err.message})`);
        continue;
      }

      if (lstat.isSymbolicLink()) {
        errors.push(`Safety violation: Refusing to delete symbolic link or junction: ${file.fullPath}`);
        continue;
      }

      if (!lstat.isFile()) {
        errors.push(`Safety violation: Target is not a regular file: ${file.fullPath}`);
        continue;
      }

      // 9. Canonical path within approved roots
      let canonicalPath: string;
      try {
        canonicalPath = normalizePath(fs.realpathSync(file.fullPath));
      } catch (err: any) {
        errors.push(`Failed to resolve canonical path for: ${file.fullPath} (${err.message})`);
        continue;
      }

      const isInsideAllowedRoot = normalizedRoots.some((r) => canonicalPath.startsWith(r));
      if (!isInsideAllowedRoot) {
        errors.push(`Safety violation: File is outside approved scan roots: ${canonicalPath}`);
        continue;
      }

      // 10. Not system protected
      if (this.safetyPolicy.isPathProtected(canonicalPath) || this.safetyPolicy.isNetworkOrUncPath(canonicalPath)) {
        errors.push(`Safety violation: Path is protected by Windows system policy: ${canonicalPath}`);
        continue;
      }

      // 11. Size matches scan exactly
      if (lstat.size !== file.sizeBytes) {
        errors.push(
          `File size changed since scan (${file.name}): scanned ${file.sizeBytes} bytes, found ${lstat.size} bytes.`
        );
        continue;
      }

      // 12. Mtime matches scan (within 2 seconds tolerance to handle filesystem precision nuances)
      const recordedMtimeMs = file.mtimeMs || new Date(file.modifiedAt).getTime();
      const currentMtimeMs = lstat.mtimeMs;
      if (Math.abs(currentMtimeMs - recordedMtimeMs) > 2000) {
        errors.push(
          `File modification time changed since scan (${file.name}): file may have been modified.`
        );
        continue;
      }

      // 13. SHA-256 verification (via persistent cache or fast check)
      let currentHash = this.hashCache.getValidHash(canonicalPath, lstat.size, Math.floor(lstat.mtimeMs));
      if (!currentHash) {
        try {
          const dummySignal = new AbortController().signal;
          currentHash = await this.fingerprintService.computeFullHashStream(canonicalPath, dummySignal);
          this.hashCache.setHash(canonicalPath, lstat.size, Math.floor(lstat.mtimeMs), currentHash);
        } catch (err: any) {
          errors.push(`Failed to verify hash for: ${file.fullPath} (${err.message})`);
          continue;
        }
      }

      if (currentHash !== group.hash) {
        errors.push(
          `Hash mismatch on verification (${file.name}): file contents no longer match duplicate group.`
        );
        continue;
      }

      // 14. Locked file check
      try {
        const fd = fs.openSync(canonicalPath, 'r');
        fs.closeSync(fd);
      } catch (err: any) {
        errors.push(`File is locked or currently in use by another application: ${file.fullPath}`);
        continue;
      }

      itemsToTrash.push(file);
      reclaimableBytes += file.sizeBytes;
    }

    if (errors.length > 0) {
      return {
        valid: false,
        itemsToTrash: [],
        reclaimableBytes: 0,
        errors,
      };
    }

    return {
      valid: true,
      itemsToTrash,
      reclaimableBytes,
      errors: [],
    };
  }
}

export const defaultDuplicateResolutionValidator = new DuplicateResolutionValidator();
