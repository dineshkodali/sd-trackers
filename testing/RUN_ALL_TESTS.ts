/**
 * SDTracker Master Test Orchestrator — Run All Tests in One Command
 *
 * Executes all application test suites sequentially:
 *   1. Static Analysis & Type Checking (tsc --noEmit)
 *   2. Unit Test Suite (schemaAdapter, legacy migration)
 *   3. Relational Database 31-Page Storage Coverage Audit
 *   4. Automated QA System Report Generator
 *   5. Master User Acceptance Testing (UAT) End-to-End Suite
 *
 * Usage:
 *   npx tsx testing/RUN_ALL_TESTS.ts
 *   npm run test:all
 */

import { exec } from 'child_process';
import path from 'path';

interface SuiteResult {
  name: string;
  command: string;
  passed: boolean;
  durationMs: number;
  outputSnippet?: string;
}

function runCommand(command: string): Promise<{ passed: boolean; durationMs: number; output: string }> {
  const start = Date.now();
  return new Promise(resolve => {
    exec(command, { cwd: process.cwd(), maxBuffer: 25 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({
        passed: !err,
        durationMs: Date.now() - start,
        output: ((stdout || '') + '\n' + (stderr || '')).trim()
      });
    });
  });
}

async function main() {
  console.log('\n========================================================================');
  console.log('       SDTracker Master Testing Engine — Executing All Test Suites       ');
  console.log(`       Start Time: ${new Date().toLocaleString('en-GB')}`);
  console.log('========================================================================\n');

  const suites: Array<{ name: string; command: string }> = [
    {
      name: '1. TypeScript Static Analysis & Type Safety',
      command: 'npx tsc --noEmit'
    },
    {
      name: '2. Unit Test Suite (Schema Adapters & Data Migrations)',
      command: 'npx tsx --test server/schemaAdapter.test.ts src/services/legacyLocalDataMigration.test.ts'
    },
    {
      name: '3. Database Relational Schema & 31-Page Storage Coverage',
      command: 'npx tsx scripts/verify-db-coverage.ts'
    },
    {
      name: '4. QA System Diagnostics & Dated Report Generation',
      command: 'npx tsx scripts/generate-qa-report.ts'
    },
    {
      name: '5. User Acceptance Testing (UAT) Master End-to-End Suite',
      command: 'npx tsx testing/02_TEST_SUITES/uat/uat-master-suite.ts'
    }
  ];

  const results: SuiteResult[] = [];
  const globalStart = Date.now();

  for (const s of suites) {
    process.stdout.write(` Running ${s.name}... `);
    const res = await runCommand(s.command);
    const mark = res.passed ? '✔ PASS' : '✖ FAIL';
    console.log(`${mark} (${(res.durationMs / 1000).toFixed(2)}s)`);

    results.push({
      name: s.name,
      command: s.command,
      passed: res.passed,
      durationMs: res.durationMs,
      outputSnippet: res.passed ? undefined : res.output.slice(-400)
    });
  }

  const globalDuration = Date.now() - globalStart;
  const allPassed = results.every(r => r.passed);

  console.log('\n========================================================================');
  console.log('                     MASTER TEST EXECUTION SUMMARY                      ');
  console.log('========================================================================');
  console.log(`Overall Result:    ${allPassed ? 'ALL TEST SUITES PASSED (100%)' : 'FAILURES DETECTED'}`);
  console.log(`Total Duration:    ${(globalDuration / 1000).toFixed(2)}s\n`);

  console.log('| Test Suite | Result | Duration | Command |');
  console.log('| :--- | :---: | :---: | :--- |');
  results.forEach(r => {
    console.log(`| ${r.name} | **${r.passed ? 'PASS' : 'FAIL'}** | ${(r.durationMs / 1000).toFixed(2)}s | \`${r.command}\` |`);
  });

  console.log('\nGenerated Reports & Dashboards:');
  console.log(' - Live UAT Dashboard:    http://localhost:3020/uat-results.html');
  console.log(' - UAT Standalone HTML:   testing/03_RESULTS_AND_REPORTS/UAT_RESULTS_LATEST.html');
  console.log(' - UAT Raw JSON:          testing/03_RESULTS_AND_REPORTS/UAT_RESULTS_LATEST.json');
  console.log(' - QA System Report:      testing/03_RESULTS_AND_REPORTS/QA_SYSTEM_REPORT_LATEST.html');
  console.log(' - Error Audit Playbook:  testing/04_DEFECTS_AND_REMEDIATION_PLAYBOOK/ERROR_AUDIT_AND_REMEDIATION_REPORT.md');
  console.log('========================================================================\n');

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Master Test Engine Error:', err);
  process.exit(1);
});
