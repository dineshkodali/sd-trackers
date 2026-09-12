import { chromium } from '@playwright/test';
import * as path from 'path';

async function runTests() {
  console.log('🚀 Starting automated verification of SDTracker Compact Real-Time Status Page...');
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext();
  const page = await context.newPage();

  const testUrls = [
    `file://${path.resolve('status.html')}`,
    `file://${path.resolve('status/index.html')}`
  ];

  for (const url of testUrls) {
    console.log(`\nTesting URL: ${url}`);
    await page.goto(url, { waitUntil: 'load' });

    // 1. Initial All Operational State
    const headline = await page.textContent('#banner-headline');
    console.log('✔ Initial Headline:', headline?.trim());
    if (!headline?.includes('All Systems Operational')) {
      throw new Error(`Expected All Systems Operational, got: ${headline}`);
    }

    const servicesCount = await page.locator('.service-row').count();
    console.log(`✔ Service Rows Rendered: ${servicesCount} (Expected: 8)`);
    if (servicesCount !== 8) throw new Error(`Expected 8 services, found: ${servicesCount}`);

    const telemetryPillars = await page.locator('.pillar-chip').count();
    console.log(`✔ Telemetry Pillars Rendered: ${telemetryPillars} (Expected: 5)`);
    if (telemetryPillars !== 5) throw new Error(`Expected 5 telemetry pillars, found: ${telemetryPillars}`);

    // Check Uptime Tab
    await page.click('button[data-tab="tab-uptime"]');
    const uptimeBarsCount = await page.locator('.uptime-day-bar').count();
    console.log(`✔ Uptime 90-Day Bars: ${uptimeBarsCount} (Expected: 90)`);
    if (uptimeBarsCount !== 90) throw new Error(`Expected 90 bars, found: ${uptimeBarsCount}`);

    // Back to Incidents Tab
    await page.click('button[data-tab="tab-incidents"]');
    const noIncidents = await page.locator('.no-incidents-title').first().textContent();
    console.log('✔ No Incidents Box:', noIncidents?.trim());

    // 2. Simulate Degraded Database (IMMEDIATE REFLECTION)
    await page.evaluate(() => (window as any).demoSimulate('degraded_database'));
    const degradedHeadline = await page.textContent('#banner-headline');
    console.log('✔ Degraded Headline:', degradedHeadline?.trim());
    if (!degradedHeadline?.includes('Partial System Degradation')) {
      throw new Error(`Expected Partial System Degradation, got: ${degradedHeadline}`);
    }
    const dbBadge = await page.locator('.service-row[data-service-id="database"] .service-badge').textContent();
    console.log('✔ Database Badge:', dbBadge?.trim());
    if (!dbBadge?.includes('Degraded Performance')) {
      throw new Error(`Expected Degraded Performance on DB, got: ${dbBadge}`);
    }
    const activeIncidents = await page.locator('.incident-card').count();
    console.log(`✔ Active Incident Cards: ${activeIncidents} (Expected: 1)`);

    // 3. Simulate API Partial Outage
    await page.evaluate(() => (window as any).demoSimulate('api_partial_outage'));
    const apiHeadline = await page.textContent('#banner-headline');
    console.log('✔ API Outage Headline:', apiHeadline?.trim());
    if (!apiHeadline?.includes('Partial System Outage')) {
      throw new Error(`Expected Partial System Outage, got: ${apiHeadline}`);
    }

    // 4. Simulate Major Outage
    await page.evaluate(() => (window as any).demoSimulate('major_outage'));
    const majorHeadline = await page.textContent('#banner-headline');
    console.log('✔ Major Outage Headline:', majorHeadline?.trim());
    if (!majorHeadline?.includes('Major System Outage')) {
      throw new Error(`Expected Major System Outage, got: ${majorHeadline}`);
    }

    // 5. Simulate Maintenance
    await page.evaluate(() => (window as any).demoSimulate('maintenance'));
    const maintHeadline = await page.textContent('#banner-headline');
    console.log('✔ Maintenance Headline:', maintHeadline?.trim());
    if (!maintHeadline?.includes('Under Maintenance')) {
      throw new Error(`Expected Under Maintenance, got: ${maintHeadline}`);
    }

    // 6. Reset to All Operational
    await page.evaluate(() => (window as any).demoSimulate('all_operational'));
    const resetHeadline = await page.textContent('#banner-headline');
    console.log('✔ Reset Headline:', resetHeadline?.trim());
    if (!resetHeadline?.includes('All Systems Operational')) {
      throw new Error(`Expected All Systems Operational after reset, got: ${resetHeadline}`);
    }

    // 7. Test Past Incidents Accordion (under History tab)
    await page.click('button[data-tab="tab-history"]');
    const firstAccordion = page.locator('.past-incident-summary').first();
    await firstAccordion.click();
    const isExpanded = await page.locator('.past-incident-item').first().getAttribute('class');
    console.log('✔ Accordion Open Class:', isExpanded);
    if (!isExpanded?.includes('open')) {
      throw new Error('Accordion did not open on click');
    }
    await firstAccordion.click();
    const isClosed = await page.locator('.past-incident-item').first().getAttribute('class');
    console.log('✔ Accordion Closed Class:', isClosed);
    if (isClosed?.includes('open')) {
      throw new Error('Accordion did not close on second click');
    }

    // 8. Test Subscription Validation (under Subscribe tab)
    await page.click('button[data-tab="tab-subscribe"]');
    await page.fill('#subscribe-email', 'invalid-email-address');
    await page.click('#subscribe-form button[type="submit"]');
    const feedbackError = await page.textContent('#subscribe-feedback');
    console.log('✔ Invalid Email Feedback:', feedbackError?.trim());
    if (!feedbackError?.includes('valid')) {
      throw new Error('Expected validation error for invalid email');
    }

    await page.fill('#subscribe-email', 'ops.manager@sdcommercial.co.uk');
    await page.click('#subscribe-form button[type="submit"]');
    const feedbackSuccess = await page.textContent('#subscribe-feedback');
    console.log('✔ Valid Email Feedback:', feedbackSuccess?.trim());
    if (!feedbackSuccess?.includes('Subscribed')) {
      throw new Error('Expected success feedback for valid email');
    }

    // 9. Mobile Responsiveness Tests
    // Mobile 320px
    await page.setViewportSize({ width: 320, height: 568 });
    const scrollWidth320 = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth320 = await page.evaluate(() => document.documentElement.clientWidth);
    console.log(`✔ Viewport 320px Horizontal Scroll Test: scrollWidth=${scrollWidth320}, clientWidth=${clientWidth320}`);
    if (scrollWidth320 > clientWidth320) {
      const offenders = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('*'))
          .filter(el => el.getBoundingClientRect().right > 320.5)
          .map(el => ({ tag: el.tagName, class: el.className, id: el.id, right: el.getBoundingClientRect().right, scrollWidth: el.scrollWidth }))
          .slice(0, 10);
      });
      console.log('Offenders at 320px:', offenders);
      throw new Error(`Horizontal overflow detected at 320px!`);
    }

    // Mobile 375px
    await page.setViewportSize({ width: 375, height: 812 });
    const scrollWidth375 = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth375 = await page.evaluate(() => document.documentElement.clientWidth);
    console.log(`✔ Viewport 375px Horizontal Scroll Test: scrollWidth=${scrollWidth375}, clientWidth=${clientWidth375}`);
    if (scrollWidth375 > clientWidth375) throw new Error(`Horizontal overflow detected at 375px!`);

    // Tablet 768px
    await page.setViewportSize({ width: 768, height: 1024 });
    const scrollWidth768 = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth768 = await page.evaluate(() => document.documentElement.clientWidth);
    console.log(`✔ Viewport 768px Horizontal Scroll Test: scrollWidth=${scrollWidth768}, clientWidth=${clientWidth768}`);
    if (scrollWidth768 > clientWidth768) throw new Error(`Horizontal overflow detected at 768px!`);

    // Desktop 1440px
    await page.setViewportSize({ width: 1440, height: 900 });
    const scrollWidth1440 = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth1440 = await page.evaluate(() => document.documentElement.clientWidth);
    console.log(`✔ Viewport 1440px Horizontal Scroll Test: scrollWidth=${scrollWidth1440}, clientWidth=${clientWidth1440}`);
    if (scrollWidth1440 > clientWidth1440) throw new Error(`Horizontal overflow detected at 1440px!`);
  }

  await browser.close();
  console.log('\n🎉 ALL REALTIME COMPACT VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
