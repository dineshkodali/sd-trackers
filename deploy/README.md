# Deployment & Infrastructure Guide

This directory contains configuration templates and guides for deploying the **SD Operations Platform** across environments.

## Deployment Options

### 1. Docker & Docker Compose (Recommended for VPS / Dedicated Server)
The application includes a production-ready container definition:
- Root [`Dockerfile`](../Dockerfile): Multi-stage container build compiling frontend assets and hosting the Node.js/Express backend.
- Root [`docker-compose.yml`](../docker-compose.yml): Runs the containerized application on port 3020 with all environment variables.

To start:
```bash
docker-compose up -d --build
```

### 2. Nginx Reverse Proxy with SSL
For hosting behind Nginx with automatic HTTPS / SSL termination:
- Template: [`deploy/nginx.conf.example`](./nginx.conf.example)
- Routes web traffic on port 80/443 directly to the application container or systemd service on `127.0.0.1:3020`.
- Includes WebSocket and Server-Sent Events headers for live database subscriptions and streaming.

### Supabase traffic goes through your domain
The Express server proxies `/supabase/*` (REST, auth, storage and the realtime websocket) to the Supabase project, and the browser client calls `https://<your domain>/supabase` instead of `*.supabase.co`. No extra nginx config is needed beyond the existing `/` block (it already forwards websocket upgrades). Set `VITE_SUPABASE_PROXY=off` to go direct again. On static Amplify hosts there is no server to forward, so `*.amplifyapp.com` stays direct unless you add a `/supabase/<*>` rewrite rule to the Supabase URL and set `VITE_SUPABASE_PROXY=on` (realtime websockets will not work through an Amplify rewrite).

### 3. AWS Amplify Static Hosting
For zero-maintenance static frontend hosting with Direct Client-Side Supabase Mode:
- Configuration: Root [`amplify.yml`](../amplify.yml)
- Full Architecture & Setup Guide: [`docs/AMPLIFY_HOSTING.md`](../docs/AMPLIFY_HOSTING.md)
