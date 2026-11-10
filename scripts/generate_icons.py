#!/usr/bin/env python3
import math
import struct
import zlib
import os

ICONS_DIR = "/Users/gmorisak/Documents/GitHub/Weights & Measures/icons"

def make_png(width, height, rgba_data):
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
    raw = b''.join(b'\x00' + rgba_data[y*width*4:(y+1)*width*4] for y in range(height))
    idat = chunk(b'IDAT', zlib.compress(raw, 9))
    iend = chunk(b'IEND', b'')
    return header + ihdr + idat + iend

def render_icon(size):
    # Create beautiful warm amber / rich baking warm gradient
    # With a scale + measuring cup icon
    img = bytearray(size * size * 4)
    cx, cy = size / 2.0, size / 2.0
    radius = size * 0.46
    corner_r = size * 0.22 # iOS app icon squircle curve

    for y in range(size):
        for x in range(size):
            idx = (y * size + x) * 4
            # Normal coordinates
            u = x / size
            v = y / size

            # Rounded rect mask (superellipse approx)
            # (|x - cx| / r)^5 + (|y - cy| / r)^5 <= 1
            dx = abs(x - cx) / (size * 0.47)
            dy = abs(y - cy) / (size * 0.47)
            dist_sq = (dx**4.5 + dy**4.5)**(1.0/4.5)

            if dist_sq > 1.0:
                # Outside icon squircle
                img[idx] = 0
                img[idx+1] = 0
                img[idx+2] = 0
                img[idx+3] = 0
                continue
            
            # Anti-aliasing edge
            alpha = 1.0
            if dist_sq > 0.96:
                alpha = max(0.0, min(1.0, (1.0 - dist_sq) / 0.04))

            # Rich warm bakery gradient: #EA580C (warm burnt orange) to #B45309 (amber gold) to #78350F (warm baker bronze)
            t = (u * 0.3 + v * 0.7)
            r = int(245 - t * 50)
            g = int(140 - t * 45)
            b = int(45 - t * 25)

            # Draw balance scale & measuring spoon / cup symbol in pure white with soft glow
            # Normalized x, y [-1, 1] relative to center
            nx = (x - cx) / (size * 0.38)
            ny = (y - cy) / (size * 0.38)

            glyph = 0.0

            # Central pillar of scale: vertical line from ny = -0.4 to 0.55
            if abs(nx) < 0.065 and -0.42 <= ny <= 0.58:
                glyph = 1.0
            
            # Base of scale: horizontal rounded base at ny = 0.52 to 0.62, nx from -0.4 to 0.4
            if -0.42 <= nx <= 0.42 and 0.52 <= ny <= 0.62:
                glyph = 1.0

            # Fulcrum / top knob: circle at (0, -0.42), radius 0.12
            if (nx**2 + (ny + 0.42)**2) < 0.12**2:
                glyph = 1.0

            # Scale beam: horizontal bar at ny = -0.32, nx from -0.72 to 0.72
            if -0.72 <= nx <= 0.72 and -0.36 <= ny <= -0.28:
                glyph = 1.0

            # Left string & pan (weight pan)
            # Strings: diagonal or vertical down from (-0.6, -0.28) to left pan at ny = 0.05
            if abs(nx - (-0.6)) < 0.035 and -0.28 <= ny <= 0.08:
                glyph = 1.0
            # Left pan: curve / arc (x + 0.6)^2 / a^2 + (y - 0.08)^2 / b^2 <= 1 for y >= 0.08
            lx = nx - (-0.6)
            ly = ny - 0.08
            if ly >= 0.0 and ly <= 0.14 and (lx / 0.22)**2 + (ly / 0.14)**2 <= 1.0:
                glyph = 1.0
            # Gram weights on left pan: small rounded block at ny = -0.02 to 0.08, lx = -0.1 to 0.1
            if -0.1 <= lx <= 0.1 and -0.04 <= ny <= 0.08:
                glyph = 1.0

            # Right string & pan (measuring cup / bowl)
            if abs(nx - 0.6) < 0.035 and -0.28 <= ny <= 0.08:
                glyph = 1.0
            rx = nx - 0.6
            ry = ny - 0.08
            # Measuring cup bowl shape on right
            if ry >= 0.0 and ry <= 0.22 and (rx / 0.24)**2 + (ry / 0.22)**2 <= 1.0:
                glyph = 1.0
            # Cup handle on right: arc from rx = 0.2 to 0.32
            if 0.18 <= rx <= 0.32 and 0.02 <= ry <= 0.16 and ((rx - 0.25)**2 + (ry - 0.09)**2) <= 0.08**2 and ((rx - 0.25)**2 + (ry - 0.09)**2) >= 0.04**2:
                glyph = 1.0

            # Combine glyph with background
            if glyph > 0.0:
                # White symbol #FFFFFF
                fr = 255
                fg = 255
                fb = 255
            else:
                fr = r
                fg = g
                fb = b

            img[idx] = fr
            img[idx+1] = fg
            img[idx+2] = fb
            img[idx+3] = int(alpha * 255)

    return make_png(size, size, bytes(img))

def main():
    os.makedirs(ICONS_DIR, exist_ok=True)
    
    sizes = [
        ('apple-touch-icon.png', 180),
        ('icon-192.png', 192),
        ('icon-512.png', 512),
        ('favicon.png', 64)
    ]
    for filename, size in sizes:
        print(f"Generating {filename} ({size}x{size})...")
        png_bytes = render_icon(size)
        path = os.path.join(ICONS_DIR, filename)
        with open(path, 'wb') as f:
            f.write(png_bytes)
        print(f"Saved {path} ({len(png_bytes)} bytes)")

    # Also write a rich SVG icon
    svg_path = os.path.join(ICONS_DIR, 'icon.svg')
    with open(svg_path, 'w', encoding='utf-8') as f:
        f.write('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F59E0B"/>
      <stop offset="50%" stop-color="#EA580C"/>
      <stop offset="100%" stop-color="#9A3412"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="115" fill="url(#bgGrad)"/>
  <g filter="url(#shadow)" fill="#FFFFFF">
    <!-- Fulcrum Knob -->
    <circle cx="256" cy="140" r="22"/>
    <!-- Beam -->
    <rect x="110" y="160" width="292" height="16" rx="8"/>
    <!-- Center Pillar -->
    <rect x="246" y="150" width="20" height="230" rx="6"/>
    <!-- Base -->
    <rect x="156" y="370" width="200" height="26" rx="13"/>
    <!-- Left Suspension -->
    <line x1="145" y1="172" x2="145" y2="260" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round"/>
    <!-- Left Pan -->
    <path d="M 100 260 Q 145 305 190 260 Z" fill="#FFFFFF"/>
    <!-- Weight Stack -->
    <rect x="130" y="235" width="30" height="24" rx="4" fill="#FFFFFF"/>
    <!-- Right Suspension -->
    <line x1="367" y1="172" x2="367" y2="260" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round"/>
    <!-- Right Measuring Cup -->
    <path d="M 320 260 L 330 310 Q 367 325 404 310 L 414 260 Z" fill="#FFFFFF"/>
    <!-- Handle -->
    <path d="M 412 268 C 430 268 430 298 408 302" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" fill="none"/>
  </g>
</svg>''')
    print(f"Saved {svg_path}")

if __name__ == '__main__':
    main()
