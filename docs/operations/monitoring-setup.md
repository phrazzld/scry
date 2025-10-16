# Vercel Monitoring Setup Guide

This guide provides step-by-step instructions for configuring comprehensive monitoring and alerting for the Scry application on Vercel.

## Quick Setup Checklist

- [ ] Configure Vercel Error Monitoring
- [ ] Set up Vercel Performance Monitoring  
- [ ] Configure Vercel Uptime Checks
- [ ] Test all alerts and endpoints

## 1. Error Monitoring (Vercel Monitoring)

### Dashboard Setup
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select the `scry` project
3. Navigate to **Monitoring** tab
4. Click **Configure Alerts**

### Recommended Alert Configurations

#### High Priority Alerts (Immediate Response)
- **New Unique Error**
  - Alert on: First occurrence of new error types
  - Notification: PagerDuty/SMS/Slack (high priority channel)
  - Rationale: New errors often indicate bugs from recent deployments

- **Critical 5xx Server Errors**
  - Threshold: More than 10 events in 5 minutes
  - Error codes: 500, 502, 503, 504
  - Notification: PagerDuty/SMS
  - Rationale: Server errors indicate critical backend failures

#### Medium Priority Alerts
- **Error Rate Spike**
  - Threshold: More than 100 events in 5 minutes
  - Notification: Dedicated Slack channel
  - Rationale: High volume of errors may indicate systemic issues

#### Low Priority Alerts
- **404 Spike Detection**
  - Use anomaly detection rather than fixed threshold
  - Notification: Email or informational Slack
  - Rationale: Sudden 404 spikes may indicate broken links after deployment

### Error Monitoring Coverage
Our application automatically logs errors through:
- NextAuth authentication failures
- API route exceptions
- Database connection issues
- AI service integration errors

## 2. Performance Monitoring (Vercel Analytics)

### Dashboard Setup
1. In Vercel Dashboard → `scry` project
2. Go to **Analytics** tab
3. Enable **Core Web Vitals** tracking

### Key Metrics to Monitor

#### Core Web Vitals (p75 targets)
- **LCP (Largest Contentful Paint)**: < 2.5s
- **INP (Interaction to Next Paint)**: < 200ms  
- **CLS (Cumulative Layout Shift)**: < 0.1

#### Backend Performance
- **TTFB (Time to First Byte)**: < 600ms
- **Function Execution Duration**: Monitor p95/p99 for API routes

#### Custom Performance Endpoints
- `/api/performance?action=health` - System health overview
- `/api/performance?action=metrics` - Detailed performance metrics
- `/api/performance?action=slow` - Slow operation analysis

### Performance Review Schedule
- **Weekly**: Review Core Web Vitals trends
- **Post-deployment**: Check for performance regressions
- **Monthly**: Analyze function execution duration trends

## 3. Uptime Monitoring (Vercel Checks)

### Dashboard Setup
1. In Vercel Dashboard → `scry` project
2. Go to **Checks** tab
3. Click **Add Check**

### Recommended Check Configurations

#### Homepage Health Check
- **URL**: `https://scry-o08qcl16e-moomooskycow.vercel.app/`
- **Method**: GET
- **Frequency**: Every 1 minute
- **Expected Status**: 200
- **Timeout**: 10 seconds

#### API Health Check
- **URL**: `https://scry-o08qcl16e-moomooskycow.vercel.app/api/health`
- **Method**: GET  
- **Frequency**: Every 2 minutes
- **Expected Status**: 200
- **Expected Response**: Contains `"status": "healthy"`
- **Timeout**: 10 seconds

#### Authentication System Check
- **URL**: `https://scry-o08qcl16e-moomooskycow.vercel.app/api/auth/signin`
- **Method**: GET
- **Frequency**: Every 5 minutes
- **Expected Status**: 200
- **Timeout**: 15 seconds

### Health Check Endpoints

#### `/api/health` (Public)
Returns basic system health without authentication:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-10T12:00:00.000Z",
  "uptime": 1234.56,
  "memory": {
    "used": 45,
    "total": 128
  },
  "environment": "production",
  "version": "0.1.0"
}
```

#### `/api/performance?action=health` (Authenticated)
Returns comprehensive health data for internal monitoring.

## 4. Alert Notification Setup

### Recommended Notification Channels

#### High Priority (Immediate Response Required)
- PagerDuty integration
- SMS notifications
- Dedicated Slack channel with @here mentions

#### Medium Priority (Business Hours Response)
- Dedicated monitoring Slack channel
- Email to development team

#### Low Priority (Informational)
- General development Slack channel
- Email summaries

### Slack Integration Setup
1. In Vercel Dashboard → **Integrations**
2. Search for and add **Slack** integration
3. Configure channels for different alert priorities
4. Test notifications with sample alerts

## 5. Testing Your Setup

### Manual Testing Checklist

#### Error Monitoring Test
```bash
# Test 404 error
curl https://scry-o08qcl16e-moomooskycow.vercel.app/nonexistent-page

# Test API error (should be rate limited or return 401)
curl https://scry-o08qcl16e-moomooskycow.vercel.app/api/performance
```

#### Health Check Test
```bash
# Test public health endpoint
curl https://scry-o08qcl16e-moomooskycow.vercel.app/api/health

# Expected response: {"status": "healthy", ...}
```

#### Performance Monitoring Test
- Deploy a test change and monitor Core Web Vitals
- Check that new deployments show in Analytics timeline
- Verify function execution times are being tracked

## 6. Maintenance and Tuning

### Regular Reviews
- **Weekly**: Check alert noise levels and adjust thresholds
- **Monthly**: Review performance trends and set new goals
- **Quarterly**: Audit alert configurations for relevance

### Alert Tuning Guidelines
- **Too many alerts**: Increase thresholds or use anomaly detection
- **Missing critical issues**: Lower thresholds or add new alert types
- **Alert fatigue**: Consolidate similar alerts or adjust priority levels

### Documentation Updates
- Update this guide when adding new endpoints or changing thresholds
- Maintain incident runbooks linked to alert notifications
- Document escalation procedures for different alert types

## 7. Integration with Development Workflow

### Pre-deployment Checks
- Run `pnpm deploy:check` to verify environment readiness
- Monitor performance during staging deployments
- Set up preview environment monitoring for testing

### Post-deployment Monitoring
- Monitor alerts for 30 minutes after production deployment
- Check Core Web Vitals for performance regressions
- Verify all health checks pass

---

## Next Steps

After completing this setup:
1. Test all alert channels with sample notifications
2. Create incident response runbooks
3. Train team members on monitoring dashboards
4. Schedule regular monitoring reviews

## Troubleshooting

### Common Issues
- **Health checks failing**: Verify endpoint URLs and expected responses
- **No alerts received**: Check integration configurations and test channels
- **Too many false positives**: Adjust thresholds or use anomaly detection
- **Missing performance data**: Ensure Analytics is enabled and configured

### Support Resources
- [Vercel Monitoring Documentation](https://vercel.com/docs/monitoring)
- [Vercel Analytics Guide](https://vercel.com/docs/analytics)
- [Vercel Checks Documentation](https://vercel.com/docs/checks)