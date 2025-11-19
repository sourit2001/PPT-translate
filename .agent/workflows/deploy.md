---
description: Deploy the application to Fly.io
---

# Deploy to Fly.io

This workflow guides you through deploying the PPT Translate application to Fly.io.

## Prerequisites

1.  **Install Fly CLI**:
    ```bash
    brew install flyctl
    ```

2.  **Login to Fly**:
    ```bash
    fly auth login
    ```

## Deployment Steps

1.  **Initialize App**:
    Run the following command to initialize the app. It will use the existing `infra/fly/fly.toml`.
    ```bash
    fly launch --no-deploy --copy-config --name ppt-translate-demo --region sin --org personal
    ```
    *Note: You may need to change the name if `ppt-translate-demo` is taken.*

2.  **Set Secrets**:
    Set the required environment variables.
    ```bash
    fly secrets set \
      SUPABASE_URL="your_supabase_url" \
      SUPABASE_SERVICE_ROLE_KEY="your_service_role_key" \
      REPLICATE_API_TOKEN="your_replicate_token" \
      SESSION_SECRET="generate_a_long_random_string"
    ```

3.  **Deploy**:
    ```bash
    fly deploy --config infra/fly/fly.toml --dockerfile infra/docker/Dockerfile
    ```

4.  **Verify**:
    Open the deployed app:
    ```bash
    fly open
    ```

## Troubleshooting

-   **Build Failures**: Check the logs with `fly logs`.
-   **Database Issues**: Ensure Supabase credentials are correct.
