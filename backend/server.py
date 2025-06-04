from fastapi import FastAPI, APIRouter, HTTPException, Request, BackgroundTasks
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import httpx
import asyncio
from telegram import Bot, Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application
import json
import secrets
import string

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Initialize Telegram Bot
bot = Bot(token=os.environ['TELEGRAM_TOKEN'])

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    telegram_id: int
    username: Optional[str] = None
    is_active: bool = True
    is_banned: bool = False
    license_key: Optional[str] = None
    license_expires: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_activity: datetime = Field(default_factory=datetime.utcnow)

class License(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    license_key: str
    is_used: bool = False
    used_by_user_id: Optional[str] = None
    used_by_telegram_id: Optional[int] = None
    duration_days: int = 30  # Default 30 days
    created_at: datetime = Field(default_factory=datetime.utcnow)
    activated_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_by_admin: str = "system"

class Ticket(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    telegram_id: int
    type: str  # "purchase", "support"
    status: str = "open"  # "open", "closed"
    message: str
    admin_response: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class BotActivity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    telegram_id: int
    username: Optional[str] = None
    action: str
    message: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

# Request/Response Models
class LicenseCreate(BaseModel):
    duration_days: int = 30
    quantity: int = 1

class AdminAction(BaseModel):
    user_id: str
    action: str  # "ban", "unban", "extend_license"
    value: Optional[int] = None  # days to extend

# Generate license key
def generate_license_key():
    """Generate a unique license key"""
    return ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(16))

# Log bot activity
async def log_activity(telegram_id: int, username: str, action: str, message: str):
    activity = BotActivity(
        telegram_id=telegram_id,
        username=username,
        action=action,
        message=message
    )
    await db.bot_activities.insert_one(activity.dict())

# Get or create user
async def get_or_create_user(telegram_id: int, username: str = None):
    user = await db.users.find_one({"telegram_id": telegram_id})
    if not user:
        user_obj = User(telegram_id=telegram_id, username=username)
        await db.users.insert_one(user_obj.dict())
        user = user_obj.dict()
    else:
        # Update last activity
        await db.users.update_one(
            {"telegram_id": telegram_id},
            {"$set": {"last_activity": datetime.utcnow()}}
        )
    return user

# Check if user has valid license
async def check_user_license(telegram_id: int):
    user = await db.users.find_one({"telegram_id": telegram_id})
    if not user:
        return False, "User not found"
    
    if user.get('is_banned', False):
        return False, "User is banned"
    
    if not user.get('license_key'):
        return False, "No license activated"
    
    license_expires = user.get('license_expires')
    if not license_expires:
        return False, "License has no expiration date"
    
    if datetime.utcnow() > license_expires:
        return False, "License has expired"
    
    return True, "License is valid"

# Telegram webhook handler
@api_router.post("/telegram-webhook")
async def telegram_webhook(request: Request, background_tasks: BackgroundTasks):
    try:
        update_data = await request.json()
        background_tasks.add_task(handle_telegram_update, update_data)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")

async def handle_telegram_update(update_data: dict):
    """Handle incoming Telegram updates"""
    try:
        update = Update.de_json(update_data, bot)
        
        if update.message:
            await handle_message(update.message)
        elif update.callback_query:
            await handle_callback_query(update.callback_query)
            
    except Exception as e:
        logger.error(f"Error handling update: {str(e)}")

async def handle_message(message):
    """Handle incoming messages"""
    telegram_id = message.from_user.id
    username = message.from_user.username
    text = message.text
    
    # Log activity
    await log_activity(telegram_id, username, "message", text)
    
    # Get or create user
    user = await get_or_create_user(telegram_id, username)
    
    if text == "/start":
        await send_welcome_message(telegram_id)
    elif text == "/buy":
        await handle_buy_request(telegram_id, user['id'])
    elif text.startswith("/license"):
        await handle_license_command(telegram_id, text, user)
    elif text == "/status":
        await handle_status_request(telegram_id, user)
    else:
        await bot.send_message(
            chat_id=telegram_id,
            text="🤖 **Verfügbare Befehle:**\n\n/start - Bot starten\n/buy - Lizenz kaufen\n/license activate [KEY] - Lizenz aktivieren\n/status - Lizenz-Status prüfen",
            parse_mode='Markdown'
        )

async def handle_callback_query(callback_query):
    """Handle button callbacks"""
    telegram_id = callback_query.from_user.id
    username = callback_query.from_user.username
    data = callback_query.data
    
    # Log activity
    await log_activity(telegram_id, username, "callback", data)
    
    await callback_query.answer()
    
    if data == "buy_license":
        user = await get_or_create_user(telegram_id, username)
        await handle_buy_request(telegram_id, user['id'])
    elif data == "check_status":
        user = await get_or_create_user(telegram_id, username)
        await handle_status_request(telegram_id, user)

async def send_welcome_message(telegram_id: int):
    """Send welcome message with license system info"""
    keyboard = [
        [InlineKeyboardButton("💰 Lizenz kaufen", callback_data="buy_license")],
        [InlineKeyboardButton("📊 Status prüfen", callback_data="check_status")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    welcome_text = """🔐 **License System Bot**

Willkommen! Dieser Bot verwaltet Lizenzen.

**Verfügbare Befehle:**
• `/buy` - Lizenz-Kauf anfragen
• `/license activate [KEY]` - Lizenz aktivieren
• `/status` - Lizenz-Status prüfen

Wählen Sie eine Option:"""
    
    await bot.send_message(
        chat_id=telegram_id,
        text=welcome_text,
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )

async def handle_buy_request(telegram_id: int, user_id: str):
    """Handle license purchase request"""
    ticket = Ticket(
        user_id=user_id,
        telegram_id=telegram_id,
        type="purchase",
        message="Lizenz-Kauf angefordert"
    )
    await db.tickets.insert_one(ticket.dict())
    
    await bot.send_message(
        chat_id=telegram_id,
        text="💰 **Kauf-Anfrage erstellt!**\n\nIhr Ticket wurde erstellt. Ein Administrator wird sich bezüglich des Kaufs bei Ihnen melden.\n\n**Ticket-ID:** `{}`".format(ticket.id),
        parse_mode='Markdown'
    )

async def handle_license_command(telegram_id: int, text: str, user: dict):
    """Handle license activation command"""
    parts = text.split()
    
    if len(parts) < 3 or parts[1] != "activate":
        await bot.send_message(
            chat_id=telegram_id,
            text="❌ **Ungültiger Befehl**\n\nVerwenden Sie: `/license activate [LIZENZ-KEY]`",
            parse_mode='Markdown'
        )
        return
    
    license_key = parts[2]
    
    # Check if license exists and is unused
    license_doc = await db.licenses.find_one({"license_key": license_key, "is_used": False})
    if not license_doc:
        await bot.send_message(
            chat_id=telegram_id,
            text="❌ **Ungültiger Lizenz-Key**\n\nDieser Lizenz-Key ist ungültig oder bereits verwendet.",
            parse_mode='Markdown'
        )
        return
    
    # Activate license
    expires_at = datetime.utcnow() + timedelta(days=license_doc['duration_days'])
    
    # Update license
    await db.licenses.update_one(
        {"license_key": license_key},
        {
            "$set": {
                "is_used": True,
                "used_by_user_id": user['id'],
                "used_by_telegram_id": telegram_id,
                "activated_at": datetime.utcnow(),
                "expires_at": expires_at
            }
        }
    )
    
    # Update user
    await db.users.update_one(
        {"telegram_id": telegram_id},
        {
            "$set": {
                "license_key": license_key,
                "license_expires": expires_at,
                "is_active": True
            }
        }
    )
    
    await bot.send_message(
        chat_id=telegram_id,
        text=f"✅ **Lizenz aktiviert!**\n\n🔑 **Key:** `{license_key}`\n📅 **Gültig bis:** {expires_at.strftime('%d.%m.%Y %H:%M')} UTC\n⏰ **Dauer:** {license_doc['duration_days']} Tage",
        parse_mode='Markdown'
    )

async def handle_status_request(telegram_id: int, user: dict):
    """Handle status check request"""
    is_valid, message = await check_user_license(telegram_id)
    
    if is_valid:
        license_expires = user.get('license_expires')
        remaining_time = license_expires - datetime.utcnow()
        remaining_days = remaining_time.days
        
        status_text = f"""✅ **Lizenz-Status: AKTIV**

🔑 **Key:** `{user.get('license_key', 'N/A')}`
📅 **Läuft ab:** {license_expires.strftime('%d.%m.%Y %H:%M')} UTC
⏰ **Verbleibend:** {remaining_days} Tage
👤 **Benutzer:** @{user.get('username', 'N/A')}"""
    else:
        status_text = f"""❌ **Lizenz-Status: INAKTIV**

**Grund:** {message}

Verwenden Sie `/buy` um eine Lizenz zu kaufen."""
    
    await bot.send_message(
        chat_id=telegram_id,
        text=status_text,
        parse_mode='Markdown'
    )

# API Routes
@api_router.get("/")
async def root():
    return {"message": "License System API Server"}

@api_router.get("/users", response_model=List[User])
async def get_users():
    users = await db.users.find().sort("created_at", -1).to_list(1000)
    return [User(**user) for user in users]

@api_router.get("/licenses", response_model=List[License])
async def get_licenses():
    licenses = await db.licenses.find().sort("created_at", -1).to_list(1000)
    return [License(**license) for license in licenses]

@api_router.get("/tickets", response_model=List[Ticket])
async def get_tickets():
    tickets = await db.tickets.find().sort("created_at", -1).to_list(1000)
    return [Ticket(**ticket) for ticket in tickets]

@api_router.get("/activities", response_model=List[BotActivity])
async def get_activities():
    activities = await db.bot_activities.find().sort("timestamp", -1).limit(100).to_list(100)
    return [BotActivity(**activity) for activity in activities]

@api_router.post("/admin/create-licenses")
async def create_licenses(license_data: LicenseCreate):
    created_licenses = []
    
    for _ in range(license_data.quantity):
        license_key = generate_license_key()
        license_obj = License(
            license_key=license_key,
            duration_days=license_data.duration_days
        )
        await db.licenses.insert_one(license_obj.dict())
        created_licenses.append(license_obj)
    
    return {
        "message": f"Created {license_data.quantity} licenses",
        "licenses": [{"key": lic.license_key, "duration": lic.duration_days} for lic in created_licenses]
    }

@api_router.post("/admin/user-action")
async def perform_user_action(action: AdminAction):
    user = await db.users.find_one({"id": action.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = {}
    
    if action.action == "ban":
        update_data["is_banned"] = True
        update_data["is_active"] = False
    elif action.action == "unban":
        update_data["is_banned"] = False
        update_data["is_active"] = True
    elif action.action == "extend_license":
        if user.get('license_expires'):
            new_expiry = user['license_expires'] + timedelta(days=action.value or 30)
            update_data["license_expires"] = new_expiry
        else:
            raise HTTPException(status_code=400, detail="User has no active license to extend")
    
    await db.users.update_one({"id": action.user_id}, {"$set": update_data})
    
    return {"message": f"Action '{action.action}' performed on user"}

@api_router.post("/admin/respond-ticket/{ticket_id}")
async def respond_to_ticket(ticket_id: str, response: str):
    # Update ticket with admin response
    result = await db.tickets.update_one(
        {"id": ticket_id},
        {
            "$set": {
                "admin_response": response,
                "status": "closed",
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Get ticket to send message to user
    ticket = await db.tickets.find_one({"id": ticket_id})
    if ticket:
        message = f"**Antwort auf Ihr Ticket:**\n\n{response}"
        try:
            await bot.send_message(
                chat_id=ticket['telegram_id'],
                text=message,
                parse_mode='Markdown'
            )
        except Exception as e:
            logger.error(f"Failed to send ticket response: {e}")
    
    return {"message": "Ticket response sent"}

async def setup_telegram_webhook():
    """Setup Telegram webhook"""
    try:
        # First check if bot token is valid
        bot_info = await bot.get_me()
        logger.info(f"Bot info: {bot_info}")
        
        # Get the webhook URL
        webhook_url = f"{os.environ.get('REACT_APP_BACKEND_URL', 'https://a0d1a663-69dc-4dcc-a21b-359c9ef7a2c3.preview.emergentagent.com')}/api/telegram-webhook"
        
        # Set the webhook
        await bot.set_webhook(url=webhook_url)
        logger.info(f"Telegram webhook set to: {webhook_url}")
        
        # Get webhook info to verify
        webhook_info = await bot.get_webhook_info()
        logger.info(f"Webhook info: {webhook_info}")
        
    except Exception as e:
        logger.error(f"Failed to set Telegram webhook: {e}")
        logger.info("Continuing startup without webhook")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    await setup_telegram_webhook()
    logger.info("License System Server started")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()