from pathlib import Path
import support_ui_content as content

ROOT = Path('.')


def main():
    (ROOT / 'css').mkdir(exist_ok=True)
    (ROOT / 'js').mkdir(exist_ok=True)
    (ROOT / 'img' / 'support').mkdir(parents=True, exist_ok=True)

    (ROOT / 'css' / 'support.css').write_text(content.SUPPORT_CSS.strip() + '\n', encoding='utf-8')
    (ROOT / 'js' / 'support.js').write_text(content.SUPPORT_JS.strip() + '\n', encoding='utf-8')

    content.write_qr(
        'https://enroll.zellepay.com/qr-codes?data=eyJ0b2tlbiI6InRlc2huYWlyQG1lLmNvbSIsIm5hbWUiOiJSaXRlc2gifQ==',
        ROOT / 'img' / 'support' / 'zelle.png',
    )
    content.write_qr('https://cash.app/$teshnair', ROOT / 'img' / 'support' / 'cash-app.png')
    content.write_qr(
        'https://venmo.com/code?user_id=4671165251454051760&created=1787616068.4310908',
        ROOT / 'img' / 'support' / 'venmo.png',
    )

    marker = b'<script src="js/support.js" defer></script>'
    closing = b'</body>'

    for path in sorted(ROOT.glob('*.html')):
        raw = path.read_bytes()
        if marker in raw:
            continue
        if closing not in raw:
            raise RuntimeError(f'{path} has no closing body tag')
        newline = b'\r\n' if b'\r\n' in raw else b'\n'
        raw = raw.replace(closing, marker + newline + closing, 1)
        path.write_bytes(raw)


if __name__ == '__main__':
    main()
