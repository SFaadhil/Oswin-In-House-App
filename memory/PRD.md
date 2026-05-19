# SubTrack Pro - PRD

## Project Overview
**Product:** SubTrack Pro (Oswin Ply Resource Tracker) — Subscription + Credential Management
**Version:** 2.0
**Date:** April 2026
**Platform:** Emergent AI (React + FastAPI + MongoDB)

## Problem Statement
Comprehensive subscription & credential management platform for Oswin Ply (5–10 users). Tracks recurring/one-time costs per responsible person, with role-based access control, granular per-module permissions, and an encrypted password vault for admins.

## User Personas
- **MD (Managing Director):** Full access — all subscriptions, categories, users, reports, and encrypted password vault. Manages granular per-module overrides.
- **Manager:** Views team subscriptions, accesses reports. Cannot manage users/categories/passwords.
- **User:** Views/manages own subscriptions only.

## Brand
- Primary Green: #009d44 · Dark Green: #006538 · Accent Red: #e31e24 · Accent Yellow: #ffed00
- Logo: Oswin Ply (green house mark), rendered in white-padded card on all dark surfaces.

## Architecture
**Backend:** FastAPI + MongoDB (Motor async) + Fernet AES-128 for password vault.
- Bearer JWT auth (localStorage `subtrack_token`, also mirrored to httpOnly cookies)
- RoleChecker dependency + access_level (editor/viewer) + optional module_permissions overrides
- Soft delete for subscriptions

**Frontend:** React 19 + Tailwind + shadcn + Recharts + Sonner + jsPDF.
- Theme system via CSS variables (light/dark) persisted in localStorage
- Context providers: AuthContext, ThemeContext

## Core Requirements
1. Auth with 3 roles + 2 access levels (editor/viewer) + optional per-module overrides
2. Subscription CRUD (Monthly/Quarterly/Semi-Annual/Annual/One Time/Custom)
3. Responsible-Person assignment (separate from owner/adder) with inline "add new person"
4. Dashboard: monthly, annual, active count, due soon, one-time total, historical 6-month trend, category pie
5. Reports: Category / By Person / By Adder / All Subscriptions + CSV + PDF export
6. Categories with brand colors (default seed)
7. User Management (MD) with inline create modal + module_permissions editor
8. **Password Manager** (MD only) — Fernet-encrypted vault with reveal/copy/search/category

## V3 Update (Feb 2026)

### Multi-tenant roles & permissions
- ✅ Added **Director** role (peer of Admin, both top-tier)
- ✅ Migrated legacy `MD` → `Admin` (auto-migration on startup for `s.faadhil@oswinpanel.com`)
- ✅ `require_md`/`require_md_or_manager` and users listing updated to accept Director/Admin/MD
- ✅ Seeded Director: Shivam (shivam@oswinpanel.com / Shivam@2026)
- ✅ Seeded 5 Users: Bablu, Sangram, Sagar, Abhirami, Tushar (firstname@2026)
- ✅ Upgraded `module_permissions` model: `{module: {access: 'edit'|'view'|'none', scope: 'individual'|'overall'}}` with legacy string fallback
- ✅ `get_module_perm(user, module)` resolves effective permission with role defaults
- ✅ `require_module(module, need_edit)` FastAPI dependency factory replaces hardcoded role guards

### Multi-tenant Password Vault
- ✅ Each `password_entries` doc now carries `owner_id`
- ✅ Users default to edit/individual → see only own entries
- ✅ Director/Admin default to edit/overall → see all entries with `owner_name` expansion
- ✅ All CRUD endpoints (`GET /api/passwords`, `/reveal`, `PUT`, `DELETE`) enforce scope

### Multi-tenant Subscriptions
- ✅ `build_sub_query()` uses `get_module_perm("subscriptions")` to filter by scope
- ✅ Update/Delete check scope before mutation

### Frontend
- ✅ `PermissionEditor` now has Access dropdown (default/edit/view/none) + Scope dropdown (individual/overall) per module
- ✅ `Layout.jsx` nav filtering handles new object format, Director role badge (purple), Admin label (formerly MD)
- ✅ `PasswordManager.jsx` shows Owner column when `owner_name` present (overall scope)
- ✅ `Profile.jsx` renders module permissions as Access + Scope badges

### Test Results (Iteration 3 — Feb 2026)
- Backend: 34/34 pytest + 1 critical regression fix verified (GET /api/users now returns all users for Director/Admin, not just MD)
- Frontend: Login flow + sidebar filter + Password Manager per-user scope verified
### Backend
- ✅ Fernet encryption (`ENCRYPTION_KEY` in .env) for password vault
- ✅ `/api/passwords` CRUD + `/api/passwords/{id}/reveal` (MD only)
- ✅ `/api/people` CRUD for Responsible Persons
- ✅ One Time billing cycle separated from monthly/annual totals; surfaced as `one_time_total`
- ✅ Historical monthly_trend based on subscription created_at/updated_at window per month
- ✅ `access_level` (editor/viewer) + `module_permissions` dict on User model
- ✅ `POST /api/users/admin-create` with role, access_level, manager, module_permissions
- ✅ `/api/auth/me` backfills `access_level` and `module_permissions` defaults

### Frontend
- ✅ Oswin Ply branding: green palette, logo in sidebar + login
- ✅ Theme toggle (light/dark) with full CSS-variable conversion across all pages
- ✅ Dashboard: brand-colored charts, one-time cost banner, historical trend
- ✅ Subscriptions: One Time cycle (hides due date), Responsible Person filter, inline add-person
- ✅ Reports: 4 tabs including By Person, By Adder; brand-colored charts; CSV + PDF
- ✅ Users: create + edit modals with module permissions editor (5 modules × edit/view/none/default)
- ✅ Password Manager page: encrypted vault UI with reveal/copy/search
- ✅ Profile: theme-aware, shows role + access_level badges + module permissions summary
- ✅ Layout sidebar filters nav based on module_permissions

### Admin Seeded
- MD: s.faadhil@oswinpanel.com / Admin@123
- Default categories: Software, Cloud Services, Marketing Tools, Design Tools, Communication, Entertainment, Utilities, Others

## Test Results (Iteration 2 — Feb 2026)
- Backend: 17/20 pytest + 2 follow-up fixes verified via curl
  - ✅ Fixed: admin-create now persists module_permissions
  - ✅ Fixed: /auth/me backfills access_level + module_permissions
- Frontend: 100% (login, theme, RBAC sidebar, One Time billing, Reports tabs, Password Manager)

## Prioritized Backlog

### P1 (Phase 3)
- [ ] Email notifications for upcoming renewals (Resend/SendGrid)
- [ ] Password reset via email
- [ ] Audit log for password reveal events
- [ ] Server-side enforcement of module_permissions (currently frontend-only hides; role checks still enforce at API)

### P2
- [ ] Scheduled reports via email
- [ ] Budget limits per category with alerts
- [ ] Department/team comparison reports
- [ ] Sub-categories

### Future
- [ ] Split `server.py` (860 lines) into routes modules: auth, subscriptions, passwords, reports, users
- [ ] Mobile apps
- [ ] AI-powered spending insights
- [ ] Rate limiting on password reveal
- [ ] Cleanup old TEST_* records from dev DB
