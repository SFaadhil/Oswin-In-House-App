"""V5 backend tests: profile fields, password phone, hierarchical supervisor chain, user leave-balance"""
import os
import pytest
import requests
import uuid

def _load_base_url():
    url = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if not url:
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        url = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    assert url, "REACT_APP_BACKEND_URL is not configured"
    return url.rstrip("/")

BASE_URL = _load_base_url()
API = f"{BASE_URL}/api"

ADMIN = {"email": "s.faadhil@oswinpanel.com", "password": "Admin@123"}
BABLU = {"email": "bablu@oswinpanel.com", "password": "Bablu@2026"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def bablu_token():
    return _login(BABLU)


# ================= PROFILE FIELDS =================
class TestProfileFields:
    def test_patch_profile_new_fields(self, bablu_token):
        payload = {
            "phone": "9999000011",
            "date_of_birth": "1995-04-12",
            "blood_group": "O+",
            "emergency_contact_name": "TEST_Jane",
            "emergency_contact_phone": "8888000022",
            "address": "TEST_221B Baker Street",
        }
        r = requests.patch(f"{API}/auth/profile", json=payload, headers=_hdr(bablu_token))
        assert r.status_code == 200, r.text
        data = r.json()
        for k, v in payload.items():
            assert data.get(k) == v, f"{k} not persisted: got {data.get(k)}"

    def test_auth_me_returns_new_fields(self, bablu_token):
        r = requests.get(f"{API}/auth/me", headers=_hdr(bablu_token))
        assert r.status_code == 200
        data = r.json()
        assert data.get("phone") == "9999000011"
        assert data.get("blood_group") == "O+"
        assert data.get("emergency_contact_name") == "TEST_Jane"
        assert data.get("address") == "TEST_221B Baker Street"


# ================= PASSWORD PHONE =================
class TestPasswordPhone:
    created_id = None

    def test_create_with_phone(self, bablu_token):
        payload = {
            "platform_name": f"TEST_Platform_{uuid.uuid4().hex[:6]}",
            "url": "https://test.example.com",
            "username": "test_user",
            "phone": "7777000033",
            "password": "s3cretP@ss",
            "category": "Other",
        }
        r = requests.post(f"{API}/passwords", json=payload, headers=_hdr(bablu_token))
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data.get("phone") == "7777000033"
        TestPasswordPhone.created_id = data.get("_id") or data.get("id")

    def test_list_returns_phone_no_password(self, bablu_token):
        r = requests.get(f"{API}/passwords", headers=_hdr(bablu_token))
        assert r.status_code == 200
        rows = r.json()
        # Find our created row
        target = next((p for p in rows if p.get("phone") == "7777000033"), None)
        assert target is not None, "phone field not returned from list"
        assert "password" not in target or target.get("password") in (None, ""), "password should be excluded from list"

    def test_cleanup(self, bablu_token):
        if TestPasswordPhone.created_id:
            requests.delete(f"{API}/passwords/{TestPasswordPhone.created_id}", headers=_hdr(bablu_token))


# ================= USER LEAVE-BALANCE =================
class TestUserLeaveBalance:
    def test_admin_can_get_any_user_balance(self, admin_token, bablu_token):
        me = requests.get(f"{API}/auth/me", headers=_hdr(bablu_token)).json()
        bablu_id = me.get("_id") or me.get("id")
        r = requests.get(f"{API}/users/{bablu_id}/leave-balance", headers=_hdr(admin_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert "year" in data
        assert "types" in data
        assert isinstance(data["types"], list)
        if data["types"]:
            t0 = data["types"][0]
            for k in ("id", "name", "quota", "used", "remaining"):
                assert k in t0

    def test_user_can_get_own_balance(self, bablu_token):
        me = requests.get(f"{API}/auth/me", headers=_hdr(bablu_token)).json()
        bablu_id = me.get("_id") or me.get("id")
        r = requests.get(f"{API}/users/{bablu_id}/leave-balance", headers=_hdr(bablu_token))
        assert r.status_code == 200

    def test_user_cannot_get_other_user_balance(self, bablu_token, admin_token):
        # Fetch admin id
        admin_me = requests.get(f"{API}/auth/me", headers=_hdr(admin_token)).json()
        admin_id = admin_me.get("_id") or admin_me.get("id")
        r = requests.get(f"{API}/users/{admin_id}/leave-balance", headers=_hdr(bablu_token))
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"


# ================= HIERARCHICAL CHAIN =================
class TestHierarchicalSupervisor:
    """A (Manager) -> B (Manager) -> C (User). A can see and approve C's leave."""
    ids = {}
    tokens = {}
    leave_id = None

    def _create_user(self, admin_token, role, full_name, manager_id=None):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": email,
            "password": "TestPass@123",
            "full_name": full_name,
            "role": role,
        }
        if manager_id:
            payload["manager_id"] = manager_id
        r = requests.post(f"{API}/users/admin-create", json=payload, headers=_hdr(admin_token))
        assert r.status_code in (200, 201), r.text
        data = r.json()
        uid = data.get("_id") or data.get("id")
        return uid, email

    def test_setup_chain(self, admin_token):
        # Create A (Manager, no manager)
        a_id, a_email = self._create_user(admin_token, "Manager", "TEST_Alice_A")
        # Create B (Manager) under A
        b_id, b_email = self._create_user(admin_token, "Manager", "TEST_Bob_B", manager_id=a_id)
        # Create C (User) under B
        c_id, c_email = self._create_user(admin_token, "User", "TEST_Charlie_C", manager_id=b_id)

        TestHierarchicalSupervisor.ids = {"A": a_id, "B": b_id, "C": c_id,
                                         "A_email": a_email, "B_email": b_email, "C_email": c_email}

        # Login each
        TestHierarchicalSupervisor.tokens["A"] = _login({"email": a_email, "password": "TestPass@123"})
        TestHierarchicalSupervisor.tokens["B"] = _login({"email": b_email, "password": "TestPass@123"})
        TestHierarchicalSupervisor.tokens["C"] = _login({"email": c_email, "password": "TestPass@123"})

    def test_c_applies_leave_with_b_as_supervisor(self):
        # Get a leave type
        lts = requests.get(f"{API}/leave-types", headers=_hdr(self.tokens["C"])).json()
        assert lts, "No leave types"
        lt_id = lts[0]["_id"]

        payload = {
            "leave_type_id": lt_id,
            "supervisor_id": self.ids["B"],
            "start_date": "2026-08-15",
            "end_date": "2026-08-15",
            "half_day": False,
            "reason": "TEST_hierarchical_leave",
        }
        r = requests.post(f"{API}/leaves", json=payload, headers=_hdr(self.tokens["C"]))
        assert r.status_code in (200, 201), r.text
        lv = r.json()
        TestHierarchicalSupervisor.leave_id = lv.get("_id") or lv.get("id")
        assert TestHierarchicalSupervisor.leave_id

    def test_a_sees_c_leave_in_pending(self):
        # A is upstream of C via B -> A should see C's pending leave
        r = requests.get(f"{API}/leaves?scope=pending", headers=_hdr(self.tokens["A"]))
        assert r.status_code == 200
        leaves = r.json()
        match = [lv for lv in leaves if (lv.get("_id") or lv.get("id")) == self.leave_id]
        assert match, f"A (upstream) should see C's pending leave; got {len(leaves)} leaves"

    def test_a_can_view_c_via_scope_user(self):
        r = requests.get(f"{API}/leaves?scope=user&user_id={self.ids['C']}", headers=_hdr(self.tokens["A"]))
        assert r.status_code == 200, r.text

    def test_random_manager_cannot_decide(self, admin_token):
        # Create a random manager outside the chain
        rand_id, rand_email = self._create_user(admin_token, "Manager", "TEST_Random_Mgr")
        rand_token = _login({"email": rand_email, "password": "TestPass@123"})
        r = requests.put(f"{API}/leaves/{self.leave_id}/approve", headers=_hdr(rand_token))
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
        # cleanup user
        requests.delete(f"{API}/users/{rand_id}", headers=_hdr(admin_token))

    def test_a_can_approve_c_leave(self):
        # A approves C's leave (transitive) — B is direct supervisor, but A is also allowed
        r = requests.put(f"{API}/leaves/{self.leave_id}/approve", headers=_hdr(self.tokens["A"]))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("status") == "approved"

    def test_b_could_also_approve_second_leave(self):
        # Create a new pending leave and verify B (direct supervisor) can also approve
        lts = requests.get(f"{API}/leave-types", headers=_hdr(self.tokens["C"])).json()
        lt_id = lts[0]["_id"]
        payload = {
            "leave_type_id": lt_id,
            "supervisor_id": self.ids["B"],
            "start_date": "2026-09-20",
            "end_date": "2026-09-20",
            "half_day": False,
            "reason": "TEST_second_leave",
        }
        r = requests.post(f"{API}/leaves", json=payload, headers=_hdr(self.tokens["C"]))
        assert r.status_code in (200, 201)
        lid = r.json().get("_id")
        r2 = requests.put(f"{API}/leaves/{lid}/approve", headers=_hdr(self.tokens["B"]))
        assert r2.status_code == 200, r2.text
        assert r2.json().get("status") == "approved"

    def test_cleanup_users(self, admin_token):
        for k in ("C", "B", "A"):
            uid = self.ids.get(k)
            if uid:
                requests.delete(f"{API}/users/{uid}", headers=_hdr(admin_token))


# ================= LEAVE TYPES + CATEGORIES =================
class TestLeaveTypesAndCategories:
    def test_leave_types_list(self, admin_token):
        r = requests.get(f"{API}/leave-types", headers=_hdr(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_categories_list(self, admin_token):
        r = requests.get(f"{API}/categories", headers=_hdr(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_leave_type_crud(self, admin_token):
        payload = {"name": f"TEST_LT_{uuid.uuid4().hex[:6]}", "color": "#123456",
                   "default_quota_days": 5, "is_paid": True, "allow_half_day": True}
        r = requests.post(f"{API}/leave-types", json=payload, headers=_hdr(admin_token))
        assert r.status_code in (200, 201), r.text
        lt_id = r.json()["_id"]

        r2 = requests.put(f"{API}/leave-types/{lt_id}", json={"color": "#abcdef"}, headers=_hdr(admin_token))
        assert r2.status_code == 200
        assert r2.json()["color"] == "#abcdef"

        r3 = requests.delete(f"{API}/leave-types/{lt_id}", headers=_hdr(admin_token))
        assert r3.status_code == 200
