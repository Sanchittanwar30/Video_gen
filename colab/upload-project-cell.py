# Complete Colab cell for uploading and extracting project
# Copy this entire cell into your Colab notebook

from google.colab import files
import zipfile
import os

# Create project directory
!mkdir -p /content/video-gen

print("📦 Upload your project ZIP file (colab-project.zip):")
uploaded = files.upload()

# Extract it
for filename in uploaded.keys():
    if filename.endswith('.zip'):
        print(f"📂 Extracting {filename}...")
        with zipfile.ZipFile(filename, 'r') as zip_ref:
            zip_ref.extractall('/content/video-gen')
        print(f"✅ Extracted {filename} to /content/video-gen")
        os.remove(filename)  # Clean up

# Change to project directory
os.chdir('/content/video-gen')
print(f"✅ Current directory: {os.getcwd()}")
print(f"📁 Files in project: {', '.join(os.listdir('.'))}")

# Verify key files exist
required_files = ['package.json', 'src', 'remotion']
missing = [f for f in required_files if not os.path.exists(f)]
if missing:
    print(f"⚠️  Warning: Missing files/dirs: {', '.join(missing)}")
else:
    print("✅ All required files present!")

