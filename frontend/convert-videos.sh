#!/bin/bash

# Navigate to the public directory
cd /Users/examodels/Desktop/digis-app/frontend/public

# Convert each .mov file to .mp4 with web-optimized settings
echo "Converting digis-video-intro.mov to MP4..."
ffmpeg -i digis-video-intro.mov -c:v libx264 -preset fast -crf 22 -c:a aac -b:a 128k -movflags +faststart digis-video-intro.mp4

echo "Converting digis-video-celebs.mov to MP4..."
ffmpeg -i digis-video-celebs.mov -c:v libx264 -preset fast -crf 22 -c:a aac -b:a 128k -movflags +faststart digis-video-celebs.mp4

echo "Converting digis-video-alix.mov to MP4..."
ffmpeg -i digis-video-alix.mov -c:v libx264 -preset fast -crf 22 -c:a aac -b:a 128k -movflags +faststart digis-video-alix.mp4

echo "✅ All videos converted successfully!"
echo "The MP4 files are now in the public folder and will work in all browsers."