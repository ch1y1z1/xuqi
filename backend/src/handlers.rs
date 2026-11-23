use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{Datelike, Duration, NaiveDate, Utc};
use serde::Deserialize;
use serde_json::json;
use sqlx::{QueryBuilder, Sqlite, SqlitePool};
use uuid::Uuid;

use crate::{
    error::AppError,
    models::{
        AuthUser, BillingChannel, CalendarResponse, CalendarSubscription, CatalogPrice,
        CatalogService, CreateBillingChannelRequest, CreatePaymentRequest,
        CreateSubscriptionRequest, ExportPayload, ImportPayload, Overview, OverviewSubscription,
        PaymentRecord, ServiceWithPrices, Subscription, UpdateBillingChannelRequest,
        UpdateMeRequest, UpdatePaymentRequest, UpdateSubscriptionRequest, User,
    },
    AppState,
};

const SUBSCRIPTION_SELECT: &str = "
    SELECT
        s.id,
        s.user_id,
        s.catalog_service_id,
        s.name,
        s.logo_url,
        s.category,
        s.amount_minor,
        s.currency,
        s.billing_interval_count,
        s.billing_interval_unit,
        s.billing_anchor_date,
        s.next_billing_date,
        s.renewal_method,
        s.billing_channel_id,
        bc.name AS billing_channel_name,
        s.status,
        s.management_url,
        s.notes,
        s.end_date,
        s.created_at,
        s.updated_at
    FROM subscriptions s
    LEFT JOIN billing_channels bc ON bc.id = s.billing_channel_id
    WHERE s.user_id = ?";

pub async fn health() -> impl IntoResponse {
    Json(json!({ "status": "ok" }))
}

pub async fn get_me(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
) -> Result<Json<User>, AppError> {
    let user = sqlx::query_as::<_, User>(
        "SELECT id, display_name, timezone, default_region, default_currency, created_at, updated_at
         FROM users WHERE id = ?",
    )
    .bind(user.id)
    .fetch_one(&state.pool)
    .await?;
    Ok(Json(user))
}

pub async fn update_me(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Json(request): Json<UpdateMeRequest>,
) -> Result<Json<User>, AppError> {
    let current = sqlx::query_as::<_, User>(
        "SELECT id, display_name, timezone, default_region, default_currency, created_at, updated_at
         FROM users WHERE id = ?",
    )
    .bind(&user.id)
    .fetch_one(&state.pool)
    .await?;

    let display_name = request
        .display_name
        .unwrap_or(current.display_name)
        .trim()
        .to_string();
    if display_name.is_empty() {
        return Err(AppError::BadRequest("display_name cannot be empty".into()));
    }

    let timezone = request.timezone.unwrap_or(current.timezone);
    let default_region = request
        .default_region
        .unwrap_or(current.default_region)
        .trim()
        .to_uppercase();
    let default_currency = request
        .default_currency
        .unwrap_or(current.default_currency)
        .trim()
        .to_uppercase();

    sqlx::query(
        "UPDATE users
         SET display_name = ?, timezone = ?, default_region = ?, default_currency = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?",
    )
    .bind(display_name)
    .bind(timezone)
    .bind(default_region)
    .bind(default_currency)
    .bind(&user.id)
    .execute(&state.pool)
    .await?;

    get_me(State(state), Extension(user)).await
}

#[derive(Debug, Deserialize)]
pub struct BillingChannelQuery {
    pub include_inactive: Option<bool>,
}

pub async fn list_billing_channels(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<BillingChannelQuery>,
) -> Result<Json<Vec<BillingChannel>>, AppError> {
    let include_inactive = query.include_inactive.unwrap_or(false);
    let channels = if include_inactive {
        sqlx::query_as::<_, BillingChannel>(
            "SELECT id, user_id, name, brand, is_active, created_at, updated_at
             FROM billing_channels WHERE user_id = ? ORDER BY is_active DESC, name ASC",
        )
        .bind(user.id)
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query_as::<_, BillingChannel>(
            "SELECT id, user_id, name, brand, is_active, created_at, updated_at
             FROM billing_channels WHERE user_id = ? AND is_active = 1 ORDER BY name ASC",
        )
        .bind(user.id)
        .fetch_all(&state.pool)
        .await?
    };
    Ok(Json(channels))
}

pub async fn create_billing_channel(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Json(request): Json<CreateBillingChannelRequest>,
) -> Result<(StatusCode, Json<BillingChannel>), AppError> {
    let name = clean_required(request.name, "name")?;
    if name.len() > 100 {
        return Err(AppError::BadRequest("name is too long".into()));
    }
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO billing_channels (id, user_id, name, brand, is_active)
         VALUES (?, ?, ?, ?, 1)",
    )
    .bind(&id)
    .bind(&user.id)
    .bind(name)
    .bind(request.brand)
    .execute(&state.pool)
    .await?;

    let channel = get_billing_channel(&state.pool, &user.id, &id).await?;
    Ok((StatusCode::CREATED, Json(channel)))
}

pub async fn update_billing_channel(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(request): Json<UpdateBillingChannelRequest>,
) -> Result<Json<BillingChannel>, AppError> {
    let current = get_billing_channel(&state.pool, &user.id, &id).await?;
    let name = match request.name {
        Some(name) => clean_required(name, "name")?,
        None => current.name,
    };
    if name.len() > 100 {
        return Err(AppError::BadRequest("name is too long".into()));
    }
    let brand = request.brand.or(current.brand);
    let is_active = request.is_active.unwrap_or(current.is_active);

    sqlx::query(
        "UPDATE billing_channels
         SET name = ?, brand = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?",
    )
    .bind(name)
    .bind(brand)
    .bind(is_active)
    .bind(&id)
    .bind(&user.id)
    .execute(&state.pool)
    .await?;

    Ok(Json(get_billing_channel(&state.pool, &user.id, &id).await?))
}

#[derive(Debug, Deserialize)]
pub struct SubscriptionQuery {
    pub q: Option<String>,
    pub status: Option<String>,
    pub limit: Option<u32>,
}

pub async fn list_subscriptions(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<SubscriptionQuery>,
) -> Result<Json<Vec<Subscription>>, AppError> {
    let mut builder = QueryBuilder::<Sqlite>::new(
        "SELECT s.id, s.user_id, s.catalog_service_id, s.name, s.logo_url, s.category,
         s.amount_minor, s.currency, s.billing_interval_count, s.billing_interval_unit,
         s.billing_anchor_date, s.next_billing_date, s.renewal_method, s.billing_channel_id,
         bc.name AS billing_channel_name, s.status, s.management_url, s.notes, s.end_date,
         s.created_at, s.updated_at
         FROM subscriptions s
         LEFT JOIN billing_channels bc ON bc.id = s.billing_channel_id
         WHERE s.user_id = ",
    );
    builder.push_bind(&user.id);

    if let Some(q) = query
        .q
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        builder.push(" AND (LOWER(s.name) LIKE LOWER(");
        builder.push_bind(format!("%{q}%"));
        builder.push(") OR LOWER(COALESCE(s.category, '')) LIKE LOWER(");
        builder.push_bind(format!("%{q}%"));
        builder.push("))");
    }
    if let Some(status) = query.status.as_deref() {
        validate_status(status)?;
        builder.push(" AND s.status = ");
        builder.push_bind(status);
    }

    builder.push(" ORDER BY CASE WHEN s.status = 'active' THEN 0 ELSE 1 END, s.next_billing_date ASC, s.name ASC LIMIT ");
    builder.push_bind(i64::from(query.limit.unwrap_or(100).clamp(1, 200)));

    let subscriptions = builder
        .build_query_as::<Subscription>()
        .fetch_all(&state.pool)
        .await?;
    Ok(Json(subscriptions))
}

pub async fn get_subscription(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<Json<Subscription>, AppError> {
    Ok(Json(fetch_subscription(&state.pool, &user.id, &id).await?))
}

pub async fn create_subscription(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Json(request): Json<CreateSubscriptionRequest>,
) -> Result<(StatusCode, Json<Subscription>), AppError> {
    validate_subscription_input(
        request.amount_minor,
        request.billing_interval_count,
        &request.billing_interval_unit,
        &request.renewal_method,
        request.status.as_deref().unwrap_or("active"),
        &request.next_billing_date,
        request.billing_anchor_date.as_deref(),
        request.end_date.as_deref(),
    )?;
    let name = clean_required(request.name, "name")?;
    let status = request.status.unwrap_or_else(|| "active".into());
    if let Some(channel_id) = request.billing_channel_id.as_deref() {
        ensure_billing_channel(&state.pool, &user.id, channel_id, true).await?;
    }

    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO subscriptions (
            id, user_id, catalog_service_id, name, logo_url, category, amount_minor, currency,
            billing_interval_count, billing_interval_unit, billing_anchor_date, next_billing_date,
            renewal_method, billing_channel_id, status, management_url, notes, end_date
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&user.id)
    .bind(request.catalog_service_id)
    .bind(name)
    .bind(request.logo_url)
    .bind(request.category)
    .bind(request.amount_minor)
    .bind(request.currency.trim().to_uppercase())
    .bind(request.billing_interval_count)
    .bind(request.billing_interval_unit)
    .bind(request.billing_anchor_date)
    .bind(request.next_billing_date)
    .bind(request.renewal_method)
    .bind(request.billing_channel_id)
    .bind(status)
    .bind(request.management_url)
    .bind(request.notes)
    .bind(request.end_date)
    .execute(&state.pool)
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(fetch_subscription(&state.pool, &user.id, &id).await?),
    ))
}

pub async fn update_subscription(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(request): Json<UpdateSubscriptionRequest>,
) -> Result<Json<Subscription>, AppError> {
    let current = fetch_subscription(&state.pool, &user.id, &id).await?;
    let catalog_service_id = request
        .catalog_service_id
        .unwrap_or(current.catalog_service_id);
    let name = match request.name {
        Some(name) => clean_required(name, "name")?,
        None => current.name,
    };
    let logo_url = request.logo_url.unwrap_or(current.logo_url);
    let category = request.category.unwrap_or(current.category);
    let amount_minor = request.amount_minor.unwrap_or(current.amount_minor);
    let currency = request
        .currency
        .unwrap_or(current.currency)
        .trim()
        .to_uppercase();
    let billing_interval_count = request
        .billing_interval_count
        .unwrap_or(current.billing_interval_count);
    let billing_interval_unit = request
        .billing_interval_unit
        .unwrap_or(current.billing_interval_unit);
    let billing_anchor_date = request
        .billing_anchor_date
        .unwrap_or(current.billing_anchor_date);
    let next_billing_date = request
        .next_billing_date
        .unwrap_or(current.next_billing_date);
    let renewal_method = request.renewal_method.unwrap_or(current.renewal_method);
    let billing_channel_id = request
        .billing_channel_id
        .unwrap_or(current.billing_channel_id);
    let status = request.status.unwrap_or(current.status);
    let management_url = request.management_url.unwrap_or(current.management_url);
    let notes = request.notes.unwrap_or(current.notes);
    let end_date = request.end_date.unwrap_or(current.end_date);

    validate_subscription_input(
        amount_minor,
        billing_interval_count,
        &billing_interval_unit,
        &renewal_method,
        &status,
        &next_billing_date,
        billing_anchor_date.as_deref(),
        end_date.as_deref(),
    )?;
    if let Some(channel_id) = billing_channel_id.as_deref() {
        ensure_billing_channel(&state.pool, &user.id, channel_id, false).await?;
    }

    sqlx::query(
        "UPDATE subscriptions SET
            catalog_service_id = ?, name = ?, logo_url = ?, category = ?, amount_minor = ?,
            currency = ?, billing_interval_count = ?, billing_interval_unit = ?,
            billing_anchor_date = ?, next_billing_date = ?, renewal_method = ?,
            billing_channel_id = ?, status = ?, management_url = ?, notes = ?, end_date = ?,
            updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?",
    )
    .bind(catalog_service_id)
    .bind(name)
    .bind(logo_url)
    .bind(category)
    .bind(amount_minor)
    .bind(currency)
    .bind(billing_interval_count)
    .bind(billing_interval_unit)
    .bind(billing_anchor_date)
    .bind(next_billing_date)
    .bind(renewal_method)
    .bind(billing_channel_id)
    .bind(status)
    .bind(management_url)
    .bind(notes)
    .bind(end_date)
    .bind(&id)
    .bind(&user.id)
    .execute(&state.pool)
    .await?;

    Ok(Json(fetch_subscription(&state.pool, &user.id, &id).await?))
}

pub async fn delete_subscription(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM subscriptions WHERE id = ? AND user_id = ?")
        .bind(id)
        .bind(user.id)
        .execute(&state.pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

pub async fn list_payments(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(subscription_id): Path<String>,
) -> Result<Json<Vec<PaymentRecord>>, AppError> {
    ensure_subscription(&state.pool, &user.id, &subscription_id).await?;
    let payments = sqlx::query_as::<_, PaymentRecord>(
        "SELECT p.id, p.subscription_id, p.billing_period_date, p.paid_at, p.amount_minor,
                p.currency, p.billing_channel_name, p.note, p.created_at, p.updated_at
         FROM payment_records p
         JOIN subscriptions s ON s.id = p.subscription_id
         WHERE p.subscription_id = ? AND s.user_id = ?
         ORDER BY p.billing_period_date DESC",
    )
    .bind(subscription_id)
    .bind(user.id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(payments))
}

pub async fn create_payment(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(subscription_id): Path<String>,
    Json(request): Json<CreatePaymentRequest>,
) -> Result<(StatusCode, Json<PaymentRecord>), AppError> {
    let subscription = fetch_subscription(&state.pool, &user.id, &subscription_id).await?;
    validate_date(&request.billing_period_date, "billing_period_date")?;
    if request.paid_at.trim().is_empty() {
        return Err(AppError::BadRequest("paid_at cannot be empty".into()));
    }
    let amount_minor = request.amount_minor.unwrap_or(subscription.amount_minor);
    let currency = request
        .currency
        .unwrap_or(subscription.currency.clone())
        .trim()
        .to_uppercase();
    if amount_minor < 0 {
        return Err(AppError::BadRequest(
            "amount_minor cannot be negative".into(),
        ));
    }

    let exists = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM payment_records WHERE subscription_id = ? AND billing_period_date = ?",
    )
    .bind(&subscription_id)
    .bind(&request.billing_period_date)
    .fetch_one(&state.pool)
    .await?;
    if exists > 0 {
        return Err(AppError::Conflict(
            "a payment for this billing period already exists".into(),
        ));
    }

    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO payment_records (
            id, subscription_id, billing_period_date, paid_at, amount_minor, currency,
            billing_channel_name, note
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&subscription_id)
    .bind(&request.billing_period_date)
    .bind(request.paid_at)
    .bind(amount_minor)
    .bind(currency)
    .bind(
        request
            .billing_channel_name
            .or(subscription.billing_channel_name.clone()),
    )
    .bind(request.note)
    .execute(&state.pool)
    .await?;

    advance_next_billing_date(&state.pool, &subscription, &request.billing_period_date).await?;

    let payment = sqlx::query_as::<_, PaymentRecord>(
        "SELECT id, subscription_id, billing_period_date, paid_at, amount_minor, currency,
                billing_channel_name, note, created_at, updated_at
         FROM payment_records WHERE id = ?",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await?;
    Ok((StatusCode::CREATED, Json(payment)))
}

pub async fn update_payment(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path((subscription_id, payment_id)): Path<(String, String)>,
    Json(request): Json<UpdatePaymentRequest>,
) -> Result<Json<PaymentRecord>, AppError> {
    ensure_subscription(&state.pool, &user.id, &subscription_id).await?;
    let current = get_payment(&state.pool, &subscription_id, &payment_id).await?;
    let billing_period_date = request
        .billing_period_date
        .unwrap_or(current.billing_period_date);
    let paid_at = request.paid_at.unwrap_or(current.paid_at);
    validate_date(&billing_period_date, "billing_period_date")?;
    if paid_at.trim().is_empty() {
        return Err(AppError::BadRequest("paid_at cannot be empty".into()));
    }
    let amount_minor = request.amount_minor.unwrap_or(current.amount_minor);
    if amount_minor < 0 {
        return Err(AppError::BadRequest(
            "amount_minor cannot be negative".into(),
        ));
    }
    let currency = request
        .currency
        .unwrap_or(current.currency)
        .trim()
        .to_uppercase();
    let billing_channel_name = request
        .billing_channel_name
        .unwrap_or(current.billing_channel_name);
    let note = request.note.unwrap_or(current.note);

    sqlx::query(
        "UPDATE payment_records SET
            billing_period_date = ?, paid_at = ?, amount_minor = ?, currency = ?,
            billing_channel_name = ?, note = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND subscription_id = ?",
    )
    .bind(billing_period_date)
    .bind(paid_at)
    .bind(amount_minor)
    .bind(currency)
    .bind(billing_channel_name)
    .bind(note)
    .bind(&payment_id)
    .bind(&subscription_id)
    .execute(&state.pool)
    .await?;

    Ok(Json(
        get_payment(&state.pool, &subscription_id, &payment_id).await?,
    ))
}

pub async fn overview(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<CurrencyQuery>,
) -> Result<Json<Overview>, AppError> {
    let subscriptions = sqlx::query_as::<_, OverviewSubscription>(
        "SELECT s.id, s.name, s.logo_url, s.amount_minor, s.currency,
                s.billing_interval_count, s.billing_interval_unit, s.next_billing_date,
                bc.name AS billing_channel_name
         FROM subscriptions s
         LEFT JOIN billing_channels bc ON bc.id = s.billing_channel_id
         WHERE s.user_id = ? AND s.status = 'active'
         ORDER BY s.next_billing_date ASC, s.name ASC",
    )
    .bind(&user.id)
    .fetch_all(&state.pool)
    .await?;

    let selected_currency = query.currency.map(|value| value.trim().to_uppercase());
    let today = Utc::now().date_naive();
    let end = today + Duration::days(30);
    let month_key = today.format("%Y-%m").to_string();
    let mut monthly_planned_minor = 0_i64;
    let mut upcoming_30_days_minor = 0_i64;
    for subscription in &subscriptions {
        if selected_currency
            .as_deref()
            .is_some_and(|currency| currency != subscription.currency)
        {
            continue;
        }
        monthly_planned_minor = monthly_planned_minor.saturating_add(monthly_equivalent(
            subscription.amount_minor,
            subscription.billing_interval_count,
            &subscription.billing_interval_unit,
        ));
        if let Ok(next_date) =
            NaiveDate::parse_from_str(&subscription.next_billing_date, "%Y-%m-%d")
        {
            if (today..=end).contains(&next_date) {
                upcoming_30_days_minor =
                    upcoming_30_days_minor.saturating_add(subscription.amount_minor);
            }
        }
    }

    let paid_this_month_minor = if let Some(currency) = selected_currency.as_deref() {
        sqlx::query_scalar::<_, Option<i64>>(
            "SELECT SUM(p.amount_minor)
             FROM payment_records p
             JOIN subscriptions s ON s.id = p.subscription_id
             WHERE s.user_id = ? AND p.currency = ? AND substr(p.paid_at, 1, 7) = ?",
        )
        .bind(&user.id)
        .bind(currency)
        .bind(&month_key)
        .fetch_one(&state.pool)
        .await?
        .unwrap_or(0)
    } else {
        0
    };

    Ok(Json(Overview {
        currency: selected_currency,
        monthly_planned_minor,
        upcoming_30_days_minor,
        paid_this_month_minor,
        active_subscription_count: subscriptions.len() as i64,
        subscriptions,
    }))
}

#[derive(Debug, Deserialize)]
pub struct CalendarQuery {
    pub from: Option<String>,
    pub to: Option<String>,
}

pub async fn calendar(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<CalendarQuery>,
) -> Result<Json<CalendarResponse>, AppError> {
    let from = query
        .from
        .unwrap_or_else(|| Utc::now().date_naive().format("%Y-%m-%d").to_string());
    let to = query.to.unwrap_or_else(|| {
        (Utc::now().date_naive() + Duration::days(30))
            .format("%Y-%m-%d")
            .to_string()
    });
    validate_date(&from, "from")?;
    validate_date(&to, "to")?;
    if from > to {
        return Err(AppError::BadRequest("from must be before to".into()));
    }

    let upcoming = sqlx::query_as::<_, CalendarSubscription>(
        "SELECT s.id, s.name, s.logo_url, s.amount_minor, s.currency, s.next_billing_date,
                s.renewal_method, bc.name AS billing_channel_name, s.status
         FROM subscriptions s
         LEFT JOIN billing_channels bc ON bc.id = s.billing_channel_id
         WHERE s.user_id = ? AND s.next_billing_date BETWEEN ? AND ?
         ORDER BY s.next_billing_date ASC, s.name ASC",
    )
    .bind(&user.id)
    .bind(&from)
    .bind(&to)
    .fetch_all(&state.pool)
    .await?;
    let payments = sqlx::query_as::<_, PaymentRecord>(
        "SELECT p.id, p.subscription_id, p.billing_period_date, p.paid_at, p.amount_minor,
                p.currency, p.billing_channel_name, p.note, p.created_at, p.updated_at
         FROM payment_records p
         JOIN subscriptions s ON s.id = p.subscription_id
         WHERE s.user_id = ? AND substr(p.paid_at, 1, 10) BETWEEN ? AND ?
         ORDER BY p.paid_at ASC",
    )
    .bind(&user.id)
    .bind(&from)
    .bind(&to)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(CalendarResponse {
        from,
        to,
        upcoming,
        payments,
    }))
}

#[derive(Debug, Deserialize)]
pub struct CurrencyQuery {
    pub currency: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CatalogQuery {
    pub q: Option<String>,
}

pub async fn search_catalog_services(
    State(state): State<AppState>,
    Query(query): Query<CatalogQuery>,
) -> Result<Json<Vec<CatalogService>>, AppError> {
    let q = query.q.unwrap_or_default().trim().to_string();
    if q.is_empty() {
        return Ok(Json(Vec::new()));
    }
    let pattern = format!("%{q}%");
    let services = sqlx::query_as::<_, CatalogService>(
        "SELECT id, name, aliases, website_domain, logo_url, created_at, updated_at
         FROM catalog_services
         WHERE LOWER(name) LIKE LOWER(?) OR LOWER(aliases) LIKE LOWER(?)
         ORDER BY name ASC LIMIT 30",
    )
    .bind(&pattern)
    .bind(&pattern)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(services))
}

#[derive(Debug, Deserialize)]
pub struct PriceQuery {
    pub region: Option<String>,
}

pub async fn catalog_prices(
    State(state): State<AppState>,
    Path(service_id): Path<String>,
    Query(query): Query<PriceQuery>,
) -> Result<Json<ServiceWithPrices>, AppError> {
    let service = sqlx::query_as::<_, CatalogService>(
        "SELECT id, name, aliases, website_domain, logo_url, created_at, updated_at
         FROM catalog_services WHERE id = ?",
    )
    .bind(&service_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;
    let prices = if let Some(region) = query.region {
        sqlx::query_as::<_, CatalogPrice>(
            "SELECT id, service_id, region, platform, plan_name, billing_interval_count,
                    billing_interval_unit, amount_minor, currency, source_name, source_url,
                    verified_at, fetched_at
             FROM catalog_prices WHERE service_id = ? AND region = ?
             ORDER BY plan_name ASC, amount_minor ASC",
        )
        .bind(&service_id)
        .bind(region.to_uppercase())
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query_as::<_, CatalogPrice>(
            "SELECT id, service_id, region, platform, plan_name, billing_interval_count,
                    billing_interval_unit, amount_minor, currency, source_name, source_url,
                    verified_at, fetched_at
             FROM catalog_prices WHERE service_id = ?
             ORDER BY region ASC, plan_name ASC, amount_minor ASC",
        )
        .bind(&service_id)
        .fetch_all(&state.pool)
        .await?
    };
    Ok(Json(ServiceWithPrices { service, prices }))
}

pub async fn export_data(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
) -> Result<Json<ExportPayload>, AppError> {
    let current_user = sqlx::query_as::<_, User>(
        "SELECT id, display_name, timezone, default_region, default_currency, created_at, updated_at
         FROM users WHERE id = ?",
    )
    .bind(&user.id)
    .fetch_one(&state.pool)
    .await?;
    let billing_channels = sqlx::query_as::<_, BillingChannel>(
        "SELECT id, user_id, name, brand, is_active, created_at, updated_at
         FROM billing_channels WHERE user_id = ? ORDER BY name ASC",
    )
    .bind(&user.id)
    .fetch_all(&state.pool)
    .await?;
    let subscriptions = sqlx::query_as::<_, Subscription>(SUBSCRIPTION_SELECT)
        .bind(&user.id)
        .fetch_all(&state.pool)
        .await?;
    let payments = sqlx::query_as::<_, PaymentRecord>(
        "SELECT p.id, p.subscription_id, p.billing_period_date, p.paid_at, p.amount_minor,
                p.currency, p.billing_channel_name, p.note, p.created_at, p.updated_at
         FROM payment_records p
         JOIN subscriptions s ON s.id = p.subscription_id
         WHERE s.user_id = ? ORDER BY p.billing_period_date ASC",
    )
    .bind(&user.id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(ExportPayload {
        version: 1,
        exported_at: Utc::now().to_rfc3339(),
        user: current_user,
        billing_channels,
        subscriptions,
        payments,
    }))
}

pub async fn import_data(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Json(payload): Json<ImportPayload>,
) -> Result<Json<serde_json::Value>, AppError> {
    if payload.version != 1 {
        return Err(AppError::BadRequest("unsupported import version".into()));
    }

    for channel in &payload.billing_channels {
        let owner =
            sqlx::query_scalar::<_, String>("SELECT user_id FROM billing_channels WHERE id = ?")
                .bind(&channel.id)
                .fetch_optional(&state.pool)
                .await?;
        if owner.is_some_and(|owner| owner != user.id) {
            return Err(AppError::Conflict(
                "import contains a billing channel belonging to another user".into(),
            ));
        }
    }
    for subscription in &payload.subscriptions {
        let owner =
            sqlx::query_scalar::<_, String>("SELECT user_id FROM subscriptions WHERE id = ?")
                .bind(&subscription.id)
                .fetch_optional(&state.pool)
                .await?;
        if owner.is_some_and(|owner| owner != user.id) {
            return Err(AppError::Conflict(
                "import contains a subscription belonging to another user".into(),
            ));
        }
        if let Some(channel_id) = subscription.billing_channel_id.as_deref() {
            let channel_in_payload = payload
                .billing_channels
                .iter()
                .any(|channel| channel.id == channel_id);
            let channel_owner = sqlx::query_scalar::<_, String>(
                "SELECT user_id FROM billing_channels WHERE id = ?",
            )
            .bind(channel_id)
            .fetch_optional(&state.pool)
            .await?;
            if channel_owner
                .as_ref()
                .is_some_and(|owner| owner != &user.id)
                || channel_owner.is_none() && !channel_in_payload
            {
                return Err(AppError::Conflict(
                    "import contains an invalid billing channel reference".into(),
                ));
            }
        }
    }
    for payment in &payload.payments {
        let owner = sqlx::query_scalar::<_, String>(
            "SELECT s.user_id
             FROM payment_records p
             JOIN subscriptions s ON s.id = p.subscription_id
             WHERE p.id = ?",
        )
        .bind(&payment.id)
        .fetch_optional(&state.pool)
        .await?;
        if owner.is_some_and(|owner| owner != user.id) {
            return Err(AppError::Conflict(
                "import contains a payment belonging to another user".into(),
            ));
        }
        let subscription_in_payload = payload
            .subscriptions
            .iter()
            .any(|subscription| subscription.id == payment.subscription_id);
        let subscription_owner =
            sqlx::query_scalar::<_, String>("SELECT user_id FROM subscriptions WHERE id = ?")
                .bind(&payment.subscription_id)
                .fetch_optional(&state.pool)
                .await?;
        if subscription_owner
            .as_ref()
            .is_some_and(|owner| owner != &user.id)
            || subscription_owner.is_none() && !subscription_in_payload
        {
            return Err(AppError::Conflict(
                "import contains an invalid subscription reference".into(),
            ));
        }
    }

    let mut transaction = state.pool.begin().await?;

    for channel in &payload.billing_channels {
        sqlx::query(
            "INSERT INTO billing_channels (id, user_id, name, brand, is_active)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, brand = excluded.brand,
                 is_active = excluded.is_active, updated_at = CURRENT_TIMESTAMP",
        )
        .bind(&channel.id)
        .bind(&user.id)
        .bind(&channel.name)
        .bind(&channel.brand)
        .bind(channel.is_active)
        .execute(&mut *transaction)
        .await?;
    }

    for subscription in &payload.subscriptions {
        validate_subscription_input(
            subscription.amount_minor,
            subscription.billing_interval_count,
            &subscription.billing_interval_unit,
            &subscription.renewal_method,
            &subscription.status,
            &subscription.next_billing_date,
            subscription.billing_anchor_date.as_deref(),
            subscription.end_date.as_deref(),
        )?;
        sqlx::query(
            "INSERT INTO subscriptions (
                id, user_id, catalog_service_id, name, logo_url, category, amount_minor, currency,
                billing_interval_count, billing_interval_unit, billing_anchor_date, next_billing_date,
                renewal_method, billing_channel_id, status, management_url, notes, end_date
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                catalog_service_id = excluded.catalog_service_id, name = excluded.name,
                logo_url = excluded.logo_url, category = excluded.category,
                amount_minor = excluded.amount_minor, currency = excluded.currency,
                billing_interval_count = excluded.billing_interval_count,
                billing_interval_unit = excluded.billing_interval_unit,
                billing_anchor_date = excluded.billing_anchor_date,
                next_billing_date = excluded.next_billing_date,
                renewal_method = excluded.renewal_method,
                billing_channel_id = excluded.billing_channel_id, status = excluded.status,
                management_url = excluded.management_url, notes = excluded.notes,
                end_date = excluded.end_date, updated_at = CURRENT_TIMESTAMP",
        )
        .bind(&subscription.id)
        .bind(&user.id)
        .bind(&subscription.catalog_service_id)
        .bind(&subscription.name)
        .bind(&subscription.logo_url)
        .bind(&subscription.category)
        .bind(subscription.amount_minor)
        .bind(subscription.currency.to_uppercase())
        .bind(subscription.billing_interval_count)
        .bind(&subscription.billing_interval_unit)
        .bind(&subscription.billing_anchor_date)
        .bind(&subscription.next_billing_date)
        .bind(&subscription.renewal_method)
        .bind(&subscription.billing_channel_id)
        .bind(&subscription.status)
        .bind(&subscription.management_url)
        .bind(&subscription.notes)
        .bind(&subscription.end_date)
        .execute(&mut *transaction)
        .await?;
    }

    for payment in &payload.payments {
        validate_date(&payment.billing_period_date, "billing_period_date")?;
        sqlx::query(
            "INSERT INTO payment_records (
                id, subscription_id, billing_period_date, paid_at, amount_minor, currency,
                billing_channel_name, note
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(subscription_id, billing_period_date) DO UPDATE SET
                paid_at = excluded.paid_at, amount_minor = excluded.amount_minor,
                currency = excluded.currency, billing_channel_name = excluded.billing_channel_name,
                note = excluded.note, updated_at = CURRENT_TIMESTAMP",
        )
        .bind(&payment.id)
        .bind(&payment.subscription_id)
        .bind(&payment.billing_period_date)
        .bind(&payment.paid_at)
        .bind(payment.amount_minor)
        .bind(payment.currency.to_uppercase())
        .bind(&payment.billing_channel_name)
        .bind(&payment.note)
        .execute(&mut *transaction)
        .await?;
    }

    transaction.commit().await?;
    Ok(Json(json!({
        "imported": {
            "billing_channels": payload.billing_channels.len(),
            "subscriptions": payload.subscriptions.len(),
            "payments": payload.payments.len()
        }
    })))
}

async fn get_billing_channel(
    pool: &SqlitePool,
    user_id: &str,
    id: &str,
) -> Result<BillingChannel, AppError> {
    sqlx::query_as::<_, BillingChannel>(
        "SELECT id, user_id, name, brand, is_active, created_at, updated_at
         FROM billing_channels WHERE id = ? AND user_id = ?",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)
}

async fn get_payment(
    pool: &SqlitePool,
    subscription_id: &str,
    payment_id: &str,
) -> Result<PaymentRecord, AppError> {
    sqlx::query_as::<_, PaymentRecord>(
        "SELECT id, subscription_id, billing_period_date, paid_at, amount_minor, currency,
                billing_channel_name, note, created_at, updated_at
         FROM payment_records WHERE id = ? AND subscription_id = ?",
    )
    .bind(payment_id)
    .bind(subscription_id)
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)
}

async fn fetch_subscription(
    pool: &SqlitePool,
    user_id: &str,
    id: &str,
) -> Result<Subscription, AppError> {
    sqlx::query_as::<_, Subscription>(
        "SELECT
            s.id,
            s.user_id,
            s.catalog_service_id,
            s.name,
            s.logo_url,
            s.category,
            s.amount_minor,
            s.currency,
            s.billing_interval_count,
            s.billing_interval_unit,
            s.billing_anchor_date,
            s.next_billing_date,
            s.renewal_method,
            s.billing_channel_id,
            bc.name AS billing_channel_name,
            s.status,
            s.management_url,
            s.notes,
            s.end_date,
            s.created_at,
            s.updated_at
         FROM subscriptions s
         LEFT JOIN billing_channels bc ON bc.id = s.billing_channel_id
         WHERE s.user_id = ? AND s.id = ?",
    )
    .bind(user_id)
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)
}

async fn ensure_subscription(pool: &SqlitePool, user_id: &str, id: &str) -> Result<(), AppError> {
    let exists = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM subscriptions WHERE id = ? AND user_id = ?",
    )
    .bind(id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    if exists == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

async fn ensure_billing_channel(
    pool: &SqlitePool,
    user_id: &str,
    id: &str,
    require_active: bool,
) -> Result<(), AppError> {
    let channel = get_billing_channel(pool, user_id, id).await?;
    if require_active && !channel.is_active {
        return Err(AppError::BadRequest(
            "inactive billing channel cannot be used for a new subscription".into(),
        ));
    }
    Ok(())
}

async fn advance_next_billing_date(
    pool: &SqlitePool,
    subscription: &Subscription,
    billing_period_date: &str,
) -> Result<(), AppError> {
    if subscription.billing_interval_unit == "once" || subscription.status != "active" {
        return Ok(());
    }
    let current = NaiveDate::parse_from_str(&subscription.next_billing_date, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest("subscription next_billing_date is invalid".into()))?;
    let paid_period = NaiveDate::parse_from_str(billing_period_date, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest("billing_period_date is invalid".into()))?;
    if paid_period < current {
        return Ok(());
    }
    let mut next = current;
    let anchor_day = subscription
        .billing_anchor_date
        .as_deref()
        .and_then(|value| NaiveDate::parse_from_str(value, "%Y-%m-%d").ok())
        .map(|date| date.day())
        .unwrap_or_else(|| current.day());
    let mut steps = 0_u16;
    while next <= paid_period && steps < 1200 {
        next = advance_date_with_anchor(
            next,
            subscription.billing_interval_count,
            &subscription.billing_interval_unit,
            anchor_day,
        )?;
        steps += 1;
    }
    sqlx::query(
        "UPDATE subscriptions SET next_billing_date = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?",
    )
    .bind(next.format("%Y-%m-%d").to_string())
    .bind(&subscription.id)
    .execute(pool)
    .await?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn validate_subscription_input(
    amount_minor: i64,
    interval_count: i64,
    interval_unit: &str,
    renewal_method: &str,
    status: &str,
    next_billing_date: &str,
    anchor_date: Option<&str>,
    end_date: Option<&str>,
) -> Result<(), AppError> {
    if amount_minor < 0 {
        return Err(AppError::BadRequest(
            "amount_minor cannot be negative".into(),
        ));
    }
    if interval_count < 1 {
        return Err(AppError::BadRequest(
            "billing_interval_count must be at least 1".into(),
        ));
    }
    if !matches!(interval_unit, "day" | "week" | "month" | "year" | "once") {
        return Err(AppError::BadRequest(
            "billing_interval_unit must be day, week, month, year, or once".into(),
        ));
    }
    if !matches!(renewal_method, "auto" | "manual") {
        return Err(AppError::BadRequest(
            "renewal_method must be auto or manual".into(),
        ));
    }
    validate_status(status)?;
    validate_date(next_billing_date, "next_billing_date")?;
    if let Some(value) = anchor_date {
        validate_date(value, "billing_anchor_date")?;
    }
    if let Some(value) = end_date {
        validate_date(value, "end_date")?;
    }
    Ok(())
}

fn validate_status(status: &str) -> Result<(), AppError> {
    if matches!(status, "active" | "paused" | "ended") {
        Ok(())
    } else {
        Err(AppError::BadRequest(
            "status must be active, paused, or ended".into(),
        ))
    }
}

fn validate_date(value: &str, field: &str) -> Result<(), AppError> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map(|_| ())
        .map_err(|_| AppError::BadRequest(format!("{field} must use YYYY-MM-DD")))
}

fn clean_required(value: String, field: &str) -> Result<String, AppError> {
    let value = value.trim().to_string();
    if value.is_empty() {
        return Err(AppError::BadRequest(format!("{field} cannot be empty")));
    }
    Ok(value)
}

fn monthly_equivalent(amount_minor: i64, count: i64, unit: &str) -> i64 {
    let denominator = match unit {
        "month" => count.max(1) as i128,
        "year" => 12_i128.saturating_mul(count.max(1) as i128),
        "week" => 12_i128.saturating_mul(count.max(1) as i128),
        "day" => 12_i128.saturating_mul(count.max(1) as i128),
        "once" => return 0,
        _ => return 0,
    };
    let numerator = match unit {
        "week" => (amount_minor as i128).saturating_mul(52),
        "day" => (amount_minor as i128).saturating_mul(365),
        _ => amount_minor as i128,
    };
    let result = numerator / denominator;
    result.clamp(i64::MIN as i128, i64::MAX as i128) as i64
}

fn advance_date_with_anchor(
    date: NaiveDate,
    count: i64,
    unit: &str,
    anchor_day: u32,
) -> Result<NaiveDate, AppError> {
    let count = u32::try_from(count)
        .map_err(|_| AppError::BadRequest("billing interval is too large".into()))?;
    match unit {
        "day" => date
            .checked_add_signed(Duration::days(i64::from(count)))
            .ok_or_else(|| AppError::BadRequest("billing date is out of range".into())),
        "week" => date
            .checked_add_signed(Duration::weeks(i64::from(count)))
            .ok_or_else(|| AppError::BadRequest("billing date is out of range".into())),
        "month" => add_months_with_day(date, count, anchor_day),
        "year" => add_months_with_day(date, count.saturating_mul(12), anchor_day),
        "once" => Ok(date),
        _ => Err(AppError::BadRequest("unsupported billing interval".into())),
    }
}

fn add_months_with_day(
    date: NaiveDate,
    months: u32,
    anchor_day: u32,
) -> Result<NaiveDate, AppError> {
    let month_index = date.month0() as u64 + u64::from(months);
    let year =
        i64::from(date.year()).saturating_add(i64::try_from(month_index / 12).unwrap_or(i64::MAX));
    let month = (month_index % 12) as u32 + 1;
    let year = i32::try_from(year)
        .map_err(|_| AppError::BadRequest("billing date is out of range".into()))?;
    let last_day = days_in_month(year, month);
    NaiveDate::from_ymd_opt(year, month, anchor_day.min(last_day))
        .ok_or_else(|| AppError::BadRequest("billing date is out of range".into()))
}

fn days_in_month(year: i32, month: u32) -> u32 {
    let first_of_next = if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1)
    };
    first_of_next
        .map(|date| (date - Duration::days(1)).day())
        .unwrap_or(28)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn monthly_billing_keeps_end_of_month_anchor() {
        let january_31 = NaiveDate::from_ymd_opt(2026, 1, 31).unwrap();
        let february_28 = advance_date_with_anchor(january_31, 1, "month", 31).unwrap();
        let march_31 = advance_date_with_anchor(february_28, 1, "month", 31).unwrap();

        assert_eq!(february_28, NaiveDate::from_ymd_opt(2026, 2, 28).unwrap());
        assert_eq!(march_31, NaiveDate::from_ymd_opt(2026, 3, 31).unwrap());
    }

    #[test]
    fn monthly_billing_without_anchor_uses_current_day() {
        let date = NaiveDate::from_ymd_opt(2026, 2, 28).unwrap();
        let next = advance_date_with_anchor(date, 1, "month", date.day()).unwrap();

        assert_eq!(next, NaiveDate::from_ymd_opt(2026, 3, 28).unwrap());
    }
}
