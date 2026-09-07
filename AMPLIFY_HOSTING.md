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
| `VITE_SUPABASE_URL` | `https://kxikojvpcyprfbyxsdaa.supabase.co` | Supabase API endpoint |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_Gyrx4Cg-tpjkXwitgNrLqA_jp0ZJpDd` | Supabase publishable key |
| `VITE_AZURE_CLIENT_ID` | `8902bae4-3763-4455-ae7d-8c7c5aac4011` | Azure Entra Client ID |
| `VITE_AZURE_TENANT_ID` | `common` | Azure Tenant ID |
| `VITE_AZURE_REDIRECT_URI` | `https://kxikojvpcyprfbyxsdaa.supabase.co/auth/v1/callback` | Azure OAuth callback |

> **Note**: Vite bakes `VITE_*` variables into the static bundle during `npm run build`.

---

## 4. Single Page Application (SPA) Routing & Redirects

To prevent `404 Not Found` errors when refreshing pages or navigating to sub-routes, add a rewrite rule:

1. In Amplify Console, navigate to **App settings** > **Rewrites and redirects**.
2. Click **Add rule** (or **Edit**):

| Source address | Target address | Type | Country code |
|---|---|---|---|
| `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>` | `/index.html` | `200 (Rewrite)` | Leave blank |

### (Optional) Reverse-Proxy API to VPS / Backend Server
If your Express API backend runs on your VPS or Docker container, you can route `/api/*` requests through Amplify without CORS:

| Source address | Target address | Type |
|---|---|---|
| `/api/<*>` | `https://trackers.sdcdms.co.uk/api/<*>` (or backend IP) | `200 (Rewrite)` |

*(Place the `/api/<*>` rule above the SPA rewrite rule).*

---

## 5. Custom Domain Setup (`trackers.sdcdms.co.uk`)

1. In Amplify Console, navigate to **App settings** > **Domain management**.
2. Click **Add domain** and enter: `sdcdms.co.uk`.
3. Configure the subdomain: `trackers.sdcdms.co.uk` to point to the `main` branch.
4. Amplify will provide the required **CNAME** records to paste into your DNS provider (Hostinger/Cloudflare).
5. AWS Amplify will automatically provision and renew a free SSL/TLS certificate.
