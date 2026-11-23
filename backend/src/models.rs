use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Clone, Debug)]
pub struct AuthUser {
    pub id: String,
}

#[derive(Debug, Serialize, FromRow)]
pub struct User {
    pub id: String,
    pub display_name: String,
    pub timezone: String,
    pub default_region: String,
    pub default_currency: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMeRequest {
    pub display_name: Option<String>,
    pub timezone: Option<String>,
    pub default_region: Option<String>,
    pub default_currency: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct BillingChannel {
    pub id: String,
    pub user_id: String,
    pub name: String,
    pub brand: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateBillingChannelRequest {
    pub name: String,
    pub brand: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBillingChannelRequest {
    pub name: Option<String>,
    pub brand: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
pub struct Subscription {
    pub id: String,
    pub user_id: String,
    pub catalog_service_id: Option<String>,
    pub name: String,
    pub logo_url: Option<String>,
    pub category: Option<String>,
    pub amount_minor: i64,
    pub currency: String,
    pub billing_interval_count: i64,
    pub billing_interval_unit: String,
    pub billing_anchor_date: Option<String>,
    pub next_billing_date: String,
    pub renewal_method: String,
    pub billing_channel_id: Option<String>,
    pub billing_channel_name: Option<String>,
    pub status: String,
    pub management_url: Option<String>,
    pub notes: Option<String>,
    pub end_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct CreateSubscriptionRequest {
    pub catalog_service_id: Option<String>,
    pub name: String,
    pub logo_url: Option<String>,
    pub category: Option<String>,
    pub amount_minor: i64,
    pub currency: String,
    pub billing_interval_count: i64,
    pub billing_interval_unit: String,
    pub billing_anchor_date: Option<String>,
    pub next_billing_date: String,
    pub renewal_method: String,
    pub billing_channel_id: Option<String>,
    pub status: Option<String>,
    pub management_url: Option<String>,
    pub notes: Option<String>,
    pub end_date: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct UpdateSubscriptionRequest {
    pub catalog_service_id: Option<Option<String>>,
    pub name: Option<String>,
    pub logo_url: Option<Option<String>>,
    pub category: Option<Option<String>>,
    pub amount_minor: Option<i64>,
    pub currency: Option<String>,
    pub billing_interval_count: Option<i64>,
    pub billing_interval_unit: Option<String>,
    pub billing_anchor_date: Option<Option<String>>,
    pub next_billing_date: Option<String>,
    pub renewal_method: Option<String>,
    pub billing_channel_id: Option<Option<String>>,
    pub status: Option<String>,
    pub management_url: Option<Option<String>>,
    pub notes: Option<Option<String>>,
    pub end_date: Option<Option<String>>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
pub struct PaymentRecord {
    pub id: String,
    pub subscription_id: String,
    pub billing_period_date: String,
    pub paid_at: String,
    pub amount_minor: i64,
    pub currency: String,
    pub billing_channel_name: Option<String>,
    pub note: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreatePaymentRequest {
    pub billing_period_date: String,
    pub paid_at: String,
    pub amount_minor: Option<i64>,
    pub currency: Option<String>,
    pub billing_channel_name: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePaymentRequest {
    pub billing_period_date: Option<String>,
    pub paid_at: Option<String>,
    pub amount_minor: Option<i64>,
    pub currency: Option<String>,
    pub billing_channel_name: Option<Option<String>>,
    pub note: Option<Option<String>>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
pub struct CatalogService {
    pub id: String,
    pub name: String,
    pub aliases: String,
    pub website_domain: Option<String>,
    pub logo_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, FromRow, Clone)]
pub struct CatalogPrice {
    pub id: String,
    pub service_id: String,
    pub region: String,
    pub platform: Option<String>,
    pub plan_name: String,
    pub billing_interval_count: i64,
    pub billing_interval_unit: String,
    pub amount_minor: i64,
    pub currency: String,
    pub source_name: Option<String>,
    pub source_url: Option<String>,
    pub verified_at: Option<String>,
    pub fetched_at: String,
}

#[derive(Debug, Serialize)]
pub struct ServiceWithPrices {
    pub service: CatalogService,
    pub prices: Vec<CatalogPrice>,
}

#[derive(Debug, Serialize)]
pub struct Overview {
    pub currency: Option<String>,
    pub monthly_planned_minor: i64,
    pub upcoming_30_days_minor: i64,
    pub paid_this_month_minor: i64,
    pub active_subscription_count: i64,
    pub subscriptions: Vec<OverviewSubscription>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct OverviewSubscription {
    pub id: String,
    pub name: String,
    pub logo_url: Option<String>,
    pub amount_minor: i64,
    pub currency: String,
    pub billing_interval_count: i64,
    pub billing_interval_unit: String,
    pub next_billing_date: String,
    pub billing_channel_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CalendarResponse {
    pub from: String,
    pub to: String,
    pub upcoming: Vec<CalendarSubscription>,
    pub payments: Vec<PaymentRecord>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct CalendarSubscription {
    pub id: String,
    pub name: String,
    pub logo_url: Option<String>,
    pub amount_minor: i64,
    pub currency: String,
    pub next_billing_date: String,
    pub renewal_method: String,
    pub billing_channel_name: Option<String>,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct ExportPayload {
    pub version: u32,
    pub exported_at: String,
    pub user: User,
    pub billing_channels: Vec<BillingChannel>,
    pub subscriptions: Vec<Subscription>,
    pub payments: Vec<PaymentRecord>,
}

#[derive(Debug, Deserialize)]
pub struct ImportPayload {
    pub version: u32,
    pub billing_channels: Vec<ImportBillingChannel>,
    pub subscriptions: Vec<ImportSubscription>,
    pub payments: Vec<ImportPayment>,
}

#[derive(Debug, Deserialize)]
pub struct ImportBillingChannel {
    pub id: String,
    pub name: String,
    pub brand: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct ImportSubscription {
    pub id: String,
    pub catalog_service_id: Option<String>,
    pub name: String,
    pub logo_url: Option<String>,
    pub category: Option<String>,
    pub amount_minor: i64,
    pub currency: String,
    pub billing_interval_count: i64,
    pub billing_interval_unit: String,
    pub billing_anchor_date: Option<String>,
    pub next_billing_date: String,
    pub renewal_method: String,
    pub billing_channel_id: Option<String>,
    pub status: String,
    pub management_url: Option<String>,
    pub notes: Option<String>,
    pub end_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ImportPayment {
    pub id: String,
    pub subscription_id: String,
    pub billing_period_date: String,
    pub paid_at: String,
    pub amount_minor: i64,
    pub currency: String,
    pub billing_channel_name: Option<String>,
    pub note: Option<String>,
}
