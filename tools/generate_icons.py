"""Generate the mini program's line icons as small RGBA PNGs.

Pure standard-library drawing (4x supersampling for anti-aliasing), so the icon
set can be regenerated without any image tooling. Run from anywhere:

    python tools/generate_icons.py
"""

import math
import os
import struct
import zlib

SCALE = 4
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'icons')

INK = (61, 107, 229)       # brand blue for page icons
MUTED = (138, 148, 166)    # tab bar, unselected
ACTIVE = (47, 107, 255)    # tab bar, selected


def clamp(value, low=0.0, high=1.0):
    return max(low, min(high, value))


class Canvas:
    def __init__(self, size):
        self.size = size
        self.n = size * SCALE
        self.mask = [0.0] * (self.n * self.n)

    def _put(self, x, y, coverage):
        if 0 <= x < self.n and 0 <= y < self.n:
            index = y * self.n + x
            if coverage > self.mask[index]:
                self.mask[index] = coverage

    def segment(self, x1, y1, x2, y2, width=3.2):
        x1, y1, x2, y2 = (v * SCALE for v in (x1, y1, x2, y2))
        half = width * SCALE / 2.0
        pad = half + 1.5
        left = int(math.floor(min(x1, x2) - pad))
        right = int(math.ceil(max(x1, x2) + pad))
        top = int(math.floor(min(y1, y2) - pad))
        bottom = int(math.ceil(max(y1, y2) + pad))
        dx, dy = x2 - x1, y2 - y1
        length_sq = dx * dx + dy * dy
        for py in range(top, bottom + 1):
            for px in range(left, right + 1):
                if length_sq == 0:
                    dist = math.hypot(px + 0.5 - x1, py + 0.5 - y1)
                else:
                    t = clamp(((px + 0.5 - x1) * dx + (py + 0.5 - y1) * dy) / length_sq)
                    dist = math.hypot(px + 0.5 - (x1 + t * dx), py + 0.5 - (y1 + t * dy))
                coverage = clamp(half + 0.7 - dist)
                if coverage > 0:
                    self._put(px, py, coverage)

    def polyline(self, points, width=3.2):
        for (x1, y1), (x2, y2) in zip(points, points[1:]):
            self.segment(x1, y1, x2, y2, width)

    def circle(self, cx, cy, radius, width=3.2):
        cx, cy, radius = cx * SCALE, cy * SCALE, radius * SCALE
        half = width * SCALE / 2.0
        pad = half + 1.5
        left = int(math.floor(cx - radius - pad))
        right = int(math.ceil(cx + radius + pad))
        top = int(math.floor(cy - radius - pad))
        bottom = int(math.ceil(cy + radius + pad))
        for py in range(top, bottom + 1):
            for px in range(left, right + 1):
                dist = abs(math.hypot(px + 0.5 - cx, py + 0.5 - cy) - radius)
                coverage = clamp(half + 0.7 - dist)
                if coverage > 0:
                    self._put(px, py, coverage)

    def dot(self, cx, cy, radius, width=3.2):
        self.circle(cx, cy, max(radius, 0.1), width * 2.2)

    def rounded_rect(self, x, y, width, height, radius, stroke=3.2):
        r = radius
        self.polyline([
            (x + r, y), (x + width - r, y),
            (x + width, y + r), (x + width, y + height - r),
            (x + width - r, y + height), (x + r, y + height),
            (x, y + height - r), (x, y + r), (x + r, y),
        ], stroke)
        # soften the mitred corners with a small arc
        for cx, cy, start in (
            (x + r, y + r, 180), (x + width - r, y + r, 270),
            (x + width - r, y + height - r, 0), (x + r, y + height - r, 90),
        ):
            arc = []
            for step in range(7):
                angle = math.radians(start + step * 15)
                arc.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
            self.polyline(arc, stroke)

    def png(self, color):
        size = self.size
        rows = []
        for y in range(size):
            row = bytearray([0])  # filter type: none
            for x in range(size):
                total = 0.0
                for sy in range(SCALE):
                    base = (y * SCALE + sy) * self.n + x * SCALE
                    total += sum(self.mask[base:base + SCALE])
                alpha = int(round(255 * clamp(total / (SCALE * SCALE))))
                row.extend(struct.pack('4B', color[0], color[1], color[2], alpha))
            rows.append(bytes(row))
        raw = b''.join(rows)

        def chunk(tag, payload):
            body = tag + payload
            return struct.pack('>I', len(payload)) + body + struct.pack('>I', zlib.crc32(body) & 0xffffffff)

        header = struct.pack('>2I5B', size, size, 8, 6, 0, 0, 0)
        return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header)
                + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def build(name, size, draw, color):
    canvas = Canvas(size)
    draw(canvas)
    with open(os.path.join(OUT_DIR, name + '.png'), 'wb') as handle:
        handle.write(canvas.png(color))


# 48px page icons -----------------------------------------------------------

def calendar(c):
    c.rounded_rect(7, 11, 34, 31, 4)
    c.segment(7, 20, 41, 20)
    c.segment(16, 7, 16, 15)
    c.segment(32, 7, 32, 15)
    c.dot(16, 27, 1.4, 2.0)
    c.dot(24, 27, 1.4, 2.0)
    c.dot(32, 27, 1.4, 2.0)
    c.dot(16, 35, 1.4, 2.0)
    c.dot(24, 35, 1.4, 2.0)


def clock(c):
    c.circle(24, 24, 16)
    c.polyline([(24, 14), (24, 24), (31, 29)])


def location(c):
    c.polyline([(13, 22), (16, 14), (24, 10), (32, 14), (35, 22), (24, 41), (13, 22)])
    c.circle(24, 21, 4)


def users(c):
    c.circle(18, 18, 6)
    c.circle(33, 19, 5)
    c.polyline([(7, 38), (9, 31), (14, 28), (22, 28), (27, 32)])
    c.polyline([(27, 32), (30, 28), (37, 28), (41, 33), (42, 38)])


def ticket(c):
    c.rounded_rect(7, 14, 34, 20, 4)
    c.segment(17, 14, 17, 34, 2.2)
    c.segment(32, 14, 32, 24, 2.2)
    c.segment(32, 30, 32, 34, 2.2)


def arrow(c):
    c.polyline([(18, 11), (30, 24), (18, 37)], 3.6)


def check(c):
    c.circle(24, 24, 17)
    c.polyline([(16, 24), (22, 30), (33, 18)])


def shield(c):
    c.polyline([(24, 6), (39, 12), (37, 28), (24, 42), (11, 28), (9, 12), (24, 6)])
    c.polyline([(17, 24), (22, 29), (31, 19)])


def phone(c):
    c.rounded_rect(15, 6, 18, 36, 4)
    c.segment(21, 11, 27, 11)
    c.dot(24, 36, 1.4, 2.0)


def note(c):
    c.rounded_rect(10, 8, 28, 32, 4)
    c.segment(16, 18, 32, 18, 2.6)
    c.segment(16, 25, 32, 25, 2.6)
    c.segment(16, 32, 27, 32, 2.6)


def image(c):
    c.rounded_rect(7, 11, 34, 27, 4)
    c.circle(16, 20, 3, 2.4)
    c.polyline([(9, 34), (19, 25), (27, 31), (33, 25), (39, 31)])


def empty(c):
    c.polyline([(8, 18), (14, 11), (34, 11), (40, 18), (40, 37), (8, 37), (8, 18)])
    c.segment(8, 22, 40, 22, 2.4)
    c.segment(19, 28, 29, 28, 2.4)


def refresh(c):
    c.polyline([(38, 21), (38, 14), (31, 14)])
    c.polyline([(38, 14), (33, 19), (26, 25), (19, 29), (12, 29)])
    c.polyline([(10, 27), (10, 34), (17, 34)])
    c.polyline([(10, 34), (18, 32), (25, 28), (32, 23), (38, 21)])


def logout(c):
    c.polyline([(20, 8), (10, 8), (10, 40), (20, 40)])
    c.polyline([(24, 24), (40, 24)])
    c.polyline([(34, 18), (40, 24), (34, 30)])


PAGE_ICONS = {
    'ic-calendar': calendar,
    'ic-clock': clock,
    'ic-location': location,
    'ic-users': users,
    'ic-ticket': ticket,
    'ic-arrow': arrow,
    'ic-check': check,
    'ic-shield': shield,
    'ic-phone': phone,
    'ic-note': note,
    'ic-image': image,
    'ic-empty': empty,
    'ic-refresh': refresh,
    'ic-logout': logout,
}


# 81px tab bar icons --------------------------------------------------------

def tab_home(c):
    c.polyline([(11, 39), (40, 14), (69, 39)], 5.2)
    c.polyline([(20, 36), (20, 66), (60, 66), (60, 36)], 5.2)
    c.rounded_rect(34, 49, 13, 17, 2, 4.4)


def tab_records(c):
    c.rounded_rect(18, 12, 45, 57, 5, 5.2)
    c.segment(29, 29, 52, 29, 4.4)
    c.segment(29, 41, 52, 41, 4.4)
    c.segment(29, 53, 44, 53, 4.4)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for name, draw in PAGE_ICONS.items():
        build(name, 48, draw, INK)
    for suffix, color in (('', MUTED), ('-active', ACTIVE)):
        build('tab-home' + suffix, 81, tab_home, color)
        build('tab-records' + suffix, 81, tab_records, color)
    print('generated', len(PAGE_ICONS) + 4, 'icons in', OUT_DIR)


if __name__ == '__main__':
    main()
