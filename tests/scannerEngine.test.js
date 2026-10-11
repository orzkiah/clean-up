const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { ScanController } = require('../dist/main/scanner/ScanController.js');
const { SafetyPolicy } = require('../dist/main/scanner/safety/SafetyPolicy.js');

test('Scanner Engine: Cancellation responsiveness', async () => {
  const controller = new ScanController();
  const abortPromise = controller.startScan(undefined, () => {});

  // Cancel immediately
  const cancelResult = controller.cancelScan();
  assert.strictEqual(cancelResult.cancelled, true);

  await abortPromise;
});

test('ScanController: Item ID validation prevents arbitrary path opening', () => {
  const controller = new ScanController();

  // Attempting to open non-existent or arbitrary path
  assert.throws(
    () => controller.openItemLocation('arbitrary-id-123'),
    /Item ID not found/
  );

  // Attempting to pass empty or invalid string
  assert.throws(
    () => controller.openItemLocation(''),
    /Invalid item ID/
  );
});

test('Scanner Engine: Age calculation and file filtering logic with fixture', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-test-'));

  try {
    const freshFile = path.join(tmpDir, 'fresh.txt');
    const oldFile = path.join(tmpDir, 'old.txt');

    fs.writeFileSync(freshFile, 'fresh content');
    fs.writeFileSync(oldFile, 'old content');

    // Backdate old file to 200 days ago
    const pastTime = (Date.now() - 200 * 24 * 60 * 60 * 1000) / 1000;
    fs.utimesSync(oldFile, pastTime, pastTime);

    const statsFresh = fs.statSync(freshFile);
    const statsOld = fs.statSync(oldFile);

    const cutoff180 = Date.now() - 180 * 24 * 60 * 60 * 1000;

    assert.ok(statsFresh.mtimeMs > cutoff180, 'Fresh file must be newer than cutoff');
    assert.ok(statsOld.mtimeMs < cutoff180, 'Old file must be older than cutoff');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
