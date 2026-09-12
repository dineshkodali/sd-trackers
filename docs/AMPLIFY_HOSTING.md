# AWS Amplify Hosting Guide — SD Operations Platform

This document outlines the step-by-step setup to host the **SD Operations Platform** on **AWS Amplify Hosting**.

---

## 1. Amplify Build Specification (`amplify.yml`)

The repository includes a root [`amplify.yml`](./amplify.yml) file configured for Vite:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci --cache .npm --prefer-offline
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - .npm/**/*
      - node_modules/**/*
```

---

## 2. Connecting to AWS Amplify Console

1. Log in to the [AWS Management Console](https://console.aws.amazon.com/amplify).
2. Click **Create new app** > **Host web app**.
3. Select **GitHub** as your Git provider and click **Next**.
4. Select your repository: `dineshkodali/sd-trackers` and branch: `main`.
5. Under **Build settings**, Amplify will automatically detect the root `amplify.yml`.

---

## 3. Environment Variables (Required in Amplify Console)

In AWS Amplify Console, navigate to:
**App settings** > **Environment variables** > **Manage variables**, and ensure the following are configured:

| Variable Name | Value | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://kxikojvpcyprfbyxsdaa.supabase.co` | Supabase API endpoint (Defaulted in bundle) |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_Gyrx4Cg-tpjkXwitgNrLqA_jp0ZJpDd` | Supabase publishable key (Defaulted in bundle) |
| `VITE_API_URL` | *(Leave empty for Direct Supabase Mode, or set to your external backend URL)* | Express Backend API URL |
| `VITE_AZURE_CLIENT_ID` | `8902bae4-3763-4455-ae7d-8c7c5aac4011` | Azure Entra Client ID |
| `VITE_AZURE_TENANT_ID` | `common` | Azure Tenant ID |
| `VITE_AZURE_REDIRECT_URI` | `https://kxikojvpcyprfbyxsdaa.supabase.co/auth/v1/callback` | Azure OAuth callback |

> **Note**: Vite bakes `VITE_*` variables into the static bundle during `npm run build`. After adding or changing environment variables in Amplify, you must click **Redeploy this version** (or push a new commit) for changes to take effect.

---

## 4. Hosting Architecture & Database Connectivity

### Mode 1: Direct Client-Side Supabase Mode (No Backend Server Needed)
If you are deploying exclusively to **AWS Amplify** without a separate Express server:
1. The web application detects it is running on AWS Amplify and connects **directly to Supabase Cloud** via `@supabase/supabase-js`.
2. All 30 database tables are queried and updated straight from the browser using the Supabase publishable key.
3. **One-time Setup Required**: You must enable Row-Level Security (RLS) policies in Supabase so the browser client is authorized to read and write records:
   - Open your [Supabase Project SQL Editor](https://supabase.com/dashboard/project/kxikojvpcyprfbyxsdaa/sql/new).
   - Copy and paste the contents of [`db/enable-direct-supabase-rls.sql`](./db/enable-direct-supabase-rls.sql).
   - Click **Run**.
   - Your Amplify app is now fully connected to the live database!

---

### Mode 2: Full-Stack Express Backend Mode (With Dedicated Server)
If you host the Express backend container on **AWS App Runner**, **EC2**, **Render**, or a **VPS**:
1. Run the backend using `Dockerfile` or `docker-compose.yml` (or `node dist/server.cjs`).
2. In AWS Amplify Console > **App settings** > **Environment variables**, set:
   - `VITE_API_URL` = `https://api.trackers.sdcdms.co.uk` (or your backend domain)
3. Click **Save** and **Redeploy this version**.

#### Option C: Emergency In-Browser Override (No Redeploy Required)
If your Amplify site is already built and you need to immediately connect it to your backend without waiting for an Amplify rebuild:
1. Open your deployed Amplify webapp in Google Chrome / Edge.
2. Press `F12` to open Developer Tools > **Console**.
3. Run:
   ```js
   localStorage.setItem('sd_api_url', 'https://api.trackers.sdcdms.co.uk'); // or your backend IP/URL
   location.reload();
   ```
4. The client will immediately route all `/api/*` requests to your backend URL!

---

## 5. Custom Domain Setup (`trackers.sdcdms.co.uk`)

1. In Amplify Console, navigate to **App settings** > **Domain management**.
2. Click **Add domain** and enter: `sdcdms.co.uk`.
3. Configure the subdomain: `trackers.sdcdms.co.uk` to point to the `main` branch.
4. Amplify will provide the required **CNAME** records to paste into your DNS provider (Hostinger/Cloudflare).
5. AWS Amplify will automatically provision and renew a free SSL/TLS certificate.
