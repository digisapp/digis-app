#!/bin/bash

# Navigate to the clean export directory
cd clean-export

# Initialize git and create initial commit
git init
git add .
git commit -m "Initial commit - Digis creator economy platform"

# Add your GitHub repository as remote (replace with your actual repo URL)
# For a new repository:
git remote add origin https://github.com/digisapp/digis-app-clean.git

# Or if you deleted and recreated the original repo:
# git remote add origin https://github.com/digisapp/digis-app.git

# Push to GitHub
git branch -M main
git push -u origin main

echo "✅ Clean code pushed to GitHub successfully!"