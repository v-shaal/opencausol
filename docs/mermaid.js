flowchart TB
    subgraph "Clients"
        direction TB
        CLI["CLI/TUI (opencode CLI)"]:::client
        Desktop["Desktop GUI (OpenCode Desktop)"]:::client
        WebConsole["Web Console (Remix SSR)"]:::client
        Website["Official Website (Astro)"]:::client
        JSSDK["JavaScript SDK"]:::client
        GoSDK["Go SDK"]:::client
        VSCode["VSCode Extension"]:::client
        Slack["Slack Integration"]:::client
    end

    subgraph "API Layer & Serverless Functions"
        direction TB
        Auth["Auth Function"]:::api
        LogProcessor["Log Processor Function"]:::api
        MailService["Mail Service"]:::api
    end

    subgraph "Core Business Logic & Data"
        direction TB
        CoreSrc["Core Source (packages/console/core/src)"]:::core
        DrizzleConfig["Drizzle Config"]:::core
        Migrations["Migrations"]:::core
        Database["PostgreSQL / Drizzle ORM"]:::core
    end

    subgraph "Infrastructure Definitions"
        direction TB
        InfraApp["Main App Stack"]:::infra
        InfraConsole["Console Function Stack"]:::infra
        InfraDesktop["Desktop Stack"]:::infra
        InfraStage["Stage Configuration"]:::infra
        SharedResource["Shared Cloud Resources"]:::infra
    end

    subgraph "External Services"
        direction TB
        Stripe["Stripe (Billing)"]:::external
        OAuth["OAuth Providers (GitHub, Discord)"]:::external
        EmailService["SES / Email Service"]:::external
    end

    %% Connections
    CLI -->|calls| Auth
    Desktop -->|calls| Auth
    WebConsole -->|calls| Auth
    Website -->|calls| Auth
    JSSDK -->|calls| Auth
    GoSDK -->|calls| Auth
    VSCode -->|uses SDK| JSSDK
    Slack -->|calls| Auth

    Auth -->|routes to| CoreSrc
    LogProcessor -->|processes logs and routes| CoreSrc
    MailService -->|generates emails| MailService
    CoreSrc -->|configures via| DrizzleConfig
    CoreSrc -->|runs migrations| Migrations
    CoreSrc -->|reads/writes| Database

    CoreSrc -->|billing calls| Stripe
    CoreSrc -->|auth calls| OAuth
    MailService -->|sends via| EmailService

    InfraApp -->|deploys| Auth
    InfraConsole -->|deploys| LogProcessor
    InfraDesktop -->|deploys desktop backend| Auth
    InfraStage -->|configures stage| InfraApp
    SharedResource -->|provides resources| Auth
    SharedResource -->|provides resources| CoreSrc
    SharedResource -->|provides resources| MailService

    %% Click Events
    click CLI "https://github.com/v-shaal/opencausol/tree/dev/packages/opencode"
    click Desktop "https://github.com/v-shaal/opencausol/tree/dev/packages/desktop"
    click WebConsole "https://github.com/v-shaal/opencausol/tree/dev/packages/console/app"
    click Website "https://github.com/v-shaal/opencausol/tree/dev/packages/web"
    click JSSDK "https://github.com/v-shaal/opencausol/tree/dev/packages/sdk/js"
    click GoSDK "https://github.com/v-shaal/opencausol/tree/dev/packages/sdk/go"
    click VSCode "https://github.com/v-shaal/opencausol/tree/dev/sdks/vscode"
    click Slack "https://github.com/v-shaal/opencausol/tree/dev/packages/slack"
    click Auth "https://github.com/v-shaal/opencausol/blob/dev/packages/console/function/src/auth.ts"
    click LogProcessor "https://github.com/v-shaal/opencausol/blob/dev/packages/console/function/src/log-processor.ts"
    click MailService "https://github.com/v-shaal/opencausol/tree/dev/packages/console/mail"
    click CoreSrc "https://github.com/v-shaal/opencausol/tree/dev/packages/console/core/src/"
    click DrizzleConfig "https://github.com/v-shaal/opencausol/blob/dev/packages/console/core/drizzle.config.ts"
    click Migrations "https://github.com/v-shaal/opencausol/tree/dev/packages/console/core/migrations/"
    click SharedResource "https://github.com/v-shaal/opencausol/tree/dev/packages/console/resource"
    click InfraApp "https://github.com/v-shaal/opencausol/blob/dev/infra/app.ts"
    click InfraConsole "https://github.com/v-shaal/opencausol/blob/dev/infra/console.ts"
    click InfraDesktop "https://github.com/v-shaal/opencausol/blob/dev/infra/desktop.ts"
    click InfraStage "https://github.com/v-shaal/opencausol/blob/dev/infra/stage.ts"

    %% Styles
    classDef client fill:#cce5ff,stroke:#66b2ff,color:#003366
    classDef api fill:#d4edda,stroke:#28a745,color:#155724
    classDef core fill:#fff3cd,stroke:#ffcd39,color:#856404
    classDef infra fill:#e2e3e5,stroke:#6c757d,color:#343a40
    classDef external fill:#fff5e6,stroke:#ffcc66,color:#663d00
