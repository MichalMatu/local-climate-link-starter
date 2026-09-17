from pathlib import Path
p = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx')
text = p.read_text()
old = '<div className="shelly-network-scan__progress" role="status">'
new = '<div className="shelly-network-scan__progress">'
if old not in text:
    raise SystemExit('progress role anchor missing')
p.write_text(text.replace(old, new, 1))
