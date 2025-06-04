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
from datetime import datetime
import httpx
import asyncio
from telegram import Bot, Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application
import json

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
    credits: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_activity: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    telegram_id: int
    username: Optional[str] = None

class Ticket(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    telegram_id: int
    type: str  # "support", "payment"
    status: str = "open"  # "open", "closed"
    message: str
    admin_response: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TicketCreate(BaseModel):
    user_id: str
    telegram_id: int
    type: str
    message: str

class Account(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # "gaming", "streaming", etc.
    username: str
    password: str
    email: Optional[str] = None
    additional_info: Optional[str] = None
    is_available: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AccountCreate(BaseModel):
    type: str
    username: str
    password: str
    email: Optional[str] = None
    additional_info: Optional[str] = None

class BotActivity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    telegram_id: int
    username: Optional[str] = None
    action: str
    message: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class AdminAction(BaseModel):
    user_id: str
    credits_to_add: int

# Initialize demo accounts on startup
async def init_demo_accounts():
    existing_accounts = await db.accounts.count_documents({})
    if existing_accounts == 0:
        demo_accounts = [
            {"type": "gaming", "username": "gamer_user1", "password": "pass123", "email": "gamer1@example.com", "additional_info": "Steam account", "is_available": True},
            {"type": "gaming", "username": "gamer_user2", "password": "pass456", "email": "gamer2@example.com", "additional_info": "Epic Games account", "is_available": True},
            {"type": "streaming", "username": "stream_user1", "password": "stream123", "email": "stream1@example.com", "additional_info": "Netflix account", "is_available": True},
            {"type": "streaming", "username": "stream_user2", "password": "stream456", "email": "stream2@example.com", "additional_info": "Spotify account", "is_available": True},
            {"type": "social", "username": "social_user1", "password": "social123", "email": "social1@example.com", "additional_info": "Instagram account", "is_available": True},
        ]
        
        for account_data in demo_accounts:
            account_obj = Account(**account_data)
            await db.accounts.insert_one(account_obj.dict())

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
    else:
        # Default response for unknown commands
        await bot.send_message(
            chat_id=telegram_id,
            text="Bot currently in development... ⚠️"
        )

async def handle_callback_query(callback_query):
    """Handle button callbacks"""
    telegram_id = callback_query.from_user.id
    username = callback_query.from_user.username
    data = callback_query.data
    
    # Log activity
    await log_activity(telegram_id, username, "callback", data)
    
    # Get user
    user = await get_or_create_user(telegram_id, username)
    
    await callback_query.answer()
    
    if data == "confirm_ok":
        await show_main_menu(telegram_id)
    elif data == "support":
        await handle_support_request(telegram_id, user['id'])
    elif data == "buy":
        await handle_buy_request(telegram_id, user['id'])
    elif data == "generate":
        await handle_generate_account(telegram_id, user)

async def send_welcome_message(telegram_id: int):
    """Send initial welcome message"""
    keyboard = [
        [InlineKeyboardButton("OK ✅", callback_data="confirm_ok")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await bot.send_message(
        chat_id=telegram_id,
        text="Bot currently in development... ⚠️\n\nClick OK to continue:",
        reply_markup=reply_markup
    )

async def show_main_menu(telegram_id: int):
    """Show main menu with buttons"""
    keyboard = [
        [InlineKeyboardButton("🎫 Einmaliger Support", callback_data="support")],
        [InlineKeyboardButton("💰 Buy Credits", callback_data="buy")],
        [InlineKeyboardButton("🎮 Generate Account", callback_data="generate")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await bot.send_message(
        chat_id=telegram_id,
        text="Wählen Sie eine Option:",
        reply_markup=reply_markup
    )

async def handle_support_request(telegram_id: int, user_id: str):
    """Handle support ticket creation"""
    ticket = Ticket(
        user_id=user_id,
        telegram_id=telegram_id,
        type="support",
        message="Einmaliger Support angefordert"
    )
    await db.tickets.insert_one(ticket.dict())
    
    await bot.send_message(
        chat_id=telegram_id,
        text="✅ Support-Ticket erstellt! Ein Administrator wird sich bald bei Ihnen melden."
    )

async def handle_buy_request(telegram_id: int, user_id: str):
    """Handle buy/payment request"""
    ticket = Ticket(
        user_id=user_id,
        telegram_id=telegram_id,
        type="payment",
        message="Guthaben-Aufladung angefordert (Standard: 10€)"
    )
    await db.tickets.insert_one(ticket.dict())
    
    await bot.send_message(
        chat_id=telegram_id,
        text="💰 Payment-Ticket erstellt!\n\nStandard: 10€ = 10 Credits\n1€ = 1 Generation\n\nEin Administrator wird sich wegen der Zahlung bei Ihnen melden."
    )

async def handle_generate_account(telegram_id: int, user: dict):
    """Handle account generation"""
    if user['credits'] <= 0:
        await bot.send_message(
            chat_id=telegram_id,
            text="❌ Nicht genügend Guthaben! Sie benötigen mindestens 1 Credit.\n\nVerwenden Sie 'Buy Credits' um Guthaben aufzuladen."
        )
        return
    
    # Find available account
    account = await db.accounts.find_one({"is_available": True})
    if not account:
        await bot.send_message(
            chat_id=telegram_id,
            text="❌ Keine Accounts verfügbar! Versuchen Sie es später noch einmal."
        )
        return
    
    # Update account availability and user credits
    await db.accounts.update_one(
        {"id": account['id']},
        {"$set": {"is_available": False}}
    )
    
    await db.users.update_one(
        {"telegram_id": telegram_id},
        {"$inc": {"credits": -1}}
    )
    
    # Send account details
    account_text = f"""🎮 **Account Generated!**

**Type:** {account['type']}
**Username:** `{account['username']}`
**Password:** `{account['password']}`
**Email:** {account.get('email', 'N/A')}
**Info:** {account.get('additional_info', 'N/A')}

**Remaining Credits:** {user['credits'] - 1}"""
    
    await bot.send_message(
        chat_id=telegram_id,
        text=account_text,
        parse_mode='Markdown'
    )

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Telegram Bot API Server"}

@api_router.get("/users", response_model=List[User])
async def get_users():
    users = await db.users.find().to_list(1000)
    return [User(**user) for user in users]

@api_router.get("/tickets", response_model=List[Ticket])
async def get_tickets():
    tickets = await db.tickets.find().sort("created_at", -1).to_list(1000)
    return [Ticket(**ticket) for ticket in tickets]

@api_router.get("/accounts", response_model=List[Account])
async def get_accounts():
    accounts = await db.accounts.find().to_list(1000)
    return [Account(**account) for account in accounts]

@api_router.get("/activities", response_model=List[BotActivity])
async def get_activities():
    activities = await db.bot_activities.find().sort("timestamp", -1).limit(100).to_list(100)
    return [BotActivity(**activity) for activity in activities]

@api_router.post("/admin/add-credits")
async def add_credits(action: AdminAction):
    result = await db.users.update_one(
        {"id": action.user_id},
        {"$inc": {"credits": action.credits_to_add}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": f"Added {action.credits_to_add} credits to user"}

@api_router.post("/admin/send-message")
async def send_admin_message(telegram_id: int, message: str):
    try:
        await bot.send_message(chat_id=telegram_id, text=message)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

@api_router.post("/accounts", response_model=Account)
async def create_account(account: AccountCreate):
    account_obj = Account(**account.dict())
    await db.accounts.insert_one(account_obj.dict())
    return account_obj

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
    await init_demo_accounts()
    await setup_telegram_webhook()
    logger.info("Telegram Bot Server started")

async def setup_telegram_webhook():
    """Setup Telegram webhook"""
    try:
        # First check if bot token is valid
        bot_info = await bot.get_me()
        logger.info(f"Bot info: {bot_info}")
        
        # Get the webhook URL from environment or construct it
        webhook_url = f"{os.environ.get('REACT_APP_BACKEND_URL', 'https://a0d1a663-69dc-4dcc-a21b-359c9ef7a2c3.preview.emergentagent.com')}/api/telegram-webhook"
        
        # Set the webhook
        await bot.set_webhook(url=webhook_url)
        logger.info(f"Telegram webhook set to: {webhook_url}")
        
        # Get webhook info to verify
        webhook_info = await bot.get_webhook_info()
        logger.info(f"Webhook info: {webhook_info}")
        
    except Exception as e:
        logger.error(f"Failed to set Telegram webhook: {e}")
        # Continue startup even if webhook fails
        logger.info("Continuing startup without webhook - bot will work in polling mode for testing")

# Add endpoint to test bot and manually set webhook
@api_router.get("/bot-info")
async def get_bot_info():
    try:
        bot_info = await bot.get_me()
        return {"status": "success", "bot_info": bot_info.to_dict()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get bot info: {str(e)}")

# Add endpoint to manually set webhook
@api_router.post("/set-webhook")
async def set_webhook_endpoint():
    try:
        await setup_telegram_webhook()
        return {"status": "success", "message": "Webhook set successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set webhook: {str(e)}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()