#!/usr/bin/env python3
"""Generates client/assets/office-bg.png and the character sprite variants.

Source sprite packs — redistributed in this repo under assets-src/, see
CREDITS.md for full license terms and attribution requirements:
  - MetroCity characters (JIK-A-4, CC0)
  - Office Furniture Pixel Art (Antea, CC BY 4.0 — attribution required)
  - Billiard Kit Pixel Art (Luca Pixel / OpenGameArt, CC0)
  - Cute Cafe/Arcade Assets (Lumi, informal permission)

Everything is placed on a 32px tile grid — never eyeball pixel coordinates
here again; it's what made the layout look randomly scattered before.
"""
from PIL import Image, ImageDraw
import os, random, sys

ASSETS_SRC = os.path.join(os.path.dirname(__file__), "..", "assets-src")
MC = f"{ASSETS_SRC}/metrocity/MetroCity"
FU = f"{ASSETS_SRC}/furniture/Office-Furniture-Pixel-Art/Office-Furniture-Pixel-Art"
BIL = f"{ASSETS_SRC}/billiard/Billiard Kit"
BUILD = f"{ASSETS_SRC}/build"
CLIENT = os.path.join(os.path.dirname(__file__), "..", "client", "assets")
os.makedirs(f"{CLIENT}/characters", exist_ok=True)

TILE = 32

def load(name, root=FU):
    return Image.open(f"{root}/{name}.png").convert("RGBA")

FOOTPRINT = {
    "Tall-Bookshelf": (2,1), "Wall-Shelf": (2,1), "Bookshelf": (2,1),
    "Wall-Clock": (1,1), "Filing-Cabinet-Tall": (1,2), "Wide-Filing-Cabinet": (2,1),
    "Filing-Cabinet-Small": (1,1), "Desk": (2,1), "Chair": (1,1), "Papers": (1,1),
    "Printer-Furniture": (1,1), "Big-Office-Printer": (1,1), "Bin": (1,1),
    "Small-Plant": (1,1), "Big-Filing-Cabinet": (1,2), "Boss-Desk": (2,1),
    "Boss-Chair": (1,1), "Folders": (1,1), "Board": (2,1), "Wall-Graph": (2,1),
    "Wall-Note-2": (1,1), "Wall-Note": (1,1), "Big-Round-Table": (3,2),
    "Small-Sofa": (2,1), "Big-Plant": (1,2), "Folders-2": (1,1),
    "Mirror": (1,1), "WC-Sink": (1,1), "Toilet-Closed": (1,1), "Toilet-Open": (1,1),
    "WC-Paper": (1,1), "Vending-Machine": (1,2), "Water-Dispenser": (1,2),
    "Coffee-Machine": (1,2), "Big-Sofa-2": (3,1), "Small-Table": (1,1),
    "Chair-2": (1,1), "Desk-2": (2,1),
    "Big-Sofa": (1,1), "Books": (1,1), "Filing-Cabinet-Open": (1,1), "Printer": (1,1),
}

W, H = 960, 640
scene = Image.new("RGBA", (W, H), (10,10,14,255))
draw = ImageDraw.Draw(scene)
for x in range(0, W, 16):
    for y in range(0, H, 16):
        c = (30,34,44,255) if ((x//16 + y//16) % 2 == 0) else (24,27,35,255)
        draw.rectangle([x,y,x+15,y+15], fill=c)

WALL = (15,16,22,255); WALLW = 4
def floor_room(x0,y0,x1,y1,color,grid):
    draw.rectangle([x0,y0,x1-1,y1-1], fill=color)
    for x in range(x0,x1,TILE): draw.line([(x,y0),(x,y1)], fill=grid, width=1)
    for y in range(y0,y1,TILE): draw.line([(x0,y),(x1,y)], fill=grid, width=1)
def rug(x0,y0,x1,y1,color):
    draw.rectangle([x0,y0,x1,y1], fill=color)
    draw.rectangle([x0,y0,x1,y1], outline=(max(0,color[0]-20),max(0,color[1]-20),max(0,color[2]-20),255), width=1)
def wall_h(x0, x1, y, gap=None):
    if gap:
        gx0, gx1 = gap
        draw.line([(x0,y),(gx0,y)], fill=WALL, width=WALLW)
        draw.line([(gx1,y),(x1,y)], fill=WALL, width=WALLW)
    else:
        draw.line([(x0,y),(x1,y)], fill=WALL, width=WALLW)
def wall_v(y0, y1, x, gap=None):
    if gap:
        gy0, gy1 = gap
        draw.line([(x,y0),(x,gy0)], fill=WALL, width=WALLW)
        draw.line([(x,gy1),(x,y1)], fill=WALL, width=WALLW)
    else:
        draw.line([(x,y0),(x,y1)], fill=WALL, width=WALLW)
def corridor_stub(x0,y0,x1,y1,color=(38,42,54,255)):
    draw.rectangle([x0,y0,x1-1,y1-1], fill=color)

WORK = (0,0,448,320); MEET = (480,0,736,224); BATH = (800,0,960,160)
BAR  = (640,256,960,448); GAMES = (0,352,384,640)
DORM = (640,480,960,640)

ROOMS = {
    "work":  (*WORK, (94,64,38,255),   (82,55,31,255)),
    "meeting": (*MEET, (40,54,84,255),  (34,46,72,255)),
    "bathroom": (*BATH, (150,180,196,255), (130,160,178,255)),
    "bar": (*BAR, (196,182,150,255), (178,164,133,255)),
    "games": (*GAMES, (74,42,84,255), (62,34,72,255)),
    "dorm": (*DORM, (58,46,74,255), (48,38,62,255)),
}
for name,(x0,y0,x1,y1,color,grid) in ROOMS.items():
    floor_room(x0,y0,x1,y1,color,grid)

rug(50,40,260,240,(122,86,52,255))
rug(530,60,690,190,(56,74,110,255))
rug(660,290,940,420,(210,198,168,255))
rug(20,390,240,600,(96,58,108,255))
rug(440,180,540,260,(46,52,64,255))
rug(660,500,930,624,(78,64,102,255))

wall_v(WORK[1], WORK[3], WORK[2], gap=(3*TILE,5*TILE)); corridor_stub(WORK[2], 3*TILE, WORK[2]+TILE, 5*TILE)
wall_h(WORK[0], WORK[2], WORK[3], gap=(5*TILE,7*TILE)); corridor_stub(5*TILE, WORK[3], 7*TILE, WORK[3]+TILE)
wall_h(WORK[0], WORK[2], WORK[1]); wall_v(WORK[1], WORK[3], WORK[0])
wall_h(MEET[0], MEET[2], MEET[3], gap=(18*TILE,20*TILE)); corridor_stub(18*TILE, MEET[3], 20*TILE, MEET[3]+TILE)
wall_v(MEET[1], MEET[3], MEET[0], gap=(2*TILE,4*TILE)); corridor_stub(MEET[0]-TILE, 2*TILE, MEET[0], 4*TILE)
wall_h(MEET[0], MEET[2], MEET[1]); wall_v(MEET[1], MEET[3], MEET[2])
wall_v(BATH[1], BATH[3], BATH[0], gap=(1*TILE,3*TILE)); corridor_stub(BATH[0]-TILE, 1*TILE, BATH[0], 3*TILE)
wall_h(BATH[0], BATH[2], BATH[3], gap=(27*TILE,29*TILE)); corridor_stub(27*TILE, BATH[3], 29*TILE, BATH[3]+TILE)
wall_h(BATH[0], BATH[2], BATH[1]); wall_v(BATH[1], BATH[3], BATH[2])
wall_h(BAR[0], BAR[2], BAR[1], gap=(23*TILE,25*TILE)); corridor_stub(23*TILE, BAR[1]-TILE, 25*TILE, BAR[1])
wall_h(BAR[0], BAR[2], BAR[3]); wall_v(BAR[1], BAR[3], BAR[0]); wall_v(BAR[1], BAR[3], BAR[2])
wall_h(GAMES[0], GAMES[2], GAMES[1], gap=(5*TILE,7*TILE)); corridor_stub(5*TILE, GAMES[1]-TILE, 7*TILE, GAMES[1])
wall_h(GAMES[0], GAMES[2], GAMES[3]); wall_v(GAMES[1], GAMES[3], GAMES[0]); wall_v(GAMES[1], GAMES[3], GAMES[2])
wall_h(DORM[0], DORM[2], DORM[1]); wall_h(DORM[0], DORM[2], DORM[3])
wall_v(DORM[1], DORM[3], DORM[0], gap=(16*TILE,18*TILE)); corridor_stub(DORM[0]-TILE, 16*TILE, DORM[0], 18*TILE)
wall_v(DORM[1], DORM[3], DORM[2])

def paste(img, x, y): scene.alpha_composite(img, (x,y))
def place(name, col, row, root=FU, extra_scale=1.0):
    im = load(name, root)
    fw, fh = FOOTPRINT.get(name, (1,1))
    im = im.resize((int(fw*TILE*extra_scale), int(fh*TILE*extra_scale)), Image.NEAREST)
    paste(im, col*TILE, row*TILE)
    return fw*TILE, fh*TILE  # pixel size, for precise child placement (e.g. centering a chair)

def place_px(name, x, y, root=FU):
    """Place at an exact pixel position (for items that must align to
    another placed item's footprint, like a chair centered under a desk,
    rather than to the room's own tile grid)."""
    im = load(name, root)
    paste(im, x, y)

# ===================== WORK OFFICE =====================
place("Tall-Bookshelf", 0, 0); place("Wall-Shelf", 2, 0); place("Bookshelf", 4, 0)
place("Wall-Clock", 6, 0)
place("Wall-Shelf", 10, 0); place("Bookshelf", 12, 0)
place("Filing-Cabinet-Tall", 0, 2); place("Wide-Filing-Cabinet", 0, 4); place("Filing-Cabinet-Small", 0, 5)

DESK_SEATS = []  # pixel (x,y) of each chair, filled below — used to sanity-check against world.js WORK_SEATS
desks = [(2,2),(6,2),(2,5),(6,5)]
for c,r in desks:
    dw, dh = place("Desk", c, r)
    desk_x, desk_y = c*TILE, r*TILE
    chair_x = desk_x + (dw - TILE) // 2   # centered under the desk's width
    chair_y = desk_y + dh                  # immediately below, touching
    place_px("Chair", chair_x, chair_y)
    DESK_SEATS.append((chair_x, chair_y))
    place("Papers", c, r)

place("Printer-Furniture", 10, 2); place("Big-Office-Printer", 10, 1)
place("Bin", 10, 4)
place("Small-Plant", 12, 8); place("Small-Plant", 0, 8)

boss_dw, boss_dh = place("Boss-Desk", 9, 6)
boss_x, boss_y = 9*TILE, 6*TILE
boss_chair_x = boss_x + (boss_dw - TILE) // 2
boss_chair_y = boss_y + boss_dh
place_px("Boss-Chair", boss_chair_x, boss_chair_y)
DESK_SEATS.append((boss_chair_x, boss_chair_y))
place("Big-Filing-Cabinet", 9, 5)
place("Folders", 11, 6)
place("Filing-Cabinet-Open", 13, 2); place("Books", 13, 4); place("Books", 4, 8)

# ===================== MEETING ROOM =====================
place("Board", 15, 0); place("Wall-Graph", 17, 0); place("Wall-Note-2", 19, 0)
place("Big-Round-Table", 17, 2)
place("Small-Sofa", 15, 4)
place("Big-Plant", 21, 3)
place("Folders-2", 18, 2)
place("Books", 21, 1); place("Big-Sofa", 21, 5)

# ===================== BATHROOM =====================
place("Mirror", 25, 0); place("WC-Sink", 25, 2)
draw.line([(27*TILE,8),(27*TILE,4*TILE-8)], fill=(110,140,158,255), width=2)
place("Toilet-Closed", 26, 3)
place("Toilet-Open", 28, 0)
place("WC-Paper", 28, 2)
place("Bin", 29, 2)
place("Small-Plant", 29, 0)

# ===================== BAR / REFEITORIO =====================
place("Vending-Machine", 20, 8); place("Water-Dispenser", 21, 8); place("Coffee-Machine", 22, 8)
place("Wall-Shelf", 23, 8); place("Wall-Note", 28, 8)
place("Bin", 20, 11)
place("Big-Sofa-2", 22, 11)
place("Small-Table", 26, 11)
place("Chair-2", 27, 11)
place("Books", 28, 9); place("Big-Sofa", 20, 9); place("Small-Plant", 29, 11)

# ===================== GAMES ROOM =====================
tbl_col, tbl_row = 1, 12
tbl_im = load("Billiards Table Small", BIL).resize((5*TILE, 3*TILE), Image.NEAREST)
paste(tbl_im, tbl_col*TILE, tbl_row*TILE)
random.seed(3)
fx0, fy0 = tbl_col*TILE+18, tbl_row*TILE+14
fx1, fy1 = (tbl_col+5)*TILE-18, (tbl_row+3)*TILE-16
for b in ["A1","B2","C3","D4","E5","F6","G7","H8","Ball-White"]:
    bim = load(b, BIL).resize((14,14), Image.NEAREST)
    bx = random.randint(fx0, fx1-14); by = random.randint(fy0, fy1-14)
    paste(bim, bx, by)
place("Chair-2", tbl_col+5, tbl_row+1)
arcade_im = Image.open(f"{BUILD}/arcade.png").convert("RGBA").resize((2*TILE, int(2*TILE*46/36)), Image.NEAREST)
paste(arcade_im, 8*TILE, 12*TILE)
claw_im = Image.open(f"{BUILD}/claw.png").convert("RGBA").resize((2*TILE, int(2*TILE*56/40)), Image.NEAREST)
paste(claw_im, 8*TILE, 15*TILE)
place("Board", 1, 17)
place("Big-Sofa", 10, 12); place("Small-Plant", 10, 17)

# ===================== DORMITORY =====================
# No bed asset in the current furniture pack — using Small-Sofa as a bed
# stand-in for now (per user decision). Each sofa gets one "sleep seat"
# immediately in front of it, same centering approach as the desk chairs.
SLEEP_SEATS = []
place("Wall-Clock", 23, 15)
for c, r in [(21,16), (25,16), (21,18)]:
    sw, sh = place("Small-Sofa", c, r)
    sofa_x, sofa_y = c*TILE, r*TILE
    seat_x = sofa_x + sw // 2
    seat_y = sofa_y + sh
    SLEEP_SEATS.append((seat_x, seat_y))
place("Small-Table", 24, 18)
place("Big-Plant", 28, 16)
place("Books", 25, 18)

# ===================== HALLWAY =====================
place("Small-Sofa", 13, 6)
place("Big-Plant", 12, 8)
place("Big-Plant", 27, 6)
place("Wall-Note", 14, 1, extra_scale=1.3)
place("Wall-Graph", 14, 15, extra_scale=1.2)
for pr in (0, 9, 17):
    place("Small-Plant", 14, pr)
place("Board", 24, 15)

scene.save(f"{CLIENT}/office-bg.png")
print("office-bg.png saved", scene.size)
print("Work desk chair pixel positions (feed into server/world.js WORK_SEATS):")
for x, y in DESK_SEATS:
    print(f"  {{ room: 'work', x: {x}, y: {y} }},")
print("Dormitory sleep-seat pixel positions (feed into server/world.js SOCIAL_SEATS, room: 'dorm'):")
for x, y in SLEEP_SEATS:
    print(f"  {{ room: 'dorm', x: {x}, y: {y} }},")

# ---- character variants ----
# CharacterModel.png is a 24-col x 6-row sheet: 6 skin tones (rows) x 24
# animation frames (cols) grouped as 4 directions x 6 walk-cycle frames each
# — [0:6]=down [6:12]=left [12:18]=up [18:24]=right, frame 0 of each block
# is the standing/idle pose. Outfits mirror the same 24-col layout. Hair has
# no per-direction art (single 32x32 sprite) — composited identically on
# every frame, a minor simplification this pack's resolution hides well.
base = Image.open(f"{MC}/CharacterModel/Character Model.png").convert("RGBA")
shadow = Image.open(f"{MC}/CharacterModel/Shadow.png").convert("RGBA")
FRAME = 32
DIRECTIONS = ["down", "left", "up", "right"]  # row order in the exported sheet
FRAMES_PER_DIR = 6
CHAR_SCALE = 3  # 32px native -> 96px on screen, matches the rest of the UI

def frame(img, col, row, size=FRAME):
    x, y = col*size, row*size
    return img.crop((x, y, x+size, y+size))

def make_char_sheet(skin_row, outfit_file, hair_file):
    outfit = Image.open(f"{MC}/Outfits/{outfit_file}").convert("RGBA") if outfit_file else None
    hair = Image.open(f"{MC}/Hair/{hair_file}").convert("RGBA") if hair_file else None
    hair_frame = hair.crop((0, 0, FRAME, FRAME)) if hair else None
    sheet = Image.new("RGBA", (FRAMES_PER_DIR*FRAME, len(DIRECTIONS)*FRAME), (0,0,0,0))
    for row_i in range(len(DIRECTIONS)):
        for col_i in range(FRAMES_PER_DIR):
            src_col = row_i*FRAMES_PER_DIR + col_i
            cell = Image.new("RGBA", (FRAME,FRAME), (0,0,0,0))
            cell.alpha_composite(shadow.crop((0,0,FRAME,FRAME)))
            cell.alpha_composite(frame(base, src_col, skin_row))
            if outfit:
                cell.alpha_composite(frame(outfit, src_col, 0))
            if hair_frame:
                cell.alpha_composite(hair_frame)
            sheet.alpha_composite(cell, (col_i*FRAME, row_i*FRAME))
    return sheet

variants = [
    (0,"Outfit1.png","Hair1.png"), (2,"Outfit3.png","Hair3.png"),
    (4,"Outfit2.png","Hair5.png"), (1,"Outfit4.png","Hair2.png"),
    (5,"Outfit5.png","Hair6.png"), (3,"Outfit6.png","Hair4.png"),
    (2,"Outfit2.png","Hair4.png"), (0,"Outfit6.png","Hair7.png"),
    (0,"Outfit3.png","Hair7.png"), (2,"Outfit1.png","Hair2.png"),
    (3,"Outfit2.png","Hair5.png"), (4,"Outfit4.png","Hair1.png"),
]
for i,(skin,outfit,hair) in enumerate(variants):
    sheet = make_char_sheet(skin, outfit, hair)
    sheet = sheet.resize((sheet.width*CHAR_SCALE, sheet.height*CHAR_SCALE), Image.NEAREST)
    sheet.save(f"{CLIENT}/characters/char-{i}.png")
print(f"character sprite sheets regenerated ({FRAMES_PER_DIR*CHAR_SCALE*FRAME}x{len(DIRECTIONS)*CHAR_SCALE*FRAME} each, {len(DIRECTIONS)} dirs x {FRAMES_PER_DIR} frames)")
