# Environment Variables Setup Guide

## Quick Setup

1. Copy the example file:
```bash
cp env.example .env
```

2. Edit `.env` with your configuration:
```bash
nano .env  # or use your preferred editor
```

## Complete Environment Variables

### Server Configuration

```env
# Server port (default: 3000)
PORT=3000

# Node environment (development, production, test)
NODE_ENV=development
```

### Redis Configuration

Required for the job queue system.

```env
# Redis host (default: localhost)
REDIS_HOST=localhost

# Redis port (default: 6379)
REDIS_PORT=6379

# Redis password (optional, leave empty if no password)
REDIS_PASSWORD=
```

**Example for Redis Cloud:**
```env
REDIS_HOST=your-redis-host.redis.cloud.redislabs.com
REDIS_PORT=12345
REDIS_PASSWORD=your-redis-password
```

**Example for Docker Redis:**
```env
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
```

### Storage Configuration

**Supabase is the default and recommended storage provider.**

Choose ONE storage provider: Supabase (recommended) or local (development only).

#### Option 1: Supabase Storage (Recommended - Default)

```env
# Storage provider (default: supabase)
ASSET_STORAGE_PROVIDER=supabase

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
SUPABASE_BUCKET=videos
```

**How to get Supabase credentials:**
1. Go to [supabase.com](https://supabase.com)
2. Create a new project (free tier available)
3. Go to Settings → API
4. Copy Project URL and anon/public key
5. Create a storage bucket named "videos" (or use your preferred name)

**Supabase Storage Setup:**
1. Go to Storage in Supabase dashboard
2. Click "New bucket"
3. Name it "videos" (or your preferred name)
4. Set bucket to **Public** (or configure RLS policies for private access)
5. Update `SUPABASE_BUCKET` in `.env` to match your bucket name

**Storage Policies (Optional):**
If you want private storage, configure Row Level Security (RLS) policies in Supabase:
- Go to Storage → Policies
- Create policies for upload/download as needed

#### Option 2: Local Storage (Development Only)

```env
# Storage provider
ASSET_STORAGE_PROVIDER=local
```

No additional configuration needed. Files will be stored in `./output` directory.

### AI Services (Optional)

```env
# OpenAI API Key (for future AI features)
OPENAI_API_KEY=sk-your-openai-api-key
```

**How to get OpenAI API key:**
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create account or sign in
3. Go to API Keys section
4. Create new secret key
5. Copy the key (starts with `sk-`)

### Directory Configuration

```env
# Output directory for rendered videos (default: ./output)
OUTPUT_DIR=./output

# Temporary directory for job processing (default: ./temp)
TEMP_DIR=./temp
```

### WebSocket Configuration

```env
# WebSocket server port (default: 3001)
WEBSOCKET_PORT=3001
```

## Environment Examples

### Development (Local)

```env
PORT=3000
NODE_ENV=development

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

ASSET_STORAGE_PROVIDER=local

OUTPUT_DIR=./output
TEMP_DIR=./temp
WEBSOCKET_PORT=3001
```

### Production (Supabase)

```env
PORT=3000
NODE_ENV=production

REDIS_HOST=your-redis-host.com
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password

ASSET_STORAGE_PROVIDER=supabase
SUPABASE_URL=https://abcdefghijklmnop.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_BUCKET=videos

OUTPUT_DIR=./output
TEMP_DIR=./temp
WEBSOCKET_PORT=3001
```

## Security Best Practices

1. **Never commit `.env` to git**
   - Already in `.gitignore`
   - Use `.env.example` for documentation

2. **Use environment-specific files**
   ```bash
   .env.development
   .env.production
   .env.staging
   ```

3. **Rotate credentials regularly**
   - Especially AWS keys and Redis passwords

4. **Use secrets management in production**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Kubernetes Secrets
   - Docker Secrets

5. **Limit permissions**
   - AWS IAM: Use least-privilege policies
   - Supabase: Use service role key only in server-side code

6. **Use different Redis passwords**
   - Different passwords for dev/staging/production

## Validation

After setting up `.env`, validate configuration:

```bash
# Check if Redis is accessible
redis-cli -h $REDIS_HOST -p $REDIS_PORT ping

# Test S3 connection (if using S3)
# Use AWS CLI: aws s3 ls s3://$AWS_S3_BUCKET

# Test Supabase connection (if using Supabase)
# Use Supabase dashboard to verify bucket access
```

## Troubleshooting

### Redis Connection Failed

```bash
# Check if Redis is running
redis-cli ping

# Check environment variables
echo $REDIS_HOST
echo $REDIS_PORT

# Test connection manually
redis-cli -h $REDIS_HOST -p $REDIS_PORT ping
```

### Storage Upload Failed

**Supabase:**
- Verify URL and key are correct
- Check bucket exists and is accessible
- Verify bucket name matches `SUPABASE_BUCKET`

### Environment Variables Not Loading

- Ensure `.env` file is in project root
- Check for typos in variable names
- Verify no extra spaces around `=`
- Restart the server after changing `.env`

## Production Deployment

For production, use environment variables from your hosting platform:

### Heroku
```bash
heroku config:set REDIS_HOST=your-host
heroku config:set AWS_ACCESS_KEY_ID=your-key
# etc.
```

### Railway
```bash
railway variables set REDIS_HOST=your-host
railway variables set AWS_ACCESS_KEY_ID=your-key
# etc.
```

### Vercel
Add variables in Vercel dashboard → Project Settings → Environment Variables

### Docker
```bash
docker run -e REDIS_HOST=your-host -e AWS_ACCESS_KEY_ID=your-key ...
```

### Kubernetes
Use ConfigMaps and Secrets:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: video-gen-secrets
data:
  AWS_ACCESS_KEY_ID: <base64-encoded>
  AWS_SECRET_ACCESS_KEY: <base64-encoded>
```

