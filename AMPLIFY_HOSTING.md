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
**App settings** > **Environment variables** > **Manage variables**, and add:

| Variable Name | Value | Description |
|---|---|---|
| `VITE_API_URL` | `https://api.trackers.sdcdms.co.uk` (or `http://YOUR_VPS_IP:3020`) | *(Recommended)* Backend Express API URL |
| `VITE_SUPABASE_URL` | `https://kxikojvpcyprfbyxsdaa.supabase.co` | Supabase API endpoint |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_Gyrx4Cg-tpjkXwitgNrLqA_jp0ZJpDd` | Supabase publishable key |
| `VITE_AZURE_CLIENT_ID` | `8902bae4-3763-4455-ae7d-8c7c5aac4011` | Azure Entra Client ID |
| `VITE_AZURE_TENANT_ID` | `common` | Azure Tenant ID |
| `VITE_AZURE_REDIRECT_URI` | `https://kxikojvpcyprfbyxsdaa.supabase.co/auth/v1/callback` | Azure OAuth callback |

> **Note**: Vite bakes `VITE_*` variables into the static bundle during `npm run build`. After adding or changing environment variables in Amplify, you must click **Redeploy this version** (or push a new commit) for changes to take effect.

---

## 4. Why "Invalid JSON / Authentication Error" Happens on Amplify

AWS Amplify Hosting is a **static web host** (it serves the compiled frontend HTML, JS, CSS from `dist/`). It does **not** run the Node.js Express server (`server/index.ts` / `dist/server.cjs`).

When you attempt to log in:
1. The browser calls `POST /api/auth/login`.
2. Because Amplify only has static files, Amplify's SPA redirect rule intercepts `/api/auth/login` and returns `/index.html` (HTML text starting with `<!DOCTYPE html>`).
3. When the browser tries to parse this HTML web page as JSON, it fails with:
   `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`.

### How to Fix It (Choose Option A or Option B):

#### Option A: Direct Backend URL with `VITE_API_URL` (Recommended)
If your backend Express server is running on your VPS, Docker container, or cloud server (e.g., `https://api.trackers.sdcdms.co.uk` or `http://YOUR_VPS_IP:3020`):

1. Go to AWS Amplify Console > **App settings** > **Environment variables**.
2. Add `VITE_API_URL` = `https://api.trackers.sdcdms.co.uk` (or `http://YOUR_VPS_IP:3020`).
3. Click **Save**.
4. Go to **Build history** and click **Redeploy this version**.
5. Ensure your backend server's `.env` has `ALLOWED_ORIGINS` containing your Amplify URL (e.g., `https://main.xxxx.amplifyapp.com` or `https://trackers.sdcdms.co.uk`).

#### Option B: Reverse-Proxy `/api/*` Through Amplify
If you want the frontend to make requests to `/api/*` on the same domain without CORS:

1. In AWS Amplify Console, navigate to **App settings** > **Rewrites and redirects**.
2. Ensure the order is exactly as follows (**The `/api/<*>` rule MUST be placed FIRST, above the SPA rewrite rule**):

| Order | Source address | Target address | Type |
|---|---|---|---|
| 1 | `/api/<*>` | `http://YOUR_BACKEND_IP:3020/api/<*>` (or `https://api.yourdomain.com/api/<*>`) | `200 (Rewrite)` |
| 2 | `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>` | `/index.html` | `200 (Rewrite)` |

> ⚠️ **Important**: Do **NOT** set the target address of `/api/<*>` to the Amplify domain itself (`trackers.sdcdms.co.uk`), because that causes Amplify to route requests right back to its static files! It must point to your external Node.js backend server.

---

## 5. Custom Domain Setup (`trackers.sdcdms.co.uk`)

1. In Amplify Console, navigate to **App settings** > **Domain management**.
2. Click **Add domain** and enter: `sdcdms.co.uk`.
3. Configure the subdomain: `trackers.sdcdms.co.uk` to point to the `main` branch.
4. Amplify will provide the required **CNAME** records to paste into your DNS provider (Hostinger/Cloudflare).
5. AWS Amplify will automatically provision and renew a free SSL/TLS certificate.
