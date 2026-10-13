"""Paints out the road branch that ran from the citadel square down off the map.

A 640 x 576 crop of land-<season>-2560.webp at (1856, 864) was repainted without
the branch by gemini-3.1-flash-image (prompt in README.md); this aligns each
repaint on the unchanged square and pastes it inside the branch's outline, at
2560 and 1600, and darkens the night lights there. Run in the folder holding
<season>.png crops and e-<season>.png repaints. `preview` draws the outline.
"""
import cv2, numpy as np, sys
from PIL import Image, ImageDraw
P='/home/user/TheGreatClassQuest/assets/team-quest-map/painted/'
X0,Y0,W,H=1856,864,640,576
POLY=[(205,128),(335,112),(432,210),(428,262),(452,330),(485,420),(530,520),(560,576),(390,576),(330,470),(282,360),(240,250),(205,180)]
def mask():
    m=Image.new('L',(W,H),0); ImageDraw.Draw(m).polygon(POLY,fill=255)
    m=np.asarray(m).astype(np.float32)/255
    m=cv2.dilate(m,np.ones((9,9),np.uint8)); return cv2.GaussianBlur(m,(0,0),9).clip(0,1)
def align(orig,edit):
    g1=cv2.cvtColor(orig,cv2.COLOR_RGB2GRAY); g2=cv2.cvtColor(edit,cv2.COLOR_RGB2GRAY)
    top=np.zeros_like(g1); top[:130]=255
    sift=cv2.SIFT_create(4000)
    k1,d1=sift.detectAndCompute(g1,top); k2,d2=sift.detectAndCompute(g2,None)
    m=cv2.BFMatcher().knnMatch(d2,d1,k=2); good=[a for a,b in m if a.distance<0.7*b.distance]
    src=np.float32([k2[g.queryIdx].pt for g in good]); dst=np.float32([k1[g.trainIdx].pt for g in good])
    A,inl=cv2.estimateAffine2D(src,dst,ransacReprojThreshold=3)
    print(' matches',len(good),'inliers',int(inl.sum()),A.round(3).tolist())
    return cv2.warpAffine(edit,A,(W,H),flags=cv2.INTER_LANCZOS4,borderMode=cv2.BORDER_REFLECT)
M=mask()
if sys.argv[1:]==['preview']:
    im=Image.open('autumn.png').convert('RGB'); d=ImageDraw.Draw(im); d.polygon(POLY,outline=(0,255,255)); im.save('poly.png'); sys.exit()
lights=np.asarray(Image.open(P+'lights-1600.webp').convert('RGB')).astype(np.float32).copy()
for s in ['autumn','winter','spring','summer']:
    land=np.asarray(Image.open(P+f'land-{s}-2560.webp').convert('RGBA')).astype(np.float32).copy()
    orig=land[Y0:Y0+H,X0:X0+W,:3].astype(np.uint8).copy()
    edit=np.asarray(Image.open(f'e-{s}.png').convert('RGB'))
    print(s); e=align(orig,edit).astype(np.float32)
    land[Y0:Y0+H,X0:X0+W,:3]=land[Y0:Y0+H,X0:X0+W,:3]*(1-M[...,None])+e*M[...,None]
    Image.fromarray(land.clip(0,255).astype(np.uint8),'RGBA').save(P+f'land-{s}-2560.webp','WEBP',quality=84,method=6)
    Image.fromarray(land.clip(0,255).astype(np.uint8),'RGBA').resize((1600,900),Image.LANCZOS).save(P+f'land-{s}-1600.webp','WEBP',quality=84,method=6)
    Image.fromarray(land[Y0:Y0+H,X0:X0+W].clip(0,255).astype(np.uint8),'RGBA').save(f'after-{s}.png')
# The lights layer: no lamp light along the road that is gone.
m16=cv2.resize(M,(400,360))
lights[540:900,1160:1560]*=(1-m16[...,None])
Image.fromarray(lights.clip(0,255).astype(np.uint8)).save(P+'lights-1600.webp','WEBP',quality=84,method=6)
