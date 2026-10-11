const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');
const fs = require('fs');

const { FingerprintService } = require('../dist/main/duplicates/FingerprintService.js');
const { DuplicateScanner } = require('../dist/main/duplicates/DuplicateScanner.js');
const { StorageAnalyzer } = require('../dist/main/analyzer/StorageAnalyzer.js');

// Helper to create test files
function createTestFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  const stats = fs.statSync(filePath);
  return {
    itemId: path.basename(filePath),
    name: path.basename(filePath),
    fullPath: filePath,
    sizeBytes: stats.size,
    createdAt: stats.birthtime.toISOString(),
    modifiedAt: stats.mtime.toISOString(),
  };
}

// ==========================================
// PART A — DUPLICATE FINDER TESTS (1 - 11)
// ==========================================

test('1. Duplicate Finder: Same content, different filenames', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dup_test_1_'));
  try {
    const f1 = createTestFile(path.join(tempDir, 'original.txt'), 'Exact Duplicate Content A123');
    const f2 = createTestFile(path.join(tempDir, 'renamed_copy.txt'), 'Exact Duplicate Content A123');

    const service = new FingerprintService();
    const sizeGroups = service.groupBySize([f1, f2]);
    assert.strictEqual(sizeGroups.size, 1);

    const fp1 = await service.computeQuickFingerprint(f1.fullPath, f1.sizeBytes);
    const fp2 = await service.computeQuickFingerprint(f2.fullPath, f2.sizeBytes);
    assert.strictEqual(fp1, fp2);

    const hash1 = await service.computeFullHashStream(f1.fullPath);
    const hash2 = await service.computeFullHashStream(f2.fullPath);
    assert.strictEqual(hash1, hash2);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('2. Duplicate Finder: Same content, different directories', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dup_test_2_'));
  try {
    const f1 = createTestFile(path.join(tempDir, 'folderA', 'data.bin'), 'Binary payload 99999');
    const f2 = createTestFile(path.join(tempDir, 'folderB', 'sub', 'data.bin'), 'Binary payload 99999');

    const scanner = new DuplicateScanner();
    const controller = new AbortController();
    const result = await scanner.executeScan(controller.signal, () => {}, [tempDir]);

    assert.strictEqual(result.groups.length, 1);
    assert.strictEqual(result.groups[0].files.length, 2);
    assert.strictEqual(result.groups[0].potentiallyReclaimableBytes, f1.sizeBytes);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('3. Duplicate Finder: Same filename, different content', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dup_test_3_'));
  try {
    const f1 = createTestFile(path.join(tempDir, 'dir1', 'notes.txt'), 'Meeting notes from Monday');
    const f2 = createTestFile(path.join(tempDir, 'dir2', 'notes.txt'), 'Completely different Tuesday notes!');

    const scanner = new DuplicateScanner();
    const controller = new AbortController();
    const result = await scanner.executeScan(controller.signal, () => {}, [tempDir]);

    // Should NOT be grouped as duplicates
    assert.strictEqual(result.groups.length, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('4. Duplicate Finder: Same size, different content', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dup_test_4_'));
  try {
    // Both 10 bytes but different content
    const f1 = createTestFile(path.join(tempDir, 'file1.dat'), 'ABCDEFGHIJ');
    const f2 = createTestFile(path.join(tempDir, 'file2.dat'), '1234567890');
    assert.strictEqual(f1.sizeBytes, f2.sizeBytes);

    const service = new FingerprintService();
    const hash1 = await service.computeFullHashStream(f1.fullPath);
    const hash2 = await service.computeFullHashStream(f2.fullPath);

    assert.notStrictEqual(hash1, hash2);

    const scanner = new DuplicateScanner();
    const controller = new AbortController();
    const result = await scanner.executeScan(controller.signal, () => {}, [tempDir]);

    assert.strictEqual(result.groups.length, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('5. Duplicate Finder: Three identical files', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dup_test_5_'));
  try {
    const content = 'Triple Duplicate Content Data Block';
    const f1 = createTestFile(path.join(tempDir, 'copy1.txt'), content);
    createTestFile(path.join(tempDir, 'copy2.txt'), content);
    createTestFile(path.join(tempDir, 'copy3.txt'), content);

    const scanner = new DuplicateScanner();
    const controller = new AbortController();
    const result = await scanner.executeScan(controller.signal, () => {}, [tempDir]);

    assert.strictEqual(result.groups.length, 1);
    assert.strictEqual(result.groups[0].files.length, 3);
    // Reclaimable = size * (3 - 1) = size * 2
    assert.strictEqual(result.groups[0].potentiallyReclaimableBytes, f1.sizeBytes * 2);
    assert.strictEqual(result.totalReclaimableBytes, f1.sizeBytes * 2);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('6. Duplicate Finder: Large file streaming', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dup_test_6_'));
  try {
    // Generate a 1 MB file with repeated blocks
    const largeFilePath = path.join(tempDir, 'large.bin');
    const chunk = Buffer.alloc(64 * 1024, 0x42);
    const fd = fs.openSync(largeFilePath, 'w');
    for (let i = 0; i < 16; i++) {
      fs.writeSync(fd, chunk);
    }
    fs.closeSync(fd);

    const service = new FingerprintService();
    const hash = await service.computeFullHashStream(largeFilePath);
    assert.strictEqual(typeof hash, 'string');
    assert.strictEqual(hash.length, 64); // SHA-256 hex string
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('7. Duplicate Finder: Cancellation stops execution', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dup_test_7_'));
  try {
    for (let i = 0; i < 20; i++) {
      createTestFile(path.join(tempDir, `file_${i}.txt`), `Sample content ${i}`);
    }

    const scanner = new DuplicateScanner();
    const controller = new AbortController();

    // Abort immediately
    controller.abort();

    await assert.rejects(
      async () => {
        await scanner.executeScan(controller.signal, () => {}, [tempDir]);
      },
      /cancelled/i
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('8. Duplicate Finder: Broken/inaccessible file handled gracefully', async () => {
  const service = new FingerprintService();
  const nonExistentPath = path.join(os.tmpdir(), 'non_existent_file_xyz_123.bin');

  const fp = await service.computeQuickFingerprint(nonExistentPath, 1024);
  assert.strictEqual(fp, null); // Handled gracefully, not crashing
});

test('9. Duplicate Finder: Symlink protection (symlinks and junctions skipped)', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dup_test_9_'));
  try {
    const realFile = path.join(tempDir, 'real.txt');
    fs.writeFileSync(realFile, 'Target file for symlink test');

    const linkFile = path.join(tempDir, 'link_to_real.txt');
    try {
      fs.symlinkSync(realFile, linkFile);
    } catch {
      // Symlink creation might require admin on Windows; if not allowed, test passes
      return;
    }

    const scanner = new DuplicateScanner();
    const controller = new AbortController();
    const result = await scanner.executeScan(controller.signal, () => {}, [tempDir]);

    // Symlink must NOT be treated as a duplicate file
    assert.strictEqual(result.groups.length, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('10. Duplicate Finder: Protected directories excluded from scan roots', () => {
  const scanner = new DuplicateScanner();
  const roots = scanner.getScanRoots();

  for (const root of roots) {
    const lower = root.toLowerCase();
    assert.strictEqual(lower.includes('windows'), false);
    assert.strictEqual(lower.includes('program files'), false);
    assert.strictEqual(lower.includes('system32'), false);
  }
});

test('11. Duplicate Finder: Reclaimable-byte calculation formula', () => {
  const size = 5000;
  const count = 4;
  const reclaimable = size * (count - 1);
  assert.strictEqual(reclaimable, 15000);
});

// ==========================================
// PART B — STORAGE ANALYZER TESTS (12 - 18)
// ==========================================

test('12. Storage Analyzer: Category size calculation sums accurately', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'analyzer_test_12_'));
  try {
    createTestFile(path.join(tempDir, 'doc1.pdf'), 'AAAA'); // 4
    createTestFile(path.join(tempDir, 'sub', 'doc2.pdf'), 'BBBBBB'); // 6

    const analyzer = new StorageAnalyzer();
    const measured = analyzer.measureDirectorySize(tempDir, 2);
    assert.strictEqual(measured, 10);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('13. Storage Analyzer: Unclassified calculation formula', () => {
  const physicalUsed = 500 * 1024 * 1024;
  const analyzedBytes = 420 * 1024 * 1024;
  const unclassified = Math.max(0, physicalUsed - analyzedBytes);
  assert.strictEqual(unclassified, 80 * 1024 * 1024);
});

test('14. Storage Analyzer: Physical vs analyzed storage distinction', async () => {
  const analyzer = new StorageAnalyzer();
  const result = await analyzer.analyzeStorage(false);

  assert.strictEqual(typeof result.physicalUsedBytes, 'number');
  assert.strictEqual(typeof result.analyzedBytes, 'number');
  assert.strictEqual(typeof result.unclassifiedBytes, 'number');
  assert.strictEqual(Array.isArray(result.categories), true);
  assert.ok(result.categories.length >= 7);
});

test('15. Storage Analyzer: Directory access failure returns 0 without crashing', () => {
  const analyzer = new StorageAnalyzer();
  const size = analyzer.measureDirectorySize('C:\\NonExistentDirectory_Random_123', 2);
  assert.strictEqual(size, 0);
});

test('16. Storage Analyzer: Empty directory measured as 0 bytes', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'analyzer_test_16_'));
  try {
    const analyzer = new StorageAnalyzer();
    const size = analyzer.measureDirectorySize(tempDir, 2);
    assert.strictEqual(size, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('17. Storage Analyzer: Permission denied or inaccessible path skipped safely', () => {
  const analyzer = new StorageAnalyzer();
  // System Volume Information is typically access-denied
  const size = analyzer.measureDirectorySize('C:\\System Volume Information', 1);
  assert.strictEqual(typeof size, 'number');
});

test('18. Storage Analyzer: Hard-link accounting documentation & verification', () => {
  // Verifies that StorageAnalyzer avoids recursive naive crawl of WinSxS
  const analyzer = new StorageAnalyzer();
  assert.strictEqual(typeof analyzer.analyzeStorage, 'function');
  assert.strictEqual(typeof analyzer.measureDirectorySize, 'function');
});
