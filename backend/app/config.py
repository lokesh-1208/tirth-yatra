from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./tirth.db"
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 60 * 24 * 7
    algorithm: str = "HS256"
    cors_origins: str = "*"
    otp_expire_minutes: int = 5
    otp_resend_seconds: int = 30
    otp_max_attempts: int = 5
    # Wrong codes in a row (any OTP) before logins for that email / phone are blocked, and for how long.
    otp_max_failures: int = 10
    otp_block_minutes: int = 30
    # Dummy account for development/testing: its OTP is always `test_user_otp`.
    # MUST be disabled in production (ENABLE_TEST_USER=false).
    enable_test_user: bool = True
    test_user_email: str = "test@tirthyatra.app"
    test_user_phone: str = "+919999999999"
    test_user_otp: str = "999999"
    # Any email at this domain also uses the fixed OTP (isolated users for automated tests).
    test_email_domain: str = "qa.tirthyatra.app"

    # Geocoding + road routing. Defaults are the free public servers (light use only).
    external_geo_enabled: bool = True
    nominatim_url: str = "https://nominatim.openstreetmap.org"
    osrm_url: str = "https://router.project-osrm.org"
    geocode_country_codes: str = "in"  # comma-separated ISO codes; empty = worldwide
    external_timeout_seconds: float = 6.0
    http_user_agent: str = "TirthYatra/0.1 (pilgrimage route planner)"

    # Admin section. Emails / phones (comma-separated, as typed at login) that get a role on login.
    # Admins can do everything curators can, plus manage users and read the activity log.
    admin_identifiers: str = ""
    curator_identifiers: str = ""
    # Dev/test admin with the fixed OTP (only while enable_test_user is on). Emails at test_email_domain
    # starting with "admin" are admins too (for automated tests).
    test_admin_email: str = "admin@tirthyatra.app"
    # Dev/test curator with the fixed OTP (only while enable_test_user is on). Any email at
    # test_email_domain whose name starts with "curator" is a curator too (for automated tests).
    test_curator_email: str = "curator@tirthyatra.app"
    # Language of a place's own text fields; other languages are stored as translations.
    default_language: str = "en"
    # Uploaded photos (served at /uploads). Use object storage (S3 / GCS) in production.
    upload_dir: str = "uploads"
    max_upload_mb: float = 5.0
    # Pilgrim reports ("Report wrong info", "Missing a place?"): most one user can send per day.
    max_reports_per_day: int = 10

    # Map tiles, served to the app through /tiles (see routers/tiles.py). OpenStreetMap's servers are
    # for light use only: switch to a paid or self-hosted provider before launch.
    tile_url_template: str = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    tile_cache_dir: str = "tile-cache"
    tile_cache_days: int = 7


@lru_cache
def get_settings() -> Settings:
    return Settings()
