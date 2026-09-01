"""Import the Dream-Drive tracker into the existing Google Sheet via the Sheets UI."""
from __future__ import annotations

import sys
import time
import urllib.parse
from pathlib import Path

from playwright.sync_api import TimeoutError as PwTimeout
from playwright.sync_api import sync_playwright

SHEET_ID = "1HHQ9yo_x0NIiAe11Orrfsc5CKw3-5fCMQUD3LKa0Z8Q"
SHEET_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit"
XLSX = Path(__file__).resolve().parents[1] / "docs" / "Dream-Drive-Functionality-Tracker.xlsx"
USER_DATA = Path.home() / "AppData" / "Local" / "Temp" / "dd-gsheets-chrome"
SCREEN = Path(__file__).resolve().parents[1] / "docs" / "gsheet-import-debug.png"


def log(msg: str) -> None:
    print(msg, flush=True)


def launch(p):
    USER_DATA.mkdir(parents=True, exist_ok=True)
    kwargs = dict(
        user_data_dir=str(USER_DATA),
        headless=False,
        args=["--disable-blink-features=AutomationControlled"],
        viewport={"width": 1440, "height": 920},
        accept_downloads=True,
    )
    try:
        return p.chromium.launch_persistent_context(**kwargs, channel="chrome")
    except Exception as exc:
        log(f"System Chrome unavailable ({exc}); using Playwright Chromium")
        return p.chromium.launch_persistent_context(**kwargs)


def wait_until_sheet(page, seconds: int = 300) -> None:
    log("A Chrome window should be visible. Sign in with the Google account that OWNS / can EDIT this sheet.")
    deadline = time.time() + seconds
    while time.time() < deadline:
        url = page.url or ""
        sign_in = page.locator("text=Sign in")
        on_accounts = "accounts.google.com" in url
        sign_in_visible = False
        try:
            sign_in_visible = sign_in.count() > 0 and sign_in.first.is_visible()
        except Exception:
            sign_in_visible = False

        if on_accounts:
            log("Waiting on Google sign-in page...")
        elif sign_in_visible:
            log("Clicking Sign in...")
            try:
                sign_in.first.click(timeout=4000)
            except Exception as exc:
                log(f"Sign in click skipped: {exc}")
        else:
            try:
                page.locator("#docs-file-menu").wait_for(timeout=4000)
                # still view-only if Sign in is in the header
                header_signin = page.locator("#gb a:has-text('Sign in'), #docs-header a:has-text('Sign in'), div:has-text('Sign in')")
                still = False
                try:
                    still = page.get_by_text("Sign in", exact=True).first.is_visible()
                except Exception:
                    still = False
                if still:
                    log("Header still shows Sign in; not an editor session yet.")
                else:
                    log("Signed in. Spreadsheet is ready.")
                    return
            except PwTimeout:
                log("Waiting for the spreadsheet to load...")
        time.sleep(3)
    dump_debug(page, "login-timeout")
    raise SystemExit(
        "Timed out waiting for Google sign-in. In the Chrome window, sign in as the sheet owner, then run this again."
    )


def dump_debug(page, label: str) -> None:
    path = SCREEN.with_name(f"gsheet-{label}.png")
    try:
        page.screenshot(path=str(path), full_page=False)
        log(f"screenshot {path.name}")
    except Exception as exc:
        log(f"screenshot failed: {exc}")
    frames = [(f.name, f.url[:120]) for f in page.frames]
    log(f"frames ({label}): {frames}")


def import_xlsx(page) -> None:
    log("Opening File > Import...")
    page.locator("#docs-file-menu").click()
    page.wait_for_timeout(500)
    page.keyboard.press("ArrowDown")
    page.keyboard.press("ArrowDown")
    page.keyboard.press("ArrowDown")
    page.keyboard.press("Enter")
    log("Sent File menu Down/Down/Down/Enter for Import")
    page.wait_for_timeout(2500)
    dump_debug(page, "import-dialog")

    picker = None
    for frame in page.frames:
        url = frame.url or ""
        if "picker" in url or "filepicker" in url or "docs.google.com/picker" in url:
            picker = frame
            log(f"Using picker frame {url[:120]}")
            break
    target = picker if picker is not None else page

    # Prefer a hidden file input anywhere
    file_input = target.locator('input[type="file"]')
    if file_input.count() == 0:
        file_input = page.locator('input[type="file"]')
    if file_input.count():
        file_input.first.set_input_files(str(XLSX))
        log(f"Attached {XLSX.name} via input[type=file]")
    else:
        # Browse button in picker
        browse = target.get_by_text("Browse", exact=False)
        if browse.count() == 0:
            browse = page.get_by_text("Browse", exact=False)
        if browse.count() == 0:
            raise SystemExit("Could not find the file picker in the Import dialog.")
        with page.expect_file_chooser() as fc:
            browse.first.click()
        fc.value.set_files(str(XLSX))
        log(f"Attached {XLSX.name} via file chooser")

    page.wait_for_timeout(3000)
    dump_debug(page, "after-file")

    for label in ["Replace spreadsheet", "Replace current spreadsheet"]:
        loc = page.get_by_text(label, exact=False)
        if loc.count():
            loc.first.click()
            log(f"Selected: {label}")
            break
        if picker:
            loc = picker.get_by_text(label, exact=False)
            if loc.count():
                loc.first.click()
                log(f"Selected in picker: {label}")
                break

    page.wait_for_timeout(500)
    clicked = False
    for host in (page, picker) if picker is not None else (page,):
        if host is None:
            continue
        for name in ["Import data", "Import", "Open"]:
            btn = host.get_by_role("button", name=name)
            if btn.count():
                btn.last.click()
                clicked = True
                log(f"Clicked {name}")
                break
        if clicked:
            break
    if not clicked:
        page.locator("button:has-text('Import')").last.click()
        log("Clicked Import (css fallback)")

    page.wait_for_timeout(8000)
    try:
        page.locator("text=00 Summary").wait_for(timeout=60_000)
        log("Found tab: 00 Summary")
    except PwTimeout:
        page.wait_for_timeout(15000)
        dump_debug(page, "after-import")
        log(f"Did not see 00 Summary yet. Check {SCREEN.parent}")
        return
    dump_debug(page, "done")
    log("Import finished.")


def main() -> None:
    if not XLSX.exists():
        raise SystemExit(f"Missing {XLSX}")
    log(f"Pushing tracker into {SHEET_URL}")
    with sync_playwright() as p:
        context = launch(p)
        page = context.pages[0] if context.pages else context.new_page()
        login = "https://accounts.google.com/ServiceLogin?hl=en&continue=" + urllib.parse.quote(
            SHEET_URL, safe=""
        )
        log("Opening Google sign-in, then the spreadsheet...")
        page.goto(login, wait_until="domcontentloaded", timeout=120_000)
        wait_until_sheet(page)
        import_xlsx(page)
        log(f"Done. Open: {SHEET_URL}")
        page.wait_for_timeout(3000)
        context.close()


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
    main()
