import urllib.request
from PIL import Image

def process_image(url, output_path):
    req = urllib.request.Request(
        url, 
        data=None, 
        headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36'
        }
    )
    with urllib.request.urlopen(req) as response, open("temp.jpeg", 'wb') as out_file:
        out_file.write(response.read())
    img = Image.open("temp.jpeg").convert("RGBA")
    datas = img.getdata()

    newData = []
    # threshold for "white"
    threshold = 240
    for item in datas:
        # change all white (also shades of whites)
        # to transparent
        if item[0] > threshold and item[1] > threshold and item[2] > threshold:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)

    img.putdata(newData)
    img.save(output_path, "PNG")

import os

output_dir = os.path.join(os.path.dirname(__file__), "..", "public")
process_image("https://i.imgur.com/1KCux4B.jpeg", os.path.join(output_dir, "medal_1st.png"))
process_image("https://i.imgur.com/gLTwrdp.jpeg", os.path.join(output_dir, "medal_2nd.png"))
print("Done!")
