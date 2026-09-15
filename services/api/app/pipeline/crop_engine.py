"""Computer-vision smart re-framing: tracks the primary speaker's face
across 16:9 footage and produces smoothed FFmpeg crop parameters for a
9:16 vertical export.

Requires the optional `opencv-python` and `mediapipe` dependencies; falls
back to a static center-crop when they aren't installed.
"""
import subprocess
from typing import List, Tuple

import numpy as np


class SmartCropEngine:
    TARGET_ASPECT_RATIO = 9 / 16

    def __init__(self, smoothing_alpha: float = 0.08):
        self.alpha = smoothing_alpha

    def analyze_speaker_centroid_trajectory(self, video_path: str, sample_step_frames: int = 5) -> Tuple[int, int, List[float]]:
        import cv2

        try:
            import mediapipe as mp
            mp_face_detection = mp.solutions.face_detection
        except ImportError:
            mp_face_detection = None

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Unable to read input video: {video_path}")

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        default_center_x = width / 2.0
        if mp_face_detection is None:
            cap.release()
            return width, height, [default_center_x] * max(total_frames, 1)

        smoothed_center_x = default_center_x
        center_x_timeline: List[float] = []

        with mp_face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.5) as detector:
            frame_idx = 0
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                if frame_idx % sample_step_frames == 0:
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    results = detector.process(rgb)
                    if results.detections:
                        largest_area = 0.0
                        target_x = smoothed_center_x
                        for detection in results.detections:
                            bbox = detection.location_data.relative_bounding_box
                            area = (bbox.width * width) * (bbox.height * height)
                            if area > largest_area:
                                largest_area = area
                                target_x = (bbox.xmin + bbox.width / 2.0) * width
                        smoothed_center_x = (self.alpha * target_x) + ((1.0 - self.alpha) * smoothed_center_x)

                center_x_timeline.append(smoothed_center_x)
                frame_idx += 1

        cap.release()
        return width, height, center_x_timeline

    def generate_ffmpeg_smart_crop_filter(self, video_path: str) -> str:
        src_w, src_h, center_x_series = self.analyze_speaker_centroid_trajectory(video_path)

        target_w = min(int(src_h * self.TARGET_ASPECT_RATIO), src_w)
        target_w -= target_w % 2
        target_h = src_h

        mean_center_x = float(np.mean(center_x_series)) if center_x_series else src_w / 2.0
        crop_x = int(mean_center_x - (target_w / 2.0))
        crop_x = max(0, min(src_w - target_w, crop_x))
        crop_x -= crop_x % 2

        return f"crop={target_w}:{target_h}:{crop_x}:0,scale=1080:1920"

    def execute_reframing(self, input_video: str, output_video: str) -> str:
        filter_str = self.generate_ffmpeg_smart_crop_filter(input_video)
        cmd = [
            "ffmpeg", "-y", "-i", input_video,
            "-vf", filter_str,
            "-c:v", "libx264", "-preset", "fast", "-crf", "22",
            "-c:a", "copy", "-movflags", "+faststart",
            output_video,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Smart-crop execution failed:\n{result.stderr}")
        return output_video
