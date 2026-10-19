import os
import sys
import io
import json
import base64
import urllib.request
import urllib.parse
from PIL import Image

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

def load_env():
    env_vars = {}
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    env_vars[k.strip()] = v.strip().strip('"').strip("'")
    return env_vars

def resize_image_to_webp(image_bytes, max_width=800, quality=80):
    img = Image.open(io.BytesIO(image_bytes))
    w, h = img.size
    
    if w > max_width:
        new_w = max_width
        new_h = int(h * (max_width / w))
        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    output = io.BytesIO()
    # Convert RGBA / P modes if needed, WEBP handles RGBA well
    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
        img.save(output, format='WEBP', quality=quality)
    else:
        img.convert('RGB').save(output, format='WEBP', quality=quality)
    
    return output.getvalue()

def upload_to_imgbb(api_key, webp_bytes):
    b64_data = base64.b64encode(webp_bytes).decode('utf-8')
    post_data = urllib.parse.urlencode({'image': b64_data}).encode('utf-8')
    url = f"https://api.imgbb.com/1/upload?key={api_key}"
    
    req = urllib.request.Request(url, data=post_data, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        if res.get('success'):
            return res['data']['url']
        raise RuntimeError(f"ImgBB upload error: {res}")

def update_firestore_meal(doc_name, low_res_url):
    patch_url = f"https://firestore.googleapis.com/v1/{doc_name}?updateMask.fieldPaths=lowResImageUrl"
    body = json.dumps({
        "fields": {
            "lowResImageUrl": {
                "stringValue": low_res_url
            }
        }
    }).encode('utf-8')
    
    req = urllib.request.Request(patch_url, data=body, method='PATCH', headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as resp:
        return resp.status == 200

def run_migration():
    env = load_env()
    imgbb_key = env.get('VITE_IMGBB_API_KEY')
    project_id = env.get('VITE_FIREBASE_PROJECT_ID', 'cook-off-contest')
    
    if not imgbb_key:
        print("ERROR: VITE_IMGBB_API_KEY is not defined in .env.local")
        return

    print("Fetching events from Firestore...")
    events_url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/events"
    req = urllib.request.Request(events_url, headers={'User-Agent': 'Mozilla/5.0'})
    
    with urllib.request.urlopen(req) as resp:
        events_data = json.loads(resp.read().decode('utf-8'))
    
    events = events_data.get('documents', [])
    print(f"Found {len(events)} event(s).")
    
    total_migrated = 0
    total_skipped = 0

    for event in events:
        event_doc_name = event['name']
        event_id = event_doc_name.split('/')[-1]
        print(f"\nProcessing Event ID: {event_id}")
        
        meals_url = f"https://firestore.googleapis.com/v1/{event_doc_name}/meals"
        meals_req = urllib.request.Request(meals_url, headers={'User-Agent': 'Mozilla/5.0'})
        
        try:
            with urllib.request.urlopen(meals_req) as resp:
                meals_data = json.loads(resp.read().decode('utf-8'))
        except Exception as e:
            print(f"Could not load meals for event {event_id}: {e}")
            continue

        meals = meals_data.get('documents', [])
        print(f"Event has {len(meals)} meal(s).")

        for idx, meal in enumerate(meals, 1):
            meal_doc_name = meal['name']
            fields = meal.get('fields', {})
            name = fields.get('name', {}).get('stringValue', 'Unnamed Meal')
            img_url = fields.get('imageUrl', {}).get('stringValue', '')
            low_res_url = fields.get('lowResImageUrl', {}).get('stringValue', '')

            if low_res_url and low_res_url.strip():
                print(f"[{idx}/{len(meals)}] '{name}' already has lowResImageUrl. Skipping.")
                total_skipped += 1
                continue

            if not img_url or 'placeholder' in img_url:
                print(f"[{idx}/{len(meals)}] '{name}' has no image or is placeholder. Updating fallback.")
                update_firestore_meal(meal_doc_name, img_url)
                total_skipped += 1
                continue

            print(f"[{idx}/{len(meals)}] Migrating '{name}'...")
            try:
                # 1. Download original image
                img_req = urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(img_req) as resp:
                    orig_bytes = resp.read()
                
                orig_size_kb = len(orig_bytes) / 1024
                
                # 2. Resize and compress to WebP (800px max width, 80% quality)
                webp_bytes = resize_image_to_webp(orig_bytes, max_width=800, quality=80)
                webp_size_kb = len(webp_bytes) / 1024
                
                # 3. Upload to ImgBB
                new_low_res_url = upload_to_imgbb(imgbb_key, webp_bytes)
                
                # 4. Save to Firestore
                update_firestore_meal(meal_doc_name, new_low_res_url)
                
                print(f"    [OK] Resized {orig_size_kb:.1f}KB -> {webp_size_kb:.1f}KB (saved {100 - (webp_size_kb/orig_size_kb*100):.1f}%)")
                print(f"    [OK] Uploaded to ImgBB and updated Firestore.")
                total_migrated += 1
            except Exception as e:
                print(f"    [ERROR] Migrating '{name}': {e}")

    print(f"\n==========================================")
    print(f"Migration Complete!")
    print(f"Total Migrated: {total_migrated}")
    print(f"Total Skipped:  {total_skipped}")
    print(f"==========================================")

if __name__ == '__main__':
    run_migration()
