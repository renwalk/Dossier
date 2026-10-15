# DrawBot: a letter "n" built like an organic molecule (black on white)
# Run in the DrawBot app (File > Open, then Cmd+R).
import random
from math import cos, sin, pi

W, H = 1000, 1000
SEED = 3
random.seed(SEED)


def blob(cx, cy, r, wobble=0.22, n=10):
    pts = []
    for k in range(n):
        a = 2 * pi * k / n
        rr = r * (1 + random.uniform(-wobble, wobble))
        pts.append((cx + cos(a) * rr, cy + sin(a) * rr))
    p = BezierPath()
    p.qCurveTo(*pts, None)
    drawPath(p)


# --- skeleton of the "n": left stem, arch, right stem ---
path = []
for t in range(5):                                  # left stem, bottom to top
    path.append((300, 200 + t * 95))
for t in range(1, 6):                               # arch over the top
    a = pi - pi * t / 6
    path.append((500 + cos(a) * 200, 580 + sin(a) * 150))
for t in range(5):                                  # right stem, top to bottom
    path.append((700, 580 - t * 95))

# organic jitter + varied atom sizes
atoms = [(x + random.uniform(-12, 12), y + random.uniform(-12, 12),
          random.choice([26, 34, 34, 44])) for x, y in path]

# a few small side atoms hanging off the chain, like branches
for i in (2, 6, 9, 12):
    x, y, r = atoms[i]
    dx = -1 if x < 500 else 1
    atoms.append((x + dx * random.uniform(70, 90), y + random.uniform(-30, 30), 16))
branches = [(i, len(atoms) - 4 + k) for k, i in enumerate((2, 6, 9, 12))]

# --- draw ---
newPage(W, H)
fill(1)
rect(0, 0, W, H)

stroke(0)
lineCap("round")
strokeWidth(16)
for i in range(len(path) - 1):                      # backbone
    line(atoms[i][:2], atoms[i + 1][:2])
strokeWidth(9)
for i, j in branches:                               # side bonds
    line(atoms[i][:2], atoms[j][:2])

stroke(None)
fill(0)
for x, y, r in atoms:
    blob(x, y, r)

# saveImage("~/Desktop/n.png")
