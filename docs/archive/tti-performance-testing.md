# TTI (Time to Interactive) Performance Testing

## Overview

Time to Interactive (TTI) is a critical performance metric that measures when a page becomes fully interactive. A page is considered fully interactive when:
- The page has displayed useful content (measured by First Contentful Paint)
- Event handlers are registered for most visible page elements
- The page responds to user interactions within 50ms

## Why TTI Matters for Card Removal

The removal of Card components from quiz flow states should improve TTI by:
1. **Reducing DOM Complexity**: Fewer wrapper elements = faster parsing
2. **Smaller Bundle Size**: Less JavaScript to parse and execute
3. **Simplified Render Tree**: Shallower component hierarchy = faster reconciliation
4. **Reduced Layout Calculations**: Simpler CSS = faster style computation

## Quick Testing Methods

### Method 1: Chrome DevTools (Manual)
1. Open Chrome DevTools (F12)
2. Go to Lighthouse tab
3. Configure:
   - Mode: Navigation
   - Device: Desktop
   - Categories: Performance only
4. Click "Analyze page load"
5. Look for "Time to Interactive" in the metrics

### Method 2: Command Line (Automated)
```bash
# Install Lighthouse globally
npm install -g lighthouse

# Run test on quiz page
lighthouse http://localhost:3000/quiz-mode --view

# Run with specific metrics only
lighthouse http://localhost:3000/quiz-mode \
  --only-categories=performance \
  --output=json \
  --output-path=./tti-results.json
```

### Method 3: Using Our Test Script
```bash
# Run the automated TTI test suite
node scripts/lighthouse-tti-test.js

# Or with Node ES modules
node --input-type=module scripts/lighthouse-tti-test.js
```

## Expected Improvements

### Before Card Removal (Baseline)
Typical metrics with Card components:
- **TTI**: 2.5-3.5 seconds
- **FCP**: 1.2-1.5 seconds
- **LCP**: 1.8-2.2 seconds
- **TBT**: 200-400ms
- **DOM Nodes**: 800-1000
- **JS Bundle**: ~280KB

### After Card Removal (Target)
Expected improvements without Card wrappers:
- **TTI**: 2.0-2.8 seconds (20-30% improvement)
- **FCP**: 1.0-1.3 seconds (15-20% improvement)
- **LCP**: 1.5-1.9 seconds (15-20% improvement)
- **TBT**: 150-300ms (25% improvement)
- **DOM Nodes**: 600-800 (20-25% reduction)
- **JS Bundle**: ~275KB (2% reduction)

## Detailed Testing Process

### 1. Preparation
```bash
# Ensure clean build
rm -rf .next
pnpm build

# Start production server
pnpm start

# Or for development comparison
pnpm dev
```

### 2. Baseline Measurement
Before making changes, capture baseline metrics:
```bash
# Checkout version with Cards
git checkout main

# Build and start
pnpm build && pnpm start

# Run baseline test
lighthouse http://localhost:3000/quiz-mode \
  --output=json \
  --output-path=./baseline-tti.json
```

### 3. Test After Changes
```bash
# Checkout Card removal branch
git checkout refactor/remove-card-components

# Build and start
pnpm build && pnpm start

# Run improvement test
lighthouse http://localhost:3000/quiz-mode \
  --output=json \
  --output-path=./improved-tti.json
```

### 4. Compare Results
```javascript
// compare-tti.js
const baseline = require('./baseline-tti.json');
const improved = require('./improved-tti.json');

const baselineTTI = baseline.audits.interactive.numericValue;
const improvedTTI = improved.audits.interactive.numericValue;

const improvement = ((baselineTTI - improvedTTI) / baselineTTI * 100).toFixed(1);
console.log(`TTI Improvement: ${improvement}%`);
console.log(`Baseline: ${(baselineTTI/1000).toFixed(2)}s`);
console.log(`Improved: ${(improvedTTI/1000).toFixed(2)}s`);
```

## Factors Affecting TTI

### Positive Factors (Should Improve with Card Removal)
- ✅ **DOM Size**: Fewer elements to parse
- ✅ **CSS Complexity**: Simpler selectors, fewer rules
- ✅ **JavaScript Execution**: Less component initialization
- ✅ **Memory Usage**: Fewer objects in memory
- ✅ **Paint Complexity**: Simpler layer tree

### Neutral Factors (No Change Expected)
- ➖ **Network Requests**: Same API calls
- ➖ **Image Loading**: Same assets
- ➖ **Font Loading**: Same typography
- ➖ **Third-party Scripts**: Same analytics/monitoring

### Testing Conditions

For consistent results, always test under similar conditions:

1. **Network**: Use consistent throttling (Fast 3G or No throttling)
2. **CPU**: Use consistent CPU throttling (4x slowdown or none)
3. **Cache**: Clear cache between test runs for consistency
4. **Extensions**: Disable browser extensions
5. **Background Processes**: Close unnecessary applications

## Monitoring TTI in Production

### Real User Monitoring (RUM)
```javascript
// Add to app layout or _document
if (typeof window !== 'undefined') {
  // Measure TTI using PerformanceObserver
  new PerformanceObserver((entryList) => {
    for (const entry of entryList.getEntries()) {
      if (entry.name === 'first-input') {
        const tti = entry.processingStart - entry.startTime;

        // Send to analytics
        if (window.gtag) {
          window.gtag('event', 'timing_complete', {
            name: 'time_to_interactive',
            value: Math.round(tti),
          });
        }
      }
    }
  }).observe({ entryTypes: ['first-input'] });
}
```

### Web Vitals Library
```javascript
import { getTTFB, getFCP, getLCP, getFID, getCLS, getINP } from 'web-vitals';

// Track all metrics including TTI approximation
getTTFB(console.log);
getFCP(console.log);
getLCP(console.log);
getFID(console.log);  // First Input Delay (related to TTI)
getCLS(console.log);
getINP(console.log);  // Interaction to Next Paint
```

## Optimization Checklist

If TTI doesn't improve as expected, check:

- [ ] **Bundle Splitting**: Are quiz components lazy loaded?
- [ ] **Code Splitting**: Is route-based splitting working?
- [ ] **Tree Shaking**: Are unused Card exports eliminated?
- [ ] **CSS-in-JS**: Is styled-components/emotion causing overhead?
- [ ] **Polyfills**: Are unnecessary polyfills loading?
- [ ] **Development Mode**: Testing in production build?
- [ ] **Source Maps**: Disabled in production?
- [ ] **Console Logs**: Removed in production?

## Automated CI Testing

Add to GitHub Actions:
```yaml
name: Performance Testing
on: [pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm build
      - run: pnpm start &
      - run: npx wait-on http://localhost:3000
      - run: |
          npx lighthouse http://localhost:3000/quiz-mode \
            --output=json \
            --output-path=./lighthouse-results.json \
            --chrome-flags="--headless"
      - name: Check TTI threshold
        run: |
          TTI=$(jq '.audits.interactive.numericValue' lighthouse-results.json)
          if (( $(echo "$TTI > 3000" | bc -l) )); then
            echo "TTI regression detected: ${TTI}ms > 3000ms"
            exit 1
          fi
```

## Reporting Results

When documenting TTI improvements, include:

1. **Test Environment**:
   - Browser version
   - Device specs
   - Network conditions
   - Build type (dev/production)

2. **Metrics Captured**:
   - TTI before/after
   - Other Core Web Vitals
   - Performance score
   - Number of test runs

3. **Visual Evidence**:
   - Lighthouse report screenshots
   - Performance timeline
   - Network waterfall

## Summary

The Card removal refactor should yield measurable TTI improvements:
- **Target**: 20-30% reduction in TTI
- **Method**: Automated Lighthouse testing
- **Validation**: Multiple test runs for consistency
- **Success Criteria**: TTI < 2.5s on desktop, < 4s on mobile

---

*Last Updated: 2025-09-24*