"""SubTrack Pro V2 - Backend API Tests (pytest)"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()

MD_EMAIL = "s.faadhil@oswinpanel.com"
MD_PASS = "Admin@123"
MANAGER_EMAIL = "manager@test.com"
MANAGER_PASS = "Manager@123"
USER_EMAIL = "user@test.com"
USER_PASS = "User@1234"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    return r


@pytest.fixture(scope="session")
def md_headers():
    r = _login(MD_EMAIL, MD_PASS)
    assert r.status_code == 200, f"MD login failed: {r.text}"
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def manager_headers():
    r = _login(MANAGER_EMAIL, MANAGER_PASS)
    if r.status_code != 200:
        requests.post(f"{BASE_URL}/api/auth/register", json={"email": MANAGER_EMAIL, "password": MANAGER_PASS, "full_name": "Test Manager", "role": "Manager"})
        r = _login(MANAGER_EMAIL, MANAGER_PASS)
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def user_headers():
    r = _login(USER_EMAIL, USER_PASS)
    if r.status_code != 200:
        requests.post(f"{BASE_URL}/api/auth/register", json={"email": USER_EMAIL, "password": USER_PASS, "full_name": "Test User", "role": "User"})
        r = _login(USER_EMAIL, USER_PASS)
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ---- V1: AUTH ----
class TestAuth:
    def test_md_login_returns_role_and_access_level(self):
        r = _login(MD_EMAIL, MD_PASS)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] in ("MD", "Admin")  # V3 migrated MD -> Admin
        assert d["access_level"] in ("editor", "viewer")
        assert "access_token" in d

    def test_manager_login_has_role_access_level(self, manager_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=manager_headers)
        assert r.status_code == 200
        assert r.json()["role"] == "Manager"
        assert "access_level" in r.json()

    def test_user_login_has_role_access_level(self, user_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=user_headers)
        assert r.status_code == 200
        assert r.json()["role"] == "User"
        assert "access_level" in r.json()

    def test_login_invalid_creds(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "nope@x.com", "password": "badpass123"})
        assert r.status_code == 401


# ---- V2: DASHBOARD STATS ----
class TestDashboard:
    def test_dashboard_has_all_v2_fields(self, md_headers):
        r = requests.get(f"{BASE_URL}/api/reports/dashboard", headers=md_headers)
        assert r.status_code == 200
        d = r.json()
        for key in ["total_monthly", "total_annual", "one_time_total", "active_count",
                    "upcoming_renewals", "category_breakdown", "monthly_trend", "recent_subscriptions"]:
            assert key in d, f"Missing key {key}"
        assert isinstance(d["monthly_trend"], list)
        assert len(d["monthly_trend"]) == 6, f"Expected 6 months, got {len(d['monthly_trend'])}"
        for item in d["monthly_trend"]:
            assert "month" in item and "total" in item


# ---- V2: ONE TIME BILLING CYCLE ----
class TestOneTimeBilling:
    def test_one_time_subscription_excluded_from_monthly_annual(self, md_headers):
        # Get baseline
        r0 = requests.get(f"{BASE_URL}/api/reports/dashboard", headers=md_headers)
        base_monthly = r0.json()["total_monthly"]
        base_onetime = r0.json()["one_time_total"]

        # Create a One Time sub
        payload = {
            "subscription_name": "TEST_OneTime_V2",
            "cost": 5000.0, "currency": "INR",
            "billing_cycle": "One Time",
            "next_due_date": "2026-06-01", "status": "Active"
        }
        r = requests.post(f"{BASE_URL}/api/subscriptions", json=payload, headers=md_headers)
        assert r.status_code == 200
        sub_id = r.json()["_id"]

        r2 = requests.get(f"{BASE_URL}/api/reports/dashboard", headers=md_headers)
        d2 = r2.json()
        # Monthly should NOT increase (One Time excluded)
        assert abs(d2["total_monthly"] - base_monthly) < 0.01, f"Monthly changed: {base_monthly} -> {d2['total_monthly']}"
        # one_time_total SHOULD increase by 5000
        assert abs(d2["one_time_total"] - base_onetime - 5000.0) < 0.01, f"one_time_total mismatch"

        # Cleanup
        requests.delete(f"{BASE_URL}/api/subscriptions/{sub_id}", headers=md_headers)


# ---- V2: PEOPLE CRUD ----
class TestPeople:
    def test_user_can_create_person(self, user_headers):
        name = f"TEST_Person_{int(time.time())}"
        r = requests.post(f"{BASE_URL}/api/people", json={"name": name}, headers=user_headers)
        assert r.status_code == 200, r.text
        assert r.json()["name"] == name

    def test_get_people(self, md_headers):
        r = requests.get(f"{BASE_URL}/api/people", headers=md_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_manager_cannot_update_person(self, md_headers, manager_headers):
        name = f"TEST_PUpd_{int(time.time())}"
        r = requests.post(f"{BASE_URL}/api/people", json={"name": name}, headers=md_headers)
        pid = r.json()["_id"]
        r2 = requests.put(f"{BASE_URL}/api/people/{pid}", json={"name": name + "_x"}, headers=manager_headers)
        assert r2.status_code == 403
        requests.delete(f"{BASE_URL}/api/people/{pid}", headers=md_headers)

    def test_md_can_update_delete_person(self, md_headers):
        name = f"TEST_PCrud_{int(time.time())}"
        r = requests.post(f"{BASE_URL}/api/people", json={"name": name}, headers=md_headers)
        pid = r.json()["_id"]
        r2 = requests.put(f"{BASE_URL}/api/people/{pid}", json={"name": name + "_Updated"}, headers=md_headers)
        assert r2.status_code == 200
        assert r2.json()["name"] == name + "_Updated"
        r3 = requests.delete(f"{BASE_URL}/api/people/{pid}", headers=md_headers)
        assert r3.status_code == 200

    def test_subscription_responsible_person_expands(self, md_headers):
        name = f"TEST_PExp_{int(time.time())}"
        rp = requests.post(f"{BASE_URL}/api/people", json={"name": name}, headers=md_headers)
        pid = rp.json()["_id"]
        rs = requests.post(f"{BASE_URL}/api/subscriptions", json={
            "subscription_name": "TEST_WithPerson", "cost": 100.0, "currency": "INR",
            "billing_cycle": "Monthly", "next_due_date": "2026-06-01",
            "status": "Active", "responsible_person_id": pid
        }, headers=md_headers)
        assert rs.status_code == 200
        sid = rs.json()["_id"]
        # List and verify expansion
        rl = requests.get(f"{BASE_URL}/api/subscriptions?search=TEST_WithPerson", headers=md_headers)
        assert rl.status_code == 200
        found = [s for s in rl.json() if s["_id"] == sid]
        assert len(found) == 1
        assert found[0].get("responsible_person") is not None
        assert found[0]["responsible_person"]["name"] == name
        requests.delete(f"{BASE_URL}/api/subscriptions/{sid}", headers=md_headers)
        requests.delete(f"{BASE_URL}/api/people/{pid}", headers=md_headers)


# ---- V2: SPENDING REPORT ----
class TestSpendingReport:
    def test_spending_report_fields(self, md_headers):
        r = requests.get(f"{BASE_URL}/api/reports/spending", headers=md_headers)
        assert r.status_code == 200
        d = r.json()
        for key in ["category_breakdown", "person_breakdown", "user_breakdown",
                    "subscriptions", "total_monthly", "total_annual", "total_one_time"]:
            assert key in d, f"Missing key {key} in spending report"

    def test_user_can_access_spending_v3(self, user_headers):
        # V3: Users now have reports:view access by default
        r = requests.get(f"{BASE_URL}/api/reports/spending", headers=user_headers)
        assert r.status_code == 200



# ---- V2: ADMIN USER MANAGEMENT WITH MODULE PERMISSIONS ----
class TestAdminUsers:
    def test_admin_create_user_with_module_permissions(self, md_headers):
        email = f"test_adm_{int(time.time())}@test.com"
        payload = {
            "email": email, "password": "Password123!",
            "full_name": "Test Adm Created",
            "role": "User", "access_level": "viewer",
            "module_permissions": {"subscriptions": "view", "passwords": "none", "reports": "edit"}
        }
        r = requests.post(f"{BASE_URL}/api/users/admin-create", json=payload, headers=md_headers)
        assert r.status_code == 200, r.text
        user = r.json()
        uid = user["_id"]
        assert user["role"] == "User"
        assert user["access_level"] == "viewer"
        assert user["module_permissions"]["subscriptions"] == "view"
        assert user["module_permissions"]["passwords"] == "none"

        # Update module_permissions
        ru = requests.put(f"{BASE_URL}/api/users/{uid}",
                          json={"module_permissions": {"subscriptions": "none", "reports": "view"}},
                          headers=md_headers)
        assert ru.status_code == 200
        # Verify persistence by GET
        rg = requests.get(f"{BASE_URL}/api/users/{uid}", headers=md_headers)
        assert rg.status_code == 200
        assert rg.json()["module_permissions"]["subscriptions"] == "none"

        # Cleanup (deactivate)
        requests.delete(f"{BASE_URL}/api/users/{uid}", headers=md_headers)

    def test_user_cannot_list_users(self, user_headers):
        r = requests.get(f"{BASE_URL}/api/users", headers=user_headers)
        assert r.status_code == 403


# ---- V2: SUBSCRIPTION CRUD ----
class TestSubscriptions:
    def test_create_edit_delete(self, md_headers):
        r = requests.post(f"{BASE_URL}/api/subscriptions", json={
            "subscription_name": "TEST_CRUD", "cost": 100.0, "currency": "INR",
            "billing_cycle": "Monthly", "next_due_date": "2026-03-01", "status": "Active"
        }, headers=md_headers)
        assert r.status_code == 200
        sid = r.json()["_id"]
        ru = requests.put(f"{BASE_URL}/api/subscriptions/{sid}",
                          json={"cost": 200.0}, headers=md_headers)
        assert ru.status_code == 200
        assert ru.json()["cost"] == 200.0
        rd = requests.delete(f"{BASE_URL}/api/subscriptions/{sid}", headers=md_headers)
        assert rd.status_code == 200
