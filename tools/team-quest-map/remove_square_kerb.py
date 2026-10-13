"""Takes the cream kerb line off the citadel square's lower edge (it ran on into
the removed branch and read as a stray white line): each kerb pixel is replaced
by the cobbles just above it, or the verge below where it left the square.
Run with `write` to save; without it, lineview.png shows before/after/mask.
"""
import cv2, numpy as np, sys
from PIL import Image, ImageDraw
P='/home/user/TheGreatClassQuest/assets/team-quest-map/painted/'
X0,Y0,W,H=1796,924,420,130
PATH=[(0,30),(50,47),(150,51),(230,47),(280,57),(330,84),(360,100)]
band=Image.new('L',(W,H),0); ImageDraw.Draw(band).line(PATH,fill=255,width=30,joint='curve')
band=np.asarray(band)>0
write = sys.argv[1:] == ['write']
views=[]
for s in ['autumn','winter','spring','summer']:
    land=np.asarray(Image.open(P+f'land-{s}-2560.webp').convert('RGBA')).astype(np.float32).copy()
    reg=land[Y0:Y0+H,X0:X0+W,:3]
    r,g,b=reg[...,0],reg[...,1],reg[...,2]
    cream=(r>232)&(g>212)&(b>160)&(b<222)&(r-b<85)&band
    n,lab,st,_=cv2.connectedComponentsWithStats(cream.astype(np.uint8))
    keep=[k for k in range(1,n) if st[k,cv2.CC_STAT_WIDTH]>40]
    cream=np.isin(lab,keep)
    m=cv2.morphologyEx(cream.astype(np.uint8),cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
    m=cv2.dilate(m,np.ones((5,5),np.uint8)).astype(np.float32)
    m=cv2.GaussianBlur(m,(0,0),1.6).clip(0,1)
    src=land[Y0-20:Y0-20+H,X0:X0+W,:3].copy()  # the same stretch 20 px higher: cobbles
    # Where the line ran off the square into the verge, take the verge below instead.
    below=land[Y0+18:Y0+18+H,X0:X0+W,:3]
    t=np.clip((np.arange(W)-290)/20,0,1)[None,:,None]
    src=src*(1-t)+below*t
    out=reg*(1-m[...,None])+src*m[...,None]
    land[Y0:Y0+H,X0:X0+W,:3]=out
    views.append(np.concatenate([reg.copy() if False else np.asarray(Image.open(P+f'land-{s}-2560.webp').convert('RGB'))[Y0:Y0+H,X0:X0+W],out.clip(0,255).astype(np.uint8),(np.dstack([m]*3)*255).astype(np.uint8)],0))
    if write:
        Image.fromarray(land.clip(0,255).astype(np.uint8),'RGBA').save(P+f'land-{s}-2560.webp','WEBP',quality=84,method=6)
        Image.fromarray(land.clip(0,255).astype(np.uint8),'RGBA').resize((1600,900),Image.LANCZOS).save(P+f'land-{s}-1600.webp','WEBP',quality=84,method=6)
    if s=='autumn': lm=m
Image.fromarray(np.concatenate(views,1).astype(np.uint8)).save('lineview.png')
if write:
    L=np.asarray(Image.open(P+'lights-1600.webp').convert('RGB')).astype(np.float32).copy()
    mm=cv2.dilate(lm,np.ones((9,9),np.uint8)); mm=cv2.resize(mm,(round(W/1.6),round(H/1.6)))
    x,y=round(X0/1.6),round(Y0/1.6)
    L[y:y+mm.shape[0],x:x+mm.shape[1]]*=(1-mm[...,None]*0.9)
    Image.fromarray(L.clip(0,255).astype(np.uint8)).save(P+'lights-1600.webp','WEBP',quality=84,method=6)
