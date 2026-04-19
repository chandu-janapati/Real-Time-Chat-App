import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

import django
django.setup()

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application
from chat.routing import websocket_urlpatterns

import asyncio
from chat.consumers import cleanup_inactive

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": URLRouter(websocket_urlpatterns),
})