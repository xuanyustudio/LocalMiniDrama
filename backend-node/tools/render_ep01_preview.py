"""Render the existing EP001 storyboard as a local review video."""

from array import array
import json
import math
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
import wave

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
FILES = ROOT / 'deliverables'
FFMPEG = Path(__file__).parent / 'ffmpeg' / 'ffmpeg.exe'
WIDTH, HEIGHT, FPS = 720, 1280, 24
BG = '#101724'
INK = '#edf2f1'
MUTED = '#b1c1cb'
ACCENT = '#efd193'
BLUE = '#7295ac'
PANEL = (46, 215, 674, 894)

CUES = [
    (.75, 3.50, '屯口乡，十七人遇害。'),
    (3.625, 7.625, '县局报来的嫌疑人叫赵海平。'),
    (9.25, 10.875, '有近照吗？'),
    (11.25, 15.75, '县里就传了这张。十一年前拍的。'),
    (27.375, 30.875, '赵盼，14 岁。状态：已殁。'),
    (32.0, 33.875, '什么时候的事？'),
    (34.50, 38.0, '两天前。没附死因。'),
    (43.0, 44.875, '他退伍了没有？'),
    (45.25, 49.25, '没有。邻居说，他在连队养猪。'),
    (50.0, 51.625, '哪个连队？'),
    (57.50, 60.875, '跟县局说，请武警支援。'),
    (60.875, 62.75, '让他们查两件事。'),
    (62.875, 68.625, '赵盼怎么死的，\n赵海平到底在哪支部队。'),
]

NOTES = [
    ('黎明前 · 屯口乡公路', '警车一辆接一辆驶来。唐倩在画外报告案情。'),
    ('黎明前 · 警车后排', '唐倩递来旧合影。县里没有更近的照片。'),
    ('资料特写 · 赵盼', '欧阳卓正要翻页，手停在了页角。'),
    ('黎明前 · 警车后排', '欧阳卓将父女的资料并到一起。'),
    ('资料特写 · 服役栏', '唐倩翻到最后一页。资料没有写明部队。'),
    ('黎明前 · 警车后排', '唐倩拿起对讲机，欧阳卓仍捏着旧合影。'),
]


def font(size, bold=False):
    face = 'msyhbd.ttc' if bold else 'msyh.ttc'
    return ImageFont.truetype(str(Path('C:/Windows/Fonts') / face), size)


def timecode(seconds, srt=False):
    millis = round(seconds * 1000)
    sec, millis = divmod(millis, 1000)
    mins, sec = divmod(sec, 60)
    return f'00:{mins:02d}:{sec:02d},{millis:03d}' if srt else f'{mins:02d}:{sec:02d}'


def paint_art(draw, shot):
    draw.rounded_rectangle(PANEL, 22, fill='#182534', outline='#334757', width=2)
    for index in range(6):
        y = 309 + 82 * index
        draw.line((74, y, 646, y), fill='#21303e', width=1)
    if shot == 0:
        draw.polygon([(78, 865), (282, 500), (448, 500), (648, 865)], fill='#283a46')
        draw.polygon([(307, 863), (353, 561), (364, 561), (345, 863)], fill='#72848e')
        for y, scale in ((541, .42), (619, .63), (728, 1)):
            half = int(100 * scale)
            draw.rounded_rectangle((432-half, y, 432+half, y+int(83*scale)), 12, fill='#0e1922', outline=BLUE, width=2)
            draw.ellipse((450-half, y+27, 474-half, y+40), fill=ACCENT)
            draw.ellipse((406+half, y+27, 429+half, y+40), fill=ACCENT)
            draw.rectangle((412, y-8, 432, y), fill='#a35661')
            draw.rectangle((432, y-8, 452, y), fill='#618ea8')
    elif shot in (1, 3, 5):
        draw.rounded_rectangle((86, 335, 634, 620), 44, fill='#334b5c', outline='#5e7482', width=3)
        draw.polygon([(88, 579), (231, 541), (338, 568), (522, 520), (630, 555), (630, 618), (88, 618)], fill='#253b4b')
        draw.rectangle((340, 337, 360, 620), fill='#212f3c')
        draw.rounded_rectangle((305, 284, 413, 309), 12, fill='#e9c883')
        for x, cy, color in ((207, 530, '#17242f'), (503, 490, '#253743')):
            draw.ellipse((x-63, cy-88, x+63, cy+49), fill=color, outline='#617281', width=2)
            draw.rounded_rectangle((x-85, cy+40, x+85, 789), 72, fill=color, outline='#617281', width=3)
        if shot == 3:
            draw.line((282, 628, 344, 747), fill=BLUE, width=24)
            draw.polygon([(274, 737), (374, 718), (425, 766), (322, 793)], fill='#dfc79a')
            draw.polygon([(356, 749), (448, 737), (467, 784), (374, 798)], fill='#ebd5ab')
        elif shot == 1:
            draw.line((472, 635, 399, 737), fill=BLUE, width=26)
            draw.line((260, 661, 329, 751), fill='#637e91', width=26)
            draw.rounded_rectangle((310, 701, 420, 791), 5, fill='#ddc29b')
            draw.ellipse((333, 719, 368, 755), fill='#745b44')
            draw.ellipse((360, 722, 392, 755), fill='#745b44')
        else:
            draw.rounded_rectangle((472, 655, 535, 775), 11, fill='#0f1b24', outline='#748e9e', width=3)
            draw.line((515, 654, 525, 598), fill='#748e9e', width=5)
            for y in (689, 699, 709):
                draw.line((487, y, 520, y), fill='#748e9e', width=2)
            draw.polygon([(159, 695), (272, 713), (255, 798), (147, 775)], fill='#ddc29b')
            draw.ellipse((175, 724, 204, 759), fill='#745b44')
            draw.ellipse((200, 729, 231, 764), fill='#745b44')
    else:
        draw.rounded_rectangle((155, 326, 601, 740), 12, fill='#8c7e6c')
        draw.rounded_rectangle((120, 357, 555, 801), 12, fill='#d3c4a8')
        draw.rounded_rectangle((155, 380, 575, 826), 12, fill='#f1dfb9')
        if shot == 2:
            draw.rectangle((189, 455, 321, 612), fill='#968273')
            draw.ellipse((224, 472, 287, 544), fill='#68584f')
            draw.rounded_rectangle((213, 534, 296, 604), 22, fill='#68584f')
            draw.line((364, 495, 503, 495), fill='#928273', width=5)
            draw.line((364, 548, 488, 548), fill='#928273', width=5)
            draw.line((192, 672, 513, 672), fill='#928273', width=4)
        else:
            draw.text((196, 429), '服役资料', font=font(37, True), fill='#3a352d')
            draw.text((196, 526), '姓名　赵海平', font=font(30), fill='#3a352d')
            draw.text((196, 599), '部队　', font=font(30), fill='#3a352d')
            draw.line((335, 635, 513, 635), fill='#827565', width=3)
        draw.polygon([(566, 795), (626, 845), (563, 872), (482, 827), (489, 787)], fill='#536a7b')


def card(shot, start, index, destination):
    image = Image.new('RGB', (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(image)
    draw.text((46, 40), '弹痕 /  要案', font=font(26, True), fill=ACCENT)
    draw.text((674, 42), '分镜预览', font=font(24), anchor='ra', fill=MUTED)
    draw.line((46, 88, 674, 88), fill='#334757', width=2)
    draw.text((46, 112), shot['title'], font=font(46, True), fill=INK)
    draw.text((47, 177), NOTES[index][0], font=font(24), fill=MUTED)
    paint_art(draw, index)
    draw.text((50, 923), NOTES[index][1], font=font(23), fill=INK)
    draw.line((47, 986, 674, 986), fill='#334757', width=2)
    draw.text((48, 1005), f'镜头  {index + 1:02d} / 06', font=font(22), fill=ACCENT)
    end = start + shot['duration']
    draw.text((671, 1005), f'{timecode(start)}  —  {timecode(end)}', font=font(22), anchor='ra', fill=MUTED)
    for segment in range(6):
        x = 49 + segment * 105
        draw.rounded_rectangle((x, 1053, x + 94, 1061), 4, fill=ACCENT if segment == index else '#344757')
    draw.text((360, 1227), 'EP 01   /   静态分镜示意', font=font(18), anchor='ma', fill=MUTED)
    image.save(destination)


def audio_bed(destination, duration):
    rate = 24000
    track = array('h')
    tau = 2 * math.pi
    for sample in range(duration * rate):
        t = sample / rate
        fade = min(1.0, t / 1.2, (duration - t) / 1.3)
        pulse = .5 + .5 * math.sin(tau * .23 * t)
        rumble = fade * (430 * math.sin(tau * 49 * t) + 220 * pulse * math.sin(tau * 73 * t))
        radio = 0
        if 68.75 < t < 68.94:
            onset = t - 68.75
            radio = 1400 * math.sin(tau * 720 * onset) * math.sin(math.pi * onset / .19)
        track.append(int(rumble + radio))
    with wave.open(str(destination), 'wb') as wav:
        wav.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
        wav.writeframes(track.tobytes())


def ffmpeg(args, cwd):
    subprocess.run([str(FFMPEG), '-hide_banner', '-loglevel', 'error', '-y', *args], cwd=cwd, check=True)


def main():
    shots = json.loads((FILES / 'EP01-storyboard.json').read_text(encoding='utf-8-sig'))
    duration = sum(shot['duration'] for shot in shots)
    assert len(shots) == 6 and duration == 70
    srt = '\n\n'.join(f'{i}\n{timecode(a, True)} --> {timecode(b, True)}\n{line}' for i, (a, b, line) in enumerate(CUES, 1)) + '\n'
    (FILES / 'EP01-preview.srt').write_text(srt, encoding='utf-8-sig')
    with TemporaryDirectory(prefix='ep01-preview-') as scratch:
        temp = Path(scratch)
        start = 0
        manifest = []
        for index, shot in enumerate(shots):
            label = f'card-{index + 1}'
            card(shot, start, index, temp / f'{label}.png')
            manifest.append(f"file '{label}.png'\nduration {shot['duration']}\n")
            start += shot['duration']
        (temp / 'cards.txt').write_text(''.join(manifest) + "file 'card-6.png'\n", encoding='ascii')
        (temp / 'captions.srt').write_text(srt, encoding='utf-8-sig')
        audio_bed(temp / 'bed.wav', duration)
        ffmpeg(['-f', 'concat', '-safe', '1', '-i', 'cards.txt', '-i', 'bed.wav', '-vf',
                f"fps={FPS},subtitles=captions.srt:force_style='FontName=Microsoft YaHei,FontSize=12,PrimaryColour=&H00FFFFFF,OutlineColour=&H001B1410,BorderStyle=3,Outline=2,Shadow=0,MarginV=39,Alignment=2'",
                '-t', str(duration), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', str(FILES / 'EP01-preview.mp4')], temp)
        ffmpeg(['-ss', '4.0', '-i', str(FILES / 'EP01-preview.mp4'), '-frames:v', '1',
                str(FILES / 'EP01-preview-still.png')], temp)


if __name__ == '__main__':
    main()
