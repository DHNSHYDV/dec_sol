from PIL import Image
import sys

try:
    img = Image.open('static/images/logo.png')
    # Get color of top-left pixel to see if it's transparent or a solid color
    rgb = img.convert('RGBA').getpixel((0, 0))
    print(f"Top-left pixel: {rgb}")
except Exception as e:
    print(e)
