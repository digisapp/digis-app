#!/bin/bash

# Digis Platform Monitoring Setup Script
# This script sets up and starts the complete monitoring stack

set -e

echo "🚀 Starting Digis Monitoring Stack..."

# Check if .env.monitoring exists
if [ ! -f .env.monitoring ]; then
    echo "❌ Error: .env.monitoring file not found!"
    echo "Please copy .env.monitoring.example and configure your settings:"
    echo "  cp .env.monitoring.example .env.monitoring"
    exit 1
fi

# Load environment variables
export $(cat .env.monitoring | grep -v '^#' | xargs)

# Check required environment variables
if [ -z "$SUPABASE_PROJECT_REF" ] || [ "$SUPABASE_PROJECT_REF" == "your-project-ref" ]; then
    echo "❌ Error: Please configure SUPABASE_PROJECT_REF in .env.monitoring"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ] || [ "$SUPABASE_SERVICE_ROLE_KEY" == "your-service-role-key" ]; then
    echo "❌ Error: Please configure SUPABASE_SERVICE_ROLE_KEY in .env.monitoring"
    exit 1
fi

# Create necessary directories
echo "📁 Creating monitoring directories..."
mkdir -p monitoring/{prometheus,grafana/{provisioning/{dashboards,datasources},dashboards}}
mkdir -p logs

# Substitute environment variables in Prometheus config
echo "⚙️  Configuring Prometheus..."
envsubst < monitoring/prometheus/prometheus.yml > monitoring/prometheus/prometheus.yml.tmp
mv monitoring/prometheus/prometheus.yml.tmp monitoring/prometheus/prometheus.yml

# Start Docker Compose
echo "🐳 Starting Docker containers..."
docker-compose -f docker-compose.monitoring.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🔍 Checking service health..."

# Check Prometheus
if curl -s http://localhost:9090/-/healthy > /dev/null; then
    echo "✅ Prometheus is healthy"
else
    echo "⚠️  Prometheus might not be ready yet"
fi

# Check Grafana
if curl -s http://localhost:8000/api/health > /dev/null; then
    echo "✅ Grafana is healthy"
else
    echo "⚠️  Grafana might not be ready yet"
fi

# Display access information
echo ""
echo "📊 Monitoring Stack Started Successfully!"
echo "========================================="
echo ""
echo "🔗 Access URLs:"
echo "  - Grafana:    http://localhost:8000"
echo "    Username:   ${GRAFANA_ADMIN_USER:-admin}"
echo "    Password:   ${GRAFANA_ADMIN_PASSWORD:-admin}"
echo ""
echo "  - Prometheus: http://localhost:9090"
echo ""
echo "  - Metrics:    http://localhost:${BACKEND_PORT:-3001}/api/metrics/prometheus"
echo ""
echo "📈 Available Dashboards:"
echo "  1. Supabase Overview"
echo "  2. Database Performance"
echo "  3. API Metrics"
echo "  4. Business Analytics"
echo ""
echo "🛑 To stop monitoring:"
echo "  docker-compose -f docker-compose.monitoring.yml down"
echo ""
echo "📋 To view logs:"
echo "  docker-compose -f docker-compose.monitoring.yml logs -f"
echo ""