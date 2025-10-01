#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function measureReviewPerformance() {
  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false',
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Enable performance measurement
  await context.addInitScript(() => {
    window.__PERF_DATA = {
      renders: [],
      questionTimings: [],
      questionStartTime: null,
      firstQuestionTime: null,
      pageLoadTime: performance.now(),
    };

    // Override React's render tracking if available
    if (window.React && window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) {
      const internals = window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
      const originalRender = internals.ReactCurrentDispatcher.current?.render;
      if (originalRender) {
        internals.ReactCurrentDispatcher.current.render = function (...args) {
          window.__PERF_DATA.renders.push({
            timestamp: performance.now(),
            component: this?.constructor?.name || 'Unknown',
          });
          return originalRender.apply(this, args);
        };
      }
    }

    // Track DOM mutations as a proxy for renders
    const observer = new MutationObserver((mutations) => {
      if (mutations.length > 0) {
        window.__PERF_DATA.renders.push({
          timestamp: performance.now(),
          mutations: mutations.length,
        });
      }
    });

    // Start observing once DOM is ready
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
    }
  });

  console.log('📊 Starting performance measurement...');
  console.log('🌐 Navigating to review page...');

  // Navigate to the review page
  await page.goto('http://localhost:3000', {
    waitUntil: 'networkidle',
  });

  // Wait for the review interface to load
  await page
    .waitForSelector(
      '[data-testid="review-question"], [data-testid="question-display"], .review-question, h2',
      {
        timeout: 10000,
      }
    )
    .catch(() => {
      console.log('⚠️  No questions found, might need to generate some first');
    });

  // Record time to first question
  await page.evaluate(() => {
    window.__PERF_DATA.firstQuestionTime = performance.now() - window.__PERF_DATA.pageLoadTime;
    window.__PERF_DATA.questionStartTime = performance.now();
  });

  const metrics = {
    questionsAnswered: 0,
    timeBetweenQuestions: [],
    renderCounts: [],
    renderDurations: [],
    totalRenders: 0,
    errors: [],
  };

  // Answer 10 questions (or until no more questions)
  for (let i = 0; i < 10; i++) {
    try {
      console.log(`📝 Answering question ${i + 1}...`);

      // Clear render tracking for this question
      await page.evaluate(() => {
        window.__PERF_DATA.renders = [];
        window.__PERF_DATA.questionStartTime = performance.now();
      });

      // Look for answer options
      const answerSelectors = [
        'button[data-testid^="answer-option"]',
        'button:has-text("A)")',
        'button:has-text("B)")',
        'button:has-text("C)")',
        'button:has-text("D)")',
        '[role="radio"]',
        '.answer-option',
      ];

      let answered = false;
      for (const selector of answerSelectors) {
        const buttons = await page.$$(selector);
        if (buttons.length > 0) {
          // Click the first available answer
          await buttons[0].click();
          answered = true;
          break;
        }
      }

      if (!answered) {
        console.log('⚠️  No answer buttons found, skipping question');
        break;
      }

      // Wait a moment for any render updates
      await page.waitForTimeout(100);

      // Submit the answer
      const submitSelectors = [
        'button:has-text("Submit")',
        'button:has-text("Check Answer")',
        'button[type="submit"]',
        'button:has-text("Next")',
      ];

      for (const selector of submitSelectors) {
        const submitBtn = await page.$(selector);
        if (submitBtn) {
          await submitBtn.click();
          break;
        }
      }

      // Wait for feedback or next question
      await page.waitForTimeout(500);

      // Click next/continue if needed
      const nextSelectors = [
        'button:has-text("Next Question")',
        'button:has-text("Continue")',
        'button:has-text("Next")',
      ];

      for (const selector of nextSelectors) {
        const nextBtn = await page.$(selector);
        if (nextBtn && (await nextBtn.isVisible())) {
          await nextBtn.click();
          break;
        }
      }

      // Collect metrics for this question
      const questionMetrics = await page.evaluate(() => {
        const endTime = performance.now();
        const duration = endTime - window.__PERF_DATA.questionStartTime;
        return {
          renders: window.__PERF_DATA.renders.length,
          duration: duration,
          renderTimestamps: window.__PERF_DATA.renders.map((r) => r.timestamp),
        };
      });

      metrics.questionsAnswered++;
      metrics.renderCounts.push(questionMetrics.renders);
      metrics.timeBetweenQuestions.push(questionMetrics.duration);
      metrics.totalRenders += questionMetrics.renders;

      // Calculate render durations if we have timestamps
      if (questionMetrics.renderTimestamps.length > 1) {
        for (let j = 1; j < questionMetrics.renderTimestamps.length; j++) {
          const duration =
            questionMetrics.renderTimestamps[j] - questionMetrics.renderTimestamps[j - 1];
          metrics.renderDurations.push(duration);
        }
      }

      // Wait before next question
      await page.waitForTimeout(200);
    } catch (error) {
      console.error(`❌ Error on question ${i + 1}:`, error.message);
      metrics.errors.push({
        question: i + 1,
        error: error.message,
      });
      // Try to continue with next question
    }
  }

  // Get final performance data
  const perfData = await page.evaluate(() => {
    return {
      firstQuestionTime: window.__PERF_DATA.firstQuestionTime,
      navigationTiming: performance.getEntriesByType('navigation')[0],
      resourceCount: performance.getEntriesByType('resource').length,
    };
  });

  await browser.close();

  // Calculate statistics
  const avgRenderMs =
    metrics.renderDurations.length > 0
      ? metrics.renderDurations.reduce((a, b) => a + b, 0) / metrics.renderDurations.length
      : 0;

  const p95RenderMs =
    metrics.renderDurations.length > 0
      ? metrics.renderDurations.sort((a, b) => a - b)[
          Math.floor(metrics.renderDurations.length * 0.95)
        ]
      : 0;

  const avgTimeBetweenQuestions =
    metrics.timeBetweenQuestions.length > 0
      ? metrics.timeBetweenQuestions.reduce((a, b) => a + b, 0) /
        metrics.timeBetweenQuestions.length
      : 0;

  const avgRendersPerQuestion =
    metrics.questionsAnswered > 0 ? metrics.totalRenders / metrics.questionsAnswered : 0;

  const report = {
    summary: {
      questionsAnswered: metrics.questionsAnswered,
      avgRenderMs: Math.round(avgRenderMs * 100) / 100,
      totalRenders: metrics.totalRenders,
      p95RenderMs: Math.round(p95RenderMs * 100) / 100,
      avgRendersPerQuestion: Math.round(avgRendersPerQuestion * 100) / 100,
      avgTimeBetweenQuestions: Math.round(avgTimeBetweenQuestions),
      timeToFirstQuestion: Math.round(perfData.firstQuestionTime),
    },
    details: {
      renderCounts: metrics.renderCounts,
      timeBetweenQuestions: metrics.timeBetweenQuestions.map((t) => Math.round(t)),
      errors: metrics.errors,
    },
    performance: {
      domContentLoaded: Math.round(perfData.navigationTiming?.domContentLoadedEventEnd),
      pageLoad: Math.round(perfData.navigationTiming?.loadEventEnd),
      resourceCount: perfData.resourceCount,
    },
    timestamp: new Date().toISOString(),
    baseline: {
      expectedRendersPerQuestion: 50,
      expectedTimeBetweenQuestions: 100,
      framebudget: 16,
    },
  };

  // Save report
  const reportPath = path.join(__dirname, '..', 'performance-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  // Print summary
  console.log('\n📊 Performance Report Summary:');
  console.log('================================');
  console.log(`✅ Questions Answered: ${report.summary.questionsAnswered}`);
  console.log(`📈 Total Renders: ${report.summary.totalRenders}`);
  console.log(`📉 Avg Renders/Question: ${report.summary.avgRendersPerQuestion} (baseline: >50)`);
  console.log(`⏱️  Avg Render Duration: ${report.summary.avgRenderMs}ms (frame budget: 16ms)`);
  console.log(`⏱️  P95 Render Duration: ${report.summary.p95RenderMs}ms`);
  console.log(
    `⏱️  Time Between Questions: ${report.summary.avgTimeBetweenQuestions}ms (baseline: >100ms)`
  );
  console.log(`🚀 Time to First Question: ${report.summary.timeToFirstQuestion}ms`);

  if (metrics.errors.length > 0) {
    console.log(`\n⚠️  Errors encountered: ${metrics.errors.length}`);
    metrics.errors.forEach((e) => console.log(`   - Question ${e.question}: ${e.error}`));
  }

  console.log(`\n💾 Full report saved to: ${reportPath}`);

  // Exit with appropriate code
  const meetsBaseline =
    report.summary.avgRendersPerQuestion <= 50 && report.summary.avgTimeBetweenQuestions <= 100;

  if (meetsBaseline) {
    console.log('\n✅ Performance meets or exceeds baseline!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Performance below baseline');
    process.exit(1);
  }
}

// Run the measurement
measureReviewPerformance().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
