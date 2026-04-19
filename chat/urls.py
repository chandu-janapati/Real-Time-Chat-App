from django.urls import path
from .views import (
    login_view,
    RegisterView,
    get_users,
    get_messages,
    online_users,
    get_profile,
    update_profile
)
from chat.views import online_users
from django.conf import settings
from django.conf.urls.static import static
urlpatterns = [
    path("login/", login_view),
    path("register/", RegisterView.as_view()),
    path("users/", get_users),
    path("messages/", get_messages),
    path("online-users/", online_users),
    path("profile/", get_profile),
    path("profile/update/", update_profile),
]
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)