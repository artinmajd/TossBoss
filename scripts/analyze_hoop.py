from PIL import Image

img = Image.open('../assets/hoop_transparent.png')
pixels = img.load()
width, height = img.size

orange_pixels = []
for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        if a > 50 and r > 150 and g > 50 and g < 150 and b < 100:
            orange_pixels.append((x, y))

leftmost_pixel = min(orange_pixels, key=lambda p: p[0])
print(f"Leftmost orange pixel is at: X={leftmost_pixel[0]}, Y={leftmost_pixel[1]}")

highest_pixel = min(orange_pixels, key=lambda p: p[1])
print(f"Highest orange pixel is at: X={highest_pixel[0]}, Y={highest_pixel[1]}")
