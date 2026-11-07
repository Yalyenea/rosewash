"""Reload Rosewash through macOS Accessibility, then optionally refresh one tab."""

import hashlib
import subprocess
import sys
import time
from pathlib import Path

import ApplicationServices as AX
import Quartz
from AppKit import NSWorkspace


def applescript(source, *arguments):
    result = subprocess.run(
        ["osascript", "-e", source, *arguments],
        capture_output=True, text=True, timeout=10, check=True,
    )
    return result.stdout.strip()


def attribute(element, name):
    code, value = AX.AXUIElementCopyAttributeValue(element, name, None)
    # Optional attributes and elements replaced during rendering are expected.
    if code in (AX.kAXErrorAttributeUnsupported, AX.kAXErrorNoValue, AX.kAXErrorInvalidUIElement):
        return None
    if code:
        raise RuntimeError(f"Accessibility could not read {name}: {code}")
    return value


def descendants(root):
    pending = [root]
    while pending:
        element = pending.pop()
        yield element
        pending.extend(attribute(element, "AXChildren") or [])


def page_area(application, url):
    pending = list(attribute(application, "AXWindows") or [])
    while pending:
        element = pending.pop()
        if attribute(element, "AXRole") == "AXWebArea":
            if str(attribute(element, "AXURL")) == url:
                return element
            continue  # Never walk unrelated pages or long feeds.
        pending.extend(attribute(element, "AXChildren") or [])


def named(root, role, text):
    label = "AXValue" if role == "AXStaticText" else "AXTitle"
    return next((element for element in descendants(root)
                 if attribute(element, "AXRole") == role and attribute(element, label) == text), None)


def wait_for(operation, message):
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        result = operation()
        if result is not None:
            return result
        time.sleep(0.05)
    raise RuntimeError(message)


def main():
    if not AX.AXIsProcessTrusted():
        raise RuntimeError("Enable Accessibility for the terminal running this command.")
    app = next((app for app in NSWorkspace.sharedWorkspace().runningApplications()
                if app.bundleIdentifier() == "net.imput.helium"), None)
    if app is None:
        raise RuntimeError("Open Helium before reloading Rosewash.")
    refresh_url = sys.argv[1] if len(sys.argv) > 1 else ""
    if refresh_url and not refresh_url.startswith(("http://", "https://")):
        raise ValueError("Pass an HTTP or HTTPS test-page URL.")

    # Chromium derives an unpacked extension's ID from its absolute folder path.
    folder = Path(__file__).resolve().parent.parent.joinpath("dist").resolve(strict=True)
    digest = hashlib.sha256(str(folder).encode()).hexdigest()[:32]
    extension_id = "".join(chr(97 + int(digit, 16)) for digit in digest)
    details_url = f"chrome://extensions/?id={extension_id}"
    application = AX.AXUIElementCreateApplication(app.processIdentifier())
    admin_id = applescript('''
on run argv
  tell application "Helium"
    if (count windows) is 0 then error "Open a Helium window first."
    set adminTab to make new tab at end of tabs of front window with properties {URL:item 1 of argv}
    set active tab index of front window to count tabs of front window
    activate
    return id of adminTab
  end tell
end run
''', details_url)
    try:
        page = wait_for(lambda: page_area(application, details_url), "Extension details did not open.")
        button = wait_for(lambda: named(page, "AXButton", "Reload"),
                          "Rosewash's Reload button was not found. Check that dist/ is loaded.")
        # Chromium's WebUI can acknowledge AXPress without firing Reload.
        # Send a native click at the located button, using its current bounds.
        active_id = applescript('tell application "Helium" to get id of active tab of front window')
        if active_id != admin_id or NSWorkspace.sharedWorkspace().frontmostApplication().processIdentifier() != app.processIdentifier():
            raise RuntimeError("Helium changed focus or tabs; retry the reload.")
        position_ok, position = AX.AXValueGetValue(attribute(button, "AXPosition"), AX.kAXValueCGPointType, None)
        size_ok, size = AX.AXValueGetValue(attribute(button, "AXSize"), AX.kAXValueCGSizeType, None)
        if not position_ok or not size_ok:
            raise RuntimeError("Could not read the Reload button's bounds.")
        center = (position.x + size.width / 2, position.y + size.height / 2)
        pointer = Quartz.CGEventGetLocation(Quartz.CGEventCreate(None))
        for event_type in (Quartz.kCGEventLeftMouseDown, Quartz.kCGEventLeftMouseUp):
            event = Quartz.CGEventCreateMouseEvent(None, event_type, center, Quartz.kCGMouseButtonLeft)
            Quartz.CGEventPost(Quartz.kCGHIDEventTap, event)
        # Reloading can replace the WebArea itself, invalidating its AX handle.
        def confirmation():
            current = page_area(application, details_url)
            return named(current, "AXStaticText", "Reloaded") if current is not None else None

        wait_for(confirmation,
                 "Helium did not confirm the extension reload.")
        event = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventMouseMoved, pointer, Quartz.kCGMouseButtonLeft)
        Quartz.CGEventPost(Quartz.kCGHIDEventTap, event)
    finally:
        applescript('''
on run argv
  tell application "Helium"
    repeat with browserWindow in windows
      set matches to tabs of browserWindow whose id is item 1 of argv
      if (count matches) > 0 then
        close item 1 of matches
        exit repeat
      end if
    end repeat
  end tell
end run
''', admin_id)
    if refresh_url:
        applescript('''
on run argv
  tell application "Helium"
    repeat with browserWindow in windows
      repeat with tabIndex from (count tabs of browserWindow) to 1 by -1
        set testTab to tab tabIndex of browserWindow
        if URL of testTab is item 1 of argv then
          reload testTab
          set active tab index of browserWindow to tabIndex
          return
        end if
      end repeat
    end repeat
    error "Extension reloaded, but the requested test page is not open."
  end tell
end run
''', refresh_url)
    print(f"Reloaded Rosewash ({extension_id})")
    if refresh_url:
        print(f"Refreshed {refresh_url}")


if __name__ == "__main__":
    started = time.monotonic()
    try:
        main()
        print(f"Completed in {time.monotonic() - started:.1f}s")
    except (RuntimeError, ValueError, subprocess.SubprocessError) as error:
        print(getattr(error, "stderr", None) or str(error), file=sys.stderr)
        sys.exit(1)
