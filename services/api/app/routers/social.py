"""Social platform OAuth (TikTok, Instagram/Meta, YouTube) and direct
publishing dispatch once a render is complete.
"""
import os
from typing import Any, Dict, Optional
from urllib.parse import urlencode

import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.models import User, VideoFile

router = APIRouter(prefix="/api/v1/social", tags=["Social Publishing"])


class SocialAuthService:
    @staticmethod
    def get_authorization_url(platform: str, state: str, redirect_uri: str) -> str:
        platform = platform.lower()
        if platform == "tiktok":
            params = {
                "client_key": os.getenv("TIKTOK_CLIENT_KEY"),
                "scope": "user.info.basic,video.upload,video.publish",
                "response_type": "code",
                "redirect_uri": redirect_uri,
                "state": state,
            }
            return f"https://www.tiktok.com/v2/auth/authorize/?{urlencode(params)}"

        if platform == "instagram":
            params = {
                "client_id": os.getenv("META_APP_ID"),
                "redirect_uri": redirect_uri,
                "scope": "instagram_basic,instagram_content_publish,pages_show_list",
                "response_type": "code",
                "state": state,
            }
            return f"https://www.facebook.com/v19.0/dialog/oauth?{urlencode(params)}"

        if platform == "youtube":
            params = {
                "client_id": os.getenv("GOOGLE_CLIENT_ID"),
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": "https://www.googleapis.com/auth/youtube.upload",
                "access_type": "offline",
                "prompt": "consent",
                "state": state,
            }
            return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"

        raise HTTPException(status_code=400, detail=f"Unsupported social provider: {platform}")

    @staticmethod
    def exchange_code_for_tokens(platform: str, code: str, redirect_uri: str) -> Dict[str, Any]:
        platform = platform.lower()

        if platform == "tiktok":
            data = {
                "client_key": os.getenv("TIKTOK_CLIENT_KEY"),
                "client_secret": os.getenv("TIKTOK_CLIENT_SECRET"),
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            }
            res = requests.post(
                "https://open.tiktokapis.com/v2/oauth/token/", data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}, timeout=10,
            )
            res.raise_for_status()
            body = res.json().get("data", {})
            return {
                "access_token": body.get("access_token"),
                "refresh_token": body.get("refresh_token"),
                "expires_in": body.get("expires_in"),
                "open_id": body.get("open_id"),
            }

        if platform == "instagram":
            short = requests.get(
                "https://graph.facebook.com/v19.0/oauth/access_token",
                params={
                    "client_id": os.getenv("META_APP_ID"),
                    "client_secret": os.getenv("META_APP_SECRET"),
                    "redirect_uri": redirect_uri,
                    "code": code,
                },
                timeout=10,
            )
            short.raise_for_status()
            short_token = short.json().get("access_token")

            long_lived = requests.get(
                "https://graph.facebook.com/v19.0/oauth/access_token",
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": os.getenv("META_APP_ID"),
                    "client_secret": os.getenv("META_APP_SECRET"),
                    "fb_exchange_token": short_token,
                },
                timeout=10,
            )
            long_lived.raise_for_status()
            long_data = long_lived.json()

            ig_user_id = None
            pages = requests.get(
                "https://graph.facebook.com/v19.0/me/accounts",
                params={"access_token": long_data.get("access_token")}, timeout=10,
            ).json()
            if pages.get("data"):
                page = pages["data"][0]
                ig_info = requests.get(
                    f"https://graph.facebook.com/v19.0/{page['id']}",
                    params={"fields": "instagram_business_account", "access_token": page["access_token"]}, timeout=10,
                ).json()
                ig_user_id = ig_info.get("instagram_business_account", {}).get("id")

            return {
                "access_token": long_data.get("access_token"),
                "expires_in": long_data.get("expires_in"),
                "instagram_user_id": ig_user_id,
            }

        if platform == "youtube":
            data = {
                "code": code,
                "client_id": os.getenv("GOOGLE_CLIENT_ID"),
                "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            }
            res = requests.post("https://oauth2.googleapis.com/token", data=data, timeout=10)
            res.raise_for_status()
            body = res.json()
            return {
                "access_token": body.get("access_token"),
                "refresh_token": body.get("refresh_token"),
                "expires_in": body.get("expires_in"),
            }

        raise HTTPException(status_code=400, detail="Provider token exchange failed")


class SocialDispatcher:
    @staticmethod
    def publish_to_tiktok(video_url: str, caption: str, access_token: str) -> Dict[str, Any]:
        body = {
            "post_info": {
                "title": caption[:150],
                "privacy_level": "PUBLIC_TO_EVERYONE",
                "disable_duet": False,
                "disable_stitch": False,
                "disable_comment": False,
            },
            "source_info": {"source": "PULL_FROM_URL", "video_url": video_url},
        }
        res = requests.post(
            "https://open.tiktokapis.com/v2/post/publish/video/init/", json=body,
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}, timeout=15,
        )
        res.raise_for_status()
        return res.json().get("data", {})

    @staticmethod
    def publish_to_instagram_reels(video_url: str, caption: str, access_token: str, ig_user_id: str) -> Dict[str, Any]:
        init = requests.post(
            f"https://graph.facebook.com/v19.0/{ig_user_id}/media",
            data={"media_type": "REELS", "video_url": video_url, "caption": caption, "access_token": access_token},
            timeout=15,
        ).json()
        container_id = init.get("id")
        if not container_id:
            raise RuntimeError(f"Instagram container creation failed: {init}")

        return requests.post(
            f"https://graph.facebook.com/v19.0/{ig_user_id}/media_publish",
            data={"creation_id": container_id, "access_token": access_token}, timeout=15,
        ).json()

    @staticmethod
    def publish_to_youtube_shorts(video_path: str, title: str, description: str, access_token: str) -> Dict[str, Any]:
        metadata = {
            "snippet": {"title": f"{title} #Shorts"[:100], "description": description, "categoryId": "22"},
            "status": {"privacyStatus": "public", "selfDeclaredMadeForKids": False},
        }
        init = requests.post(
            "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
            json=metadata,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Type": "video/mp4",
            },
            timeout=15,
        )
        init.raise_for_status()
        resumable_uri = init.headers.get("Location")

        with open(video_path, "rb") as media_file:
            upload = requests.put(resumable_uri, data=media_file, headers={"Content-Type": "video/mp4"}, timeout=300)
        upload.raise_for_status()
        return upload.json()


class PublishRequest(BaseModel):
    video_id: str
    platform: str  # tiktok, instagram, youtube
    caption: Optional[str] = None


@router.get("/oauth/{platform}/authorize-url")
def get_oauth_url(platform: str, state: str, redirect_uri: str):
    return {"authorize_url": SocialAuthService.get_authorization_url(platform, state, redirect_uri)}


@router.post("/oauth/exchange")
def exchange_oauth_code(platform: str, code: str, redirect_uri: str, db: Session = Depends(get_db)):
    return SocialAuthService.exchange_code_for_tokens(platform, code, redirect_uri)


@router.post("/publish")
def publish_video(payload: PublishRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    video = db.query(VideoFile).filter(VideoFile.id == payload.video_id, VideoFile.user_id == current_user.id).first()
    if not video or video.status != "completed" or not video.output_url:
        raise HTTPException(status_code=400, detail="Video is not ready for publishing")

    caption = payload.caption or "Automated ViralVision publish"

    if payload.platform == "tiktok":
        if not current_user.tiktok_access_token:
            raise HTTPException(status_code=400, detail="TikTok account not connected")
        return SocialDispatcher.publish_to_tiktok(video.output_url, caption, current_user.tiktok_access_token)

    if payload.platform == "instagram":
        if not (current_user.meta_access_token and current_user.instagram_user_id):
            raise HTTPException(status_code=400, detail="Instagram account not connected")
        return SocialDispatcher.publish_to_instagram_reels(
            video.output_url, caption, current_user.meta_access_token, current_user.instagram_user_id
        )

    if payload.platform == "youtube":
        raise HTTPException(
            status_code=400,
            detail="YouTube publishing requires a local file path, not a hosted URL; wire this up once render "
            "artifacts are downloadable server-side.",
        )

    raise HTTPException(status_code=400, detail=f"Unsupported platform: {payload.platform}")
