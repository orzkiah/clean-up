const test = require('node:test');
const assert = require('node:assert/strict');
const { WindowsStorageService } = require('../dist/main/services/windowsStorageService.js');

test('WindowsStorageService queries genuine Windows system drive', async () => {
  const service = new WindowsStorageService();
  const overview = await service.getStorageOverview();

  // 1. Verify overview structure
  assert.ok(overview, 'Overview should not be null');
  assert.ok(Array.isArray(overview.drives), 'drives should be an array');
  assert.ok(overview.drives.length > 0, 'Should detect at least one drive');
  assert.ok(overview.lastUpdated, 'Should include lastUpdated timestamp');

  // 2. Verify system drive detection
  const systemDrive = overview.systemDrive;
  assert.ok(systemDrive, 'System drive must be detected');
  assert.strictEqual(systemDrive.isSystemDrive, true, 'System drive flag must be true');
  assert.strictEqual(typeof systemDrive.id, 'string');
  assert.ok(systemDrive.id.endsWith(':'), 'Drive ID should be a drive letter like C:');

  // 3. Verify real capacity numbers (not zero, not mock)
  assert.ok(systemDrive.totalBytes > 0, 'Total bytes must be greater than zero');
  assert.ok(systemDrive.freeBytes >= 0, 'Free bytes must be >= 0');
  assert.ok(systemDrive.usedBytes > 0, 'Used bytes must be greater than zero');
  assert.strictEqual(
    systemDrive.totalBytes - systemDrive.freeBytes,
    systemDrive.usedBytes,
    'Used bytes calculation must equal total - free'
  );

  // 4. Verify percentage calculation
  assert.ok(systemDrive.usedPercentage >= 0 && systemDrive.usedPercentage <= 100, 'Used percentage must be 0-100');
  const expectedPct = Number(((systemDrive.usedBytes / systemDrive.totalBytes) * 100).toFixed(1));
  assert.strictEqual(systemDrive.usedPercentage, expectedPct, 'Percentage must match calculated value');

  // 5. Verify filesystem and drive type
  assert.ok(systemDrive.fileSystem.length > 0, 'Filesystem must be identified (e.g. NTFS)');
  assert.ok(['fixed', 'removable', 'network'].includes(systemDrive.driveType), 'Drive type must be valid');
});

test('WindowsStorageService getDriveDetails returns matching drive', async () => {
  const service = new WindowsStorageService();
  const overview = await service.getStorageOverview();
  const sysId = overview.systemDrive.id;

  const details = await service.getDriveDetails(sysId);
  assert.ok(details, 'Should return details for system drive');
  assert.strictEqual(details.id, sysId);
  assert.strictEqual(details.totalBytes, overview.systemDrive.totalBytes);
});

test('WindowsStorageService handles non-existent drive gracefully', async () => {
  const service = new WindowsStorageService();
  const details = await service.getDriveDetails('Z:');
  // Should return null without throwing an unhandled exception
  assert.strictEqual(details, null);
});
