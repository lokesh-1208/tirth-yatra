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


@lru_cache
def get_settings() -> Settings:
    return Settings()
