from urllib.parse import parse_qs
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth.models import AnonymousUser, User
from asgiref.sync import sync_to_async

@sync_to_async
def get_user_from_token(token):
    try:
        access_token = AccessToken(token)
        user = User.objects.get(id=access_token["user_id"])
        return user
    except Exception as e:
        print("JWT ERROR:", e)
        return AnonymousUser()

class JWTAuthMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        query_string = scope["query_string"].decode()
        query_params = parse_qs(query_string)

        token = query_params.get("token", [None])[0]

        if token:
            scope["user"] = await get_user_from_token(token)
        else:
            scope["user"] = AnonymousUser()

        return await self.app(scope, receive, send)