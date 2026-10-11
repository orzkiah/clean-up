const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

const { HashCacheDatabase } = require('../dist/main/duplicates/cache/HashCacheDatabase.js');
const { DuplicateResolutionValidator } = require('../dist/main/duplicates/resolver/DuplicateResolutionValidator.js');
const { DuplicateResolver } = require('../dist/main/duplicates/resolver/DuplicateResolver.js');
const { DuplicateTrashService } = require('../dist/main/duplicates/resolver/DuplicateTrashService.js');
const { DuplicateScanner } = require('../dist/main/duplicates/DuplicateScanner.js');
const { FingerprintService } = require('../dist/main/duplicates/FingerprintService.js');
const { SafetyPolicy } = require('../dist/main/scanner/safety/SafetyPolicy.js');

function createTestFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  const stats = fs.statSync(filePath);
  const itemId = crypto.createHash('sha256').update(filePath).digest('hex').substring(0, 16);
  return {
    itemId,
    name: path.basename(filePath),
    fullPath: filePath,
    sizeBytes: stats.size,
    createdAt: stats.birthtime.toISOString(),
    modifiedAt: stats.mtime.toISOString(),
    mtimeMs: Math.floor(stats.mtimeMs),
  };
}

// =======================================================
// PART 1: PERSISTENT SQLITE HASH CACHE TESTS (1 - 10)
// =======================================================

test('1. Hash Cache: Stores and retrieves hash for identical file', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache_test_1_'));
  const dbPath = path.join(tempDir, 'cache.db');
  const cache = new HashCacheDatabase(dbPath);

  try {
    const file = createTestFile(path.join(tempDir, 'sample.txt'), 'Hello CleanUp Cache 123');
    const computedHash = 'abc123def456';

    // Store in cache
    cache.setHash(file.fullPath, file.sizeBytes, file.mtimeMs, computedHash);

    // Retrieve
    const retrieved = cache.getValidHash(file.fullPath, file.sizeBytes, file.mtimeMs);
    assert.strictEqual(retrieved, computedHash);
  } finally {
    cache.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('2. Hash Cache: Modifying file content & mtime invalidates cached hash', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache_test_2_'));
  const cache = new HashCacheDatabase(path.join(tempDir, 'cache.db'));

  try {
    const filePath = path.join(tempDir, 'sample.txt');
    const f1 = createTestFile(filePath, 'Initial Content');
    cache.setHash(f1.fullPath, f1.sizeBytes, f1.mtimeMs, 'hash_initial');

    // Wait a brief moment and modify the file
    const futureTime = new Date(Date.now() + 5000);
    fs.writeFileSync(filePath, 'Updated Content');
    fs.utimesSync(filePath, futureTime, futureTime);

    const f2Stats = fs.statSync(filePath);
    const retrieved = cache.getValidHash(filePath, f2Stats.size, Math.floor(f2Stats.mtimeMs));
    assert.strictEqual(retrieved, null, 'Cache must invalidate when mtime/content changes');
  } finally {
    cache.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('3. Hash Cache: Modifying file size invalidates cached hash', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache_test_3_'));
  const cache = new HashCacheDatabase(path.join(tempDir, 'cache.db'));

  try {
    const filePath = path.join(tempDir, 'sample.txt');
    const f1 = createTestFile(filePath, 'Short');
    cache.setHash(f1.fullPath, f1.sizeBytes, f1.mtimeMs, 'hash_short');

    // Query with different size
    const retrieved = cache.getValidHash(filePath, f1.sizeBytes + 10, f1.mtimeMs);
    assert.strictEqual(retrieved, null, 'Cache must invalidate when size does not match');
  } finally {
    cache.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('4. Hash Cache: Deleting file from disk invalidates cached entry and cleans DB', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache_test_4_'));
  const cache = new HashCacheDatabase(path.join(tempDir, 'cache.db'));

  try {
    const filePath = path.join(tempDir, 'temp_file.txt');
    const f1 = createTestFile(filePath, 'Will Be Deleted');
    cache.setHash(filePath, f1.sizeBytes, f1.mtimeMs, 'hash_deleted');

    // Physically delete file
    fs.unlinkSync(filePath);

    // Query cache
    const retrieved = cache.getValidHash(filePath, f1.sizeBytes, f1.mtimeMs);
    assert.strictEqual(retrieved, null, 'Cache must not return hash for non-existent file');

    // Entry should have been purged
    const stats = cache.getStats();
    assert.strictEqual(stats.entryCount, 0);
  } finally {
    cache.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('5. Hash Cache: Closing and reopening SQLite database preserves entries', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache_test_5_'));
  const dbPath = path.join(tempDir, 'cache.db');
  let cache1 = new HashCacheDatabase(dbPath);

  try {
    const filePath = path.join(tempDir, 'persisted.txt');
    const f1 = createTestFile(filePath, 'Persistent Record');
    cache1.setHash(filePath, f1.sizeBytes, f1.mtimeMs, 'hash_persistent_999');
    cache1.close();

    // Reopen database
    const cache2 = new HashCacheDatabase(dbPath);
    try {
      const retrieved = cache2.getValidHash(filePath, f1.sizeBytes, f1.mtimeMs);
      assert.strictEqual(retrieved, 'hash_persistent_999', 'Cached hash must persist across sessions');
    } finally {
      cache2.close();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('6. Hash Cache: Pruning removes entries for non-existent files', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache_test_6_'));
  const cache = new HashCacheDatabase(path.join(tempDir, 'cache.db'));

  try {
    const f1 = createTestFile(path.join(tempDir, 'f1.txt'), 'F1 Content');
    const f2 = createTestFile(path.join(tempDir, 'f2.txt'), 'F2 Content');

    cache.setHash(f1.fullPath, f1.sizeBytes, f1.mtimeMs, 'hash_f1');
    cache.setHash(f2.fullPath, f2.sizeBytes, f2.mtimeMs, 'hash_f2');
    assert.strictEqual(cache.getStats().entryCount, 2);

    // Delete f2 physically
    fs.unlinkSync(f2.fullPath);

    const pruneResult = cache.pruneStaleEntries([tempDir]);
    assert.strictEqual(pruneResult.prunedCount, 1);
    assert.strictEqual(cache.getStats().entryCount, 1);
  } finally {
    cache.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('7. Hash Cache: Pruning removes entries outside allowed roots', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache_test_7_'));
  const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache_test_7_other_'));
  const cache = new HashCacheDatabase(path.join(tempDir, 'cache.db'));

  try {
    const fInside = createTestFile(path.join(tempDir, 'inside.txt'), 'Inside Root');
    const fOutside = createTestFile(path.join(otherDir, 'outside.txt'), 'Outside Root');

    cache.setHash(fInside.fullPath, fInside.sizeBytes, fInside.mtimeMs, 'hash_in');
    cache.setHash(fOutside.fullPath, fOutside.sizeBytes, fOutside.mtimeMs, 'hash_out');
    assert.strictEqual(cache.getStats().entryCount, 2);

    // Prune specifying only tempDir as allowed root
    const pruneResult = cache.pruneStaleEntries([tempDir]);
    assert.strictEqual(pruneResult.prunedCount, 1);
    assert.strictEqual(cache.getStats().entryCount, 1);
  } finally {
    cache.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(otherDir, { recursive: true, force: true });
  }
});

test('8. Hash Cache: Correctly tracks entry count, hits, and misses', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache_test_8_'));
  const cache = new HashCacheDatabase(path.join(tempDir, 'cache.db'));

  try {
    const f1 = createTestFile(path.join(tempDir, 'item.txt'), 'Stats Tracking');

    // Initial miss
    const res1 = cache.getValidHash(f1.fullPath, f1.sizeBytes, f1.mtimeMs);
    assert.strictEqual(res1, null);

    // Add entry
    cache.setHash(f1.fullPath, f1.sizeBytes, f1.mtimeMs, 'hash_stats');

    // Hit
    const res2 = cache.getValidHash(f1.fullPath, f1.sizeBytes, f1.mtimeMs);
    assert.strictEqual(res2, 'hash_stats');

    const stats = cache.getStats();
    assert.strictEqual(stats.entryCount, 1);
    assert.strictEqual(stats.cacheHitsTotal, 1);
    assert.strictEqual(stats.cacheMissesTotal, 1);
    assert.ok(stats.dbSizeBytes > 0);
  } finally {
    cache.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('9. Hash Cache: Clear cache truncates table and resets metrics', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache_test_9_'));
  const cache = new HashCacheDatabase(path.join(tempDir, 'cache.db'));

  try {
    const f1 = createTestFile(path.join(tempDir, 'item.txt'), 'Clear Test');
    cache.setHash(f1.fullPath, f1.sizeBytes, f1.mtimeMs, 'hash_clear');
    cache.getValidHash(f1.fullPath, f1.sizeBytes, f1.mtimeMs);

    cache.clear();
    const stats = cache.getStats();
    assert.strictEqual(stats.entryCount, 0);
    assert.strictEqual(stats.cacheHitsTotal, 0);
  } finally {
    cache.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('10. Hash Cache: Scanner integration shows cache hits on second pass', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache_test_10_'));
  const dbPath = path.join(tempDir, 'scanner_cache.db');
  const cache = new HashCacheDatabase(dbPath);

  try {
    createTestFile(path.join(tempDir, 'copy1.txt'), 'Identical Content Cache Speedup');
    createTestFile(path.join(tempDir, 'copy2.txt'), 'Identical Content Cache Speedup');

    const scanner = new DuplicateScanner(undefined, undefined, cache);

    // Pass 1: Cold cache
    const res1 = await scanner.executeScan(new AbortController().signal, () => {}, [tempDir]);
    assert.strictEqual(res1.groupsCount, 1);
    assert.strictEqual(res1.cacheHits, 0);
    assert.strictEqual(res1.rehashedCount, 2);

    // Pass 2: Warm cache
    const res2 = await scanner.executeScan(new AbortController().signal, () => {}, [tempDir]);
    assert.strictEqual(res2.groupsCount, 1);
    assert.strictEqual(res2.cacheHits, 2);
    assert.strictEqual(res2.rehashedCount, 0);
  } finally {
    cache.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// =======================================================
// PART 2: DUPLICATE RESOLVER & 15-POINT VALIDATION (11 - 24)
// =======================================================

test('11. Duplicate Resolver: Explicit selection - unselected items default to KEEP', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'res_test_11_'));
  try {
    createTestFile(path.join(tempDir, 'original.txt'), 'Same Data 11');
    createTestFile(path.join(tempDir, 'copy.txt'), 'Same Data 11');

    const scanner = new DuplicateScanner();
    const scanResult = await scanner.executeScan(new AbortController().signal, () => {}, [tempDir]);
    assert.strictEqual(scanResult.groupsCount, 1);

    const copyItem = scanResult.groups[0].files.find((f) => f.name === 'copy.txt');
    assert.ok(copyItem);

    const validator = new DuplicateResolutionValidator();
    // User only marks copy.txt for REMOVE
    const actions = [{ itemId: copyItem.itemId, action: 'REMOVE' }];

    const planResult = await validator.validateActions(scanResult, actions, [tempDir]);
    assert.strictEqual(planResult.valid, true);
    assert.strictEqual(planResult.itemsToTrash.length, 1);
    assert.strictEqual(planResult.itemsToTrash[0].name, 'copy.txt');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('12. Duplicate Resolver: Group integrity - Refuses plan if all copies are marked REMOVE', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'res_test_12_'));
  try {
    createTestFile(path.join(tempDir, 'original.txt'), 'Same Data 12');
    createTestFile(path.join(tempDir, 'copy.txt'), 'Same Data 12');

    const scanner = new DuplicateScanner();
    const scanResult = await scanner.executeScan(new AbortController().signal, () => {}, [tempDir]);
    assert.strictEqual(scanResult.groupsCount, 1);

    const f1 = scanResult.groups[0].files[0];
    const f2 = scanResult.groups[0].files[1];

    const validator = new DuplicateResolutionValidator();
    // User illegally marks BOTH copies for removal
    const actions = [
      { itemId: f1.itemId, action: 'REMOVE' },
      { itemId: f2.itemId, action: 'REMOVE' },
    ];

    const planResult = await validator.validateActions(scanResult, actions, [tempDir]);
    assert.strictEqual(planResult.valid, false);
    assert.ok(planResult.errors.some((e) => e.includes('At least one original copy must be kept')));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('13. Duplicate Resolver: 3 identical copies -> keep 1, remove 2 -> correctly plans removals', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'res_test_13_'));
  try {
    createTestFile(path.join(tempDir, 'copy1.txt'), 'Data 13');
    createTestFile(path.join(tempDir, 'copy2.txt'), 'Data 13');
    createTestFile(path.join(tempDir, 'copy3.txt'), 'Data 13');

    const scanner = new DuplicateScanner();
    const scanResult = await scanner.executeScan(new AbortController().signal, () => {}, [tempDir]);
    assert.strictEqual(scanResult.groupsCount, 1);

    const f1 = scanResult.groups[0].files.find((f) => f.name === 'copy1.txt');
    const f2 = scanResult.groups[0].files.find((f) => f.name === 'copy2.txt');
    const f3 = scanResult.groups[0].files.find((f) => f.name === 'copy3.txt');

    const validator = new DuplicateResolutionValidator();
    const actions = [
      { itemId: f1.itemId, action: 'KEEP' },
      { itemId: f2.itemId, action: 'REMOVE' },
      { itemId: f3.itemId, action: 'REMOVE' },
    ];

    const planResult = await validator.validateActions(scanResult, actions, [tempDir]);
    assert.strictEqual(planResult.valid, true);
    assert.strictEqual(planResult.itemsToTrash.length, 2);
    assert.strictEqual(planResult.reclaimableBytes, f2.sizeBytes + f3.sizeBytes);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('14. Duplicate Resolver: Non-existent file rejection on validation', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'res_test_14_'));
  try {
    createTestFile(path.join(tempDir, 'orig.txt'), 'Data 14');
    createTestFile(path.join(tempDir, 'del.txt'), 'Data 14');

    const scanner = new DuplicateScanner();
    const scanResult = await scanner.executeScan(new AbortController().signal, () => {}, [tempDir]);

    const delItem = scanResult.groups[0].files.find((f) => f.name === 'del.txt');

    // Delete del.txt physically before validation
    fs.unlinkSync(delItem.fullPath);

    const validator = new DuplicateResolutionValidator();
    const actions = [{ itemId: delItem.itemId, action: 'REMOVE' }];

    const planResult = await validator.validateActions(scanResult, actions, [tempDir]);
    assert.strictEqual(planResult.valid, false);
    assert.ok(planResult.errors.some((e) => e.includes('no longer exists on disk')));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('15. Duplicate Resolver: Symlink / Junction rejection', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'res_test_15_'));
  try {
    createTestFile(path.join(tempDir, 'real.txt'), 'Data 15');
    createTestFile(path.join(tempDir, 'copy.txt'), 'Data 15');

    const scanner = new DuplicateScanner();
    const scanResult = await scanner.executeScan(new AbortController().signal, () => {}, [tempDir]);
    assert.strictEqual(scanResult.groupsCount, 1);

    const copyItem = scanResult.groups[0].files.find((f) => f.name === 'copy.txt');
    const symlinkPath = path.join(tempDir, 'link.txt');

    try {
      fs.symlinkSync(copyItem.fullPath, symlinkPath);
    } catch {
      // Symlinks may require elevated permissions on Windows
      return;
    }

    // Point copyItem to the symlink
    copyItem.fullPath = symlinkPath;

    const validator = new DuplicateResolutionValidator();
    const actions = [{ itemId: copyItem.itemId, action: 'REMOVE' }];

    const planResult = await validator.validateActions(scanResult, actions, [tempDir]);
    assert.strictEqual(planResult.valid, false);
    assert.ok(planResult.errors.some((e) => e.includes('symbolic link')));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('16. Duplicate Resolver: Protected system path rejection', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'res_test_16_'));
  try {
    createTestFile(path.join(tempDir, 'orig.txt'), 'Data 16');
    createTestFile(path.join(tempDir, 'copy.txt'), 'Data 16');

    const scanner = new DuplicateScanner();
    const scanResult = await scanner.executeScan(new AbortController().signal, () => {}, [tempDir]);

    const copyItem = scanResult.groups[0].files.find((f) => f.name === 'copy.txt');

    // Policy configured with tempDir protected
    const policy = new SafetyPolicy([tempDir]);
    const validator = new DuplicateResolutionValidator(policy);

    const actions = [{ itemId: copyItem.itemId, action: 'REMOVE' }];
    const planResult = await validator.validateActions(scanResult, actions, [tempDir]);
    assert.strictEqual(planResult.valid, false);
    assert.ok(planResult.errors.some((e) => e.includes('protected by Windows system policy')));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('17. Duplicate Resolver: File size mismatch rejection', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'res_test_17_'));
  try {
    createTestFile(path.join(tempDir, 'orig.txt'), 'Data 17 Initial');
    createTestFile(path.join(tempDir, 'copy.txt'), 'Data 17 Initial');

    const scanner = new DuplicateScanner();
    const scanResult = await scanner.executeScan(new AbortController().signal, () => {}, [tempDir]);

    const copyItem = scanResult.groups[0].files.find((f) => f.name === 'copy.txt');

    // Append extra byte to copy.txt
    fs.appendFileSync(copyItem.fullPath, 'X');

    const validator = new DuplicateResolutionValidator();
    const actions = [{ itemId: copyItem.itemId, action: 'REMOVE' }];
    const planResult = await validator.validateActions(scanResult, actions, [tempDir]);
    assert.strictEqual(planResult.valid, false);
    assert.ok(planResult.errors.some((e) => e.includes('File size changed since scan')));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('18. Duplicate Resolver: File mtime modification rejection', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'res_test_18_'));
  try {
    createTestFile(path.join(tempDir, 'orig.txt'), 'Data 18 Fixed Size');
    createTestFile(path.join(tempDir, 'copy.txt'), 'Data 18 Fixed Size');

    const scanner = new DuplicateScanner();
    const scanResult = await scanner.executeScan(new AbortController().signal, () => {}, [tempDir]);

    const copyItem = scanResult.groups[0].files.find((f) => f.name === 'copy.txt');

    // Update mtime to 10 seconds in the future
    const future = new Date(Date.now() + 10000);
    fs.utimesSync(copyItem.fullPath, future, future);

    const validator = new DuplicateResolutionValidator();
    const actions = [{ itemId: copyItem.itemId, action: 'REMOVE' }];
    const planResult = await validator.validateActions(scanResult, actions, [tempDir]);
    assert.strictEqual(planResult.valid, false);
    assert.ok(planResult.errors.some((e) => e.includes('modification time changed')));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('19. Duplicate Resolver: Hash mismatch rejection when content swapped', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'res_test_19_'));
  const emptyCache = new HashCacheDatabase(path.join(tempDir, 'empty.db'));
  try {
    createTestFile(path.join(tempDir, 'orig.txt'), 'AAAA');
    createTestFile(path.join(tempDir, 'copy.txt'), 'AAAA');

    const scanner = new DuplicateScanner();
    const scanResult = await scanner.executeScan(new AbortController().signal, () => {}, [tempDir]);

    const copyItem = scanResult.groups[0].files.find((f) => f.name === 'copy.txt');

    // Swap content with same byte length (BBBB instead of AAAA) and preserve mtime
    const oldStats = fs.statSync(copyItem.fullPath);
    fs.writeFileSync(copyItem.fullPath, 'BBBB');
    fs.utimesSync(copyItem.fullPath, oldStats.atime, oldStats.mtime);

    const validator = new DuplicateResolutionValidator(undefined, emptyCache);

    const actions = [{ itemId: copyItem.itemId, action: 'REMOVE' }];
    const planResult = await validator.validateActions(scanResult, actions, [tempDir]);
    assert.strictEqual(planResult.valid, false);
    assert.ok(planResult.errors.some((e) => e.includes('Hash mismatch')));
  } finally {
    emptyCache.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('20. Duplicate Resolver: Trashed files are removed from original location into Recycle Bin', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'res_test_20_'));
  try {
    const testFile = path.join(tempDir, 'recycle_me.txt');
    fs.writeFileSync(testFile, 'CleanUp Recycle Bin Test 20');
    assert.ok(fs.existsSync(testFile));

    const result = await DuplicateTrashService.moveToRecycleBin(testFile);
    assert.strictEqual(result.success, true);
    assert.strictEqual(fs.existsSync(testFile), false, 'Original file must no longer exist at path');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('21. Duplicate Resolver: Multi-keep (keeping 2 copies and removing 1) succeeds safely', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'res_test_21_'));
  try {
    createTestFile(path.join(tempDir, 'keep1.txt'), 'MultiKeep Content 21');
    createTestFile(path.join(tempDir, 'keep2.txt'), 'MultiKeep Content 21');
    createTestFile(path.join(tempDir, 'remove3.txt'), 'MultiKeep Content 21');

    const scanner = new DuplicateScanner();
    const scanResult = await scanner.executeScan(new AbortController().signal, () => {}, [tempDir]);
    assert.strictEqual(scanResult.groupsCount, 1);

    const f1 = scanResult.groups[0].files.find((f) => f.name === 'keep1.txt');
    const f2 = scanResult.groups[0].files.find((f) => f.name === 'keep2.txt');
    const f3 = scanResult.groups[0].files.find((f) => f.name === 'remove3.txt');

    const validator = new DuplicateResolutionValidator();
    const actions = [
      { itemId: f1.itemId, action: 'KEEP' },
      { itemId: f2.itemId, action: 'KEEP' },
      { itemId: f3.itemId, action: 'REMOVE' },
    ];

    const planResult = await validator.validateActions(scanResult, actions, [tempDir]);
    assert.strictEqual(planResult.valid, true);
    assert.strictEqual(planResult.itemsToTrash.length, 1);
    assert.strictEqual(planResult.itemsToTrash[0].name, 'remove3.txt');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('22. Duplicate Resolver: Convenience logic - Keep Newest selects latest modified file', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'res_test_22_'));
  try {
    const older = createTestFile(path.join(tempDir, 'older.txt'), 'Date Test');
    const past = new Date(Date.now() - 100000);
    fs.utimesSync(older.fullPath, past, past);

    createTestFile(path.join(tempDir, 'newer.txt'), 'Date Test');

    const scanner = new DuplicateScanner();
    const scanResult = await scanner.executeScan(new AbortController().signal, () => {}, [tempDir]);

    const group = scanResult.groups[0];
    const sorted = [...group.files].sort(
      (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
    );
    assert.strictEqual(sorted[0].name, 'newer.txt');

    // Action plan: Keep newest, remove older
    const actions = [
      { itemId: sorted[0].itemId, action: 'KEEP' },
      { itemId: sorted[1].itemId, action: 'REMOVE' },
    ];

    const validator = new DuplicateResolutionValidator();
    const planResult = await validator.validateActions(scanResult, actions, [tempDir]);
    assert.strictEqual(planResult.valid, true);
    assert.strictEqual(planResult.itemsToTrash[0].name, 'older.txt');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('23. Duplicate Resolver: Convenience logic - Keep Oldest selects earliest modified file', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'res_test_23_'));
  try {
    const older = createTestFile(path.join(tempDir, 'older.txt'), 'Date Test 23');
    const past = new Date(Date.now() - 100000);
    fs.utimesSync(older.fullPath, past, past);

    createTestFile(path.join(tempDir, 'newer.txt'), 'Date Test 23');

    const scanner = new DuplicateScanner();
    const scanResult = await scanner.executeScan(new AbortController().signal, () => {}, [tempDir]);

    const group = scanResult.groups[0];
    const sorted = [...group.files].sort(
      (a, b) => new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime()
    );
    assert.strictEqual(sorted[0].name, 'older.txt');

    // Action plan: Keep oldest, remove newer
    const actions = [
      { itemId: sorted[0].itemId, action: 'KEEP' },
      { itemId: sorted[1].itemId, action: 'REMOVE' },
    ];

    const validator = new DuplicateResolutionValidator();
    const planResult = await validator.validateActions(scanResult, actions, [tempDir]);
    assert.strictEqual(planResult.valid, true);
    assert.strictEqual(planResult.itemsToTrash[0].name, 'newer.txt');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('24. Duplicate Resolver: Cancellation stops execution and marks remaining skipped', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'res_test_24_'));
  try {
    createTestFile(path.join(tempDir, 'f1.txt'), 'Cancel Data');
    createTestFile(path.join(tempDir, 'f2.txt'), 'Cancel Data');

    const scanner = new DuplicateScanner();
    const scanResult = await scanner.executeScan(new AbortController().signal, () => {}, [tempDir]);

    const f1 = scanResult.groups[0].files.find((f) => f.name === 'f1.txt');
    const f2 = scanResult.groups[0].files.find((f) => f.name === 'f2.txt');

    const resolver = new DuplicateResolver();
    const actions = [
      { itemId: f1.itemId, action: 'KEEP' },
      { itemId: f2.itemId, action: 'REMOVE' },
    ];

    const plan = await resolver.preparePlan(scanResult, actions, [tempDir]);

    // Create aborted controller
    const abortController = new AbortController();
    abortController.abort();

    const result = await resolver.executePlan(plan.planId, abortController.signal);
    assert.strictEqual(result.skippedCount, 1);
    assert.strictEqual(result.movedCount, 0);
    assert.ok(fs.existsSync(f2.fullPath), 'Cancelled items must remain intact');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
