mod auth;
mod error;
mod handlers;
mod models;

use std::{net::SocketAddr, path::Path, str::FromStr};

use anyhow::Context;
use axum::{
    http::Method,
    middleware,
    routing::{get, patch, post},
    Router,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use clap::{Args, Parser, Subcommand};
use rand::{rngs::OsRng, RngCore};
use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions},
    SqlitePool,
};
use tokio::net::TcpListener;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

use crate::{
    auth::hash_token,
    handlers::{
        calendar, catalog_prices, create_billing_channel, create_payment, create_subscription,
        delete_subscription, export_data, get_me, get_subscription, health, import_data,
        list_billing_channels, list_payments, list_subscriptions, overview,
        search_catalog_services, update_billing_channel, update_me, update_payment,
        update_subscription,
    },
};

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
}

#[derive(Debug, Parser)]
#[command(name = "xuqi-backend", version, about = "续期订阅管理器 API")]
struct Cli {
    #[arg(long, env = "DATABASE_URL", default_value = "sqlite://data/xuqi.db")]
    database_url: String,
    #[arg(long, env = "BIND_ADDR", default_value = "127.0.0.1:3000")]
    bind_addr: String,
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Debug, Subcommand)]
enum Command {
    Serve,
    CreateUser(CreateUserArgs),
    RotateToken(RotateTokenArgs),
}

#[derive(Debug, Args)]
struct CreateUserArgs {
    #[arg(long)]
    name: String,
    #[arg(long, default_value = "Asia/Shanghai")]
    timezone: String,
    #[arg(long, default_value = "CN")]
    region: String,
    #[arg(long, default_value = "CNY")]
    currency: String,
}

#[derive(Debug, Args)]
struct RotateTokenArgs {
    #[arg(long)]
    user_id: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    init_tracing();

    let cli = Cli::parse();
    let pool = connect_database(&cli.database_url).await?;
    let state = AppState { pool };

    match cli.command.unwrap_or(Command::Serve) {
        Command::Serve => serve(state, &cli.bind_addr).await?,
        Command::CreateUser(args) => create_user(&state, args).await?,
        Command::RotateToken(args) => rotate_token(&state, args).await?,
    }

    Ok(())
}

fn init_tracing() {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
    tracing_subscriber::registry()
        .with(filter)
        .with(tracing_subscriber::fmt::layer())
        .init();
}

async fn connect_database(database_url: &str) -> anyhow::Result<SqlitePool> {
    ensure_sqlite_parent(database_url)?;
    let options = SqliteConnectOptions::from_str(database_url)
        .with_context(|| format!("invalid DATABASE_URL: {database_url}"))?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .foreign_keys(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(8)
        .connect_with(options)
        .await
        .context("failed to connect to SQLite")?;
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .context("failed to apply database migrations")?;
    Ok(pool)
}

fn ensure_sqlite_parent(database_url: &str) -> anyhow::Result<()> {
    let Some(path) = database_url.strip_prefix("sqlite://") else {
        return Ok(());
    };
    if path == ":memory:" || path.starts_with("file:") {
        return Ok(());
    }
    if let Some(parent) = Path::new(path)
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("failed to create database directory {}", parent.display()))?;
    }
    Ok(())
}

async fn serve(state: AppState, bind_addr: &str) -> anyhow::Result<()> {
    let app = build_router(state);
    let address: SocketAddr = bind_addr
        .parse()
        .with_context(|| format!("invalid BIND_ADDR: {bind_addr}"))?;
    let listener = TcpListener::bind(address)
        .await
        .with_context(|| format!("failed to bind {address}"))?;
    tracing::info!(address = %address, "xuqi backend is listening");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("server stopped with an error")?;
    Ok(())
}

fn build_router(state: AppState) -> Router {
    let protected = Router::new()
        .route("/me", get(get_me).patch(update_me))
        .route(
            "/billing-channels",
            get(list_billing_channels).post(create_billing_channel),
        )
        .route("/billing-channels/{id}", patch(update_billing_channel))
        .route(
            "/subscriptions",
            get(list_subscriptions).post(create_subscription),
        )
        .route(
            "/subscriptions/{id}",
            get(get_subscription)
                .patch(update_subscription)
                .delete(delete_subscription),
        )
        .route(
            "/subscriptions/{subscription_id}/payments",
            get(list_payments).post(create_payment),
        )
        .route(
            "/subscriptions/{subscription_id}/payments/{payment_id}",
            patch(update_payment),
        )
        .route("/overview", get(overview))
        .route("/calendar", get(calendar))
        .route("/catalog/services", get(search_catalog_services))
        .route("/catalog/services/{id}/prices", get(catalog_prices))
        .route("/export", get(export_data))
        .route("/import", post(import_data))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::middleware,
        ));

    Router::new()
        .route("/health", get(health))
        .nest("/api/v1", protected)
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods([
                    Method::GET,
                    Method::POST,
                    Method::PATCH,
                    Method::DELETE,
                    Method::OPTIONS,
                ])
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}

async fn create_user(state: &AppState, args: CreateUserArgs) -> anyhow::Result<()> {
    let display_name = args.name.trim();
    if display_name.is_empty() {
        anyhow::bail!("--name cannot be empty");
    }

    let user_id = Uuid::new_v4().to_string();
    let token = generate_token();
    let token_hash = hash_token(&token);
    let mut transaction = state.pool.begin().await?;
    sqlx::query(
        "INSERT INTO users (
            id, display_name, timezone, default_region, default_currency, token_hash
         ) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&user_id)
    .bind(display_name)
    .bind(args.timezone)
    .bind(args.region.trim().to_uppercase())
    .bind(args.currency.trim().to_uppercase())
    .bind(token_hash)
    .execute(&mut *transaction)
    .await?;

    for (name, brand) in [
        ("微信支付", Some("wechat")),
        ("支付宝 Alipay", Some("alipay")),
        ("Apple Pay", Some("apple-pay")),
        ("Mastercard", Some("mastercard")),
    ] {
        sqlx::query(
            "INSERT INTO billing_channels (id, user_id, name, brand, is_active)
             VALUES (?, ?, ?, ?, 1)",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(&user_id)
        .bind(name)
        .bind(brand)
        .execute(&mut *transaction)
        .await?;
    }
    transaction.commit().await?;

    println!(
        "{}",
        serde_json::to_string_pretty(&serde_json::json!({
            "user_id": user_id,
            "token": token,
            "message": "Save this token now. It will not be shown again."
        }))?
    );
    Ok(())
}

async fn rotate_token(state: &AppState, args: RotateTokenArgs) -> anyhow::Result<()> {
    let token = generate_token();
    let result =
        sqlx::query("UPDATE users SET token_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(hash_token(&token))
            .bind(&args.user_id)
            .execute(&state.pool)
            .await?;
    if result.rows_affected() == 0 {
        anyhow::bail!("user not found: {}", args.user_id);
    }
    println!(
        "{}",
        serde_json::to_string_pretty(&serde_json::json!({
            "user_id": args.user_id,
            "token": token,
            "message": "Save this token now. The previous token no longer works."
        }))?
    );
    Ok(())
}

fn generate_token() -> String {
    let mut bytes = [0_u8; 32];
    OsRng.fill_bytes(&mut bytes);
    format!("xuqi_{}", URL_SAFE_NO_PAD.encode(bytes))
}
