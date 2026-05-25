from dotenv import load_dotenv
load_dotenv()

import os
import jwt
import bcrypt
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Any, List, Annotated, Literal
from pathlib import Path
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, BeforeValidator

ROOT_DIR = Path(__file__).parent
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# JWT Config
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

app = FastAPI(title="SubTrack Pro")
api_router = APIRouter(prefix="/api")

# ============================================================
# MONGODB HELPERS
# ============================================================

def validate_object_id(v: Any) -> str:
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, str) and ObjectId.is_valid(v):
        return v
    raise ValueError(f"Invalid ObjectId: {v}")

PyObjectId = Annotated[str, BeforeValidator(validate_object_id)]

# ============================================================
# PASSWORD HASHING
# ============================================================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

# ============================================================
# JWT TOKENS
# ============================================================

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS), "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    response.set_cookie("access_token", access_token, httponly=True, secure=False, samesite="lax", max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60, path="/")
    response.set_cookie("refresh_token", refresh_token, httponly=True, secure=False, samesite="lax", max_age=REFRESH_TOKEN_EXPIRE_DAYS * 86400, path="/")

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        user.setdefault("access_level", "editor")
        user.setdefault("module_permissions", {})
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

class RoleChecker:
    def __init__(self, *roles):
        self.roles = roles
    async def __call__(self, current_user: dict = Depends(get_current_user)):
        if current_user.get("role") not in self.roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user

require_md = RoleChecker("Director", "Admin", "MD")
require_md_or_manager = RoleChecker("Director", "Admin", "MD", "Manager")

TOP_ROLES = {"Director", "Admin", "MD"}

def get_module_perm(user: dict, module: str) -> dict:
    """Resolve effective permission {access, scope} for a user on a module.
    Priority: explicit module_permissions override → role defaults."""
    role = user.get("role")
    mp = user.get("module_permissions") or {}
    override = mp.get(module)
    if override:
        if isinstance(override, str):
            # legacy format
            if override in ("none", "view", "edit"):
                return {"access": override, "scope": "individual"}
        elif isinstance(override, dict) and override.get("access"):
            return {"access": override["access"], "scope": override.get("scope") or "individual"}
    # role defaults
    if role in TOP_ROLES:
        return {"access": "edit", "scope": "overall"}
    if role == "Manager":
        if module in ("subscriptions", "reports"):
            return {"access": "view", "scope": "overall"}
        return {"access": "none", "scope": "individual"}
    # User
    if module in ("subscriptions", "passwords"):
        return {"access": "edit", "scope": "individual"}
    if module == "reports":
        return {"access": "view", "scope": "individual"}
    return {"access": "none", "scope": "individual"}

def require_module(module: str, need_edit: bool = False):
    async def _check(current_user: dict = Depends(get_current_user)):
        perm = get_module_perm(current_user, module)
        if perm["access"] == "none":
            raise HTTPException(status_code=403, detail=f"No access to {module}")
        if need_edit and perm["access"] != "edit":
            raise HTTPException(status_code=403, detail=f"Read-only access to {module}")
        if current_user.get("access_level") == "viewer" and need_edit:
            raise HTTPException(status_code=403, detail="Read-only account")
        return current_user
    return _check

async def require_edit_access(current_user: dict = Depends(get_current_user)):
    if current_user.get("access_level") == "viewer":
        raise HTTPException(status_code=403, detail="Read-only access: editing not allowed")
    return current_user

# ============================================================
# PYDANTIC MODELS
# ============================================================

class UserRegister(BaseModel):
    email: str
    password: str
    full_name: str
    role: Literal["Director", "Admin", "MD", "Manager", "User"] = "User"

class UserLogin(BaseModel):
    email: str
    password: str

class AdminCreateUser(BaseModel):
    email: str
    password: str
    full_name: str
    role: Literal["Director", "Admin", "MD", "Manager", "User"] = "User"
    access_level: Literal["editor", "viewer"] = "editor"
    manager_id: Optional[str] = None
    module_permissions: Optional[dict] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[Literal["Director", "Admin", "MD", "Manager", "User"]] = None
    is_active: Optional[bool] = None
    manager_id: Optional[str] = None
    access_level: Optional[Literal["editor", "viewer"]] = None
    module_permissions: Optional[dict] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    blood_group: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    address: Optional[str] = None

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    blood_group: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    address: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class PersonCreate(BaseModel):
    name: str

class PersonUpdate(BaseModel):
    name: Optional[str] = None

class SubscriptionCreate(BaseModel):
    subscription_name: str
    cost: float
    currency: str = "INR"
    billing_cycle: Literal["Monthly", "Quarterly", "Semi-Annual", "Annual", "One Time", "Custom"]
    next_due_date: str
    category_id: Optional[str] = None
    responsible_person_id: Optional[str] = None
    status: Literal["Active", "Inactive", "Trial", "Cancelled"] = "Active"
    management_link: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    assigned_user_id: Optional[str] = None  # top roles can assign ownership to any user

class SubscriptionUpdate(BaseModel):
    subscription_name: Optional[str] = None
    cost: Optional[float] = None
    currency: Optional[str] = None
    billing_cycle: Optional[Literal["Monthly", "Quarterly", "Semi-Annual", "Annual", "One Time", "Custom"]] = None
    next_due_date: Optional[str] = None
    category_id: Optional[str] = None
    responsible_person_id: Optional[str] = None
    status: Optional[Literal["Active", "Inactive", "Trial", "Cancelled"]] = None
    management_link: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None

class CategoryCreate(BaseModel):
    category_name: str
    color_code: str = "#009d44"

class CategoryUpdate(BaseModel):
    category_name: Optional[str] = None
    color_code: Optional[str] = None

# Employee Portal - Leave + Notifications
class LeaveTypeCreate(BaseModel):
    name: str
    color: str = "#009d44"
    default_quota_days: float = 12
    is_paid: bool = True
    allow_half_day: bool = True

class LeaveTypeUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    default_quota_days: Optional[float] = None
    is_paid: Optional[bool] = None
    allow_half_day: Optional[bool] = None
    is_active: Optional[bool] = None

class LeaveCreate(BaseModel):
    leave_type_id: str
    start_date: str  # YYYY-MM-DD
    end_date: str
    half_day: bool = False
    reason: str
    supervisor_id: str

class LeaveDecide(BaseModel):
    rejection_reason: Optional[str] = None

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    due_date: Optional[str] = None  # YYYY-MM-DD
    priority: Literal["Low", "Medium", "High", "Urgent"] = "Medium"
    status: Literal["Not Started", "In Progress", "Paused", "Completed", "Cancelled"] = "Not Started"
    assignee_ids: List[str] = []
    tags: Optional[List[str]] = []

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[Literal["Low", "Medium", "High", "Urgent"]] = None
    status: Optional[Literal["Not Started", "In Progress", "Paused", "Completed", "Cancelled"]] = None
    assignee_ids: Optional[List[str]] = None
    tags: Optional[List[str]] = None

class TaskStatusUpdate(BaseModel):
    status: Literal["Not Started", "In Progress", "Paused", "Completed", "Cancelled"]
    note: Optional[str] = ""


# ============================================================
# COST NORMALIZATION
# ============================================================

MONTHLY_FACTORS = {"Monthly": 1, "Quarterly": 1/3, "Semi-Annual": 1/6, "Annual": 1/12, "One Time": 0, "Custom": 1}
ANNUAL_FACTORS = {"Monthly": 12, "Quarterly": 4, "Semi-Annual": 2, "Annual": 1, "One Time": 0, "Custom": 12}

def to_monthly(cost: float, cycle: str) -> float:
    return cost * MONTHLY_FACTORS.get(cycle, 1)

def to_annual(cost: float, cycle: str) -> float:
    return cost * ANNUAL_FACTORS.get(cycle, 12)

# ============================================================
# SUBSCRIPTION QUERY HELPER
# ============================================================

async def build_sub_query(current_user: dict) -> dict:
    """Query filter for subscriptions based on effective module_permissions.scope."""
    perm = get_module_perm(current_user, "subscriptions")
    user_id = current_user["_id"]
    base = {"is_deleted": False}
    if perm["access"] == "none":
        # return impossible filter
        return {**base, "_id": None}
    if perm["scope"] == "overall":
        return base
    # individual scope — own records (Manager default still sees team)
    if current_user.get("role") == "Manager" and not (current_user.get("module_permissions") or {}).get("subscriptions"):
        team = await db.users.find({"manager_id": user_id}, {"_id": 1}).to_list(500)
        team_ids = [str(m["_id"]) for m in team] + [user_id]
        return {**base, "owner_id": {"$in": team_ids}}
    return {**base, "owner_id": user_id}

async def enrich_subscriptions(subs: list) -> list:
    if not subs:
        return subs
    cats = {str(c["_id"]): c async for c in db.categories.find({})}
    people = {str(p["_id"]): p async for p in db.people.find({})}
    owner_ids = list(set(s["owner_id"] for s in subs if s.get("owner_id")))
    owners = {}
    for oid in owner_ids:
        try:
            u = await db.users.find_one({"_id": ObjectId(oid)}, {"full_name": 1, "email": 1})
            if u:
                owners[oid] = {"id": oid, "name": u["full_name"], "email": u["email"]}
        except Exception:
            pass
    for s in subs:
        cid = s.get("category_id")
        s["category"] = {"id": cid, "name": cats[cid]["category_name"], "color": cats[cid]["color_code"]} if cid and cid in cats else None
        pid = s.get("responsible_person_id")
        s["responsible_person"] = {"id": pid, "name": people[pid]["name"]} if pid and pid in people else None
        s["owner"] = owners.get(s.get("owner_id", ""), {"id": "", "name": "Unknown", "email": ""})
    return subs

# ============================================================
# AUTH ROUTES
# ============================================================

@api_router.post("/auth/register")
async def register(data: UserRegister, response: Response):
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    doc = {"email": email, "password_hash": hash_password(data.password), "full_name": data.full_name, "role": data.role, "access_level": "editor", "is_active": True, "manager_id": None, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}
    result = await db.users.insert_one(doc)
    user_id = str(result.inserted_id)
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token)
    return {"id": user_id, "email": email, "full_name": data.full_name, "role": data.role, "access_level": "editor", "is_active": True, "manager_id": None, "access_token": access_token, "refresh_token": refresh_token}

@api_router.post("/auth/login")
async def login(data: UserLogin, response: Response, request: Request):
    email = data.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    attempts = await db.login_attempts.find_one({"identifier": identifier})
    if attempts and attempts.get("count", 0) >= 5:
        last = attempts.get("last_attempt")
        if last:
            if isinstance(last, str): last = datetime.fromisoformat(last)
            if last.tzinfo is None: last = last.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) - last < timedelta(minutes=15):
                raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        await db.login_attempts.update_one({"identifier": identifier}, {"$inc": {"count": 1}, "$set": {"last_attempt": datetime.now(timezone.utc)}}, upsert=True)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")
    await db.login_attempts.delete_one({"identifier": identifier})
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token)
    return {"id": user_id, "email": email, "full_name": user.get("full_name", ""), "role": user.get("role", "User"), "access_level": user.get("access_level", "editor"), "is_active": True, "manager_id": user.get("manager_id"), "access_token": access_token, "refresh_token": refresh_token}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token"); response.delete_cookie("refresh_token")
    return {"message": "Logged out"}

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

class RefreshRequest(BaseModel):
    refresh_token: Optional[str] = None

@api_router.post("/auth/refresh")
async def refresh_token_endpoint(request: Request, response: Response, body: RefreshRequest = RefreshRequest()):
    token = request.cookies.get("refresh_token") or body.refresh_token
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access_token = create_access_token(str(user["_id"]), user["email"])
        response.set_cookie("access_token", access_token, httponly=True, secure=False, samesite="lax", max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60, path="/")
        return {"message": "Token refreshed", "access_token": access_token}
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError) as e:
        raise HTTPException(status_code=401, detail=str(e))

@api_router.patch("/auth/profile")
async def update_profile(data: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    update["updated_at"] = datetime.now(timezone.utc)
    await db.users.update_one({"_id": ObjectId(current_user["_id"])}, {"$set": update})
    user = await db.users.find_one({"_id": ObjectId(current_user["_id"])}, {"password_hash": 0})
    user["_id"] = str(user["_id"])
    return user

@api_router.post("/auth/change-password")
async def change_password(data: PasswordChange, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"_id": ObjectId(current_user["_id"])})
    if not verify_password(data.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    await db.users.update_one({"_id": ObjectId(current_user["_id"])}, {"$set": {"password_hash": hash_password(data.new_password), "updated_at": datetime.now(timezone.utc)}})
    return {"message": "Password changed successfully"}

# ============================================================
# USER MANAGEMENT ROUTES
# ============================================================

@api_router.get("/users")
async def get_users(current_user: dict = Depends(require_md_or_manager)):
    query = {} if current_user["role"] in TOP_ROLES else {"manager_id": current_user["_id"]}
    users = []
    async for u in db.users.find(query, {"password_hash": 0}):
        u["_id"] = str(u["_id"])
        users.append(u)
    return users

@api_router.get("/users/managers")
async def get_managers(current_user: dict = Depends(require_md)):
    managers = []
    async for u in db.users.find({"role": "Manager", "is_active": True}, {"password_hash": 0}):
        u["_id"] = str(u["_id"])
        managers.append(u)
    return managers

@api_router.post("/users/admin-create")
async def admin_create_user(data: AdminCreateUser, current_user: dict = Depends(require_md)):
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    doc = {"email": email, "password_hash": hash_password(data.password), "full_name": data.full_name, "role": data.role, "access_level": data.access_level, "is_active": True, "manager_id": data.manager_id, "module_permissions": data.module_permissions or {}, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "created_by": current_user["_id"]}
    result = await db.users.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    doc.pop("password_hash", None)
    return doc

@api_router.get("/users/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "User" and current_user["_id"] != user_id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    user = await db.users.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user["_id"] = str(user["_id"])
    return user

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, data: UserUpdate, current_user: dict = Depends(require_md)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    update["updated_at"] = datetime.now(timezone.utc)
    result = await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    user = await db.users.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0})
    user["_id"] = str(user["_id"])
    return user

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, hard: bool = False, current_user: dict = Depends(require_md)):
    if user_id == current_user["_id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    target = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    # Prevent deleting the last Director/Admin
    if target.get("role") in TOP_ROLES:
        remaining = await db.users.count_documents({"role": {"$in": list(TOP_ROLES)}, "is_active": True, "_id": {"$ne": ObjectId(user_id)}})
        if remaining == 0:
            raise HTTPException(status_code=400, detail="Cannot delete the last Director/Admin")
    if hard:
        await db.subscriptions.update_many({"owner_id": user_id}, {"$set": {"is_deleted": True, "updated_at": datetime.now(timezone.utc)}})
        await db.users.delete_one({"_id": ObjectId(user_id)})
        return {"message": "User permanently deleted"}
    # Soft: deactivate
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}})
    return {"message": "User deactivated"}

# ============================================================
# PEOPLE ROUTES
# ============================================================

@api_router.get("/people")
async def get_people(current_user: dict = Depends(get_current_user)):
    people = []
    async for p in db.people.find({}).sort("name", 1):
        p["_id"] = str(p["_id"])
        count = await db.subscriptions.count_documents({"responsible_person_id": p["_id"], "is_deleted": False})
        p["subscription_count"] = count
        people.append(p)
    return people

@api_router.post("/people")
async def create_person(data: PersonCreate, current_user: dict = Depends(get_current_user)):
    if await db.people.find_one({"name": {"$regex": f"^{data.name}$", "$options": "i"}}):
        raise HTTPException(status_code=400, detail="Person with this name already exists")
    doc = {"name": data.name.strip(), "created_by": current_user["_id"], "created_at": datetime.now(timezone.utc)}
    result = await db.people.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    doc["subscription_count"] = 0
    return doc

@api_router.put("/people/{person_id}")
async def update_person(person_id: str, data: PersonUpdate, current_user: dict = Depends(require_md)):
    if data.name:
        await db.people.update_one({"_id": ObjectId(person_id)}, {"$set": {"name": data.name.strip()}})
    p = await db.people.find_one({"_id": ObjectId(person_id)})
    if not p:
        raise HTTPException(status_code=404, detail="Person not found")
    p["_id"] = str(p["_id"])
    return p

@api_router.delete("/people/{person_id}")
async def delete_person(person_id: str, current_user: dict = Depends(require_md)):
    await db.subscriptions.update_many({"responsible_person_id": person_id}, {"$set": {"responsible_person_id": None}})
    await db.people.delete_one({"_id": ObjectId(person_id)})
    return {"message": "Person deleted"}

# ============================================================
# CATEGORY ROUTES
# ============================================================

@api_router.get("/categories")
async def get_categories(current_user: dict = Depends(get_current_user)):
    cats = []
    async for c in db.categories.find({}):
        c["_id"] = str(c["_id"])
        count = await db.subscriptions.count_documents({"category_id": c["_id"], "is_deleted": False})
        c["subscription_count"] = count
        cats.append(c)
    return cats

@api_router.post("/categories")
async def create_category(data: CategoryCreate, current_user: dict = Depends(require_md)):
    if await db.categories.find_one({"category_name": data.category_name}):
        raise HTTPException(status_code=400, detail="Category already exists")
    doc = {"category_name": data.category_name, "color_code": data.color_code, "created_by": current_user["_id"], "is_default": False, "created_at": datetime.now(timezone.utc)}
    result = await db.categories.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    doc["subscription_count"] = 0
    return doc

@api_router.put("/categories/{cat_id}")
async def update_category(cat_id: str, data: CategoryUpdate, current_user: dict = Depends(require_md)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    result = await db.categories.update_one({"_id": ObjectId(cat_id)}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    cat = await db.categories.find_one({"_id": ObjectId(cat_id)})
    cat["_id"] = str(cat["_id"])
    return cat

@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, current_user: dict = Depends(require_md)):
    cat = await db.categories.find_one({"_id": ObjectId(cat_id)})
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    others = await db.categories.find_one({"category_name": "Others"})
    if others and str(others["_id"]) != cat_id:
        await db.subscriptions.update_many({"category_id": cat_id}, {"$set": {"category_id": str(others["_id"])}})
    else:
        # deleting "Others" itself (or no fallback): detach subscriptions
        await db.subscriptions.update_many({"category_id": cat_id}, {"$set": {"category_id": None}})
    await db.categories.delete_one({"_id": ObjectId(cat_id)})
    return {"message": "Category deleted"}

# ============================================================
# SUBSCRIPTION ROUTES
# ============================================================

@api_router.get("/subscriptions")
async def get_subscriptions(
    status: Optional[str] = None, category_id: Optional[str] = None,
    billing_cycle: Optional[str] = None, search: Optional[str] = None,
    responsible_person_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = await build_sub_query(current_user)
    if status: query["status"] = status
    if category_id: query["category_id"] = category_id
    if billing_cycle: query["billing_cycle"] = billing_cycle
    if responsible_person_id: query["responsible_person_id"] = responsible_person_id
    if search: query["subscription_name"] = {"$regex": search, "$options": "i"}
    subs = await db.subscriptions.find(query).sort("next_due_date", 1).to_list(10000)
    for s in subs:
        s["_id"] = str(s["_id"])
    return await enrich_subscriptions(subs)

@api_router.post("/subscriptions")
async def create_subscription(data: SubscriptionCreate, current_user: dict = Depends(require_module("subscriptions", need_edit=True))):
    owner_id = current_user["_id"]
    if data.assigned_user_id and current_user.get("role") in TOP_ROLES:
        if await db.users.find_one({"_id": ObjectId(data.assigned_user_id), "is_active": True}):
            owner_id = data.assigned_user_id
    doc = {**data.model_dump(exclude={"assigned_user_id"}), "owner_id": owner_id, "is_deleted": False, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}
    if data.category_id:
        try:
            if not await db.categories.find_one({"_id": ObjectId(data.category_id)}):
                doc["category_id"] = None
        except Exception:
            doc["category_id"] = None
    result = await db.subscriptions.insert_one(doc)
    sub_id = str(result.inserted_id)
    await db.subscription_history.insert_one({"subscription_id": sub_id, "edited_by": current_user["_id"], "field_changed": "created", "old_value": "", "new_value": f"Created '{data.subscription_name}'", "changed_at": datetime.now(timezone.utc)})
    doc["_id"] = sub_id
    return doc

@api_router.get("/subscriptions/archived")
async def get_archived(current_user: dict = Depends(require_md)):
    subs = await db.subscriptions.find({"is_deleted": True}).sort("updated_at", -1).to_list(1000)
    for s in subs:
        s["_id"] = str(s["_id"])
    return subs

@api_router.get("/subscriptions/{sub_id}")
async def get_subscription(sub_id: str, current_user: dict = Depends(get_current_user)):
    sub = await db.subscriptions.find_one({"_id": ObjectId(sub_id)})
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    sub["_id"] = str(sub["_id"])
    if current_user["role"] == "User" and sub["owner_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return sub

@api_router.put("/subscriptions/{sub_id}")
async def update_subscription(sub_id: str, data: SubscriptionUpdate, current_user: dict = Depends(require_module("subscriptions", need_edit=True))):
    sub = await db.subscriptions.find_one({"_id": ObjectId(sub_id), "is_deleted": False})
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    perm = get_module_perm(current_user, "subscriptions")
    uid = current_user["_id"]
    if perm["scope"] == "individual" and sub.get("owner_id") != uid:
        # Manager individual: check team
        if current_user.get("role") == "Manager":
            team = await db.users.find({"manager_id": uid}, {"_id": 1}).to_list(500)
            team_ids = {str(m["_id"]) for m in team} | {uid}
            if sub.get("owner_id") not in team_ids:
                raise HTTPException(status_code=403, detail="Access denied")
        else:
            raise HTTPException(status_code=403, detail="Access denied")
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    update["updated_at"] = datetime.now(timezone.utc)
    for field, new_val in update.items():
        if field == "updated_at": continue
        old_val = sub.get(field, "")
        if str(old_val) != str(new_val):
            await db.subscription_history.insert_one({"subscription_id": sub_id, "edited_by": uid, "field_changed": field, "old_value": str(old_val), "new_value": str(new_val), "changed_at": datetime.now(timezone.utc)})
    await db.subscriptions.update_one({"_id": ObjectId(sub_id)}, {"$set": update})
    updated = await db.subscriptions.find_one({"_id": ObjectId(sub_id)})
    updated["_id"] = str(updated["_id"])
    return updated

@api_router.delete("/subscriptions/{sub_id}")
async def delete_subscription(sub_id: str, current_user: dict = Depends(require_module("subscriptions", need_edit=True))):
    sub = await db.subscriptions.find_one({"_id": ObjectId(sub_id), "is_deleted": False})
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    perm = get_module_perm(current_user, "subscriptions")
    uid = current_user["_id"]
    if perm["scope"] == "individual" and sub.get("owner_id") != uid:
        if current_user.get("role") == "Manager":
            team = await db.users.find({"manager_id": uid}, {"_id": 1}).to_list(500)
            team_ids = {str(m["_id"]) for m in team} | {uid}
            if sub.get("owner_id") not in team_ids:
                raise HTTPException(status_code=403, detail="Access denied")
        else:
            raise HTTPException(status_code=403, detail="Access denied")
    await db.subscriptions.update_one({"_id": ObjectId(sub_id)}, {"$set": {"is_deleted": True, "updated_at": datetime.now(timezone.utc)}})
    await db.subscription_history.insert_one({"subscription_id": sub_id, "edited_by": uid, "field_changed": "deleted", "old_value": "active", "new_value": "deleted", "changed_at": datetime.now(timezone.utc)})
    return {"message": "Subscription deleted"}

@api_router.put("/subscriptions/{sub_id}/restore")
async def restore_subscription(sub_id: str, current_user: dict = Depends(require_md)):
    result = await db.subscriptions.update_one({"_id": ObjectId(sub_id)}, {"$set": {"is_deleted": False, "updated_at": datetime.now(timezone.utc)}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return {"message": "Subscription restored"}

@api_router.get("/subscriptions/{sub_id}/history")
async def get_history(sub_id: str, current_user: dict = Depends(get_current_user)):
    history = []
    async for h in db.subscription_history.find({"subscription_id": sub_id}).sort("changed_at", -1):
        h["_id"] = str(h["_id"])
        try:
            editor = await db.users.find_one({"_id": ObjectId(h["edited_by"])}, {"full_name": 1})
            h["editor_name"] = editor["full_name"] if editor else "Unknown"
        except Exception:
            h["editor_name"] = "Unknown"
        history.append(h)
    return history

# ============================================================
# REPORTS & ANALYTICS
# ============================================================

@api_router.get("/reports/dashboard")
async def dashboard_stats(current_user: dict = Depends(get_current_user)):
    query = await build_sub_query(current_user)
    active_query = {**query, "status": "Active"}
    subs = await db.subscriptions.find(active_query).to_list(10000)

    total_monthly = sum(to_monthly(s["cost"], s["billing_cycle"]) for s in subs)
    total_annual = sum(to_annual(s["cost"], s["billing_cycle"]) for s in subs)
    one_time_total = sum(s["cost"] for s in subs if s.get("billing_cycle") == "One Time")

    today = datetime.now(timezone.utc).date()
    upcoming = []
    for sub in subs:
        if sub.get("billing_cycle") == "One Time":
            continue
        try:
            due_str = sub["next_due_date"][:10]
            due = datetime.strptime(due_str, "%Y-%m-%d").date()
            days = (due - today).days
            if -1 <= days <= 7:
                s = dict(sub); s["_id"] = str(s["_id"]); s["days_until_due"] = days
                upcoming.append(s)
        except Exception:
            pass
    upcoming.sort(key=lambda x: x.get("days_until_due", 99))

    cats = {str(c["_id"]): {"name": c["category_name"], "color": c["color_code"], "monthly": 0.0, "count": 0} async for c in db.categories.find({})}
    for sub in subs:
        cid = sub.get("category_id")
        if cid and cid in cats:
            cats[cid]["monthly"] += to_monthly(sub["cost"], sub["billing_cycle"])
            cats[cid]["count"] += 1
    category_breakdown = [{"name": v["name"], "color": v["color"], "value": round(v["monthly"], 2), "count": v["count"]} for v in cats.values() if v["monthly"] > 0]

    # HISTORICAL monthly trend - based on subscription creation dates
    monthly_trend = []
    for i in range(5, -1, -1):
        d = today.replace(day=1)
        m, y = d.month - i, d.year
        while m <= 0: m += 12; y -= 1
        month_start = datetime(y, m, 1, tzinfo=timezone.utc)
        if m == 12:
            month_end = datetime(y + 1, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
        else:
            month_end = datetime(y, m + 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
        label = datetime(y, m, 1).strftime("%b %y")
        month_q = {k: v for k, v in query.items() if k != "is_deleted"}
        month_q["created_at"] = {"$lte": month_end}
        month_q["$or"] = [{"is_deleted": False}, {"updated_at": {"$gt": month_end}}]
        month_q["status"] = "Active"
        month_subs = await db.subscriptions.find(month_q).to_list(10000)
        total = sum(to_monthly(s["cost"], s["billing_cycle"]) for s in month_subs if s.get("billing_cycle") != "One Time")
        monthly_trend.append({"month": label, "total": round(total, 2)})

    recent_query = {k: v for k, v in query.items()}
    recent = []
    async for s in db.subscriptions.find(recent_query).sort("created_at", -1).limit(5):
        s["_id"] = str(s["_id"]); recent.append(s)

    return {
        "total_monthly": round(total_monthly, 2), "total_annual": round(total_annual, 2),
        "one_time_total": round(one_time_total, 2), "active_count": len(subs),
        "upcoming_count": len(upcoming), "upcoming_renewals": upcoming[:10],
        "category_breakdown": category_breakdown, "monthly_trend": monthly_trend,
        "recent_subscriptions": recent,
    }

@api_router.get("/reports/spending")
async def spending_report(current_user: dict = Depends(require_module("reports"))):
    query = await build_sub_query(current_user)
    query["status"] = "Active"
    subs = await db.subscriptions.find(query).to_list(10000)
    cats = {str(c["_id"]): c["category_name"] async for c in db.categories.find({})}
    people = {str(p["_id"]): p["name"] async for p in db.people.find({})}
    owners = {}
    for oid in set(s.get("owner_id", "") for s in subs):
        try:
            u = await db.users.find_one({"_id": ObjectId(oid)}, {"full_name": 1})
            if u: owners[oid] = u["full_name"]
        except Exception:
            pass
    cat_bd, user_bd, person_bd = {}, {}, {}
    ot_cat_bd, ot_user_bd, ot_person_bd, one_time_list = {}, {}, {}, []
    for sub in subs:
        cname = cats.get(sub.get("category_id", ""), "Uncategorized")
        oname = owners.get(sub.get("owner_id", ""), "Unknown")
        pid = sub.get("responsible_person_id")
        pname = people.get(pid, "Unassigned") if pid else "Unassigned"
        m, a = to_monthly(sub["cost"], sub["billing_cycle"]), to_annual(sub["cost"], sub["billing_cycle"])
        one_t = sub["cost"] if sub.get("billing_cycle") == "One Time" else 0
        for d, k in [(cat_bd, cname), (user_bd, oname), (person_bd, pname)]:
            d.setdefault(k, {"monthly": 0, "annual": 0, "one_time": 0, "count": 0})
            d[k]["monthly"] += m; d[k]["annual"] += a; d[k]["one_time"] += one_t; d[k]["count"] += 1
        if sub.get("billing_cycle") == "One Time":
            one_time_list.append({
                "id": str(sub["_id"]),
                "name": sub["subscription_name"],
                "cost": sub["cost"],
                "currency": sub.get("currency", "INR"),
                "category": cname,
                "owner": oname,
                "responsible_person": pname,
                "date": sub.get("next_due_date") or sub.get("created_at", "").isoformat() if isinstance(sub.get("created_at"), datetime) else sub.get("next_due_date", ""),
            })
            for d, k in [(ot_cat_bd, cname), (ot_user_bd, oname), (ot_person_bd, pname)]:
                d.setdefault(k, {"total": 0, "count": 0})
                d[k]["total"] += sub["cost"]; d[k]["count"] += 1
    return {
        "total_monthly": round(sum(to_monthly(s["cost"], s["billing_cycle"]) for s in subs), 2),
        "total_annual": round(sum(to_annual(s["cost"], s["billing_cycle"]) for s in subs), 2),
        "total_one_time": round(sum(s["cost"] for s in subs if s.get("billing_cycle") == "One Time"), 2),
        "one_time_count": len(one_time_list),
        "category_breakdown": [{"name": k, "monthly": round(v["monthly"], 2), "annual": round(v["annual"], 2), "count": v["count"]} for k, v in cat_bd.items()],
        "user_breakdown": [{"name": k, "monthly": round(v["monthly"], 2), "annual": round(v["annual"], 2), "count": v["count"]} for k, v in user_bd.items()],
        "person_breakdown": [{"name": k, "monthly": round(v["monthly"], 2), "annual": round(v["annual"], 2), "one_time": round(v["one_time"], 2), "count": v["count"]} for k, v in person_bd.items()],
        "one_time_by_category": [{"name": k, "total": round(v["total"], 2), "count": v["count"]} for k, v in ot_cat_bd.items()],
        "one_time_by_user": [{"name": k, "total": round(v["total"], 2), "count": v["count"]} for k, v in ot_user_bd.items()],
        "one_time_by_person": [{"name": k, "total": round(v["total"], 2), "count": v["count"]} for k, v in ot_person_bd.items()],
        "one_time_payments": one_time_list,
        "subscriptions": [{"id": str(s["_id"]), "name": s["subscription_name"], "cost": s["cost"], "currency": s.get("currency", "INR"), "billing_cycle": s["billing_cycle"], "monthly_cost": round(to_monthly(s["cost"], s["billing_cycle"]), 2), "annual_cost": round(to_annual(s["cost"], s["billing_cycle"]), 2), "category": cats.get(s.get("category_id", ""), "Uncategorized"), "owner": owners.get(s.get("owner_id", ""), "Unknown"), "responsible_person": people.get(s.get("responsible_person_id", ""), "Unassigned"), "status": s["status"], "next_due_date": s.get("next_due_date", "")} for s in subs],
    }

# ============================================================
# EMPLOYEE PORTAL — LEAVES + NOTIFICATIONS
# ============================================================

SUPERVISOR_ROLES = {"Director", "Admin", "MD", "Manager"}

def _is_supervisor(user: dict) -> bool:
    return user.get("role") in SUPERVISOR_ROLES

async def _downstream_user_ids(manager_id: str, max_depth: int = 10) -> set:
    """Return all user IDs that the given manager oversees transitively (direct + indirect)."""
    result = set()
    frontier = {manager_id}
    for _ in range(max_depth):
        if not frontier: break
        cursor = db.users.find({"manager_id": {"$in": list(frontier)}}, {"_id": 1})
        next_frontier = set()
        async for u in cursor:
            uid = str(u["_id"])
            if uid not in result:
                result.add(uid)
                next_frontier.add(uid)
        frontier = next_frontier
    return result

def _parse_date(s: str):
    return datetime.strptime(s[:10], "%Y-%m-%d").date()

def _compute_days(start: str, end: str, half_day: bool) -> float:
    sd = _parse_date(start); ed = _parse_date(end)
    if ed < sd:
        raise HTTPException(status_code=400, detail="End date before start date")
    days = (ed - sd).days + 1
    if half_day:
        if days != 1:
            raise HTTPException(status_code=400, detail="Half-day requires single day leave")
        return 0.5
    return float(days)

async def _create_notification(user_id: str, n_type: str, title: str, message: str, link: str = "", ref_id: str = ""):
    await db.notifications.insert_one({
        "user_id": user_id, "type": n_type, "title": title, "message": message,
        "link": link, "ref_id": ref_id, "read": False,
        "created_at": datetime.now(timezone.utc),
    })

async def _enrich_leave(lv: dict) -> dict:
    lv["_id"] = str(lv["_id"])
    try:
        u = await db.users.find_one({"_id": ObjectId(lv["user_id"])}, {"full_name": 1, "email": 1})
        if u: lv["user"] = {"id": str(u["_id"]), "name": u["full_name"], "email": u["email"]}
    except Exception: lv["user"] = {"name": "Unknown"}
    try:
        s = await db.users.find_one({"_id": ObjectId(lv["supervisor_id"])}, {"full_name": 1})
        if s: lv["supervisor"] = {"id": str(s["_id"]), "name": s["full_name"]}
    except Exception: lv["supervisor"] = {"name": "—"}
    try:
        lt = await db.leave_types.find_one({"_id": ObjectId(lv["leave_type_id"])})
        if lt: lv["leave_type"] = {"id": str(lt["_id"]), "name": lt["name"], "color": lt.get("color", "#009d44")}
    except Exception: lv["leave_type"] = {"name": "—", "color": "#999"}
    if lv.get("approved_by"):
        try:
            a = await db.users.find_one({"_id": ObjectId(lv["approved_by"])}, {"full_name": 1})
            if a: lv["approver"] = {"id": str(a["_id"]), "name": a["full_name"]}
        except Exception: pass
    return lv

@api_router.get("/leave-types")
async def list_leave_types(current_user: dict = Depends(get_current_user)):
    out = []
    async for t in db.leave_types.find({"is_active": True}).sort("name", 1):
        t["_id"] = str(t["_id"]); out.append(t)
    return out

@api_router.post("/leave-types")
async def create_leave_type(data: LeaveTypeCreate, current_user: dict = Depends(require_md)):
    if await db.leave_types.find_one({"name": data.name}):
        raise HTTPException(status_code=400, detail="Leave type with this name already exists")
    doc = {**data.model_dump(), "is_active": True, "created_at": datetime.now(timezone.utc)}
    result = await db.leave_types.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc

@api_router.put("/leave-types/{type_id}")
async def update_leave_type(type_id: str, data: LeaveTypeUpdate, current_user: dict = Depends(require_md)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    update["updated_at"] = datetime.now(timezone.utc)
    await db.leave_types.update_one({"_id": ObjectId(type_id)}, {"$set": update})
    t = await db.leave_types.find_one({"_id": ObjectId(type_id)})
    if not t: raise HTTPException(status_code=404, detail="Not found")
    t["_id"] = str(t["_id"])
    return t

@api_router.delete("/leave-types/{type_id}")
async def delete_leave_type(type_id: str, current_user: dict = Depends(require_md)):
    await db.leave_types.update_one({"_id": ObjectId(type_id)}, {"$set": {"is_active": False}})
    return {"message": "Leave type deactivated"}

@api_router.get("/leaves")
async def list_leaves(scope: str = "mine", status: Optional[str] = None, user_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    uid = current_user["_id"]
    if scope == "mine":
        query["user_id"] = uid
    elif scope == "pending":
        if current_user.get("role") in TOP_ROLES:
            query["status"] = "pending"
        else:
            # All downstream users (transitive)
            downstream = await _downstream_user_ids(uid)
            query = {"status": "pending", "user_id": {"$in": list(downstream) + [uid]}}
    elif scope == "all":
        if not _is_supervisor(current_user):
            raise HTTPException(status_code=403, detail="Forbidden")
        if current_user.get("role") not in TOP_ROLES:
            # Restrict to own downstream
            downstream = await _downstream_user_ids(uid)
            query["user_id"] = {"$in": list(downstream) + [uid]}
    elif scope == "user" and user_id:
        # View specific user's leaves — allowed if you're admin OR in their upstream chain
        if current_user.get("role") not in TOP_ROLES:
            downstream = await _downstream_user_ids(uid)
            if user_id not in downstream and user_id != uid:
                raise HTTPException(status_code=403, detail="Not in your team")
        query["user_id"] = user_id
    else:
        raise HTTPException(status_code=400, detail="Invalid scope")
    if status and scope != "pending":
        query["status"] = status
    out = []
    async for lv in db.leave_requests.find(query).sort("created_at", -1):
        out.append(await _enrich_leave(lv))
    return out

@api_router.get("/leaves/balance")
async def my_leave_balance(current_user: dict = Depends(get_current_user)):
    return await _compute_balance(current_user["_id"])

@api_router.get("/users/{user_id}/leave-balance")
async def user_leave_balance(user_id: str, current_user: dict = Depends(get_current_user)):
    if user_id != current_user["_id"]:
        if current_user.get("role") not in TOP_ROLES:
            downstream = await _downstream_user_ids(current_user["_id"])
            if user_id not in downstream:
                raise HTTPException(status_code=403, detail="Not in your team")
    return await _compute_balance(user_id)

async def _compute_balance(user_id: str) -> dict:
    year = datetime.now(timezone.utc).year
    year_start = datetime(year, 1, 1, tzinfo=timezone.utc)
    year_end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    types = []
    async for t in db.leave_types.find({"is_active": True}).sort("name", 1):
        used = 0.0
        async for lv in db.leave_requests.find({
            "user_id": user_id,
            "leave_type_id": str(t["_id"]),
            "status": "approved",
            "created_at": {"$gte": year_start, "$lt": year_end},
        }):
            used += float(lv.get("total_days", 0))
        types.append({
            "id": str(t["_id"]),
            "name": t["name"],
            "color": t.get("color", "#009d44"),
            "quota": float(t.get("default_quota_days", 0)),
            "used": used,
            "remaining": max(0.0, float(t.get("default_quota_days", 0)) - used),
        })
    return {"year": year, "types": types, "user_id": user_id}

@api_router.get("/leaves/calendar")
async def calendar_leaves(start: Optional[str] = None, end: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"status": "approved"}
    if start and end:
        query["start_date"] = {"$lte": end}
        query["end_date"] = {"$gte": start}
    out = []
    async for lv in db.leave_requests.find(query).sort("start_date", 1):
        out.append(await _enrich_leave(lv))
    return out

@api_router.post("/leaves")
async def apply_leave(data: LeaveCreate, current_user: dict = Depends(get_current_user)):
    lt = await db.leave_types.find_one({"_id": ObjectId(data.leave_type_id), "is_active": True})
    if not lt:
        raise HTTPException(status_code=400, detail="Invalid leave type")
    sup = await db.users.find_one({"_id": ObjectId(data.supervisor_id), "is_active": True})
    if not sup or not _is_supervisor(sup):
        raise HTTPException(status_code=400, detail="Supervisor must be a manager/admin/director")
    if data.half_day and not lt.get("allow_half_day", True):
        raise HTTPException(status_code=400, detail="Half-day not allowed for this leave type")
    total = _compute_days(data.start_date, data.end_date, data.half_day)
    doc = {
        "user_id": current_user["_id"],
        "supervisor_id": data.supervisor_id,
        "leave_type_id": data.leave_type_id,
        "start_date": data.start_date[:10],
        "end_date": data.end_date[:10],
        "half_day": data.half_day,
        "total_days": total,
        "reason": data.reason.strip(),
        "status": "pending",
        "approved_by": None, "approved_at": None, "rejection_reason": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    result = await db.leave_requests.insert_one(doc)
    leave_id = str(result.inserted_id)
    await _create_notification(
        data.supervisor_id, "leave_request",
        f"Leave request from {current_user.get('full_name','someone')}",
        f"{lt['name']} · {data.start_date[:10]} → {data.end_date[:10]} ({total} day{'s' if total != 1 else ''})",
        "/leaves?scope=pending", leave_id,
    )
    async for adm in db.users.find({"role": {"$in": list(TOP_ROLES)}, "is_active": True}):
        adm_id = str(adm["_id"])
        if adm_id != data.supervisor_id and adm_id != current_user["_id"]:
            await _create_notification(adm_id, "leave_request_admin",
                f"New leave request: {current_user.get('full_name','someone')}",
                f"{lt['name']} · {total} day(s) · pending {sup['full_name']}'s approval",
                "/leaves?scope=pending", leave_id)
    doc["_id"] = leave_id
    return await _enrich_leave(doc)

async def _can_decide(user: dict, leave: dict) -> bool:
    if user.get("role") in TOP_ROLES:
        return True
    if leave.get("supervisor_id") == user["_id"]:
        return True
    if _is_supervisor(user):
        downstream = await _downstream_user_ids(user["_id"])
        if leave.get("user_id") in downstream:
            return True
    return False

@api_router.put("/leaves/{leave_id}/approve")
async def approve_leave(leave_id: str, current_user: dict = Depends(get_current_user)):
    lv = await db.leave_requests.find_one({"_id": ObjectId(leave_id)})
    if not lv:
        raise HTTPException(status_code=404, detail="Leave not found")
    if lv["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Already {lv['status']}")
    if not await _can_decide(current_user, lv):
        raise HTTPException(status_code=403, detail="Not authorized to approve")
    await db.leave_requests.update_one({"_id": ObjectId(leave_id)}, {"$set": {
        "status": "approved",
        "approved_by": current_user["_id"],
        "approved_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }})
    lt = await db.leave_types.find_one({"_id": ObjectId(lv["leave_type_id"])})
    await _create_notification(
        lv["user_id"], "leave_approved",
        f"Leave approved by {current_user['full_name']}",
        f"{lt['name'] if lt else 'Leave'} · {lv['start_date']} → {lv['end_date']} confirmed",
        "/leaves", leave_id,
    )
    updated = await db.leave_requests.find_one({"_id": ObjectId(leave_id)})
    return await _enrich_leave(updated)

@api_router.put("/leaves/{leave_id}/reject")
async def reject_leave(leave_id: str, data: LeaveDecide, current_user: dict = Depends(get_current_user)):
    lv = await db.leave_requests.find_one({"_id": ObjectId(leave_id)})
    if not lv:
        raise HTTPException(status_code=404, detail="Leave not found")
    if lv["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Already {lv['status']}")
    if not await _can_decide(current_user, lv):
        raise HTTPException(status_code=403, detail="Not authorized to reject")
    await db.leave_requests.update_one({"_id": ObjectId(leave_id)}, {"$set": {
        "status": "rejected",
        "approved_by": current_user["_id"],
        "approved_at": datetime.now(timezone.utc),
        "rejection_reason": (data.rejection_reason or "").strip(),
        "updated_at": datetime.now(timezone.utc),
    }})
    lt = await db.leave_types.find_one({"_id": ObjectId(lv["leave_type_id"])})
    await _create_notification(
        lv["user_id"], "leave_rejected",
        f"Leave rejected by {current_user['full_name']}",
        (data.rejection_reason or f"{lt['name'] if lt else 'Leave'} · {lv['start_date']} → {lv['end_date']}"),
        "/leaves", leave_id,
    )
    updated = await db.leave_requests.find_one({"_id": ObjectId(leave_id)})
    return await _enrich_leave(updated)

@api_router.delete("/leaves/{leave_id}")
async def cancel_leave(leave_id: str, current_user: dict = Depends(get_current_user)):
    lv = await db.leave_requests.find_one({"_id": ObjectId(leave_id)})
    if not lv:
        raise HTTPException(status_code=404, detail="Leave not found")
    if lv["user_id"] != current_user["_id"] and current_user.get("role") not in TOP_ROLES:
        raise HTTPException(status_code=403, detail="Not your leave")
    if lv["status"] not in ("pending", "approved"):
        raise HTTPException(status_code=400, detail="Cannot cancel this leave")
    await db.leave_requests.update_one({"_id": ObjectId(leave_id)}, {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc)}})
    return {"message": "Leave cancelled"}

@api_router.get("/supervisors")
async def list_supervisors(current_user: dict = Depends(get_current_user)):
    out = []
    async for u in db.users.find({"role": {"$in": list(SUPERVISOR_ROLES)}, "is_active": True}, {"full_name": 1, "email": 1, "role": 1}).sort("full_name", 1):
        out.append({"id": str(u["_id"]), "name": u["full_name"], "email": u["email"], "role": u["role"]})
    return out

@api_router.get("/notifications")
async def list_notifications(unread_only: bool = False, limit: int = 30, current_user: dict = Depends(get_current_user)):
    query = {"user_id": current_user["_id"]}
    if unread_only:
        query["read"] = False
    out = []
    async for n in db.notifications.find(query).sort("created_at", -1).limit(limit):
        n["_id"] = str(n["_id"])
        out.append(n)
    unread = await db.notifications.count_documents({"user_id": current_user["_id"], "read": False})
    return {"items": out, "unread_count": unread}

@api_router.put("/notifications/{nid}/read")
async def mark_read(nid: str, current_user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"_id": ObjectId(nid), "user_id": current_user["_id"]}, {"$set": {"read": True}})
    return {"message": "marked read"}

@api_router.put("/notifications/read-all")
async def mark_all_read(current_user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": current_user["_id"], "read": False}, {"$set": {"read": True}})
    return {"message": "all read"}

@api_router.get("/employee/dashboard")
async def employee_dashboard(current_user: dict = Depends(get_current_user)):
    uid = current_user["_id"]
    today = datetime.now(timezone.utc).date().isoformat()
    my_leaves = []
    async for lv in db.leave_requests.find({"user_id": uid}).sort("created_at", -1).limit(5):
        my_leaves.append(await _enrich_leave(lv))
    team_today = []
    async for lv in db.leave_requests.find({"status": "approved", "start_date": {"$lte": today}, "end_date": {"$gte": today}}):
        if lv["user_id"] != uid:
            team_today.append(await _enrich_leave(lv))
    pending_count = 0
    if _is_supervisor(current_user):
        if current_user.get("role") in TOP_ROLES:
            pending_count = await db.leave_requests.count_documents({"status": "pending"})
        else:
            downstream = await _downstream_user_ids(uid)
            pending_count = await db.leave_requests.count_documents({"status": "pending", "user_id": {"$in": list(downstream) + [uid]}})
    return {
        "my_recent_leaves": my_leaves,
        "team_on_leave_today": team_today,
        "pending_approvals": pending_count,
    }



# ============================================================
# TASK MANAGER
# ============================================================

async def _enrich_task(t: dict) -> dict:
    t["_id"] = str(t["_id"])
    try:
        creator = await db.users.find_one({"_id": ObjectId(t["created_by"])}, {"full_name": 1})
        if creator: t["creator"] = {"id": str(creator["_id"]), "name": creator["full_name"]}
    except Exception: t["creator"] = {"name": "—"}
    assignees = []
    for aid in t.get("assignee_ids", []) or []:
        try:
            u = await db.users.find_one({"_id": ObjectId(aid)}, {"full_name": 1, "email": 1})
            if u: assignees.append({"id": str(u["_id"]), "name": u["full_name"], "email": u["email"]})
        except Exception:
            pass
    t["assignees"] = assignees
    return t

@api_router.get("/tasks")
async def list_tasks(scope: str = "mine", status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """scope: mine (assigned to me) | created (I created) | all (supervisor+) | completed (audit backlog)"""
    uid = current_user["_id"]
    query = {}
    if scope == "mine":
        query["assignee_ids"] = uid
    elif scope == "created":
        query["created_by"] = uid
    elif scope == "all":
        if not _is_supervisor(current_user):
            raise HTTPException(status_code=403, detail="Forbidden")
        if current_user.get("role") not in TOP_ROLES:
            downstream = await _downstream_user_ids(uid)
            allowed = list(downstream) + [uid]
            query = {"$or": [{"assignee_ids": {"$in": allowed}}, {"created_by": {"$in": allowed}}]}
    elif scope == "completed":
        query["status"] = {"$in": ["Completed", "Cancelled"]}
        if current_user.get("role") not in TOP_ROLES:
            # only see tasks where they were creator or assignee
            query = {**query, "$or": [{"assignee_ids": uid}, {"created_by": uid}]}
    else:
        raise HTTPException(status_code=400, detail="Invalid scope")
    if status and scope != "completed":
        query["status"] = status
    out = []
    async for t in db.tasks.find(query).sort("created_at", -1):
        out.append(await _enrich_task(t))
    return out

@api_router.post("/tasks")
async def create_task(data: TaskCreate, current_user: dict = Depends(get_current_user)):
    # validate assignees exist
    valid_ids = []
    for aid in data.assignee_ids or []:
        try:
            if await db.users.find_one({"_id": ObjectId(aid), "is_active": True}):
                valid_ids.append(aid)
        except Exception:
            pass
    doc = {
        "title": data.title.strip(),
        "description": (data.description or "").strip(),
        "due_date": data.due_date[:10] if data.due_date else None,
        "priority": data.priority,
        "status": data.status,
        "assignee_ids": valid_ids,
        "tags": data.tags or [],
        "created_by": current_user["_id"],
        "completed_at": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    result = await db.tasks.insert_one(doc)
    task_id = str(result.inserted_id)
    # notify assignees
    for aid in valid_ids:
        if aid != current_user["_id"]:
            await _create_notification(
                aid, "task_assigned",
                f"New task from {current_user.get('full_name','someone')}",
                f"{data.title} · {('Due ' + data.due_date[:10]) if data.due_date else 'No due date'}",
                "/tasks", task_id,
            )
    doc["_id"] = task_id
    return await _enrich_task(doc)

@api_router.get("/tasks/{task_id}")
async def get_task(task_id: str, current_user: dict = Depends(get_current_user)):
    t = await db.tasks.find_one({"_id": ObjectId(task_id)})
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return await _enrich_task(t)

@api_router.put("/tasks/{task_id}")
async def update_task(task_id: str, data: TaskUpdate, current_user: dict = Depends(get_current_user)):
    t = await db.tasks.find_one({"_id": ObjectId(task_id)})
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    # Creator, assignee, or supervisor can edit
    uid = current_user["_id"]
    can_edit = t.get("created_by") == uid or uid in (t.get("assignee_ids") or []) or current_user.get("role") in TOP_ROLES
    if not can_edit:
        raise HTTPException(status_code=403, detail="Not authorized")
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if "due_date" in update and update["due_date"]:
        update["due_date"] = update["due_date"][:10]
    if "status" in update:
        if update["status"] in ("Completed", "Cancelled") and t.get("status") not in ("Completed", "Cancelled"):
            update["completed_at"] = datetime.now(timezone.utc)
        elif update["status"] not in ("Completed", "Cancelled"):
            update["completed_at"] = None
    update["updated_at"] = datetime.now(timezone.utc)
    if "assignee_ids" in update:
        new_assignees = set(update["assignee_ids"] or [])
        old_assignees = set(t.get("assignee_ids") or [])
        added = new_assignees - old_assignees
        for aid in added:
            if aid != uid:
                await _create_notification(aid, "task_assigned",
                    f"You've been assigned a task",
                    t.get("title", "Task"), "/tasks", task_id)
    await db.tasks.update_one({"_id": ObjectId(task_id)}, {"$set": update})
    updated = await db.tasks.find_one({"_id": ObjectId(task_id)})
    return await _enrich_task(updated)

@api_router.put("/tasks/{task_id}/status")
async def change_task_status(task_id: str, data: TaskStatusUpdate, current_user: dict = Depends(get_current_user)):
    t = await db.tasks.find_one({"_id": ObjectId(task_id)})
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    uid = current_user["_id"]
    can_edit = t.get("created_by") == uid or uid in (t.get("assignee_ids") or []) or current_user.get("role") in TOP_ROLES
    if not can_edit:
        raise HTTPException(status_code=403, detail="Not authorized")
    patch = {"status": data.status, "updated_at": datetime.now(timezone.utc)}
    if data.status in ("Completed", "Cancelled"):
        patch["completed_at"] = datetime.now(timezone.utc)
    else:
        patch["completed_at"] = None
    await db.tasks.update_one({"_id": ObjectId(task_id)}, {"$set": patch})
    # notify creator if someone else changed status
    if t.get("created_by") and t["created_by"] != uid:
        await _create_notification(t["created_by"], "task_status",
            f"Task status changed to {data.status}",
            f"{t.get('title', '')} · by {current_user.get('full_name','someone')}",
            "/tasks", task_id)
    updated = await db.tasks.find_one({"_id": ObjectId(task_id)})
    return await _enrich_task(updated)

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, current_user: dict = Depends(get_current_user)):
    t = await db.tasks.find_one({"_id": ObjectId(task_id)})
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    if t.get("created_by") != current_user["_id"] and current_user.get("role") not in TOP_ROLES:
        raise HTTPException(status_code=403, detail="Only creator or admin can delete")
    await db.tasks.delete_one({"_id": ObjectId(task_id)})
    return {"message": "Task deleted"}

@api_router.get("/tasks-stats/me")
async def my_task_stats(current_user: dict = Depends(get_current_user)):
    uid = current_user["_id"]
    today = datetime.now(timezone.utc).date().isoformat()
    stats = {"not_started": 0, "in_progress": 0, "paused": 0, "completed": 0, "cancelled": 0, "overdue": 0, "due_today": 0, "due_this_week": 0}
    async for t in db.tasks.find({"assignee_ids": uid}):
        s = t.get("status", "Not Started")
        key = s.lower().replace(" ", "_")
        if key in stats: stats[key] += 1
        if s not in ("Completed", "Cancelled") and t.get("due_date"):
            if t["due_date"] < today: stats["overdue"] += 1
            elif t["due_date"] == today: stats["due_today"] += 1
    return stats


# ============================================================
# APP SETUP
# ============================================================

app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origin_regex=r"https?://.*", allow_methods=["*"], allow_headers=["*"])
app.include_router(api_router)

@app.on_event("startup")
async def startup_event():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.subscriptions.create_index([("owner_id", 1), ("is_deleted", 1)])
    await db.people.create_index("name")
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.leave_requests.create_index([("user_id", 1), ("created_at", -1)])
    await db.leave_requests.create_index([("status", 1), ("supervisor_id", 1)])
    await db.tasks.create_index([("assignee_ids", 1), ("status", 1)])
    await db.tasks.create_index([("created_by", 1), ("created_at", -1)])

    DEFAULT_LEAVE_TYPES = [
        ("Casual Leave", "#009d44", 12, True, True),
        ("Sick Leave", "#e31e24", 10, True, True),
        ("Annual Leave", "#3B82F6", 15, True, False),
        ("Work From Home", "#9B59B6", 30, True, False),
        ("Unpaid Leave", "#6b7280", 0, False, True),
    ]
    lt_seeded = await db.system_meta.find_one({"key": "default_leave_types_seeded"})
    if not lt_seeded:
        for name, color, q, paid, half in DEFAULT_LEAVE_TYPES:
            if not await db.leave_types.find_one({"name": name}):
                await db.leave_types.insert_one({"name": name, "color": color, "default_quota_days": q, "is_paid": paid, "allow_half_day": half, "is_active": True, "created_at": datetime.now(timezone.utc)})
        await db.system_meta.insert_one({"key": "default_leave_types_seeded", "at": datetime.now(timezone.utc)})

    DEFAULT_CATS = [("Software", "#009d44"), ("Cloud Services", "#9B59B6"), ("Marketing Tools", "#e31e24"), ("Design Tools", "#F39C12"), ("Communication", "#1ABC9C"), ("Entertainment", "#E67E22"), ("Utilities", "#95A5A6"), ("Others", "#6b7280")]
    seed_flag = await db.system_meta.find_one({"key": "default_categories_seeded"})
    if not seed_flag:
        for name, color in DEFAULT_CATS:
            if not await db.categories.find_one({"category_name": name}):
                await db.categories.insert_one({"category_name": name, "color_code": color, "is_default": True, "created_by": None, "created_at": datetime.now(timezone.utc)})
        await db.system_meta.insert_one({"key": "default_categories_seeded", "at": datetime.now(timezone.utc)})

    admin_email = os.environ.get("ADMIN_EMAIL", "s.faadhil@oswinpanel.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({"email": admin_email, "password_hash": hash_password(admin_password), "full_name": "S. Faadhil", "role": "Admin", "access_level": "editor", "is_active": True, "manager_id": None, "module_permissions": {}, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)})
        logger.info(f"Admin seeded: {admin_email}")
    else:
        patch = {}
        if not existing.get("access_level"):
            patch["access_level"] = "editor"
        if existing.get("role") == "MD":
            patch["role"] = "Admin"
        if patch:
            await db.users.update_one({"_id": existing["_id"]}, {"$set": patch})

    # Seed Director + team members
    SEED_USERS = [
        ("shivam@oswinpanel.com", "Shivam@2026", "Shivam", "Director"),
        ("bablu@oswinpanel.com", "Bablu@2026", "Bablu", "User"),
        ("sangram@oswinpanel.com", "Sangram@2026", "Sangram", "User"),
        ("sagar@oswinpanel.com", "Sagar@2026", "Sagar", "User"),
        ("abhirami@oswinpanel.com", "Abhirami@2026", "Abhirami", "User"),
        ("tushar@oswinpanel.com", "Tushar@2026", "Tushar", "User"),
    ]
    for email, pw, name, role in SEED_USERS:
        if not await db.users.find_one({"email": email}):
            await db.users.insert_one({
                "email": email, "password_hash": hash_password(pw),
                "full_name": name, "role": role,
                "access_level": "editor", "is_active": True, "manager_id": None,
                "module_permissions": {},
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            })
            logger.info(f"Seeded {role}: {email}")
    logger.info("SubTrack Pro startup complete")

@app.on_event("shutdown")
async def shutdown():
    client.close()
