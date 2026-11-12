# Stack pose sheets into review montages: python proto/montage.py <who> <out-prefix> clip1 clip2 ...
import sys
from PIL import Image, ImageDraw
who, pre, clips = sys.argv[1], sys.argv[2], sys.argv[3:]
ims = []
for c in clips:
    im = Image.open(f'out/sheet-{who}-{c}.png').convert('RGB')
    im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    ImageDraw.Draw(im).text((6, 4), c, fill=(255, 255, 255))
    ims.append(im)
W = max(i.width for i in ims); H = sum(i.height for i in ims)
m = Image.new('RGB', (W, H)); y = 0
for i in ims: m.paste(i, (0, y)); y += i.height
m.save(pre)
