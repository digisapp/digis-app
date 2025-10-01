// Redis Adapter Configuration for Socket.io Scalability
// This file shows how to configure Redis adapter for multi-node deployments

const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

// Redis configuration
const REDIS_CONFIG = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
};

// Create Redis clients for pub/sub
const createRedisAdapter = async () => {
  try {
    // Create publisher client
    const pubClient = createClient(REDIS_CONFIG);
    
    // Create subscriber client (must be a duplicate)
    const subClient = pubClient.duplicate();
    
    // Handle Redis errors
    pubClient.on('error', (err) => {
      console.error('Redis Publisher Client Error:', err);
    });
    
    subClient.on('error', (err) => {
      console.error('Redis Subscriber Client Error:', err);
    });
    
    // Connect both clients
    await Promise.all([
      pubClient.connect(),
      subClient.connect()
    ]);
    
    console.log('Redis adapter clients connected successfully');
    
    // Create and return the adapter
    return createAdapter(pubClient, subClient);
  } catch (error) {
    console.error('Failed to create Redis adapter:', error);
    // Return null to fallback to default adapter
    return null;
  }
};

// Enhanced Socket.io initialization with Redis adapter
const initializeSocketWithRedis = async (server, socketConfig) => {
  try {
    // Create Socket.io server
    const io = new Server(server, {
      ...socketConfig,
      // Additional configuration for scaling
      serveClient: false, // Don't serve client files in production
      connectionStateRecovery: {
        // Enable connection state recovery
        maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
        skipMiddlewares: true,
      }
    });
    
    // Try to create Redis adapter
    const redisAdapter = await createRedisAdapter();
    
    if (redisAdapter) {
      io.adapter(redisAdapter);
      console.log('Socket.io configured with Redis adapter for horizontal scaling');
    } else {
      console.warn('Failed to create Redis adapter, using default in-memory adapter');
    }
    
    return io;
  } catch (error) {
    console.error('Failed to initialize Socket.io with Redis:', error);
    throw error;
  }
};

// Example usage in your socket.js file:
/*
// Import the Redis configuration
const { initializeSocketWithRedis } = require('./socket-redis-config');

// In your initializeSocket function, replace the Socket.io initialization with:
const initializeSocket = async (server) => {
  const socketConfig = {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST']
    },
    path: '/socket.io/',
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    allowEIO3: true
  };
  
  // Use Redis-enabled initialization
  io = await initializeSocketWithRedis(server, socketConfig);
  
  // Rest of your socket initialization code...
};
*/

// PM2 ecosystem configuration for clustering
const pm2EcosystemConfig = {
  apps: [{
    name: 'digis-backend',
    script: './api/index.js',
    instances: 'max', // Use all available CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    // Graceful reload
    kill_timeout: 5000,
    listen_timeout: 3000,
    // Auto restart on memory limit
    max_memory_restart: '1G',
    // Monitoring
    instance_var: 'INSTANCE_ID',
    merge_logs: true
  }]
};

// Docker Compose configuration for Redis
const dockerComposeConfig = `
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: digis-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes --requirepass \${REDIS_PASSWORD}
    environment:
      - REDIS_PASSWORD=\${REDIS_PASSWORD}
    networks:
      - digis-network

  backend:
    build: ./backend
    container_name: digis-backend
    restart: unless-stopped
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - REDIS_PASSWORD=\${REDIS_PASSWORD}
    depends_on:
      - redis
    networks:
      - digis-network

volumes:
  redis-data:

networks:
  digis-network:
    driver: bridge
`;

// Instructions for deployment
const deploymentInstructions = `
# Deployment Instructions for Scalable Socket.io with Redis

## 1. Local Development with Redis

### Install Redis locally:
\`\`\`bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis
\`\`\`

### Set environment variable:
\`\`\`bash
export REDIS_URL=redis://localhost:6379
\`\`\`

## 2. Production Deployment with PM2

### Install PM2:
\`\`\`bash
npm install -g pm2
\`\`\`

### Create ecosystem.config.js:
\`\`\`javascript
module.exports = ${JSON.stringify(pm2EcosystemConfig, null, 2)}
\`\`\`

### Start clustered application:
\`\`\`bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
\`\`\`

## 3. Docker Deployment

### Create docker-compose.yml:
\`\`\`yaml
${dockerComposeConfig}
\`\`\`

### Deploy with Docker:
\`\`\`bash
docker-compose up -d
\`\`\`

## 4. Cloud Deployment (Vercel/Railway/Render)

### Add Redis addon or use external service:
- Redis Cloud: https://redis.com/cloud/
- Upstash: https://upstash.com/
- AWS ElastiCache
- DigitalOcean Managed Redis

### Set environment variables:
- REDIS_URL=redis://your-redis-host:6379
- REDIS_PASSWORD=your-redis-password

## 5. Monitoring and Debugging

### Check Redis connection:
\`\`\`bash
redis-cli ping
\`\`\`

### Monitor Socket.io adapter:
\`\`\`javascript
io.of('/').adapter.on('error', (error) => {
  console.error('Redis adapter error:', error);
});
\`\`\`

### PM2 monitoring:
\`\`\`bash
pm2 monit
pm2 logs
\`\`\`
`;

module.exports = {
  createRedisAdapter,
  initializeSocketWithRedis,
  REDIS_CONFIG,
  deploymentInstructions
};