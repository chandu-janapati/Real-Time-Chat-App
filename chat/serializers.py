from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Message
from .models import Profile

class RegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["username", "password"]
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class MessageSerializer(serializers.ModelSerializer):
    sender = serializers.CharField(source="sender.username")
    receiver = serializers.CharField(source="receiver.username")

    class Meta:
        model = Message
        fields = [
            "id",
            "sender",
            "receiver",
            "content",
            "created_at",
            "is_seen",
            "is_deleted",
            'is_delivered',
        ]

    def get_timestamp(self, obj):
        return obj.created_at.isoformat() if obj.created_at else None

    def get_reply_to(self, obj):
        if obj.reply_to:
            return {
                "id": obj.reply_to.id,
                "content": obj.reply_to.content,
                "sender": obj.reply_to.sender.username
            }
        return None
    
class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username")
    profile_pic = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = ["id", "username", "profile_pic", "bio"]

    def get_profile_pic(self, obj):
        request = self.context.get("request")

        if obj.profile_pic:
            return request.build_absolute_uri(obj.profile_pic.url)

        return None