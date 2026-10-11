const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { SafetyPolicy } = require('../dist/main/scanner/safety/SafetyPolicy.js');
const { normalizePath } = require('../dist/main/scanner/safety/ProtectedPaths.js');

test('SafetyPolicy: Normalizes paths consistently', () => {
  const p1 = 'C:\\Windows\\System32\\';
  const p2 = 'c:/windows/system32';
  assert.strictEqual(normalizePath(p1), normalizePath(p2));
});

test('SafetyPolicy: Correctly identifies protected Windows system directories', () => {
  const policy = new SafetyPolicy([
    'C:\\Windows\\System32',
    'C:\\Windows\\WinSxS',
    'C:\\Program Files',
  ]);

  // Direct match
  assert.strictEqual(policy.isPathProtected('C:\\Windows\\System32'), true);
  assert.strictEqual(policy.isPathProtected('c:\\windows\\system32'), true);

  // Subdirectory match
  assert.strictEqual(policy.isPathProtected('C:\\Windows\\System32\\drivers\\etc\\hosts'), true);
  assert.strictEqual(policy.isPathProtected('C:\\Program Files\\App\\binary.exe'), true);

  // Unprotected user path
  assert.strictEqual(policy.isPathProtected('C:\\Users\\User\\AppData\\Local\\Temp\\test.tmp'), false);
  assert.strictEqual(policy.isPathProtected('C:\\Users\\User\\Downloads\\file.zip'), false);
});

test('SafetyPolicy: Rejects network and UNC paths', () => {
  const policy = new SafetyPolicy();
  assert.strictEqual(policy.isNetworkOrUncPath('\\\\server\\share\\file.txt'), true);
  assert.strictEqual(policy.isNetworkOrUncPath('//network/data'), true);
  assert.strictEqual(policy.isNetworkOrUncPath('C:\\Local\\File.txt'), false);
});

test('SafetyPolicy: Classifies categories according to strict safety rules', () => {
  const policy = new SafetyPolicy(['C:\\Windows\\System32']);

  // SAFE_TO_CLEAN categories
  assert.strictEqual(
    policy.classifyItem('user_temp', 'C:\\Users\\User\\AppData\\Local\\Temp\\1.tmp'),
    'SAFE_TO_CLEAN'
  );
  assert.strictEqual(
    policy.classifyItem('browser_cache', 'C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\Cache\\f_001'),
    'SAFE_TO_CLEAN'
  );
  assert.strictEqual(
    policy.classifyItem('recycle_bin', 'shell:RecycleBinFolder'),
    'SAFE_TO_CLEAN'
  );

  // REVIEW_REQUIRED categories (User files must NEVER be SAFE_TO_CLEAN)
  assert.strictEqual(
    policy.classifyItem('large_files', 'C:\\Users\\User\\Downloads\\setup.iso'),
    'REVIEW_REQUIRED'
  );
  assert.strictEqual(
    policy.classifyItem('old_files', 'C:\\Users\\User\\Documents\\old_report.docx'),
    'REVIEW_REQUIRED'
  );

  // PROTECTED paths always override category
  assert.strictEqual(
    policy.classifyItem('user_temp', 'C:\\Windows\\System32\\temp.tmp'),
    'PROTECTED'
  );
});

test('SafetyPolicy: isCategoryRecoverable only returns true for SAFE_TO_CLEAN', () => {
  const policy = new SafetyPolicy();
  assert.strictEqual(policy.isCategoryRecoverable('user_temp'), true);
  assert.strictEqual(policy.isCategoryRecoverable('windows_temp'), true);
  assert.strictEqual(policy.isCategoryRecoverable('browser_cache'), true);
  assert.strictEqual(policy.isCategoryRecoverable('recycle_bin'), true);

  // Must be false for personal files
  assert.strictEqual(policy.isCategoryRecoverable('large_files'), false);
  assert.strictEqual(policy.isCategoryRecoverable('old_files'), false);
});
