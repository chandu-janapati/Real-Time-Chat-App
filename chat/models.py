from django.db import models
from django.contrib.auth.models import User

class Message(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent")
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name="received")
    content = models.TextField(blank=True, null=True)
    file = models.FileField(upload_to="chat_files/", null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    is_seen = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    edited_at = models.DateTimeField(null=True, blank=True)
    is_delivered = models.BooleanField(default=False)
    def __str__(self):
        return f"{self.sender} -> {self.receiver}"
    
def default_avatar():
    return "default.png"  # 🔥 default image path

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    bio = models.TextField(blank=True)
    profile_pic = models.ImageField(
        upload_to="profiles/",
        default=default_avatar
    )

    def __str__(self):
        return self.user.username