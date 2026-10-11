const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');
const fs = require('fs');

const { ApprovedRoots } = require('../dist/main/cleanup/safety/ApprovedRoots.js');
const { CleanupValidator } = require('../dist/main/cleanup/CleanupValidator.js');
const { HistoryService } = require('../dist/main/cleanup/HistoryService.js');

test('ApprovedRoots: Rejects parent directories and dangerous roots', () => {
  // Root drives must NEVER be approved
  assert.strictEqual(ApprovedRoots.isInsideApprovedRoot('C:\\'), false);
  assert.strictEqual(ApprovedRoots.isInsideApprovedRoot('C:\\Windows'), false);
  assert.strictEqual(ApprovedRoots.isInsideApprovedRoot('C:\\Windows\\System32'), false);
  assert.strictEqual(ApprovedRoots.isInsideApprovedRoot('C:\\Users'), false);
  assert.strictEqual(ApprovedRoots.isInsideApprovedRoot('C:\\Program Files'), false);

  // UNC and network shares must NEVER be approved
  assert.strictEqual(ApprovedRoots.isInsideApprovedRoot('\\\\server\\share\\file.tmp'), false);
  assert.strictEqual(ApprovedRoots.isInsideApprovedRoot('//network/data.tmp'), false);
});

test('ApprovedRoots: Accepts files inside legitimate Windows Temp root', () => {
  const testFileInTemp = path.join(os.tmpdir(), 'CleanUp_Safe_Test_File.tmp');
  assert.strictEqual(ApprovedRoots.isInsideApprovedRoot(testFileInTemp), true);
});

test('CleanupValidator: Rejects disallowed categories (e.g. large_files, old_files)', () => {
  const validator = new CleanupValidator();

  const itemPersonalDoc = {
    id: 'item-personal-doc',
    fullPath: 'C:\\Users\\User\\Documents\\huge_video.mp4',
    name: 'huge_video.mp4',
    category: 'large_files',
    sizeBytes: 1024 * 1024 * 600,
    modifiedAt: new Date().toISOString(),
    riskLevel: 'REVIEW_REQUIRED',
  };

  const validation = validator.validateItemForPlan(itemPersonalDoc);
  assert.strictEqual(validation.valid, false);
  assert.match(validation.reason, /not eligible for cleanup/i);
});

test('CleanupValidator: Rejects paths outside approved boundaries or system files', () => {
  const validator = new CleanupValidator();

  const itemSystemFile = {
    id: 'item-sys',
    fullPath: 'C:\\Windows\\System32\\drivers\\test.sys',
    name: 'test.sys',
    category: 'user_temp', // spoofed category
    sizeBytes: 1024,
    modifiedAt: new Date().toISOString(),
    riskLevel: 'SAFE_TO_CLEAN',
  };

  const validation = validator.validateItemForPlan(itemSystemFile);
  assert.strictEqual(validation.valid, false);
  assert.match(validation.reason, /(protected|boundaries)/i);
});

test('CleanupValidator: Validates safe items inside Temp directory correctly', () => {
  const validator = new CleanupValidator();

  // Create real temporary test file
  const tempFilePath = path.join(os.tmpdir(), `cleanup_val_test_${Date.now()}.tmp`);
  fs.writeFileSync(tempFilePath, 'CleanUp Safety Test Content');
  const stats = fs.statSync(tempFilePath);

  const itemTemp = {
    id: 'item-temp-file',
    fullPath: tempFilePath,
    name: path.basename(tempFilePath),
    category: 'user_temp',
    sizeBytes: stats.size,
    modifiedAt: stats.mtime.toISOString(),
    riskLevel: 'SAFE_TO_CLEAN',
  };

  try {
    // 1. Plan validation
    const planValidation = validator.validateItemForPlan(itemTemp);
    assert.strictEqual(planValidation.valid, true);

    // 2. Immediate pre-deletion atomic validation
    const preDeleteValidation = validator.validateImmediatelyBeforeDeletion(
      tempFilePath,
      stats.size,
      'user_temp'
    );
    assert.strictEqual(preDeleteValidation.canDelete, true);
    assert.strictEqual(preDeleteValidation.skipReason, undefined);
  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
});

test('HistoryService: Persists aggregate audit record without leaking file paths', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup_hist_test_'));
  const service = new HistoryService(tempDir);

  const record = service.recordCleanup({
    cleanupId: 'test-clean-1',
    startedAt: new Date(Date.now() - 1000).toISOString(),
    completedAt: new Date().toISOString(),
    status: 'completed',
    requestedItems: 5,
    deletedItems: 4,
    skippedItems: 1,
    failedItems: 0,
    bytesFreed: 5242880,
    bytesSkipped: 1024,
    bytesFailed: 0,
    categoriesFreed: {
      user_temp: { count: 4, bytes: 5242880 },
    },
    itemResults: [
      {
        itemId: '1',
        name: 'secret_user_file.txt',
        category: 'user_temp',
        sizeBytes: 1024,
        status: 'deleted',
        reason: 'Cleaned',
      },
    ],
  });

  const history = service.getHistory();
  assert.strictEqual(history.length, 1);
  assert.strictEqual(history[0].bytesFreed, 5242880);
  assert.strictEqual(history[0].itemsDeleted, 4);

  // Privacy verification: File path or raw item results must NEVER be saved in history JSON
  const rawJson = fs.readFileSync(path.join(tempDir, 'cleanup_history.json'), 'utf-8');
  assert.strictEqual(rawJson.includes('secret_user_file.txt'), false);
  assert.strictEqual(rawJson.includes('itemResults'), false);

  // Test clearHistory
  service.clearHistory();
  assert.strictEqual(service.getHistory().length, 0);

  // Clean up test dir
  fs.rmSync(tempDir, { recursive: true, force: true });
});
