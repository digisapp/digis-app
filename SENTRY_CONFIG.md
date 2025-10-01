# Sentry Configuration for Digis

## Project Details

### Organization
- **Org Name**: `digis-gj`
- **Org ID**: `o4510043742994432`

### Backend Project: `digis-backend`
- **Project ID**: `4510043784937472`
- **DSN**: `https://35ffe45701077f19e225f76465b38965@o4510043742994432.ingest.us.sentry.io/4510043775500288`
- **Platform**: Node.js/Express
- **Dashboard URL**: https://digis-gj.sentry.io/projects/digis-backend/

### Frontend Project: `digis-frontend`
- **Project ID**: `4510043876229120`
- **DSN**: `https://39643d408b9ed97b88abb63fb81cfeb6@o4510043742994432.ingest.us.sentry.io/4510043876229120`
- **Platform**: React
- **Dashboard URL**: https://digis-gj.sentry.io/projects/digis-frontend/

## Configuration Files

### Backend
- **Instrumentation**: `/backend/instrument.js`
- **Environment Variable**: `SENTRY_DSN`
- **Test Endpoints**: `/api/sentry-test/*` (development only)

### Frontend
- **Configuration**: `/frontend/src/utils/sentry.js`
- **Environment Variables**:
  - `VITE_SENTRY_DSN`
  - `VITE_SENTRY_ENABLED`
- **Test Component**: `/frontend/src/components/SentryTestButton.js`

## Features Enabled

### Both Projects
- ✅ Error Tracking
- ✅ Performance Monitoring
- ✅ Breadcrumb Tracking
- ✅ Release Tracking
- ✅ Environment Detection

### Backend Specific
- ✅ Database Query Performance
- ✅ API Endpoint Monitoring
- ✅ Stripe Webhook Error Tracking
- ✅ Agora.io Integration Monitoring

### Frontend Specific
- ✅ Session Replay (on errors)
- ✅ Browser Performance Metrics
- ✅ React Error Boundaries
- ✅ Route Navigation Tracking

## Sampling Rates

### Development
- Traces: 100% (all transactions captured)
- Profiles: 100% (all profiles captured)
- Session Replays: 100% on errors

### Production
- Traces: 10% (1 in 10 transactions)
- Profiles: 10% (1 in 10 profiles)
- Session Replays: 100% on errors only

## Privacy & Security

### Filtered/Redacted Data
- Passwords
- API Keys & Tokens
- Credit Card Information
- SSN/Personal IDs
- Authorization Headers
- Cookies
- Supabase Auth Headers

### Ignored Errors
- 404 Not Found
- Validation Errors
- Redis Connection Errors (ECONNREFUSED)
- Browser Extension Errors
- ResizeObserver Warnings

## Testing

### Backend Test Commands
```bash
# Test error tracking
curl http://localhost:3001/api/sentry-test/test-error

# Test message logging
curl http://localhost:3001/api/sentry-test/test-message

# Test performance monitoring
curl http://localhost:3001/api/sentry-test/test-performance

# Test with breadcrumbs
curl http://localhost:3001/api/sentry-test/test-breadcrumbs
```

### Frontend Test
1. Start development server
2. Look for "Sentry Test" button (bottom-right)
3. Click buttons to test various scenarios

## Monitoring Best Practices

### Alerts to Configure
1. **Error Rate Alert**: Trigger when error rate > 5% in 5 minutes
2. **New Error Alert**: Notify on first occurrence of new error type
3. **Performance Alert**: Trigger when P95 latency > 3 seconds
4. **Payment Error Alert**: Immediate notification for Stripe errors
5. **Video Call Alert**: Notify on Agora.io connection failures

### Key Metrics to Track
- **Apdex Score**: Target > 0.9
- **Crash Free Rate**: Target > 99.5%
- **P95 Response Time**: Target < 1 second
- **Error Rate**: Target < 1%

## Maintenance

### Monthly Tasks
- Review and resolve top errors
- Check performance regression trends
- Update sampling rates if needed
- Archive resolved issues

### Before Major Releases
- Create release in Sentry
- Tag deployment with version
- Monitor error spike after deployment
- Set up release health tracking

## Support & Resources

- [Sentry Documentation](https://docs.sentry.io/)
- [Node.js SDK Guide](https://docs.sentry.io/platforms/node/)
- [React SDK Guide](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Session Replay](https://docs.sentry.io/product/session-replay/)

## Troubleshooting

### Events Not Appearing?
1. Check DSN is correct
2. Verify environment variables are loaded
3. Check console for Sentry initialization message
4. Ensure `NODE_ENV` is not 'test'
5. Check network tab for Sentry requests to ingest endpoint

### Too Many Events?
- Reduce `tracesSampleRate` in production
- Add more errors to ignore list
- Use `beforeSend` to filter events
- Implement rate limiting on error logging

### Session Replay Issues?
- Check browser compatibility
- Verify privacy settings allow recording
- Check replay sampling rate
- Ensure sufficient quota available

## Contact

For Sentry-specific issues:
- Organization: digis-gj
- Projects: digis-backend, digis-frontend
- Support: https://sentry.io/support/