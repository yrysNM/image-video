# Guardian — 18+ content & screen‑time blocker (PC app)

An always‑on desktop guard that:

- **Blocks adult / 18+ content immediately** — whether you **see** it (it reads
  on‑screen text with OCR, so it works in the browser *and* other programs like
  Instagram, chat apps, PDF viewers, etc.) or **write / paste** it (it inspects
  the clipboard). A single explicit term or a known adult site triggers a block.
- **Enforces per‑app / per‑site time limits** — give Instagram 30 min/day,
  YouTube 45, TikTok 20… when the time is up, that app/site is blocked for the
  rest of the day.
- **Enforcement** = a fullscreen block overlay + closing the offending
  window/tab, and optionally adding adult domains to your `hosts` file.

Everything runs locally; nothing is uploaded.

## How it maps to the request

| Request | How Guardian does it |
| --- | --- |
| Absolute blocker for 18+ content | `detector.py` — explicit‑term + adult‑domain + weighted signal classifier |
| Block if you *saw* it (any program) | `screen.py` captures the screen and OCRs it every few seconds |
| Block if you *wrote* it | clipboard inspection + the same on‑screen text (typed text shows on screen) |
| Active all the time | `monitor.py` runs a continuous loop; install as a startup service |
| Time estimate per app/site, then block | `activity.py` budgets + `config` `budgets:` list |

## Install

Requires Python 3.10+, the Tesseract OCR engine, and (Linux) `xdotool`/`wmctrl`.

```bash
# System packages
# Debian/Ubuntu:
sudo apt-get install -y tesseract-ocr python3-tk xdotool wmctrl xclip
# macOS (Homebrew):  brew install tesseract
# Windows: install "Tesseract at UB Mannheim" and add it to PATH

# Python deps (use a virtualenv)
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
```

## Usage

```bash
# Classify text (the "saw/wrote" brain)
python -m guardian check --text "click here for free porn"     # -> BLOCK
python -m guardian check --text "quarterly financial analysis" # -> ALLOW

# Classify an image via OCR (simulates on-screen content)
python -m guardian check --image screenshot.png

# Capture and scan the real screen once
python -m guardian scan --once --enforce

# See time-budget blocking
python -m guardian budget-demo

# Preview the block overlay
python -m guardian block-demo --reason "demo"

# Start the always-on guard (Ctrl+C to stop)
python -m guardian run --config guardian.example.yaml

# Review what was blocked
python -m guardian log
```

## Configuration

Copy `guardian.example.yaml` and edit it (blocklists, thresholds, enforcement,
and per‑app/site `budgets`). All fields are optional.

## Run it at startup (always‑on)

- **Linux (systemd user service)** — create `~/.config/systemd/user/guardian.service`:

  ```ini
  [Unit]
  Description=Guardian content & time blocker
  [Service]
  ExecStart=%h/guardian/.venv/bin/python -m guardian run --config %h/guardian/guardian.yaml
  Restart=always
  Environment=DISPLAY=:0
  [Install]
  WantedBy=default.target
  ```
  then `systemctl --user enable --now guardian`.

- **Windows** — Task Scheduler → "At log on" → run
  `pythonw -m guardian run --config guardian.yaml`.
- **macOS** — a `launchd` LaunchAgent plist running the same command.

## Detection notes

- Uses word‑boundary matching so substrings don't cause false positives
  (`analysis` ≠ `anal`, `Sussex` ≠ `sex`), and an allow‑list softens
  education/health contexts (e.g. "sex education").
- Extend `extra_hard_terms`, `extra_soft_terms`, and `extra_domains` in config.

## Scope & limitations (honest)

- **This is a PC app.** The detection engine (`detector.py`) is
  platform‑agnostic and reusable, but the OS hooks (active window, closing
  windows) are implemented for Linux here; Windows/macOS use the same structure
  with per‑OS calls (documented above and stubbed in `activity.py`).
- **"Absolute"/unbypassable** enforcement (a determined user can't disable it)
  ultimately needs OS‑level privileges — a background service running as
  admin/root, tamper protection, and DNS/network filtering. This project blocks
  effectively for normal use and provides the hooks (`hosts_block`, window
  close, always‑on service); locking it down fully is an OS‑integration step.
- **Mobile (Android/iOS)** cannot be covered by this desktop process. The same
  `detector` logic can be reused, but enforcement requires platform APIs —
  Android **AccessibilityService** + `VpnService` content filtering, iOS
  **Screen Time / Family Controls (ManagedSettings + DeviceActivity)**. Those
  are separate native apps.
- **OCR accuracy** depends on screen clarity; text rendered as stylized images
  may not be read perfectly.
```
