from django.contrib.auth import authenticate
from rest_framework import generics
from django.db.models import Q
from django.contrib.auth.models import User
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .consumers import online_connections
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.parsers import MultiPartParser, FormParser
from .serializers import RegisterSerializer, MessageSerializer
from .models import Message
from .models import Profile
from .serializers import ProfileSerializer

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer

@api_view(['GET'])
def online_users(request):
    return Response(sorted(list(online_connections.keys())))

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_users(request):
    current_user = request.user

    users = User.objects.exclude(id=current_user.id)

    data = []

    for u in users:
        profile, _ = Profile.objects.get_or_create(user=u)

        # last message
        last_msg = Message.objects.filter(
            Q(sender=current_user, receiver=u) |
            Q(sender=u, receiver=current_user)
        ).order_by("-created_at").first()

        # unread count
        unread_count = Message.objects.filter(
            sender=u,
            receiver=current_user,
            is_seen=False
        ).count()

        data.append({
            "id": u.id,
            "username": u.username,
            "profile_pic": profile.profile_pic.url if profile.profile_pic else None,
            "last_message": last_msg.content if last_msg else "",
            "timestamp": last_msg.created_at if last_msg else None,
            "unread": unread_count
        })

    # 🔥 SORT HERE (IMPORTANT)
    data.sort(
        key=lambda x: x["timestamp"] or "",
        reverse=True
    )

    return Response(data)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_messages(request):
    current_user = request.user.username
    other_user = request.GET.get("receiver")

    if not other_user:
        return Response([])

    messages = Message.objects.filter(
        sender__username=current_user,
        receiver__username=other_user
    ) | Message.objects.filter(
        sender__username=other_user,
        receiver__username=current_user
    )

    # mark messages as seen
    Message.objects.filter(
        sender__username=other_user,
        receiver__username=current_user,
        is_seen=False
    ).update(is_seen=True)

    messages = messages.order_by("created_at")

    serializer = MessageSerializer(messages, many=True)
    return Response(serializer.data)


@api_view(["POST"])
def login_view(request):
    username = request.data.get("username")
    password = request.data.get("password")

    user = authenticate(username=username, password=password)

    if user:
        refresh = RefreshToken.for_user(user)

        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "username": user.username
        })

    return Response({"error": "Invalid credentials"}, status=400)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_profile(request):
    profile, _ = Profile.objects.get_or_create(user=request.user)
    serializer = ProfileSerializer(profile, context={"request": request})
    return Response(serializer.data)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_profile(request):
    profile, _ = Profile.objects.get_or_create(user=request.user)

    profile.bio = request.data.get("bio", profile.bio)

    if "profile_pic" in request.FILES:
        profile.profile_pic = request.FILES["profile_pic"]

    profile.save()

    serializer = ProfileSerializer(profile, context={"request": request})
    return Response(serializer.data)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def last_messages(request):
    user = request.user

    users = User.objects.exclude(id=user.id)

    data = {}

    for u in users:
        msg = Message.objects.filter(
            sender__in=[user, u],
            receiver__in=[user, u]
        ).order_by("-created_at").first()

        if msg:
            data[u.username] = {
                "content": msg.content,
                "timestamp": msg.created_at
            }

    return Response(data)
