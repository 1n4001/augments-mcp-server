# Railway Deployment Guide for Augments MCP Server

This guide provides step-by-step instructions for deploying the Augments MCP Server to Railway with production-grade security, scalability, and monitoring.

## 🚀 Quick Start

### Prerequisites
- Railway account (sign up at [railway.app](https://railway.app))
- GitHub account (for automatic deployments)
- Redis instance (Railway provides this)
- Domain configured (mcp.augments.dev)

### Deployment Steps

1. **Fork/Clone Repository**
   ```bash
   git clone https://github.com/yourusername/augments-mcp-server.git
   cd augments-mcp-server
   git checkout web-hosting-refactor
   ```

2. **Create Railway Project**
   - Go to [Railway Dashboard](https://railway.app/dashboard)
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your forked repository

3. **Add Redis Service**
   - In your Railway project, click "New Service"
   - Select "Database" → "Add Redis"
   - Note the `REDIS_URL` for later configuration

4. **Configure Environment Variables**
   In Railway project settings, add these environment variables:

   ```env
   # Required
   PORT=8080
   ENV=production
   REDIS_URL=${{Redis.REDIS_URL}}  # Railway will auto-link this
   
   # Security
   MASTER_API_KEY=your-secure-master-api-key-here
   
   # GitHub API (for higher rate limits)
   GITHUB_TOKEN=your-github-personal-access-token
   
   # Performance
   WORKERS=4
   CACHE_TTL=3600
   AUGMENTS_CACHE_DIR=/app/cache
   
   # Monitoring
   LOG_LEVEL=INFO
   ```

5. **Deploy**
   - Railway will automatically deploy when you push to your repository
   - Monitor deployment in the Railway dashboard
   - Check logs for any issues

## 💰 Railway Pricing Recommendations

### For 1M Users/Month Scale

**Recommended Plan: Pro ($20/month)**

#### Resource Allocation:
- **Compute**: 2 vCPU, 4GB RAM per instance
- **Replicas**: 2-3 instances for high availability
- **Redis**: 512MB (sufficient for rate limiting and caching metadata)
- **Bandwidth**: ~100GB/month included

#### Cost Breakdown:
- Base Plan: $20/month
- Additional Resources: ~$30-50/month
- **Total Estimated Cost**: $50-70/month

#### Why This Plan:
1. **Horizontal Scaling**: Can handle 1M+ requests with multiple replicas
2. **Auto-scaling**: Railway supports automatic scaling based on load
3. **High Availability**: Multiple instances ensure no downtime
4. **Included Features**: SSL, DDoS protection, monitoring

### Starting Small (Hobby Plan - $5/month)
Perfect for testing and initial launch:
- 1 vCPU, 512MB RAM
- Can handle ~100K requests/month
- Upgrade as you grow

## 🔒 Security Configuration

### 1. API Key Management

The server implements tiered API access:

```python
# Demo tier (rate limited)
curl -H "X-API-Key: demo_test123" https://mcp.augments.dev/api/v1/frameworks

# Premium tier (10x rate limits)
curl -H "X-API-Key: $MASTER_API_KEY" https://mcp.augments.dev/api/v1/frameworks
```

### 2. Rate Limiting

Default limits per tier:
- **Demo**: 100 requests/minute, 1000/hour
- **Premium**: 1000 requests/minute, 10000/hour
- **Per-IP**: Additional IP-based limiting via Redis

### 3. Security Headers

Automatically configured:
- CORS (restricted to augments.dev domains)
- Trusted Host validation
- Request ID tracking
- Process time headers

## 📊 Monitoring & Observability

### Prometheus Metrics Endpoint
```bash
curl https://mcp.augments.dev/metrics
```

Key metrics:
- `api_requests_total`: Request count by endpoint
- `api_request_duration_seconds`: Response time histogram
- `rate_limit_exceeded_total`: Rate limit violations

### Health Checks
```bash
# Basic health
curl https://mcp.augments.dev/health

# Detailed component health
curl -H "X-API-Key: demo_test" https://mcp.augments.dev/health/detailed
```

### Railway Monitoring
- View logs: `railway logs`
- Monitor metrics in Railway dashboard
- Set up alerts for high CPU/memory usage

## 🔧 Custom Domain Setup

1. **Add Domain in Railway**
   - Go to project settings → Domains
   - Add `mcp.augments.dev`
   - Railway provides CNAME record

2. **Configure DNS**
   - Add CNAME record pointing to Railway domain
   - Enable Railway's automatic SSL

3. **Verify SSL**
   - Railway automatically provisions Let's Encrypt SSL
   - Force HTTPS in Railway settings

## 📈 Scaling Strategy

### Vertical Scaling
1. Increase instance resources in Railway dashboard
2. Adjust `WORKERS` environment variable
3. Monitor performance metrics

### Horizontal Scaling
1. Increase replica count in Railway
2. Redis handles shared rate limiting
3. Load balancing handled automatically

### Caching Strategy
- In-memory cache for hot data
- Disk cache for persistent storage
- Redis for distributed rate limiting
- CDN for static documentation (future enhancement)

## 🚨 Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Reduce `WORKERS` count
   - Decrease cache size
   - Enable memory profiling

2. **Slow Response Times**
   - Check GitHub API rate limits
   - Increase Redis memory
   - Enable query result caching

3. **Rate Limit Issues**
   - Verify Redis connection
   - Check rate limit configuration
   - Monitor rate limit metrics

### Debug Mode
For development/debugging:
```env
DEBUG=true
LOG_LEVEL=DEBUG
```

## 🔄 CI/CD Pipeline

### GitHub Actions (Optional)
Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Railway

on:
  push:
    branches: [main, web-hosting-refactor]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Railway
        run: npm i -g @railway/cli
      
      - name: Deploy
        run: railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

### Railway Auto-Deploy
- Enable auto-deploy in Railway project settings
- Set branch to `web-hosting-refactor` or `main`
- Configure deployment triggers

## 📝 API Documentation

Once deployed, access:
- Interactive docs: `https://mcp.augments.dev/docs`
- ReDoc: `https://mcp.augments.dev/redoc`
- OpenAPI schema: `https://mcp.augments.dev/openapi.json`

## 🔐 Production Checklist

- [ ] Set strong `MASTER_API_KEY`
- [ ] Configure GitHub token for API access
- [ ] Set up monitoring alerts
- [ ] Enable automatic backups
- [ ] Configure custom domain with SSL
- [ ] Test rate limiting
- [ ] Verify health checks
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Document API keys for users
- [ ] Create runbook for incidents

## 💡 Cost Optimization Tips

1. **Cache Aggressively**
   - Increase `CACHE_TTL` for stable content
   - Use CDN for documentation (future)

2. **Optimize Container**
   - Multi-stage Docker build
   - Minimal base image
   - Remove dev dependencies

3. **Monitor Usage**
   - Track most requested frameworks
   - Identify heavy users
   - Optimize slow queries

4. **Resource Limits**
   - Set memory limits
   - Configure CPU throttling
   - Auto-scale based on metrics

## 🆘 Support

- Railway Support: [railway.app/help](https://railway.app/help)
- Railway Status: [status.railway.app](https://status.railway.app)
- Project Issues: [GitHub Issues](https://github.com/yourusername/augments-mcp-server/issues)

---

Remember to test thoroughly in staging before promoting to production!