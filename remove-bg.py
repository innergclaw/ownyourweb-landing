#!/usr/bin/env python3
"""Remove background from logo and make it transparent"""

from PIL import Image
import sys

# Open the image
img_path = '/Users/ngvisions/.openclaw/workspace/projects/ownyourweb/demos/allyzworld-logo.jpg'
img = Image.open(img_path).convert('RGBA')

# Get dimensions
width, height = img.size
pixels = img.load()

# Define the background color threshold (near-white)
# The logo appears to have a white/light background
threshold = 240

# Process each pixel
for x in range(width):
    for y in range(height):
        r, g, b, a = pixels[x, y]
        
        # Check if pixel is close to white (background)
        if r > threshold and g > threshold and b > threshold:
            # Make it fully transparent
            pixels[x, y] = (r, g, b, 0)
        # Also check for very light colors that might be background
        elif abs(r - g) < 15 and abs(g - b) < 15 and abs(r - b) < 15 and r > 220:
            # Grayish light background
            pixels[x, y] = (r, g, b, 0)

# Save as PNG with transparency
output_path = '/Users/ngvisions/.openclaw/workspace/projects/ownyourweb/demos/allyzworld-logo-transparent.png'
img.save(output_path, 'PNG')

print(f'Saved transparent logo to: {output_path}')
print(f'Dimensions: {width}x{height}')
