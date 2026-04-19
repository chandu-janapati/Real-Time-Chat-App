from channels.generic.websocket import AsyncWebsocketConsumer
import json
from django.contrib.auth.models import User
from .models import Message
from asgiref.sync import sync_to_async
from urllib.parse import parse_qs
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError
import asyncio
import time
last_seen = {}  # { username: timestamp }
import logging
logger = logging.getLogger("chat")
online_connections = {}  # { username: set(channel_names) }

cleanup_started = False
class ChatConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        query = parse_qs(self.scope["query_string"].decode())
        token = query.get("token", [None])[0]

        if not token:
            return await self.close()

        try:
            access = AccessToken(token)
            user_id = access["user_id"]

            self.user = await sync_to_async(User.objects.get)(id=user_id)
            self.username = self.user.username

            self.group_name = f"user_{self.username}"

            await self.channel_layer.group_add("global_online", self.channel_name)
            await self.channel_layer.group_add(self.group_name, self.channel_name)

            await self.accept()

            logger.info(f"[CONNECT] {self.username}")

            if self.username not in online_connections:
                online_connections[self.username] = set()

            online_connections[self.username].add(self.channel_name)

            global cleanup_started
            if not cleanup_started:
                cleanup_started = True
                asyncio.create_task(cleanup_inactive())

            await self.broadcast_online_users()

        except TokenError:
            # 🔥 silent drop (normal case)
            await self.close()

        except Exception as e:
            logger.error(f"WS CONNECT ERROR: {e}")
            await self.close()
        

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard("global_online", self.channel_name)
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

        if hasattr(self, "username"):
            logger.info(f"[DISCONNECT] {self.username}")
        
        if hasattr(self, "username") and self.username in online_connections:
            online_connections[self.username].discard(self.channel_name)

            if not online_connections[self.username]:
                del online_connections[self.username]
        if hasattr(self, "username"):
            await self.broadcast_online_users()

    async def receive(self, text_data):
            try:
                data = json.loads(text_data)
                action = data.get("action")

                if action == "send":
                    logger.info(f"[MSG] {self.user.username} -> {data.get('receiver')}")
                    await self.handle_send(data)

                elif action == "seen":
                    await self.mark_seen(data)
                
                elif action == "edit":
                    await self.handle_edit(data)

                elif action == "delete":
                    await self.handle_delete(data)

                elif action == "ping":
                    if hasattr(self, "username"):
                        last_seen[self.username] = time.time()
                    await self.send(text_data=json.dumps({"type": "pong"}))

            except Exception as e:
                logger.error(f"WS RECEIVE ERROR: {e}")

    async def handle_send(self, data):
        sender = self.user
        receiver = await sync_to_async(User.objects.get)(username=data["receiver"])

        msg = await sync_to_async(Message.objects.create)(
    sender=sender,
    receiver=receiver,
    content=data["message"],
    is_seen=False,
    is_delivered=True   # 🔥 add this
)

        payload = {
            "type": "chat_message",
            "id": msg.id,
            "temp_id": data.get("temp_id"),
            "sender": sender.username,
            "receiver": receiver.username,
            "content": msg.content,
            "timestamp": msg.created_at.isoformat(),
            "is_seen": False,
            "is_delivered": True
        }

        # send to receiver
        await self.channel_layer.group_send(f"user_{receiver.username}", payload)

        # send to sender
        await self.channel_layer.group_send(f"user_{sender.username}", payload)

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event))

    async def mark_seen(self, data):
        sender = data["sender"]

        messages = await sync_to_async(list)(
            Message.objects.filter(
                sender__username=sender,
                receiver=self.user,
                is_seen=False
            )
        )

        for msg in messages:
            msg.is_seen = True
            await sync_to_async(msg.save)()

            # 🔥 REAL-TIME SEEN UPDATE
            await self.channel_layer.group_send(
                f"user_{sender}",
                {
                    "type": "seen_update",
                    "message_id": msg.id
                }
            )

    async def seen_update(self, event):
        await self.send(text_data=json.dumps({
            "type": "seen_update",
            "message_id": event["message_id"]
        }))

    async def typing_event(self, event):
        await self.send(text_data=json.dumps({
            "type": "typing",
            "sender": event["sender"]
        }))
    
    async def broadcast_online_users(self):
        users = list(online_connections.keys())

        await self.channel_layer.group_send(
        "global_online",
        {
            "type": "online_users_update",
            "users": users
        }
    )
    async def online_users_update(self, event):
        await self.send(text_data=json.dumps({
        "type": "online_users",
        "users": event["users"]
    }))
    
async def cleanup_inactive():
    while True:
        now = time.time()
        to_remove = []

        for user, ts in last_seen.items():
            if now - ts > 60:
                to_remove.append(user)

        for user in to_remove:
            online_connections.pop(user, None)
            last_seen.pop(user, None)

        if to_remove:
            # 🔥 broadcast update
            from channels.layers import get_channel_layer
            channel_layer = get_channel_layer()

            await channel_layer.group_send(
                "global_online",
                {
                    "type": "online_users_update",
                    "users": list(online_connections.keys())
                }
            )

        await asyncio.sleep(30)
    
async def handle_edit(self, data):
    msg = await sync_to_async(Message.objects.get)(id=data["message_id"])

    # ❌ prevent editing others' messages
    if msg.sender_id != self.user.id:
        return

    msg.content = data["content"]
    msg.edited_at = timezone.now()
    await sync_to_async(msg.save)()

    payload = {
        "type": "message_edited",
        "message_id": msg.id,
        "content": msg.content,
        "edited_at": msg.edited_at.isoformat(),
    }

    await self.channel_layer.group_send(f"user_{msg.receiver.username}", payload)
    await self.channel_layer.group_send(f"user_{msg.sender.username}", payload)


async def handle_delete(self, data):
    msg = await sync_to_async(Message.objects.get)(id=data["message_id"])

    if msg.sender_id != self.user.id:
        return

    msg.is_deleted = True
    await sync_to_async(msg.save)()

    payload = {
        "type": "message_deleted",
        "message_id": msg.id,
    }

    await self.channel_layer.group_send(f"user_{msg.receiver.username}", payload)
    await self.channel_layer.group_send(f"user_{msg.sender.username}", payload)
