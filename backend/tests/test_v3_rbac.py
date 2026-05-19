"""SubTrack Pro V3 - Director role, multi-tenant password/subscription, Access x Scope permissions."""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()

ADMIN = ("s.faadhil@oswinpanel.com", "Admin@123")
DIRECTOR = ("shivam@oswinpanel.com", "Shivam@2026")
BABLU = ("bablu@oswinpanel.com", "Bablu@2026")
SANGRAM = ("sangram@oswinpanel.com", "Sangram@2026")


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    return r


def _headers(email, password):
    r = _login(email, password)
    assert r.status_code == 200, f"login failed for {email}: {r.text}"
    return {"Authorization": f"Bearer {r.json()['access_token']}"}, r.json()


@pytest.fixture(scope="session")
def admin_ctx():
    return _headers(*ADMIN)


@pytest.fixture(scope="session")
def director_ctx():
    return _headers(*DIRECTOR)


@pytest.fixture(scope="session")
def bablu_ctx():
    return _headers(*BABLU)


@pytest.fixture(scope="session")
def sangram_ctx():
    return _headers(*SANGRAM)


# ---- V3: SEEDED ROLES ----
class TestV3Roles:
    def test_admin_role_is_admin_not_md(self):
        r = _login(*ADMIN)
        assert r.status_code == 200
        assert r.json()["role"] == "Admin", f"expected Admin, got {r.json()['role']}"

    def test_director_login(self):
        r = _login(*DIRECTOR)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "Director"
        assert d["access_level"] == "editor"

    def test_bablu_user_login(self):
        r = _login(*BABLU)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "User"
        assert d["access_level"] == "editor"

    def test_all_new_users_can_login(self):
        for email, pw in [
            ("bablu@oswinpanel.com", "Bablu@2026"),
            ("sangram@oswinpanel.com", "Sangram@2026"),
            ("sagar@oswinpanel.com", "Sagar@2026"),
            ("abhirami@oswinpanel.com", "Abhirami@2026"),
            ("tushar@oswinpanel.com", "Tushar@2026"),
        ]:
            r = _login(email, pw)
            assert r.status_code == 200, f"{email} login failed: {r.text}"
            assert r.json()["role"] == "User"

    def test_auth_me_returns_module_permissions(self, bablu_ctx):
        h, _ = bablu_ctx
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=h)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "User"
        assert "access_level" in d
        assert "module_permissions" in d

    def test_auth_me_director(self, director_ctx):
        h, _ = director_ctx
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=h)
        assert r.status_code == 200
        assert r.json()["role"] == "Director"


# ---- V3: MULTI-TENANT PASSWORDS ----
class TestV3Passwords:
    def test_bablu_create_password_has_owner_id(self, bablu_ctx):
        h, me = bablu_ctx
        payload = {
            "platform_name": f"TEST_V3Babpass_{int(time.time())}",
            "username": "bablu_u",
            "password": "BabSecret123!",
            "category": "Other"
        }
        r = requests.post(f"{BASE_URL}/api/passwords", json=payload, headers=h)
        assert r.status_code == 200, r.text
        entry = r.json()
        assert entry.get("owner_id") == me["id"], f"owner_id mismatch: {entry.get('owner_id')} vs {me['id']}"
        # cleanup
        requests.delete(f"{BASE_URL}/api/passwords/{entry['_id']}", headers=h)

    def test_bablu_sees_only_own_passwords(self, bablu_ctx, sangram_ctx):
        hb, meb = bablu_ctx
        hs, mes = sangram_ctx
        # Bablu create
        rb = requests.post(f"{BASE_URL}/api/passwords", json={
            "platform_name": f"TEST_BabOnly_{int(time.time())}",
            "username": "b", "password": "BabX12345!"
        }, headers=hb)
        assert rb.status_code == 200
        bid = rb.json()["_id"]
        # Sangram create
        rs = requests.post(f"{BASE_URL}/api/passwords", json={
            "platform_name": f"TEST_SanOnly_{int(time.time())}",
            "username": "s", "password": "SanX12345!"
        }, headers=hs)
        assert rs.status_code == 200
        sid = rs.json()["_id"]

        # Bablu list -> must not see Sangram's entry
        rl = requests.get(f"{BASE_URL}/api/passwords", headers=hb)
        assert rl.status_code == 200
        ids = [e["_id"] for e in rl.json()]
        assert bid in ids
        assert sid not in ids, "Bablu should not see Sangram's password entry"

        # Bablu reveal own OK
        rr = requests.get(f"{BASE_URL}/api/passwords/{bid}/reveal", headers=hb)
        assert rr.status_code == 200
        assert rr.json()["password"] == "BabX12345!"

        # Bablu reveal other -> 403 or 404
        rr2 = requests.get(f"{BASE_URL}/api/passwords/{sid}/reveal", headers=hb)
        assert rr2.status_code in (403, 404), f"expected 403/404, got {rr2.status_code}"

        # cleanup
        requests.delete(f"{BASE_URL}/api/passwords/{bid}", headers=hb)
        requests.delete(f"{BASE_URL}/api/passwords/{sid}", headers=hs)

    def test_admin_sees_all_passwords_with_owner_name(self, admin_ctx, bablu_ctx):
        ha, _ = admin_ctx
        hb, _ = bablu_ctx
        # Bablu create one
        rb = requests.post(f"{BASE_URL}/api/passwords", json={
            "platform_name": f"TEST_AdminSees_{int(time.time())}",
            "username": "b", "password": "BabY12345!"
        }, headers=hb)
        assert rb.status_code == 200
        bid = rb.json()["_id"]
        # Admin list -> must see it with owner_name
        rl = requests.get(f"{BASE_URL}/api/passwords", headers=ha)
        assert rl.status_code == 200
        found = [e for e in rl.json() if e["_id"] == bid]
        assert len(found) == 1
        assert "owner_name" in found[0], f"owner_name missing, keys={list(found[0].keys())}"
        assert found[0]["owner_name"]
        # cleanup
        requests.delete(f"{BASE_URL}/api/passwords/{bid}", headers=hb)


# ---- V3: MULTI-TENANT SUBSCRIPTIONS ----
class TestV3Subscriptions:
    def test_bablu_creates_subscription_owner_id_set(self, bablu_ctx):
        h, me = bablu_ctx
        r = requests.post(f"{BASE_URL}/api/subscriptions", json={
            "subscription_name": f"TEST_V3Bsub_{int(time.time())}",
            "cost": 300.0, "currency": "INR", "billing_cycle": "Monthly",
            "next_due_date": "2026-06-01", "status": "Active"
        }, headers=h)
        assert r.status_code == 200, r.text
        sub = r.json()
        assert sub.get("owner_id") == me["id"], f"owner_id mismatch"
        requests.delete(f"{BASE_URL}/api/subscriptions/{sub['_id']}", headers=h)

    def test_bablu_sees_only_own_subs(self, bablu_ctx, sangram_ctx):
        hb, _ = bablu_ctx
        hs, _ = sangram_ctx
        rb = requests.post(f"{BASE_URL}/api/subscriptions", json={
            "subscription_name": f"TEST_BsubOnly_{int(time.time())}",
            "cost": 100.0, "currency": "INR", "billing_cycle": "Monthly",
            "next_due_date": "2026-06-01", "status": "Active"
        }, headers=hb)
        bid = rb.json()["_id"]
        rs = requests.post(f"{BASE_URL}/api/subscriptions", json={
            "subscription_name": f"TEST_SsubOnly_{int(time.time())}",
            "cost": 200.0, "currency": "INR", "billing_cycle": "Monthly",
            "next_due_date": "2026-06-01", "status": "Active"
        }, headers=hs)
        sid = rs.json()["_id"]

        rl = requests.get(f"{BASE_URL}/api/subscriptions", headers=hb)
        assert rl.status_code == 200
        ids = [s["_id"] for s in rl.json()]
        assert bid in ids
        assert sid not in ids, "Bablu should not see Sangram's subscription"

        # cleanup
        requests.delete(f"{BASE_URL}/api/subscriptions/{bid}", headers=hb)
        requests.delete(f"{BASE_URL}/api/subscriptions/{sid}", headers=hs)


# ---- V3: REPORTS ACCESSIBLE TO USER ----
class TestV3Reports:
    def test_bablu_can_access_spending_report(self, bablu_ctx):
        h, _ = bablu_ctx
        r = requests.get(f"{BASE_URL}/api/reports/spending", headers=h)
        assert r.status_code == 200, f"expected 200, got {r.status_code} ({r.text[:200]})"


# ---- V3: ACCESS x SCOPE OVERRIDE ----
class TestV3PermissionOverrides:
    """Admin overrides Bablu's module_permissions and verifies effective access."""

    def test_override_subs_view_overall_then_revert(self, admin_ctx, bablu_ctx):
        ha, _ = admin_ctx
        hb, meb = bablu_ctx
        bablu_id = meb["id"]

        # Give Bablu view/overall on subscriptions
        ru = requests.put(
            f"{BASE_URL}/api/users/{bablu_id}",
            json={"module_permissions": {
                "subscriptions": {"access": "view", "scope": "overall"}
            }},
            headers=ha
        )
        assert ru.status_code == 200, ru.text

        # /auth/me reflects override
        rme = requests.get(f"{BASE_URL}/api/auth/me", headers=hb)
        assert rme.status_code == 200
        mp = rme.json().get("module_permissions", {})
        subs_perm = mp.get("subscriptions")
        assert isinstance(subs_perm, dict), f"expected dict, got {subs_perm}"
        assert subs_perm.get("access") == "view"
        assert subs_perm.get("scope") == "overall"

        # Admin creates sub so overall scope makes it visible
        rc = requests.post(f"{BASE_URL}/api/subscriptions", json={
            "subscription_name": f"TEST_AdminSub_{int(time.time())}",
            "cost": 500.0, "currency": "INR", "billing_cycle": "Monthly",
            "next_due_date": "2026-06-01", "status": "Active"
        }, headers=ha)
        assert rc.status_code == 200
        asid = rc.json()["_id"]

        # Bablu GET subscriptions - should include admin's sub (overall scope)
        rl = requests.get(f"{BASE_URL}/api/subscriptions", headers=hb)
        assert rl.status_code == 200
        ids = [s["_id"] for s in rl.json()]
        assert asid in ids, "view/overall should let Bablu see admin subs"

        # Bablu POST -> 403 (view not edit)
        rp = requests.post(f"{BASE_URL}/api/subscriptions", json={
            "subscription_name": f"TEST_ShouldFail_{int(time.time())}",
            "cost": 10.0, "currency": "INR", "billing_cycle": "Monthly",
            "next_due_date": "2026-06-01", "status": "Active"
        }, headers=hb)
        assert rp.status_code == 403, f"expected 403 with view access, got {rp.status_code}"

        # Revert to default (editor/individual)
        requests.put(
            f"{BASE_URL}/api/users/{bablu_id}",
            json={"module_permissions": {
                "subscriptions": {"access": "edit", "scope": "individual"}
            }},
            headers=ha
        )
        requests.delete(f"{BASE_URL}/api/subscriptions/{asid}", headers=ha)

    def test_override_passwords_none_blocks_access(self, admin_ctx, bablu_ctx):
        ha, _ = admin_ctx
        hb, meb = bablu_ctx
        bablu_id = meb["id"]

        ru = requests.put(
            f"{BASE_URL}/api/users/{bablu_id}",
            json={"module_permissions": {
                "passwords": {"access": "none", "scope": "individual"}
            }},
            headers=ha
        )
        assert ru.status_code == 200

        rl = requests.get(f"{BASE_URL}/api/passwords", headers=hb)
        assert rl.status_code == 403, f"expected 403, got {rl.status_code}"

        # Revert
        requests.put(
            f"{BASE_URL}/api/users/{bablu_id}",
            json={"module_permissions": {
                "passwords": {"access": "edit", "scope": "individual"}
            }},
            headers=ha
        )
