# Join the reel parts into one H.264 file with labels, through the imageio-ffmpeg binary.
#   python proto/reel_build.py <frames dir from proto/reel.sh> <out.mp4>
import json, os, subprocess, sys
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

R, OUT = sys.argv[1], sys.argv[2]
FF = imageio_ffmpeg.get_ffmpeg_exe(); W, H = 1280, 720
try:
    FONT = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 26); BIG = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 40)
except OSError:
    FONT = BIG = ImageFont.load_default()
enc = subprocess.Popen([FF, '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', '30', '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'slow', OUT], stdin=subprocess.PIPE)
n = 0
def put(im):
    global n; enc.stdin.write(im.convert('RGB').tobytes()); n += 1
def card(title, sub, frames=60):
    im = Image.new('RGB', (W, H), (14, 11, 13)); d = ImageDraw.Draw(im)
    d.text((80, 300), title, fill=(236, 230, 220), font=BIG); d.text((80, 360), sub, fill=(170, 162, 150), font=FONT)
    for _ in range(frames): put(im)
def tag(im, text):
    d = ImageDraw.Draw(im); w = d.textlength(text, font=FONT) + 28; d.rectangle([0, H - 52, w, H], fill=(14, 11, 13)); d.text((14, H - 46), text, fill=(236, 230, 220), font=FONT); return im
def part(name, hold=75):
    d = os.path.join(R, name)
    if not os.path.isdir(d): print('missing part', name); return
    labels = json.load(open(os.path.join(d, 'labels.json'))); frames = sorted(f for f in os.listdir(d) if f.endswith('.png')); cur, until = None, -1
    for i, f in enumerate(frames):
        if str(i) in labels: cur, until = labels[str(i)], i + hold
        im = Image.open(os.path.join(d, f)).convert('RGB')
        put(tag(im, cur) if cur else im)

card('Low Water: characters', 'Current figures against the new pipeline. Offscreen CPU renders, 2026-10-17.')
# old against new on the quay at today's camera: the old from the playthrough capture, the new from the runtime
oldf = os.path.join(R, 'old'); os.makedirs(oldf, exist_ok=True)
subprocess.run([FF, '-loglevel', 'error', '-y', '-ss', '19', '-t', '4', '-i', '../game/capture/playthrough/low-water-playthrough.mp4', '-vf', 'fps=30,crop=640:360:300:170', os.path.join(oldf, '%04d.png')], check=True)
olds = sorted(os.listdir(oldf)); news = sorted(f for f in os.listdir(os.path.join(R, 'walkquay')) if f.endswith('.png')) if os.path.isdir(os.path.join(R, 'walkquay')) else []
for i in range(min(len(olds), 120)):
    im = Image.new('RGB', (W, H), (14, 11, 13)); im.paste(Image.open(os.path.join(oldf, olds[i])).convert('RGB'), (0, 180))
    if news: im.paste(Image.open(os.path.join(R, 'walkquay', news[min(i, len(news) - 1)])).convert('RGB').crop((300, 170, 940, 530)), (640, 180))
    d = ImageDraw.Draw(im); d.text((20, 130), 'Current: figures.mjs cutout, one side view', fill=(236, 230, 220), font=FONT); d.text((660, 130), 'New: skinned figure, same camera, true scale', fill=(236, 230, 220), font=FONT)
    put(im)
part('turntable'); part('secondary'); part('lamb'); part('npcs'); part('fray'); part('enemies'); part('quay')
enc.stdin.close(); enc.wait(); print(OUT, n, 'frames', round(n / 30, 1), 's')
