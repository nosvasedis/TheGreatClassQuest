"""
Takes the cream kerb line off the Team Quest road in every season.

The painted land had a smooth cream stripe running beside the cobbles (up the
mountain switchbacks, over the bridge, on to the citadel square and through
the village lane). It read as a line drawn on the map. This finds it along the
route (where at least two of autumn, spring and summer agree, since the
seasons share one layout), fills it with inpainted cobbles plus borrowed
grain, writes the land at 2560 and 1600, and dims the night lights where the
stripe glowed.

Run once from anywhere: python3 tools/team-quest-map/remove_route_kerb.py write
Without `write` it only saves kerb-preview.png (mask in red) next to this file.
Needs numpy, pillow and opencv-python-headless.
"""
import os, sys
import cv2
import numpy as np
from PIL import Image

P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'team-quest-map', 'painted') + os.sep
# worldGeometry ROUTE_POINTS in world units (1600x900); the land is 2560 wide.
ROUTE = np.array([[230, 748], [262, 728], [292, 707], [335, 698], [390, 702], [440, 721], [500, 737], [552, 735], [600, 718], [640, 694], [624, 640], [613, 590], [604, 540], [592, 486], [568, 446], [525, 410], [476, 362], [449, 318], [456, 289], [490, 273], [552, 264], [612, 254], [655, 234], [668, 210], [655, 188], [686, 197], [720, 220], [750, 250], [774, 290], [791, 331], [810, 373], [829, 420], [846, 456], [862, 486], [884, 505], [912, 500], [942, 503], [975, 516], [1012, 535], [1060, 553], [1100, 576], [1142, 596], [1192, 592], [1242, 578], [1290, 559], [1328, 540], [1358, 522], [1379, 486], [1391, 436], [1390, 398], [1372, 361], [1347, 330], [1323, 298], [1311, 262], [1312, 229], [1330, 203], [1354, 180], [1372, 160]], np.float32) * 1.6


def chaikin(p, n=4):
    for _ in range(n):
        q = [p[0]]
        for a, b in zip(p[:-1], p[1:]):
            q += [0.75 * a + 0.25 * b, 0.25 * a + 0.75 * b]
        q.append(p[-1])
        p = np.array(q)
    return p


PATH = chaikin(ROUTE)


def band(width):
    m = np.zeros((1440, 2560), np.uint8)
    cv2.polylines(m, [PATH.astype(np.int32).reshape(-1, 1, 2)], False, 255, width)
    return m > 0


def detect(season, bw=130):
    im=np.asarray(Image.open(P+f'land-{season}-2560.webp').convert('RGBA')).astype(np.float32)
    r,g,b,a=[im[...,i] for i in range(4)]
    cream=(r>220)&(g>196)&(b>138)&(b<230)&((r-b)>=18)&((r-b)<105)&(a>200)
    op=cv2.morphologyEx(cream.astype(np.uint8),cv2.MORPH_OPEN,np.ones((17,17),np.uint8))
    return (cream&(op==0)&band(bw)).astype(np.uint8)
def tip(season):
    im=np.asarray(Image.open(P+f'land-{season}-2560.webp').convert('RGB')).astype(np.float32)
    r,g,b=im[...,0],im[...,1],im[...,2]
    c=np.zeros(r.shape,np.uint8); cv2.line(c,(990,1118),(1090,1072),1,34)
    return ((r>196)&(g>178)&(b>128)&((r-b)>=12)&(c>0)).astype(np.uint8)
def build():
    d=sum(detect(s)|tip(s) for s in ['autumn','spring','summer'])
    m=(d>=2).astype(np.uint8)
    n,lab,st,_=cv2.connectedComponentsWithStats(m,8)
    out=np.zeros_like(m)
    for i in range(1,n):
        w,h,area=st[i,2],st[i,3],st[i,4]
        if max(w,h)>=60 and area>=150: out[lab==i]=1
    out[int(140*1.6):int(195*1.6), int(625*1.6):int(675*1.6)]=0
    out[int(525*1.6):int(625*1.6), int(1170*1.6):int(1360*1.6)]=0
    # the pale flagstone stretches (descent to the bridge, village to the mountain) are road, not kerb
    out[int(205*1.6):int(490*1.6), int(700*1.6):int(840*1.6)]=0
    out[int(430*1.6):int(672*1.6), int(540*1.6):int(640*1.6)]=0
    out=cv2.morphologyEx(out,cv2.MORPH_CLOSE,np.ones((7,7),np.uint8))
    # two short stubs the detector misses: the switchback foot and the village lane's tip
    hand=np.zeros_like(out)
    cv2.line(hand,(845,676),(905,716),1,14)
    cv2.line(hand,(1025,1120),(1073,1088),1,14)
    loose=np.zeros_like(out)
    for s in ['autumn','spring','summer']:
        im=np.asarray(Image.open(P+f'land-{s}-2560.webp').convert('RGB')).astype(np.float32)
        r,g,b=im[...,0],im[...,1],im[...,2]
        loose|=((r>200)&(g>180)&(b>130)&((r-b)>=12)).astype(np.uint8)
    out|=cv2.dilate(hand&loose,np.ones((3,3),np.uint8))&hand
    return out

def fill(season,M):
    im=np.asarray(Image.open(P+f'land-{season}-2560.webp').convert('RGBA'))
    rgb=np.ascontiguousarray(im[...,:3]); a=im[...,3]
    f=rgb.astype(np.float32)
    lum=f@np.array([0.299,0.587,0.114],np.float32)
    Md=cv2.dilate(M,np.ones((5,5),np.uint8))
    # keep lamp posts and other dark details the line runs behind
    zone=np.zeros_like(M); zone[670:730,840:920]=1; zone[1060:1130,1000:1090]=1
    dark=((lum<120)&(zone>0)).astype(np.uint8)
    Md=(Md&(1-dark)).astype(np.uint8)
    t=cv2.inpaint(rgb,Md,6,cv2.INPAINT_TELEA).astype(np.float32)
    hp=f-cv2.GaussianBlur(f,(0,0),2.2)
    ys,xs=np.nonzero(Md); H,W=M.shape
    grain=np.zeros_like(f); done=np.zeros(len(ys),bool)
    for dy,dx in [(0,24),(0,-24),(24,0),(-24,0),(18,18),(-18,-18),(18,-18),(-18,18),(0,40),(0,-40),(40,0),(-40,0)]:
        sy=np.clip(ys+dy,0,H-1); sx=np.clip(xs+dx,0,W-1)
        ok=(~done)&(Md[sy,sx]==0)&(a[sy,sx]>200)&(lum[sy,sx]>=120)
        grain[ys[ok],xs[ok]]=hp[sy[ok],sx[ok]]; done|=ok
    out=t+grain*0.85
    w=cv2.GaussianBlur(Md.astype(np.float32),(0,0),1.2)
    w=np.maximum(w,Md.astype(np.float32))[...,None]
    res=f*(1-w)+out*w
    return np.dstack([np.clip(res,0,255).astype(np.uint8),a]), Md

if __name__ == '__main__':
    M = build()
    if sys.argv[1:] != ['write']:
        im = np.asarray(Image.open(P + 'land-autumn-2560.webp').convert('RGB')).copy()
        im[M > 0] = [255, 0, 0]
        Image.fromarray(im).resize((1600, 900)).save(os.path.join(os.path.dirname(__file__), 'kerb-preview.png'))
        sys.exit()
    for s in ['autumn', 'winter', 'spring', 'summer']:
        land, _ = fill(s, M)
        img = Image.fromarray(land, 'RGBA')
        img.save(P + f'land-{s}-2560.webp', 'WEBP', quality=84, method=6)
        img.resize((1600, 900), Image.LANCZOS).save(P + f'land-{s}-1600.webp', 'WEBP', quality=84, method=6)
    # Night lights: the stripe glowed; dim it and its halo.
    m = cv2.resize(M.astype(np.float32), (1600, 900), interpolation=cv2.INTER_AREA)
    w = cv2.GaussianBlur(cv2.dilate((m > 0.1).astype(np.float32), np.ones((7, 7), np.uint8)), (0, 0), 3)
    w = np.clip(w * 1.3, 0, 1)
    lights = np.asarray(Image.open(P + 'lights-1600.webp').convert('RGB')).astype(np.float32)
    lights *= 1 - w[..., None] * 0.97
    Image.fromarray(lights.clip(0, 255).astype(np.uint8)).save(P + 'lights-1600.webp', 'WEBP', quality=84, method=6)
