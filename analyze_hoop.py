from PIL import Image

img = Image.open('hoop_transparent.png')
pixels = img.load()
width, height = img.size

# Find bounds of non-transparent pixels
min_x, max_x = width, 0
min_y, max_y = height, 0

for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        if a > 50:
            if x < min_x: min_x = x
            if x > max_x: max_x = x
            if y < min_y: min_y = y
            if y > max_y: max_y = y

print(f"Image size: {width}x{height}")
print(f"Non-transparent bounds: X({min_x}-{max_x}), Y({min_y}-{max_y})")

# Try to find the horizontal line of the rim (usually the widest orange part)
# Orange is high R, medium G, low B
orange_pixels = []
for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        if a > 50 and r > 150 and g > 50 and g < 150 and b < 100:
            orange_pixels.append((x, y))

if orange_pixels:
    rim_min_x = min([p[0] for p in orange_pixels])
    rim_max_x = max([p[0] for p in orange_pixels])
    rim_min_y = min([p[1] for p in orange_pixels])
    rim_max_y = max([p[1] for p in orange_pixels])
    print(f"Rim (orange) bounds: X({rim_min_x}-{rim_max_x}), Y({rim_min_y}-{rim_max_y})")
    print(f"Rim width: {rim_max_x - rim_min_x}")
    print(f"Rim Y center: {(rim_min_y + rim_max_y) / 2}")
    
    # Let's see the backboard x (rightmost non-transparent)
    print(f"Backboard Right X: {max_x}")
