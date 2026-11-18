"""
Gera a mídia de demonstração dos exercícios (3 quadros + GIF animado por exercício).

- Exercícios com equivalente fotográfico usam fotos reais do Free Exercise DB
  (https://github.com/yuhonas/free-exercise-db, licença Unlicense / domínio público).
  Quadros: foto inicial -> transição (fusão das duas fotos) -> foto final.
- Exercícios de aparelho (Reformer / Step Chair) sem foto livre de direitos recebem
  ilustração esquemática desenhada aqui, nas mesmas 3 fases.

Uso:
    python scripts/generate_exercise_media.py <pasta_cache_downloads>

Saída: public/exercises/<id>/{1,2,3}.jpg e public/exercises/<id>/sequencia.gif
"""

import os
import sys
import urllib.request

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'public', 'exercises')
W, H = 480, 320
CAPTION_H = 44
FEDB_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/{id}/{n}.jpg'

STEP_TITLES = ['Posição Inicial', 'Posição Intermediária', 'Posição Final']

# Exercício -> id da foto equivalente no Free Exercise DB
PHOTO_SOURCES = {
    'ex-ref-2': 'Spinal_Stretch',  # flexão lateral sentada (Mermaid)
    'ex-chr-1': 'Hamstring_Stretch',  # alongamento de isquiotibiais
    'ex-chr-2': 'Cat_Stretch',  # flexão/extensão de coluna em quatro apoios
    'ex-chr-3': 'Superman',  # extensão de tronco em prono (Swan)
    'ex-sol-1': 'Janda_Sit-Up',  # enrolamento de decúbito dorsal para sentado (Roll Up)
    'ex-sol-2': 'Air_Bike',  # alternância de pernas com flexão de tronco (Single Leg Stretch)
    'ex-sol-3': 'Pelvic_Tilt_Into_Bridge',  # ponte com articulação de coluna
}

NAMES = {
    'ex-ref-1': 'Footwork no Reformer',
    'ex-ref-2': 'Mermaid no Reformer',
    'ex-ref-3': 'The Hundred no Reformer',
    'ex-ref-4': 'Short Spine Massage',
    'ex-ref-5': 'Knee Stretches Round',
    'ex-chr-1': 'Hamstring Stretch',
    'ex-chr-2': 'The Cat',
    'ex-chr-3': 'Swan Front',
    'ex-chr-4': 'Footwork na Chair',
    'ex-sol-1': 'Roll Up',
    'ex-sol-2': 'Single Leg Stretch',
    'ex-sol-3': 'Shoulder Bridge',
    'ex-mob-1': 'Open Book',
    'ex-mob-2': 'Side to Side',
}


def font(size, bold=False):
    candidates = (
        ['C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/arialbd.ttf']
        if bold
        else ['C:/Windows/Fonts/segoeui.ttf', 'C:/Windows/Fonts/arial.ttf']
    )
    for path in candidates + ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


# ---------------------------------------------------------------- ilustrações

BG = (244, 247, 245)
FLOOR = (214, 222, 217)
APPARATUS = (120, 132, 140)
APPARATUS_DARK = (78, 90, 98)
BODY = (66, 107, 91)
BODY_BACK = (140, 170, 158)
SKIN = (233, 196, 170)

BONES = [
    ('shoulder', 'elbow'), ('elbow', 'wrist'),
    ('hip', 'knee'), ('knee', 'ankle'),
    ('shoulder2', 'elbow2'), ('elbow2', 'wrist2'),
    ('hip2', 'knee2'), ('knee2', 'ankle2'),
]


def lerp(a, b, t):
    if isinstance(a, tuple):
        return tuple(lerp(x, y, t) for x, y in zip(a, b))
    return a + (b - a) * t


def lerp_pose(p1, p3, t):
    return {k: lerp(p1[k], p3[k], t) for k in p1}


def draw_reformer(d, carriage_x):
    d.rectangle([30, 232, 450, 240], fill=APPARATUS)  # trilho
    d.rectangle([40, 240, 52, 262], fill=APPARATUS_DARK)
    d.rectangle([428, 240, 440, 262], fill=APPARATUS_DARK)
    d.line([(400, 232), (400, 168)], fill=APPARATUS_DARK, width=7)  # barra de pés
    d.ellipse([392, 160, 408, 176], fill=APPARATUS_DARK)
    d.line([(44, 232), (44, 150)], fill=APPARATUS, width=5)  # polias
    d.ellipse([38, 144, 50, 156], fill=APPARATUS_DARK)
    d.rounded_rectangle([carriage_x, 206, carriage_x + 150, 228], radius=6, fill=(196, 168, 140))
    d.rectangle([carriage_x + 8, 228, carriage_x + 142, 232], fill=APPARATUS_DARK)


def draw_chair(d, pedal_drop):
    d.rounded_rectangle([190, 150, 300, 262], radius=6, fill=(196, 168, 140))
    d.rectangle([190, 145, 300, 152], fill=APPARATUS_DARK)
    hinge = (300, 252)
    end = (372, 214 + pedal_drop)
    d.line([hinge, end], fill=APPARATUS_DARK, width=9)


def draw_mat(d):
    d.rounded_rectangle([60, 244, 420, 256], radius=4, fill=(150, 185, 205))


def draw_body(d, p):
    def pt(name):
        return tuple(int(v) for v in p[name])

    # membros do lado de trás primeiro (mais claros)
    for a, b in BONES[4:]:
        if a in p and b in p:
            d.line([pt(a), pt(b)], fill=BODY_BACK, width=13, joint='curve')
    # tronco (com curvatura opcional)
    if 'spine' in p:
        d.line([pt('shoulder'), pt('spine'), pt('hip')], fill=BODY, width=24, joint='curve')
    else:
        d.line([pt('shoulder'), pt('hip')], fill=BODY, width=24)
    for name in ('shoulder', 'hip', 'spine'):
        if name in p:
            x, y = pt(name)
            d.ellipse([x - 12, y - 12, x + 12, y + 12], fill=BODY)
    for a, b in BONES[:4]:
        if a in p and b in p:
            d.line([pt(a), pt(b)], fill=BODY, width=14, joint='curve')
    for name in ('elbow', 'knee', 'wrist', 'ankle'):
        if name in p:
            x, y = pt(name)
            r = 7
            d.ellipse([x - r, y - r, x + r, y + r], fill=BODY if name in ('elbow', 'knee') else SKIN)
    # pescoço + cabeça
    d.line([pt('shoulder'), pt('head')], fill=SKIN, width=10)
    x, y = pt('head')
    d.ellipse([x - 17, y - 17, x + 17, y + 17], fill=SKIN, outline=(190, 150, 125), width=2)


def reformer_scene(carriage_x, straps=None):
    def scene(d, p, t):
        draw_reformer(d, lerp(carriage_x[0], carriage_x[1], t))
        if straps:
            d.line([(44, 150), tuple(int(v) for v in p[straps])], fill=(60, 60, 60), width=2)
    return scene


ILLUSTRATIONS = {
    # Footwork: carrinho se afasta da barra conforme os joelhos estendem
    'ex-ref-1': dict(
        scene=reformer_scene((205, 115)),
        p1=dict(head=(222, 190), shoulder=(248, 200), hip=(325, 200), knee=(362, 148), ankle=(398, 172),
                elbow=(280, 210), wrist=(310, 210)),
        p3=dict(head=(132, 190), shoulder=(158, 200), hip=(235, 200), knee=(318, 186), ankle=(398, 172),
                elbow=(190, 210), wrist=(220, 210)),
    ),
    # Hundred: flexão de tronco, braços bombeando, pernas de tabletop a 45°
    'ex-ref-3': dict(
        scene=reformer_scene((160, 160), straps='wrist'),
        p1=dict(head=(176, 190), shoulder=(200, 200), hip=(280, 200), knee=(290, 148), ankle=(338, 148),
                elbow=(205, 160), wrist=(212, 124)),
        p2=dict(head=(190, 166), shoulder=(210, 184), hip=(280, 200), knee=(290, 148), ankle=(338, 148),
                elbow=(240, 178), wrist=(272, 180)),
        p3=dict(head=(190, 166), shoulder=(210, 184), hip=(280, 200), knee=(325, 170), ankle=(370, 140),
                elbow=(240, 178), wrist=(272, 172)),
    ),
    # Short Spine: pernas a 45°, pelve sobe e coluna enrola, depois desenrola
    'ex-ref-4': dict(
        scene=reformer_scene((160, 160), straps='ankle'),
        p1=dict(head=(176, 192), shoulder=(200, 200), hip=(280, 200), knee=(325, 170), ankle=(370, 140),
                elbow=(230, 208), wrist=(258, 208)),
        p2=dict(head=(176, 192), shoulder=(200, 198), spine=(212, 168), hip=(232, 132), knee=(188, 110),
                ankle=(232, 100), elbow=(230, 208), wrist=(258, 208)),
        p3=dict(head=(176, 192), shoulder=(200, 200), spine=(240, 194), hip=(275, 196), knee=(250, 140),
                ankle=(295, 132), elbow=(230, 208), wrist=(258, 208)),
    ),
    # Knee Stretches Round: ajoelhado no carrinho, coluna arredondada, joelhos empurram o carrinho
    'ex-ref-5': dict(
        scene=reformer_scene((200, 130)),
        p1=dict(head=(372, 128), shoulder=(352, 142), spine=(312, 124), hip=(272, 154), knee=(262, 202),
                ankle=(222, 202), elbow=(378, 156), wrist=(398, 170)),
        p3=dict(head=(372, 128), shoulder=(352, 142), spine=(290, 128), hip=(220, 160), knee=(192, 202),
                ankle=(152, 202), elbow=(378, 156), wrist=(398, 170)),
    ),
    # Footwork na Chair: sentado, pés empurram o pedal para baixo
    'ex-chr-4': dict(
        scene=lambda d, p, t: draw_chair(d, lerp(-10, 30, t)),
        p1=dict(head=(240, 50), shoulder=(240, 76), hip=(244, 138), knee=(300, 132), ankle=(334, 196),
                elbow=(232, 108), wrist=(222, 140)),
        p3=dict(head=(240, 50), shoulder=(240, 76), hip=(244, 138), knee=(304, 146), ankle=(340, 226),
                elbow=(232, 108), wrist=(222, 140)),
    ),
    # Open Book: deitado de lado, braço de cima abre em rotação torácica
    'ex-mob-1': dict(
        scene=lambda d, p, t: draw_mat(d),
        p1=dict(head=(150, 226), shoulder=(180, 232), hip=(275, 234), knee=(330, 196), ankle=(372, 236),
                elbow=(222, 234), wrist=(262, 234), elbow2=(222, 240), wrist2=(262, 240)),
        p2=dict(head=(150, 220), shoulder=(180, 230), hip=(275, 234), knee=(330, 196), ankle=(372, 236),
                elbow=(184, 186), wrist=(188, 146), elbow2=(222, 240), wrist2=(262, 240)),
        p3=dict(head=(146, 216), shoulder=(180, 228), hip=(275, 234), knee=(330, 196), ankle=(372, 236),
                elbow=(140, 222), wrist=(100, 234), elbow2=(222, 240), wrist2=(262, 240)),
    ),
    # Side to Side (vista superior): joelhos pendulam para o lado com ombros apoiados
    'ex-mob-2': dict(
        scene=lambda d, p, t: d.rounded_rectangle([150, 20, 330, 300], radius=8, fill=(150, 185, 205)),
        p1=dict(head=(240, 48), shoulder=(240, 82), hip=(240, 180), knee=(228, 236), ankle=(228, 286),
                hip2=(252, 180), knee2=(252, 236), ankle2=(252, 286),
                elbow=(196, 90), wrist=(160, 96), shoulder2=(240, 82), elbow2=(284, 90), wrist2=(320, 96)),
        p3=dict(head=(240, 48), shoulder=(240, 82), hip=(240, 182), knee=(184, 226), ankle=(222, 286),
                hip2=(252, 182), knee2=(206, 238), ankle2=(250, 288),
                elbow=(196, 90), wrist=(160, 96), shoulder2=(240, 82), elbow2=(284, 90), wrist2=(320, 96)),
    ),
}


def render_illustration(ex_id):
    spec = ILLUSTRATIONS[ex_id]
    frames = []
    for i, t in enumerate((0.0, 0.5, 1.0)):
        if i == 1 and 'p2' in spec:
            pose = spec['p2']
        else:
            pose = lerp_pose(spec['p1'], spec['p3'], t) if i == 1 else spec['p1' if i == 0 else 'p3']
        img = Image.new('RGB', (W, H), BG)
        d = ImageDraw.Draw(img)
        d.rectangle([0, 262, W, H], fill=FLOOR)
        spec['scene'](d, pose, t)
        draw_body(d, pose)
        frames.append(img)
    return frames


# ------------------------------------------------------------------- fotos

def fetch(cache, fedb_id, n):
    os.makedirs(cache, exist_ok=True)
    path = os.path.join(cache, f'{fedb_id}_{n}.jpg')
    if not os.path.exists(path):
        urllib.request.urlretrieve(FEDB_URL.format(id=fedb_id, n=n), path)
    return path


def cover(img):
    img = img.convert('RGB')
    scale = max(W / img.width, H / img.height)
    img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    left = (img.width - W) // 2
    top = (img.height - H) // 2
    return img.crop((left, top, left + W, top + H))


def render_photos(cache, fedb_id):
    a = cover(Image.open(fetch(cache, fedb_id, 0)))
    b = cover(Image.open(fetch(cache, fedb_id, 1)))
    return [a, Image.blend(a, b, 0.5), b]


# --------------------------------------------------------------------- saída

def caption(frame, ex_id, index, source_label):
    img = frame.copy()
    overlay = Image.new('RGBA', (W, CAPTION_H), (23, 35, 29, 215))
    img.paste(overlay, (0, H - CAPTION_H), overlay)
    d = ImageDraw.Draw(img)
    d.text((12, H - CAPTION_H + 5), f'{index + 1}/3 · {STEP_TITLES[index]}', font=font(15, True), fill='white')
    d.text((12, H - CAPTION_H + 25), f'{NAMES[ex_id]} — {source_label}', font=font(11), fill=(200, 220, 210))
    # indicador de progresso
    for i in range(3):
        x = W - 70 + i * 20
        color = (217, 119, 6) if i == index else (120, 140, 130)
        d.ellipse([x, H - CAPTION_H + 16, x + 10, H - CAPTION_H + 26], fill=color)
    return img


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    cache = sys.argv[1]
    for ex_id in NAMES:
        if ex_id in PHOTO_SOURCES:
            frames = render_photos(cache, PHOTO_SOURCES[ex_id])
            label = 'foto real (Free Exercise DB)'
        else:
            frames = render_illustration(ex_id)
            label = 'ilustração esquemática'
        target = os.path.join(OUT_DIR, ex_id)
        os.makedirs(target, exist_ok=True)
        for i, fr in enumerate(frames):
            fr.save(os.path.join(target, f'{i + 1}.jpg'), quality=86)
        captioned = [caption(fr, ex_id, i, label) for i, fr in enumerate(frames)]
        # 1 -> 2 -> 3 -> 2 (vai e volta, como o movimento real)
        seq = captioned + [captioned[1]]
        pal = [f.convert('P', palette=Image.ADAPTIVE, colors=200) for f in seq]
        pal[0].save(
            os.path.join(target, 'sequencia.gif'),
            save_all=True,
            append_images=pal[1:],
            duration=[1300, 900, 1300, 900],
            loop=0,
            optimize=True,
        )
        print('ok', ex_id, label)


if __name__ == '__main__':
    main()
