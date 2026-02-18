#!/usr/bin/env python3
"""
macOS DMG Builder for Apple Service Ticketing System
Builds a standalone DMG installer with WebUI offline app
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

# Configuration
PROJECT_DIR = Path(__file__).parent.parent
import time
BUILD_ID = str(int(time.time()))
BUILD_DIR = Path(f"/tmp/app_build_{BUILD_ID}")
APP_BUNDLE = BUILD_DIR / "AppleService.app/Contents"
RESOURCES_DIR = APP_BUNDLE / "Resources"
MACOS_DIR = APP_BUNDLE / "MacOS"
DIST_DIR = PROJECT_DIR / "dist"
FINAL_DIR = PROJECT_DIR / "final" / "MacOS"

def run_cmd(cmd, error_msg=""):
    """Run shell command and return output"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"❌ Error: {error_msg}")
        print(f"   Command: {cmd}")
        print(f"   Output: {e.stderr}")
        sys.exit(1)

def create_app_structure():
    """Create macOS app bundle structure"""
    print("📁 Creating app bundle structure...")
    
    # Create directories
    MACOS_DIR.mkdir(parents=True, exist_ok=True)
    RESOURCES_DIR.mkdir(parents=True, exist_ok=True)
    
    # Create launcher script
    launcher_path = MACOS_DIR / "run"
    launcher_code = '''#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../Resources" && pwd)"
open "$SCRIPT_DIR/app.html"
'''
    launcher_path.write_text(launcher_code)
    launcher_path.chmod(0o755)
    print(f"   ✓ Launcher script: {launcher_path}")
    
    # Copy WebUI
    html_src = PROJECT_DIR / "demo-full.html"
    html_dst = RESOURCES_DIR / "app.html"
    if not html_src.exists():
        print(f"❌ Error: {html_src} not found")
        sys.exit(1)
    shutil.copy(html_src, html_dst)
    print(f"   ✓ WebUI copied: {html_dst} ({html_dst.stat().st_size / 1024:.1f} KB)")
    
    # Create Info.plist
    plist_path = APP_BUNDLE / "Info.plist"
    plist_content = '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key><string>run</string>
    <key>CFBundleIdentifier</key><string>local.applservice.ticketing</string>
    <key>CFBundleName</key><string>Apple Service</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleShortVersionString</key><string>1.0.0</string>
    <key>CFBundleVersion</key><string>1</string>
    <key>LSMinimumSystemVersion</key><string>10.14</string>
    <key>NSHighResolutionCapable</key><true/>
    <key>NSHumanReadableCopyright</key><string>© 2026 Apple Service</string>
</dict>
</plist>'''
    plist_path.write_text(plist_content)
    print(f"   ✓ Info.plist created: {plist_path}")

def create_dmg():
    """Create DMG from app bundle"""
    print("\n📦 Creating DMG installer...")
    
    DIST_DIR.mkdir(exist_ok=True)
    dmg_path = DIST_DIR / "ticket-system-installer.dmg"
    
    # Remove existing DMG
    if dmg_path.exists():
        dmg_path.unlink()
        print(f"   ✓ Removed old DMG")
    
    # Create DMG (temporary)
    temp_dmg = DIST_DIR / "temp.dmg"
    cmd = f'hdiutil create -srcfolder "{BUILD_DIR}" -volname "Apple Service" -fs HFS+ -fsargs "-c c=64,a=16,e=16" -format UDRW -ov -o "{temp_dmg}"'
    print(f"   Creating uncompressed DMG...")
    run_cmd(cmd, "Failed to create temp DMG")
    
    # Compress to UDZO
    cmd = f'hdiutil convert "{temp_dmg}" -format UDZO -o "{dmg_path}"'
    print(f"   Compressing to UDZO format...")
    run_cmd(cmd, "Failed to convert DMG")
    
    # Clean up temp
    temp_dmg.unlink(missing_ok=True)
    
    size_kb = dmg_path.stat().st_size / 1024
    print(f"   ✓ DMG created: {dmg_path} ({size_kb:.1f} KB)")
    
    return dmg_path

def copy_to_final(dmg_path):
    """Copy DMG to final distribution folder"""
    print("\n📤 Copying to final distribution...")
    
    FINAL_DIR.mkdir(parents=True, exist_ok=True)
    final_dmg = FINAL_DIR / dmg_path.name
    
    shutil.copy(dmg_path, final_dmg)
    print(f"   ✓ Copied to: {final_dmg}")
    
    # Also copy to aktualna
    aktualna_dir = PROJECT_DIR / "final" / "aktualna"
    aktualna_dir.mkdir(parents=True, exist_ok=True)
    print(f"   ✓ Note: WebUI available in: {aktualna_dir}/index.html")

def cleanup():
    """Remove temporary build directory"""
    print("\n🧹 Cleaning up...")
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
        print(f"   ✓ Removed: {BUILD_DIR}")

def main():
    """Main build process"""
    print("=" * 60)
    print("🍎 macOS DMG Builder - Apple Service Ticketing")
    print("=" * 60)
    print(f"Project: {PROJECT_DIR}")
    print(f"Build dir: {BUILD_DIR}")
    print(f"Output: {DIST_DIR}")
    print("=" * 60)
    
    try:
        create_app_structure()
        dmg_path = create_dmg()
        copy_to_final(dmg_path)
        cleanup()
        
        print("\n" + "=" * 60)
        print("✅ BUILD SUCCESSFUL!")
        print("=" * 60)
        print(f"DMG ready at: {dmg_path}")
        print(f"Installation: open {dmg_path}")
        print("\nTo install:")
        print("  1. Double-click the DMG to mount")
        print("  2. Drag 'Apple Service.app' to Applications folder")
        print("  3. Open from Launchpad or Applications")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ BUILD FAILED: {e}")
        cleanup()
        sys.exit(1)

if __name__ == "__main__":
    main()
