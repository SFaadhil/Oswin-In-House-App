"""V4 Employee Portal – leaves, notifications, calendar, supervisors, leave-types."""
import os
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://brave-snyder-5.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "s.faadhil@oswinpanel.com", "password": "Admin@123"}
DIRECTOR = {"email": "shivam@oswinpanel.com", "password": "Shivam@2026"}
BABLU = {"email": "bablu@oswinpanel.com", "password": "Bablu@2026"}
SANGRAM = {"email": "sangram@oswinpanel.com", "password": "Sangram@2026"}
MANAGER = {"email": "manager@test.com", "password": "Manager@123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=10)
    if r.status_code != 200:
        pytest.skip(f"Login failed for {creds['email']}: {r.status_code} {r.text}")
    body = r.json()
    return body.get("access_token") or body.get("token")


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def director_token():
    return _login(DIRECTOR)


@pytest.fixture(scope="module")
def bablu_token():
    return _login(BABLU)


@pytest.fixture(scope="module")
def sangram_token():
    return _login(SANGRAM)


@pytest.fixture(scope="module")
def manager_token():
    return _login(MANAGER)


@pytest.fixture(scope="module")
def bablu_id(bablu_token):
    r = requests.get(f"{API}/auth/me", headers=_hdr(bablu_token), timeout=10)
    body = r.json()
    return body.get("id") or body.get("_id")


@pytest.fixture(scope="module")
def admin_id(admin_token):
    r = requests.get(f"{API}/auth/me", headers=_hdr(admin_token), timeout=10)
    body = r.json()
    return body.get("id") or body.get("_id")


# -----------------------------------------------
# Leave Types
# -----------------------------------------------
class TestLeaveTypes:
    def test_default_seeded_5_types(self, bablu_token):
        r = requests.get(f"{API}/leave-types", headers=_hdr(bablu_token), timeout=10)
        assert r.status_code == 200
        types = r.json()
        names = {t["name"] for t in types}
        # 5 defaults must exist
        for expected in ["Casual Leave", "Sick Leave", "Annual Leave", "Work From Home", "Unpaid Leave"]:
            assert expected in names, f"Missing default leave type {expected}; got {names}"
        quotas = {t["name"]: t["default_quota_days"] for t in types}
        assert quotas["Casual Leave"] == 12
        assert quotas["Sick Leave"] == 10
        assert quotas["Annual Leave"] == 15
        assert quotas["Work From Home"] == 30
        assert quotas["Unpaid Leave"] == 0

    def test_user_cannot_create_leave_type(self, bablu_token):
        payload = {"name": "TEST_UserCreated", "default_quota_days": 5}
        r = requests.post(f"{API}/leave-types", headers=_hdr(bablu_token), json=payload, timeout=10)
        assert r.status_code == 403, f"Expected 403 got {r.status_code}: {r.text}"

    def test_admin_can_create_update_delete_leave_type(self, admin_token):
        name = f"TEST_LT_{datetime.now().timestamp():.0f}"
        # create
        r = requests.post(f"{API}/leave-types", headers=_hdr(admin_token),
                          json={"name": name, "color": "#123456", "default_quota_days": 7,
                                "is_paid": True, "allow_half_day": False}, timeout=10)
        assert r.status_code == 200, r.text
        lt = r.json()
        lt_id = lt["_id"]
        assert lt["name"] == name
        # update
        r2 = requests.put(f"{API}/leave-types/{lt_id}", headers=_hdr(admin_token),
                          json={"default_quota_days": 9}, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["default_quota_days"] == 9
        # deactivate
        r3 = requests.delete(f"{API}/leave-types/{lt_id}", headers=_hdr(admin_token), timeout=10)
        assert r3.status_code == 200


# -----------------------------------------------
# Supervisors
# -----------------------------------------------
class TestSupervisors:
    def test_supervisors_excludes_user_role(self, bablu_token):
        r = requests.get(f"{API}/supervisors", headers=_hdr(bablu_token), timeout=10)
        assert r.status_code == 200
        sups = r.json()
        assert len(sups) > 0
        roles = {s["role"] for s in sups}
        # No 'User' role allowed
        assert "User" not in roles, f"Supervisor list incorrectly contains User role: {sups}"
        # Should have Admin or Director somewhere
        assert roles & {"Admin", "Director", "Manager", "MD"}


# -----------------------------------------------
# Apply / List / Approve / Reject / Cancel
# -----------------------------------------------
class TestLeaveLifecycle:
    @pytest.fixture
    def casual_type_id(self, bablu_token):
        r = requests.get(f"{API}/leave-types", headers=_hdr(bablu_token), timeout=10)
        for t in r.json():
            if t["name"] == "Casual Leave":
                return t["_id"]
        pytest.skip("Casual Leave not found")

    @pytest.fixture
    def admin_supervisor_id(self, bablu_token):
        r = requests.get(f"{API}/supervisors", headers=_hdr(bablu_token), timeout=10)
        for s in r.json():
            if s["role"] in ("Admin", "Director", "MD"):
                return s["id"]
        pytest.skip("No admin supervisor found")

    def test_apply_3_day_leave_total_3(self, bablu_token, casual_type_id, admin_supervisor_id):
        payload = {
            "leave_type_id": casual_type_id,
            "supervisor_id": admin_supervisor_id,
            "start_date": "2026-06-10",
            "end_date": "2026-06-12",
            "half_day": False,
            "reason": "TEST_v4 3-day leave",
        }
        r = requests.post(f"{API}/leaves", headers=_hdr(bablu_token), json=payload, timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "pending"
        assert body["total_days"] == 3.0
        assert body["user"]["email"] == BABLU["email"]
        # cleanup
        requests.delete(f"{API}/leaves/{body['_id']}", headers=_hdr(bablu_token), timeout=10)

    def test_apply_half_day_total_0_5(self, bablu_token, casual_type_id, admin_supervisor_id):
        payload = {
            "leave_type_id": casual_type_id,
            "supervisor_id": admin_supervisor_id,
            "start_date": "2026-06-15",
            "end_date": "2026-06-15",
            "half_day": True,
            "reason": "TEST_v4 half day",
        }
        r = requests.post(f"{API}/leaves", headers=_hdr(bablu_token), json=payload, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["total_days"] == 0.5
        requests.delete(f"{API}/leaves/{r.json()['_id']}", headers=_hdr(bablu_token), timeout=10)

    def test_invalid_end_before_start_400(self, bablu_token, casual_type_id, admin_supervisor_id):
        payload = {
            "leave_type_id": casual_type_id,
            "supervisor_id": admin_supervisor_id,
            "start_date": "2026-07-10",
            "end_date": "2026-07-05",
            "half_day": False,
            "reason": "TEST_v4 invalid",
        }
        r = requests.post(f"{API}/leaves", headers=_hdr(bablu_token), json=payload, timeout=10)
        assert r.status_code == 400

    def test_half_day_with_range_400(self, bablu_token, casual_type_id, admin_supervisor_id):
        payload = {
            "leave_type_id": casual_type_id,
            "supervisor_id": admin_supervisor_id,
            "start_date": "2026-07-10",
            "end_date": "2026-07-12",
            "half_day": True,
            "reason": "TEST_v4 invalid half",
        }
        r = requests.post(f"{API}/leaves", headers=_hdr(bablu_token), json=payload, timeout=10)
        assert r.status_code == 400

    def test_scope_mine_returns_only_own(self, bablu_token, sangram_token, casual_type_id, admin_supervisor_id):
        # bablu creates one
        payload = {
            "leave_type_id": casual_type_id,
            "supervisor_id": admin_supervisor_id,
            "start_date": "2026-08-10",
            "end_date": "2026-08-10",
            "half_day": False,
            "reason": "TEST_v4 mine",
        }
        r = requests.post(f"{API}/leaves", headers=_hdr(bablu_token), json=payload, timeout=10)
        assert r.status_code == 200
        bid = r.json()["_id"]
        # bablu mine
        r2 = requests.get(f"{API}/leaves?scope=mine", headers=_hdr(bablu_token), timeout=10)
        assert r2.status_code == 200
        assert any(lv["_id"] == bid for lv in r2.json())
        # sangram mine should NOT include bid
        r3 = requests.get(f"{API}/leaves?scope=mine", headers=_hdr(sangram_token), timeout=10)
        assert all(lv["_id"] != bid for lv in r3.json())
        requests.delete(f"{API}/leaves/{bid}", headers=_hdr(bablu_token), timeout=10)

    def test_scope_pending_user_empty_or_self(self, bablu_token):
        r = requests.get(f"{API}/leaves?scope=pending", headers=_hdr(bablu_token), timeout=10)
        assert r.status_code == 200
        # Bablu is User role; pending shows leaves where Bablu is supervisor (should be empty)
        assert isinstance(r.json(), list)

    def test_scope_all_403_for_user(self, bablu_token):
        r = requests.get(f"{API}/leaves?scope=all", headers=_hdr(bablu_token), timeout=10)
        assert r.status_code == 403

    def test_scope_all_works_for_admin(self, admin_token):
        r = requests.get(f"{API}/leaves?scope=all", headers=_hdr(admin_token), timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_approves_and_notifies_owner(self, bablu_token, admin_token, bablu_id, casual_type_id, admin_supervisor_id):
        # bablu creates
        payload = {
            "leave_type_id": casual_type_id,
            "supervisor_id": admin_supervisor_id,
            "start_date": "2026-09-05",
            "end_date": "2026-09-06",
            "half_day": False,
            "reason": "TEST_v4 approve",
        }
        r = requests.post(f"{API}/leaves", headers=_hdr(bablu_token), json=payload, timeout=10)
        assert r.status_code == 200
        lid = r.json()["_id"]
        # admin approves
        r2 = requests.put(f"{API}/leaves/{lid}/approve", headers=_hdr(admin_token), timeout=10)
        assert r2.status_code == 200, r2.text
        body = r2.json()
        assert body["status"] == "approved"
        assert body.get("approved_by")
        # bablu notifications include leave_approved
        r3 = requests.get(f"{API}/notifications", headers=_hdr(bablu_token), timeout=10)
        assert r3.status_code == 200
        items = r3.json()["items"]
        assert any(n["type"] == "leave_approved" and n["ref_id"] == lid for n in items), f"approval notif missing: {items[:3]}"
        # cleanup (cancel approved)
        requests.delete(f"{API}/leaves/{lid}", headers=_hdr(admin_token), timeout=10)

    def test_admin_rejects_with_reason(self, bablu_token, admin_token, casual_type_id, admin_supervisor_id):
        payload = {
            "leave_type_id": casual_type_id,
            "supervisor_id": admin_supervisor_id,
            "start_date": "2026-10-05",
            "end_date": "2026-10-06",
            "half_day": False,
            "reason": "TEST_v4 reject",
        }
        r = requests.post(f"{API}/leaves", headers=_hdr(bablu_token), json=payload, timeout=10)
        lid = r.json()["_id"]
        r2 = requests.put(f"{API}/leaves/{lid}/reject", headers=_hdr(admin_token),
                          json={"rejection_reason": "TEST_v4 not enough notice"}, timeout=10)
        assert r2.status_code == 200, r2.text
        assert r2.json()["status"] == "rejected"
        assert r2.json()["rejection_reason"] == "TEST_v4 not enough notice"
        # bablu gets leave_rejected notification with reason in message
        r3 = requests.get(f"{API}/notifications", headers=_hdr(bablu_token), timeout=10)
        items = r3.json()["items"]
        rej = [n for n in items if n["type"] == "leave_rejected" and n["ref_id"] == lid]
        assert rej, "rejected notif missing"
        assert "TEST_v4 not enough notice" in rej[0]["message"]

    def test_user_cannot_cancel_other_user_leave(self, bablu_token, sangram_token, casual_type_id, admin_supervisor_id):
        payload = {
            "leave_type_id": casual_type_id,
            "supervisor_id": admin_supervisor_id,
            "start_date": "2026-11-01",
            "end_date": "2026-11-01",
            "half_day": False,
            "reason": "TEST_v4 cancel cross",
        }
        r = requests.post(f"{API}/leaves", headers=_hdr(bablu_token), json=payload, timeout=10)
        lid = r.json()["_id"]
        r2 = requests.delete(f"{API}/leaves/{lid}", headers=_hdr(sangram_token), timeout=10)
        assert r2.status_code == 403
        # cleanup
        requests.delete(f"{API}/leaves/{lid}", headers=_hdr(bablu_token), timeout=10)


# -----------------------------------------------
# Balance + Calendar
# -----------------------------------------------
class TestBalanceAndCalendar:
    def test_balance_lists_5_types(self, bablu_token):
        r = requests.get(f"{API}/leaves/balance", headers=_hdr(bablu_token), timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "year" in body and "types" in body
        assert len(body["types"]) >= 5
        for t in body["types"]:
            assert {"id", "name", "quota", "used", "remaining"}.issubset(t.keys())
            assert t["remaining"] == max(0.0, t["quota"] - t["used"])

    def test_calendar_only_approved(self, bablu_token):
        r = requests.get(f"{API}/leaves/calendar?start=2026-01-01&end=2026-12-31",
                         headers=_hdr(bablu_token), timeout=10)
        assert r.status_code == 200
        for lv in r.json():
            assert lv["status"] == "approved"
            assert "user" in lv and "leave_type" in lv


# -----------------------------------------------
# Notifications
# -----------------------------------------------
class TestNotifications:
    def test_get_notifications_shape(self, bablu_token):
        r = requests.get(f"{API}/notifications", headers=_hdr(bablu_token), timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "items" in body
        assert "unread_count" in body
        assert isinstance(body["unread_count"], int)

    def test_mark_all_read_sets_unread_zero(self, bablu_token):
        r = requests.put(f"{API}/notifications/read-all", headers=_hdr(bablu_token), timeout=10)
        assert r.status_code == 200
        r2 = requests.get(f"{API}/notifications", headers=_hdr(bablu_token), timeout=10)
        assert r2.json()["unread_count"] == 0


# -----------------------------------------------
# Employee Dashboard
# -----------------------------------------------
class TestEmployeeDashboard:
    def test_user_dashboard_shape(self, bablu_token):
        r = requests.get(f"{API}/employee/dashboard", headers=_hdr(bablu_token), timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "my_recent_leaves" in body
        assert "team_on_leave_today" in body
        assert "pending_approvals" in body
        assert body["pending_approvals"] == 0  # User can't approve

    def test_admin_dashboard_pending_count_int(self, admin_token):
        r = requests.get(f"{API}/employee/dashboard", headers=_hdr(admin_token), timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body["pending_approvals"], int)
